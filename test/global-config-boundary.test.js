const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');

const root = join(__dirname, '..');
const syncSource = readFileSync(join(root, 'global-config-sync.js'), 'utf8');

test('global config sync does not patch Storage', () => {
  assert.doesNotMatch(syncSource, /Storage\.prototype/);
  assert.match(syncSource, /localChanged/);
  assert.match(syncSource, /localRemoved/);
});

test('global config owners notify explicit persistence boundaries', () => {
  const expectations = {
    'content-center-core.js': ['localChanged(COPY_KEY, state)', 'localChanged(QUOTE_KEY, state)'],
    'site-brand.js': ['localChanged(KEY, state)', 'localRemoved(KEY)'],
    'nav-order.js': ['localChanged(KEY, state)', 'localRemoved(KEY)'],
  };
  for (const [file, calls] of Object.entries(expectations)) {
    const source = readFileSync(join(root, file), 'utf8');
    for (const call of calls) assert.ok(source.includes(call), `${file} is missing ${call}`);
  }
});
