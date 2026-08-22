const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');

const root = join(__dirname, '..');
const insightSource = readFileSync(join(root, 'home-month-insight-v2.js'), 'utf8');

test('monthly insight observes the explicit application save event', () => {
  assert.doesNotMatch(insightSource, /Storage\.prototype/);
  assert.match(insightSource, /addEventListener\('movie-collection:data-saved', queueRender\)/);
});

test('active application save paths publish the data saved event', () => {
  for (const file of ['index.html', 'watch-record-edit-v1.js']) {
    const source = readFileSync(join(root, file), 'utf8');
    assert.match(
      source,
      /localStorage\.setItem\([^\n]+\);\s*window\.dispatchEvent\(new CustomEvent\('movie-collection:data-saved'\)\)/,
      `${file} must publish the save event after persistence`,
    );
  }
});
