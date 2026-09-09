import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({ window:{} });
vm.runInContext(readFileSync('score-cache-policy-v1.js', 'utf8'), context);
const policy = context.window.CineverseScoreCachePolicy;
const cache = {};
const now = 1_000_000;

policy.writeSuccess(cache, 'movie:1', 8.4, now, 100);
assert.deepEqual(policy.read(cache, 'movie:1', now + 50).kind, 'success');
assert.equal(policy.read(cache, 'movie:1', now + 50).score, 8.4);

policy.writeEmpty(cache, 'movie:2', now, 100);
assert.equal(policy.read(cache, 'movie:2', now + 50).kind, 'empty');
assert.equal(policy.read(cache, 'movie:2', now + 101).kind, 'miss');

cache['movie:legacy-null'] = { score:null, expiresAt:now + 1000 };
assert.equal(policy.read(cache, 'movie:legacy-null', now).kind, 'miss', 'legacy null must be revalidated');

policy.writeFailure(cache, 'movie:3', now, 30);
assert.equal(policy.read(cache, 'movie:3', now + 10).kind, 'backoff');
assert.equal(policy.read(cache, 'movie:3', now + 31).kind, 'miss');

policy.writeFailure(cache, 'movie:1', now + 10, 30);
assert.equal(cache['movie:1'].status, 'success', 'failure must not replace valid success');

console.log('Score cache policy tests passed.');
