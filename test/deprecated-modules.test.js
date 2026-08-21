const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');

const root = join(__dirname, '..');

test('superseded runtime implementations stay removed', () => {
  for (const file of [
    'cloud-auth.js',
    'global-tmdb-search-v1.js',
    'radar-experience-v2.js',
    'rating-sync-v2.js',
    'library-filter-experience-v1.js',
    'library-filter-controls-v3.js',
    'library-filter-experience-v2.js',
    'library-display-experience-v1.js',
  ]) {
    assert.equal(existsSync(join(root, file)), false, `${file} must not return to the runtime`);
  }
});

test('runtime manifest retains each active replacement', () => {
  const runtime = readFileSync(join(root, 'content-center-runtime-v1.js'), 'utf8');
  for (const file of [
    'cloud-auth-v5.js',
    'global-tmdb-search-v2.js',
    'radar-experience-v3.js',
    'rating-sync-v3.js',
    'library-filter-system-v1.js',
  ]) {
    assert.ok(runtime.includes(`'${file}`), `Missing active replacement: ${file}`);
  }
});
