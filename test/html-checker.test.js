const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { join } = require('node:path');
const test = require('node:test');

const root = join(__dirname, '..');

test('HTML checker validates entry resources and static IDs', () => {
  const output = execFileSync(process.execPath, ['scripts/check-html.js'], {
    cwd: root,
    encoding:'utf8',
  });
  assert.match(output, /Checked 3 HTML entry files\./);
});
