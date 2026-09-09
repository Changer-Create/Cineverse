const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '../..');
const BASE = 'http://127.0.0.1:8765';
let server;
let browser;

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
  await page.addInitScript(() => {
    let authListener;
    let resolveUpsert;
    const uploads = [];
    const user = { id: 'user-a', email: 'a@example.com' };
    const chain = {
      select() { return this; },
      eq() { return this; },
      maybeSingle: async () => ({ data: { updated_at: '2026-09-09T00:00:00.000Z' }, error: null }),
      upsert(payload) {
        uploads.push(payload);
        return new Promise(resolve => { resolveUpsert = () => resolve({ error: null }); });
      }
    };
    window.__cloudTest = { uploads, release() { resolveUpsert?.(); }, switchUser() { authListener?.('SIGNED_IN', { user: { id: 'user-b', email: 'b@example.com' } }); } };
    window.supabase = {
      createClient() { return {
        from() { return chain; },
        auth: {
          getSession: async () => ({ data: { session: { user } } }),
          onAuthStateChange(callback) { authListener = callback; return { data: { subscription: { unsubscribe() {} } } }; },
          signOut: async () => ({ error: null })
        }
      }; }
    };
  });
  await page.goto(`${BASE}/index.html#home`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await page.evaluate(() => localStorage.setItem('movie-collection-v2', JSON.stringify({ movies: [{ id: 'm1', info: { title: '评分 1' } }] })));
  const first = page.evaluate(() => window.MovieCloudAccount.sync({ force: true, silent: true }));
  await page.waitForFunction(() => window.__cloudTest.uploads.length === 1);
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('movie-collection-v2'));
    state.movies[0].info.title = '评分 2';
    localStorage.setItem('movie-collection-v2', JSON.stringify(state));
  });
  await page.evaluate(() => window.__cloudTest.release());
  await first;
  await page.waitForFunction(() => window.__cloudTest.uploads.length === 2, null, { timeout: 5000 });
  const secondPayload = await page.evaluate(() => window.__cloudTest.uploads[1].data_json.movies[0].info.title);
  if (secondPayload !== '评分 2') throw new Error(`latest edit was not uploaded: ${secondPayload}`);
  await page.evaluate(() => window.__cloudTest.release());
  await wait(200);
  const third = page.evaluate(() => window.MovieCloudAccount.sync({ force: true, silent: true }));
  await page.waitForFunction(() => window.__cloudTest.uploads.length === 3);
  await page.evaluate(() => window.__cloudTest.switchUser());
  await page.evaluate(() => window.__cloudTest.release());
  await third;
  const ownerAfterSwitch = await page.evaluate(() => localStorage.getItem('movie-cloud-owner-v1'));
  if (ownerAfterSwitch !== 'user-a') throw new Error('stale account request changed the active owner marker');
  console.log('Cloud sync revision regression passed: latest edit queued after in-flight upload.');
}

main().catch(error => { console.error(error.stack || error); process.exitCode = 1; })
  .finally(async () => { try { await browser?.close(); } catch {} try { server?.kill('SIGTERM'); } catch {} });
