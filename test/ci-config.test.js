const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');

const root = join(__dirname, '..');

test('CI runs the same local check command with read-only permissions', () => {
  const workflow = readFileSync(join(root, '.github/workflows/check.yml'), 'utf8');

  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /branches: \[main\]/);
  assert.match(workflow, /contents: read/);
  assert.match(workflow, /node-version: 20/);
  assert.match(workflow, /run: npm run check/);
  assert.doesNotMatch(workflow, /pull-requests: write|contents: write/);
});
