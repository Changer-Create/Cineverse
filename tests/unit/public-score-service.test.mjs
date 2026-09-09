import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const storage = new Map();
const context = vm.createContext({
  window: {
    CineverseScoreCachePolicy: null,
    CineverseDomain: { publicScore: () => 7.7 },
    CineversePublicConfig: { tmdbProxyUrl:'https://proxy.test' },
    fetch: async () => ({ ok:true, json:async()=>({ vote_average:8.8 }) })
  },
  localStorage: {
    getItem: key => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, value)
  },
  AbortController,
  setTimeout,
  clearTimeout
});
vm.runInContext(readFileSync('score-cache-policy-v1.js','utf8'), context);
vm.runInContext(readFileSync('public-score-service-v1.js','utf8'), context);
const service = context.window.CineversePublicScoreService;
const movie = { mediaType:'movie', info:{ tmdbId:42, tmdbVoteAverage:null } };

assert.equal(service.read(movie), 7.7);
const [one,two] = await Promise.all([service.fetch(movie), service.fetch(movie)]);
assert.equal(one, 8.8);
assert.equal(two, 8.8);
assert.equal(service.read(movie), 8.8);
console.log('Public score service tests passed.');
