const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');

const root = join(__dirname, '..');

test('runtime reference checker finds no dangling or removed resources', () => {
  const output = execFileSync(process.execPath, ['scripts/check-runtime-references.js'], { cwd:root, encoding:'utf8' });
  assert.match(output, /^Checked \d+ runtime references across \d+ production files\./);
});

test('repository check includes the runtime reference audit', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.match(pkg.scripts.check, /npm run check:references/);
});
