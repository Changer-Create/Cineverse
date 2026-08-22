import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({ window:{} });
vm.runInContext(readFileSync('app-library-model-v1.js', 'utf8'), context);

const model = context.window.CineverseLibrary;
assert.equal(typeof model.filterMovies, 'function');
assert.equal(typeof model.paginate, 'function');

const collectExternalDetail = () => 'collected';
const integrated = model.extend({ collectExternalDetail });

assert.equal(integrated.filterMovies, model.filterMovies, 'runtime integration must preserve filtering');
assert.equal(integrated.paginate, model.paginate, 'runtime integration must preserve pagination');
assert.equal(integrated.collectExternalDetail(), 'collected');
assert.ok(Object.isFrozen(integrated));

console.log('Library model integration tests passed.');
