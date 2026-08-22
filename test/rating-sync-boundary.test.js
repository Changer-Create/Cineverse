const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = join(__dirname, '..');
const ratingSource = readFileSync(join(root, 'rating-sync-v3.js'), 'utf8');
const indexSource = readFileSync(join(root, 'index.html'), 'utf8');

test('rating synchronization no longer replaces JSON.stringify', () => {
  assert.doesNotMatch(ratingSource, /JSON\.stringify\s*=/);
  assert.match(ratingSource, /window\.MovieRatingSync = Object\.freeze/);
});

test('application save invokes rating synchronization at its persistence boundary', () => {
  const saveFunction = indexSource.match(/function save\(\)\{[^\n]+\}/)?.[0] || '';
  assert.match(saveFunction, /MovieRatingSync\?\.syncState\(appState\)/);
  assert.ok(
    saveFunction.indexOf('MovieRatingSync') < saveFunction.indexOf('localStorage.setItem'),
    'ratings must synchronize before serialization',
  );
});

test('rating boundary synchronizes from latest watch without changing JSON', () => {
  const previous = {
    movies: [{ id:'movie-1', personal:{ rating:4 }, watchHistory:[{ date:'2026-01-01', rating:4 }] }],
  };
  const storage = new Map([['movie-collection-v2', JSON.stringify(previous)]]);
  const context = {
    window: { addEventListener() {} },
    location: { pathname:'/index.html', hash:'', reload() {} },
    localStorage: {
      getItem:key => storage.get(key) || null,
      setItem:(key,value) => storage.set(key,value),
    },
    document: {
      readyState:'loading',
      addEventListener() {},
      getElementById() { return null; },
    },
    Event,
    JSON,
    Map,
    Object,
    Number,
    String,
    queueMicrotask,
    setTimeout() {},
  };
  const originalStringify = JSON.stringify;
  vm.runInNewContext(ratingSource, context, { filename:'rating-sync-v3.js' });
  const state = {
    movies: [{ id:'movie-1', personal:{ rating:4 }, watchHistory:[
      { date:'2026-01-01', rating:4 },
      { date:'2026-02-01', rating:8 },
    ] }],
  };

  assert.equal(context.window.MovieRatingSync.syncState(state), true);
  assert.equal(state.movies[0].personal.rating, 8);
  assert.equal(JSON.stringify, originalStringify);
});
