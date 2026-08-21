const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = join(__dirname, '..');
const pendingSource = readFileSync(join(root, 'cloud-pending-volatile-v1.js'), 'utf8');
const authSource = readFileSync(join(root, 'cloud-auth-v5.js'), 'utf8');

test('pending cloud payloads use an explicit tab-local store', () => {
  const removed = [];
  const context = {
    window:{},
    location:{ pathname:'/index.html' },
    localStorage:{ removeItem:key => removed.push(key) },
  };
  vm.runInNewContext(pendingSource, context, { filename:'cloud-pending-volatile-v1.js' });

  assert.deepEqual(removed, ['movie-cloud-pending-v1']);
  assert.equal(context.window.MovieCloudPending.get(), null);
  context.window.MovieCloudPending.set('payload');
  assert.equal(context.window.MovieCloudPending.get(), 'payload');
  context.window.MovieCloudPending.remove();
  assert.equal(context.window.MovieCloudPending.get(), null);
});

test('pending store does not patch Storage and cloud auth uses the boundary', () => {
  assert.doesNotMatch(pendingSource, /Storage\.prototype/);
  assert.doesNotMatch(authSource, /localStorage\.(?:getItem|setItem|removeItem)\(PENDING_KEY/);
  assert.match(authSource, /pendingStore\?\.set/);
  assert.match(authSource, /pendingStore\?\.remove/);
});
