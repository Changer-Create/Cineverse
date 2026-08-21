const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { join } = require('node:path');
const test = require('node:test');

const root = join(__dirname, '..');

test('syntax checker covers application, script, and test directories', () => {
  const output = execFileSync(process.execPath, ['scripts/check-syntax.js'], {
    cwd: root,
    encoding: 'utf8',
  });
  const trackedCount = execFileSync('git', ['ls-files', '*.js'], {
    cwd: root,
    encoding: 'utf8',
  }).trim().split(/\r?\n/).filter(Boolean).length;

  assert.match(output, new RegExp(`Syntax checked ${trackedCount} tracked JavaScript files\\.`));
  assert.ok(trackedCount > 61, 'nested JavaScript files must be included');
});
