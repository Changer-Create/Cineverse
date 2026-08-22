import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const page = () => ({
  classList:{ toggle() {} }
});
const listeners = new Map();
const context = vm.createContext({
  location:{ hash:'#home' },
  document:{ querySelectorAll:() => [] },
  window:{
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type) { listeners.delete(type); }
  }
});
vm.runInContext(readFileSync('app-router-v1.js', 'utf8'), context);

const entered = [];
const router = context.window.CineverseRouter.createRouter({
  pages:{
    home:{ element:page(), enter:() => entered.push('home') },
    library:{ element:page(), enter:() => entered.push('library') },
    detail:{ element:page(), enter:() => entered.push('detail') }
  },
  detail:{ enter:id => id === 'known', fallback:'library' },
  passthrough:['external-preview/', route => route.startsWith('radar-preview/')]
});

assert.equal(router.routeHash('#external-preview/search/movie/42'), false);
assert.equal(context.location.hash, '#home', 'owned routes must not be rewritten');
assert.deepEqual(entered, [], 'owned routes must not change the visible page');

assert.equal(router.routeHash('#radar-preview/42'), false);
assert.deepEqual(entered, []);

assert.equal(router.routeHash('#detail/known'), true);
assert.equal(entered.at(-1), 'detail');

assert.equal(router.routeHash('#detail/missing'), true);
assert.equal(entered.at(-1), 'library');
assert.equal(context.location.hash, 'library');

console.log('Router ownership tests passed.');
