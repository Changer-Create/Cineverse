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

async function openScenario() {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    timezoneId: 'Asia/Shanghai',
    serviceWorkers: 'block'
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    const A = { id: 'user-a', email: 'a@example.com' };
    const requests = { meta: {}, row: {} };
    const uploads = [];
    let authListener;
    const pending = new Map();
    const keyFor = (kind, userId) => `${kind}:${userId}`;
    const hold = (kind, userId) => new Promise(resolve => {
      pending.set(keyFor(kind, userId), resolve);
      requests[kind][userId] = (requests[kind][userId] || 0) + 1;
    });
    const release = (kind, userId, value) => {
      const resolve = pending.get(keyFor(kind, userId));
      if (!resolve) throw new Error(`no pending ${kind} request for ${userId}`);
      pending.delete(keyFor(kind, userId));
      resolve({ data: value, error: null });
    };
    window.__cloudIsolation = {
      requests,
      uploads,
      releaseMeta(userId, value) { release('meta', userId, value); },
      releaseRow(userId, value) { release('row', userId, value); },
      switchUser(userId) {
        authListener?.('SIGNED_IN', { user: { id: userId, email: `${userId}@example.com` } });
      },
      snapshot() {
        return {
          owner: localStorage.getItem('movie-cloud-owner-v1'),
          baseline: localStorage.getItem('movie-cloud-baseline-fingerprint-v1'),
          dirty: localStorage.getItem('movie-cloud-dirty-v1'),
          pending: localStorage.getItem('movie-cloud-pending-v1')
        };
      }
    };
    window.supabase = {
      createClient() {
        return {
          from() {
            let columns = '';
            let userId = '';
            return {
              select(value) { columns = value; return this; },
              eq(_key, value) { userId = value; return this; },
              maybeSingle: () => hold(columns === 'updated_at' ? 'meta' : 'row', userId),
              upsert(payload) {
                uploads.push(payload);
                return Promise.resolve({ error: null });
              }
            };
          },
          auth: {
            getSession: async () => ({ data: { session: { user: A } } }),
            onAuthStateChange(callback) {
              authListener = callback;
              return { data: { subscription: { unsubscribe() {} } } };
            },
            signOut: async () => ({ error: null })
          }
        };
      }
    };
    localStorage.setItem('movie-collection-v2', JSON.stringify({
      movies: [{ id: 'movie-a', info: { title: 'A 的本地影片' } }]
    }));
  });
  await page.goto(`${BASE}/index.html#home`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__cloudIsolation.requests.meta['user-a'] === 1);
  return { page, context };
}

async function metadataSwitchScenario() {
  const { page, context } = await openScenario();
  try {
    await page.evaluate(() => window.__cloudIsolation.switchUser('user-b'));
    await page.waitForFunction(() => window.__cloudIsolation.requests.meta['user-b'] === 1);
    await page.evaluate(() => window.__cloudIsolation.releaseMeta('user-b', { updated_at: '2026-09-10T00:00:00.000Z' }));
    await page.waitForFunction(() => window.__cloudIsolation.requests.row['user-b'] === 1);
    await page.evaluate(() => window.__cloudIsolation.releaseMeta('user-a', null));
    await page.waitForTimeout(120);
    const uploads = await page.evaluate(() => window.__cloudIsolation.uploads.slice());
    if (uploads.some(payload => payload.user_id === 'user-b' && payload.data_json?.movies?.[0]?.id === 'movie-a')) {
      throw new Error('stale A metadata response uploaded A data with B user_id');
    }
  } finally {
    await context.close();
  }
}

async function fullRowSwitchScenario() {
  const { page, context } = await openScenario();
  try {
    await page.evaluate(() => window.__cloudIsolation.releaseMeta('user-a', { updated_at: '2026-09-10T00:00:00.000Z' }));
    await page.waitForFunction(() => window.__cloudIsolation.requests.row['user-a'] === 1);
    await page.evaluate(() => window.__cloudIsolation.switchUser('user-b'));
    await page.waitForFunction(() => window.__cloudIsolation.requests.meta['user-b'] === 1);
    await page.evaluate(() => window.__cloudIsolation.releaseMeta('user-b', { updated_at: '2026-09-10T00:01:00.000Z' }));
    await page.waitForFunction(() => window.__cloudIsolation.requests.row['user-b'] === 1);
    await page.evaluate(() => window.__cloudIsolation.releaseRow('user-b', {
      movies: [{ id: 'movie-b', info: { title: 'B 的云端影片' } }]
    }));
    await page.waitForTimeout(80);
    const before = await page.evaluate(() => window.__cloudIsolation.snapshot());
    await page.evaluate(() => window.__cloudIsolation.releaseRow('user-a', {
      movies: [{ id: 'movie-a-cloud', info: { title: 'A 的云端影片' } }]
    }));
    await page.waitForTimeout(120);
    const after = await page.evaluate(() => window.__cloudIsolation.snapshot());
    const pending = JSON.parse(after.pending || '{}');
    if (pending.userId !== 'user-b' || pending.data_json?.movies?.[0]?.id !== 'movie-b') {
      throw new Error(`stale A row polluted B pending state: before=${JSON.stringify(before)} after=${JSON.stringify(after)}`);
    }
    if (after.owner !== before.owner || after.baseline !== before.baseline || after.dirty !== before.dirty) {
      throw new Error(`stale A row changed B persistence markers: before=${JSON.stringify(before)} after=${JSON.stringify(after)}`);
    }
  } finally {
    await context.close();
  }
}

async function main() {
  server = spawn('python3', ['-m', 'http.server', '8765', '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  await metadataSwitchScenario();
  await fullRowSwitchScenario();
  console.log('Account context isolation regression passed.');
}

main().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
}).finally(async () => {
  try { await browser?.close(); } catch {}
  try { server?.kill('SIGTERM'); } catch {}
});
