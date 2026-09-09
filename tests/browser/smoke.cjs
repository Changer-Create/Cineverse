const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '../..');
const BASE = 'http://127.0.0.1:8765';
const ARTIFACTS = path.join(ROOT, 'browser-artifacts');
const fixture = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixtures/app-state-v2.json'), 'utf8'));
const report = { commit: process.env.GITHUB_SHA || '', browser: '', viewport: {}, pageErrors: [], consoleErrors: [], localHttpErrors: [], checks: [] };
let server;
let browser;

function check(name, condition, detail = '') {
  report.checks.push({ name, ok: Boolean(condition), detail });
  if (!condition) throw new Error(`${name}: ${detail}`);
}

function fixedDateInitScript() {
  return `(() => {
    const RealDate = Date;
    const fixed = RealDate.parse('2026-09-09T08:00:00+08:00');
    class FixedDate extends RealDate {
      constructor(...args) { super(...(args.length ? args : [fixed])); }
      static now() { return fixed; }
    }
    window.Date = FixedDate;
  })();`;
}

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${BASE}/index.html`);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('local server did not become ready on 127.0.0.1:8765');
}

async function main() {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  server = spawn('python3', ['-m', 'http.server', '8765', '--bind', '127.0.0.1'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  const serverLog = [];
  server.stdout.on('data', chunk => serverLog.push(String(chunk)));
  server.stderr.on('data', chunk => serverLog.push(String(chunk)));
  await waitForServer();

  browser = await chromium.launch({ headless: true });
  report.browser = browser.version();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'Asia/Shanghai', serviceWorkers: 'block' });
  report.viewport = { width: 1440, height: 900 };
  await context.addInitScript({ content: fixedDateInitScript() });
  const page = await context.newPage();
  page.on('pageerror', error => report.pageErrors.push(String(error?.stack || error)));
  page.on('console', message => {
    if (['error', 'warning'].includes(message.type())) report.consoleErrors.push(message.text());
  });
  page.on('response', response => {
    try {
      const url = new URL(response.url());
      if (url.origin === BASE && response.status() >= 400 && url.pathname !== '/favicon.ico') {
        report.localHttpErrors.push(`${response.status()} ${url.pathname}`);
      }
    } catch {}
  });
  await page.route('**/functions/v1/tmdb-proxy', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: [], total_results: 0 }) }));
  await page.route('**/rest/v1/global_site_config**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));

  await page.goto(`${BASE}/index.html#home`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(state => {
    localStorage.clear();
    localStorage.setItem('movie-collection-v2', JSON.stringify(state));
  }, fixture);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);

  check('page identity is Cineverse', (await page.title()) === '光影宇宙', await page.title());
  check('home contains meaningful app content', (await page.locator('#homeView').innerText()).includes('晚上好'));
  check('no local resource failures', report.localHttpErrors.length === 0, report.localHttpErrors.join('\n'));
  check('no uncaught page errors', report.pageErrors.length === 0, report.pageErrors.join('\n'));
  check('no relevant console errors', report.consoleErrors.length === 0, report.consoleErrors.join('\n'));

  const homeRadarCount = await page.locator('#radarGrid .movie-card').count();
  check('home radar is capped at four cards', homeRadarCount === 4, `found ${homeRadarCount}`);
  const recentText = await page.locator('#recentGrid').innerText();
  check('recent view shows cached public score', recentText.includes('★ 8.6'), recentText);
  check('recent view shows dash for missing public score', recentText.includes('—'), recentText);

  await page.goto(`${BASE}/index.html#settings`, { waitUntil: 'domcontentloaded' });
  for (const theme of ['nebula', 'forest', 'snow', 'ocean']) {
    await page.locator(`[data-theme-preset="${theme}"]`).click();
    check(`theme ${theme} applies immediately`, await page.evaluate(value => document.body.dataset.uiTheme === (value === 'nebula' ? 'star' : value), theme));
    check(`theme ${theme} persists immediately`, await page.evaluate(value => JSON.parse(localStorage.getItem('movie-collection-v2')).settings.themePreset === value, theme));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(250);
    check(`theme ${theme} survives refresh`, await page.evaluate(value => JSON.parse(localStorage.getItem('movie-collection-v2')).settings.themePreset === value, theme));
  }

  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto(`${BASE}/index.html#plan`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  const calendar = page.locator('#planCalendar');
  const calendarMetrics = await calendar.evaluate(node => ({ clientHeight: node.clientHeight, scrollHeight: node.scrollHeight, rows: node.querySelectorAll('.plan-day').length }));
  check('calendar keeps seven columns and month rows', calendarMetrics.rows >= 28, JSON.stringify(calendarMetrics));
  check('calendar has an independently scrollable dense list', calendarMetrics.scrollHeight > calendarMetrics.clientHeight, JSON.stringify(calendarMetrics));
  const scrollTarget = await calendar.evaluate(node => {
    let current = node;
    while (current && current !== document.body) {
      if (current.scrollHeight > current.clientHeight && getComputedStyle(current).overflowY !== 'visible') return current;
      current = current.parentElement;
    }
    return null;
  });
  check('calendar exposes an internal scroll container', Boolean(scrollTarget));
  const scrollTop = await page.evaluate(() => {
    const calendar = document.querySelector('#planCalendar');
    let current = calendar;
    while (current && current !== document.body) {
      if (current.scrollHeight > current.clientHeight && getComputedStyle(current).overflowY !== 'visible') {
        current.scrollTop = Math.min(64, current.scrollHeight);
        return current.scrollTop;
      }
      current = current.parentElement;
    }
    return 0;
  });
  check('calendar internal scrollTop is mutable', scrollTop > 0, String(scrollTop));
  await page.locator('#planListBtn').click();
  check('calendar/list switch shows list panel', await page.locator('#planListPanel').isVisible());
  check('calendar/list switch hides calendar panel', !(await page.locator('#planCalendarWrap').isVisible()));

  for (const viewport of [{ width: 1024, height: 768 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto(`${BASE}/index.html#library`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(350);
    if (viewport.width === 1024) {
      await page.locator('#favoriteFilterBtn').click();
      check('library star filter button narrows to starred items', await page.locator('#libraryGrid .lib-card').count() === 1);
      await page.locator('#clearLibFilters').click();
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(`${viewport.width}px library has no horizontal overflow`, overflow <= 0, String(overflow));
    await page.screenshot({ path: path.join(ARTIFACTS, `library-${viewport.width}.png`), fullPage: false });
  }

  await page.screenshot({ path: path.join(ARTIFACTS, 'home-1440.png'), fullPage: false });
  fs.writeFileSync(path.join(ARTIFACTS, 'server.log'), serverLog.join(''));
  fs.writeFileSync(path.join(ARTIFACTS, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch(error => {
  report.fatal = String(error?.stack || error);
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  fs.writeFileSync(path.join(ARTIFACTS, 'report.json'), JSON.stringify(report, null, 2));
  console.error(report.fatal);
  process.exitCode = 1;
}).finally(async () => {
  try { await browser?.close(); } catch {}
  try { server?.kill('SIGTERM'); } catch {}
});
