import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const context = vm.createContext({window:{}, Date});
vm.runInContext(readFileSync('app-domain-model-v1.js','utf8'),context);
const score = context.window.CineverseDomain.publicScore;
const movie = {info:{tmdbId:123},mediaType:'movie'};
const cache = {'movie:123':{score:8.3,expiresAt:200},'tv:123':{score:7.1,expiresAt:200}};
assert.equal(score(movie,cache,100),8.3);
assert.equal(score({...movie,mediaType:'tv'},cache,100),7.1);
assert.equal(score(movie,cache,201),null);
assert.equal(score({...movie,radar:{publicReputation:9}},cache,100),8.3);
assert.equal(score({...movie,info:{tmdbId:123,tmdbVoteAverage:7.8,tmdbScoreSourceKey:'movie:123'}}),7.8);
assert.equal(score({info:{tmdbVoteAverage:7.8,tmdbScoreSourceKey:'movie:123'}}),null);
assert.equal(score({...movie, info:{tmdbId:123,tmdbVoteAverage:9}}, {'movie:123':{status:'empty',expiresAt:200}},100),null);
for (const invalid of [null,undefined,'',0,-1,'bad',Infinity,11]) {
 assert.equal(score({radar:{publicReputation:invalid}}),null);
}
assert.equal(score({info:{tmdbId:0}},cache,100),null);
assert.equal(score(movie,{'movie:123':{score:null,expiresAt:200}},100),null);
console.log('Public score source tests passed.');

assert.equal(score({...movie,info:{tmdbId:123,tmdbVoteAverage:9}}),null,'unkeyed fields are unverified');
assert.equal(score({...movie,info:{tmdbId:124,tmdbVoteAverage:9,tmdbScoreSourceKey:'movie:123'}}),null);
assert.equal(score({...movie,mediaType:'tv',info:{tmdbId:123,tmdbVoteAverage:9,tmdbScoreSourceKey:'movie:123'}}),null);
