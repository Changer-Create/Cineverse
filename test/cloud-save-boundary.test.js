const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');

const root = join(__dirname, '..');
const authSource = readFileSync(join(root, 'cloud-auth-v5.js'), 'utf8');

test('cloud auth no longer patches Storage to observe application saves', () => {
  assert.doesNotMatch(authSource, /Storage\.prototype/);
  assert.doesNotMatch(authSource, /installStorageHook/);
  assert.match(authSource, /markLocalChange:queueUpload/);
});

test('active application save paths mark cloud data dirty explicitly', () => {
  for (const file of ['index.html', 'watch-record-edit-v1.js']) {
    const source = readFileSync(join(root, file), 'utf8');
    const saveAt = source.indexOf('localStorage.setItem(');
    const notifyAt = source.indexOf('window.MovieCloudAccount?.markLocalChange()', saveAt);
    assert.ok(saveAt >= 0 && notifyAt > saveAt, `${file} must notify cloud sync after saving`);
  }
});
