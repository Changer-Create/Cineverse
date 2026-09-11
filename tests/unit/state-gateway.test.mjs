import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const values = new Map();
const localStorage = {
  getItem:key => values.has(key) ? values.get(key) : null,
  setItem:(key, value) => values.set(key, String(value))
};
const context = vm.createContext({
  window:{},
  localStorage,
  structuredClone,
  crypto:{ randomUUID:() => 'test-id' },
  Date,
  Blob
});

for (const file of ['app-constants-v1.js', 'app-core-utils-v1.js', 'app-state-storage-v1.js']) {
  vm.runInContext(readFileSync(file, 'utf8'), context);
}

const State = context.window.CineverseState;
assert.equal(typeof State.createGateway, 'function');

const initial = State.normalizeState({
  movies:[{ id:'movie-1', info:{ title:'电影一' } }],
  settings:{},
  home:{}
});
const store = State.createStore(initial);
const gateway = State.createGateway(store);

assert.equal(gateway.getContextVersion(), 0);
const guarded = gateway.update(state => {
  state.movies.push(State.normalizeMovie({ id:'stale', info:{ title:'stale' } }));
}, { source:'test-stale', guard:() => false });
assert.equal(guarded.movies.length, 1, 'stale guarded update must not persist');
gateway.replace(gateway.getState(), { silent:true, persist:false, contextReplace:true });
assert.equal(gateway.getContextVersion(), 1, 'context replacement must advance the generation');

const actions = State.createActions(gateway);
assert.equal(actions.setPlan('movie-1', '2026-09-11'), true);
assert.equal(gateway.getState().movies[0].plans[0].plannedDate, '2026-09-11');
const planCount = gateway.getState().movies[0].plans.length;
assert.equal(actions.setPlan('movie-1', '2026-9-11'), false);
assert.equal(gateway.getState().movies[0].plans.length, planCount, 'invalid plan date must not add a plan');

const snapshot = gateway.snapshot();
snapshot.movies.push({ id:'detached' });
assert.equal(gateway.getState().movies.length, 1, 'snapshots must not mutate live state');

const notifications = [];
const unsubscribe = gateway.subscribe(
  state => state.movies.length,
  (count, previous, metadata) => notifications.push({ count, previous, metadata })
);

gateway.update(state => {
  state.movies.push(State.normalizeMovie({ id:'movie-2', info:{ title:'电影二' } }));
}, { source:'test-writer', reason:'add-movie' });

assert.equal(gateway.getState().movies.length, 2);
assert.equal(notifications.length, 1);
assert.equal(notifications[0].count, 2);
assert.equal(notifications[0].previous, 1);
assert.equal(notifications[0].metadata.source, 'test-writer');

gateway.update(state => {
  state.settings.profileName = '新的名称';
}, { source:'test-writer', reason:'settings-only' });
assert.equal(notifications.length, 1, 'selectors must ignore unrelated state changes');

gateway.update(state => {
  state.movies.push(State.normalizeMovie({ id:'movie-3', info:{ title:'电影三' } }));
}, { source:'silent-writer', silent:true });
assert.equal(notifications.length, 1, 'silent writes must remain available for app-owned render flows');

unsubscribe();
gateway.update(state => { state.movies.pop(); }, { source:'test-writer', reason:'after-unsubscribe' });
assert.equal(notifications.length, 1);
assert.match(values.get(State.keys.app), /movie-2/, 'gateway writes must persist through the store');

for (const [file, source] of [
  ['library-card-system-v1.js', 'library-card-system'],
  ['watch-record-edit-v1.js', 'watch-record-edit'],
  ['rating-sync-v3.js', 'rating-sync'],
  ['radar-experience-v3.js', 'radar-experience'],
  ['radar-20.js', 'radar-20'],
  ['cloud-auth-v5.js', 'cloud-auth']
]) {
  const script = readFileSync(file, 'utf8');
  assert.match(script, /window\.CineverseStateGateway/, `${file} must use the shared gateway when available`);
  assert.match(script, new RegExp(`source:'${source}'`), `${file} must identify its write source`);
}

const appMain = readFileSync('app-main-v1.js', 'utf8');
assert.match(appMain, /window\.CineverseStateGateway=stateGateway/);
assert.match(appMain, /stateGateway\.subscribe\(/);

console.log('State Gateway tests passed.');

const ratingRoundTrip = State.normalizeState({ movies:[{id:'rating-source',info:{title:'Public rating',tmdbVoteAverage:8.3}}], settings:{themePreset:'snow'} });
assert.equal(ratingRoundTrip.movies[0].info.tmdbVoteAverage,8.3);
assert.equal(ratingRoundTrip.settings.themePreset,'snow');
