const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = join(__dirname, '..');

function loadSafeHttpUrl(file) {
  const source = readFileSync(join(root, file), 'utf8');
  const match = source.match(/function safeHttpUrl\(value\)\{[^\n]+/);
  assert.ok(match, `Missing safeHttpUrl in ${file}`);
  return { source, safeHttpUrl: vm.runInNewContext(`(${match[0]})`, { URL }) };
}

for (const file of ['index.html', 'content-center-core.js', 'admin-console.html']) {
  test(`${file} accepts only HTTP quote source links`, () => {
    const { safeHttpUrl } = loadSafeHttpUrl(file);
    assert.equal(safeHttpUrl('javascript:alert(1)'), '');
    assert.equal(safeHttpUrl('data:text/html,unsafe'), '');
    assert.equal(safeHttpUrl('/relative'), '');
    assert.equal(safeHttpUrl('https://example.com/source'), 'https://example.com/source');
    assert.equal(safeHttpUrl('http://example.com/source'), 'http://example.com/source');
  });
}

test('quote source renderers use the validated URL', () => {
  const core = readFileSync(join(root, 'content-center-core.js'), 'utf8');
  const index = readFileSync(join(root, 'index.html'), 'utf8');
  const admin = readFileSync(join(root, 'admin-console.html'), 'utf8');
  assert.match(core, /const sourceUrl=safeHttpUrl\(q\.sourceUrl\)/);
  assert.doesNotMatch(core, /window\.open\(q\.sourceUrl/);
  assert.match(index, /const sourceUrl=safeHttpUrl\(q\.sourceUrl\)/);
  assert.doesNotMatch(index, /quoteSourceLink\.href=q\.sourceUrl/);
  assert.match(admin, /const sourceUrl=safeHttpUrl\(x\.sourceUrl\)/);
  assert.doesNotMatch(admin, /href="\$\{escapeHtml\(x\.sourceUrl\)\}"/);
});
