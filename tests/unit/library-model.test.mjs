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

const movies = [
  { id:'fav', mediaType:'movie', info:{ title:'Beta', originalTitle:'', year:2024, directors:['A'], countries:['CN'], runtime:120 }, personal:{ favorite:true, status:'want', rating:8, tags:['x'] }, plans:[{ month:'2026-09', plannedDate:'2026-09-20' }], updatedAt:'2026-09-01' },
  { id:'plain', mediaType:'movie', info:{ title:'Alpha', originalTitle:'', year:2025, directors:['B'], countries:['US'], runtime:90 }, personal:{ favorite:false, status:'watched', rating:9, tags:['y'] }, plans:[{ month:'2026-09', plannedDate:'2026-09-21' }], updatedAt:'2026-09-02' }
];
const displayStatus = movie => [movie.personal.status === 'watched' ? 'watched' : 'want'];
const options = { displayStatus, mediaTypeLabel: () => '电影' };
const originalOrder = movies.map(movie => movie.id);
assert.deepEqual(model.filterMovies(movies, { favoriteOnly:true }, options).map(movie => movie.id), ['fav']);
assert.deepEqual(model.filterMovies(movies, { planDate:'2026-09-21' }, options).map(movie => movie.id), ['plain']);
assert.deepEqual(model.filterMovies(movies, { plan:'2026-09', planDate:'2026-09-21' }, options).map(movie => movie.id), ['plain']);
assert.deepEqual(model.filterMovies(movies, { sort:'年份升序' }, options).map(movie => movie.id), ['fav','plain']);
assert.deepEqual(model.filterMovies(movies, { status:'看过', exclude:{ status:true } }, options).map(movie => movie.id), ['fav']);
assert.deepEqual(model.filterMovies(movies, { sort:'评分', sortDirection:'asc' }, options).map(movie => movie.id), ['fav','plain']);
assert.deepEqual(movies.map(movie => movie.id), originalOrder, 'filtering must not mutate the input array');
const native = [3, 1, 2];
native.sort((a, b) => a - b);
assert.deepEqual(native, [1, 2, 3], 'native Array.sort must remain untouched');
