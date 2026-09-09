import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const values = new Map();
const context = vm.createContext({
  window:{},
  localStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,String(value))},
  structuredClone,
  crypto:{randomUUID:()=> 'test-id'},
  Date,
  Blob
});
for (const file of ['app-constants-v1.js','app-core-utils-v1.js','app-state-storage-v1.js']) {
  vm.runInContext(readFileSync(file,'utf8'), context);
}
const State = context.window.CineverseState;
const initial = State.normalizeState({
  movies:[
    { id:'watched', info:{title:'已观看'}, personal:{status:'watched',want:false,favorite:false}, watchHistory:[{date:'2026-09-01'}] },
    { id:'want', info:{title:'想看'}, personal:{status:'want',want:true,favorite:true}, watchHistory:[] }
  ], settings:{}, home:{}
});
const store=State.createStore(initial);
const gateway=State.createGateway(store);
const actions=State.createActions(gateway);
assert.equal(actions.setFavorite('watched', true), true);
assert.equal(actions.setWanted('watched', true), true);
let state=gateway.getState();
assert.equal(state.movies.find(m=>m.id==='watched').personal.favorite, true);
assert.equal(state.movies.find(m=>m.id==='watched').personal.want, true);
assert.equal(state.movies.find(m=>m.id==='watched').personal.status, 'watched');
assert.equal(state.movies.find(m=>m.id==='want').personal.favorite, true);
assert.equal(actions.setWanted('want', false), true);
state=gateway.getState();
assert.equal(state.movies.find(m=>m.id==='want').personal.status, 'follow');
assert.equal(actions.setFavorite('missing', true), false);
console.log('Favorite and want action tests passed.');
