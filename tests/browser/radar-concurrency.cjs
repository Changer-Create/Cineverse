const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '../..');
const BASE = 'http://127.0.0.1:8765';
const fixture = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixtures/app-state-v2.json'), 'utf8'));
let server;
let browser;
let releaseRequests;

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitForServer() {
  for (let i = 0; i < 40; i += 1) {
    try { if ((await fetch(`${BASE}/index.html`)).ok) return; } catch {}
    await wait(250);
  }
  throw new Error('local server did not become ready');
}

async function main() {
  server = spawn('python3', ['-m', 'http.server', '8765', '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'Asia/Shanghai', serviceWorkers: 'block' });
  const page = await context.newPage();
  let pending = 0;
  let release;
  releaseRequests = new Promise(resolve => { release = resolve; });
  await page.route('**/functions/v1/tmdb-proxy', async route => {
    pending += 1;
    await releaseRequests;
    const results = Array.from({ length: 25 }, (_, i) => ({ id: 81000 + i, title: `异步候选 ${i + 1}`, release_date: '2026-09-10', vote_average: 8.2, vote_count: 2000, genre_ids: [] }));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results, genres: [] }) });
  });
  await page.route('**/rest/v1/global_site_config**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.goto(`${BASE}/index.html#radar`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(state => {
    localStorage.clear();
    localStorage.setItem('movie-collection-v2', JSON.stringify(state));
  }, fixture);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  await page.locator('#radarAutoUpdateBtn').click();
  for (let i = 0; i < 30 && pending === 0; i += 1) await wait(50);
  if (pending === 0) throw new Error('radar generation did not issue a pending TMDb request');

  await page.evaluate(() => {
    window.CineverseStateGateway.update(state => {
      state.settings.themePreset = 'forest';
      state.movies.push({
        id: 'edited-during-radar', mediaType: 'movie',
        info: { title: '请求期间新增影片', originalTitle: '', year: 2026, releaseDate: '2026-09-09', firstAirDate: '', lastAirDate: '', numberOfSeasons: null, numberOfEpisodes: null, tvStatus: '', directors: [], countries: [], runtime: 100, genres: ['剧情'], posterUrl: '', overview: '', tmdbId: null, tmdbVoteAverage: null, doubanId: null },
        personal: { status: 'want', want: true, rating: null, tags: [], shortReview: '', favorite: false },
        watchHistory: [], plans: [], radar: { discovered: false, ignored: false }
      });
    }, { source: 'test', reason: 'edit-during-radar' });
  });
  release();
  await page.waitForTimeout(1200);
  const result = await page.evaluate(() => JSON.parse(localStorage.getItem('movie-collection-v2')));
  if (result.settings.themePreset !== 'forest') throw new Error('theme changed during generation was overwritten');
  if (!result.movies.some(movie => movie.id === 'edited-during-radar')) throw new Error('movie added during generation was overwritten');
  if (!Array.isArray(result.home?.radar) || result.home.radar.length === 0) throw new Error('radar batch was not committed');
  console.log('Radar concurrency regression passed: latest movie/settings survived async generation.');
}

main().catch(error => { console.error(error.stack || error); process.exitCode = 1; })
  .finally(async () => { try { await browser?.close(); } catch {} try { server?.kill('SIGTERM'); } catch {} });
