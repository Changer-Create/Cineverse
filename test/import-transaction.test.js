const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = join(__dirname, '..');
const source = readFileSync(join(root, 'index.html'), 'utf8');
const fixture = JSON.parse(readFileSync(join(root, 'test/fixtures/app-state-v2.json'), 'utf8'));

function transactionHarness(initial) {
  const match = source.match(/function runImportTransaction\(work\)\{[^\n]+/);
  assert.ok(match, 'Missing runImportTransaction');
  const storage = new Map([['movie-collection-v2', JSON.stringify(initial)]]);
  const context = {
    initial,
    storage,
    structuredClone,
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key),
    },
  };
  vm.runInNewContext(`var appState=structuredClone(initial);const V2_KEY='movie-collection-v2';${match[0]};this.run=runImportTransaction;this.state=()=>appState`, context);
  return context;
}

test('anonymous app fixture covers state migration canaries', () => {
  assert.equal(fixture.movies[0].mediaType, 'movie');
  assert.equal(fixture.movies[0].watchHistory.length, 1);
  assert.equal(fixture.movies[0].plans.length, 1);
  assert.deepEqual(Object.keys(fixture.tmdbMatchCenter).sort(), ['paused', 'resumeIds', 'rows']);
});

test('failed imports restore in-memory and persisted state', () => {
  const harness = transactionHarness(fixture);
  assert.throws(() => harness.run(() => {
    harness.state().movies.push({ id: 'partial-import' });
    harness.localStorage.setItem('movie-collection-v2', '{"partial":true}');
    throw new Error('import failed');
  }), /import failed/);
  assert.deepEqual(harness.state(), fixture);
  assert.equal(harness.storage.get('movie-collection-v2'), JSON.stringify(fixture));
});

test('successful imports keep their state and result', () => {
  const harness = transactionHarness(fixture);
  const result = harness.run(() => {
    harness.state().movies.push({ id: 'imported' });
    return 1;
  });
  assert.equal(result, 1);
  assert.equal(harness.state().movies.at(-1).id, 'imported');
});

test('JSON and CSV imports use the transaction boundary', () => {
  assert.match(source, /function importMoviesCsvText\(text\)\{return runImportTransaction\(/);
  assert.match(source, /async function importBackupFile\(file\).*return runImportTransaction\(/);
});
