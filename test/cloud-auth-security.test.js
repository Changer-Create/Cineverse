const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');

const source = readFileSync(join(__dirname, '..', 'cloud-auth-v5.js'), 'utf8');

test('cloud account UI writes remote and error text through textContent', () => {
  assert.match(source, /statusElement\.textContent = status/);
  assert.match(source, /emailElement\.textContent = String\(currentUser\.email/);
  assert.match(source, /stateElement\.textContent = stateText/);
});

test('cloud account templates do not interpolate untrusted display values', () => {
  assert.doesNotMatch(source, /innerHTML\s*=.*\$\{status\}/);
  assert.doesNotMatch(source, /innerHTML\s*=.*\$\{stateText\}/);
  assert.doesNotMatch(source, /innerHTML\s*=.*\$\{String\(currentUser\.email/);
});
