import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

function setup({rows={}, noProxy=false, storageThrows=false, writeThrows=false}={}) {
  const storage = new Map([['movie-tmdb-score-cache-v1', JSON.stringify(rows)]]);
  let now=1_000_000, calls=[];
  class Clock extends Date { static now(){return now;} }
  const context=vm.createContext({window:{CineversePublicConfig:{tmdbProxyUrl:noProxy?'':'https://proxy.test'}},Date:Clock,
    localStorage:{getItem:k=>{if(storageThrows)throw Error('blocked');return storage.get(k)||null;},
      setItem:(k,v)=>{if(storageThrows||writeThrows)throw Error('quota');storage.set(k,v);}},AbortController,setTimeout,clearTimeout});
  for(const file of ['app-domain-model-v1.js','score-cache-policy-v1.js','public-score-service-v1.js'])
    vm.runInContext(readFileSync(file,'utf8'),context);
  const service=context.window.CineversePublicScoreService;
  const movie=(id=42,type='movie')=>({mediaType:type,info:{tmdbId:id,tmdbVoteAverage:9,tmdbScoreSourceKey:`${type}:${id}`},radar:{publicReputation:9.9},personal:{rating:6.2}});
  const response=(data={id:42,vote_average:7.86,vote_count:120},status=200)=>async(url,opts)=>{
    calls.push(JSON.parse(opts.body).path);return {ok:status===200,status,json:async()=>data};
  };
  return {domain:context.window.CineverseDomain,service,movie,response,calls,storage,policy:context.window.CineverseScoreCachePolicy,tick:ms=>{now+=ms;}};
}
test('cold score, concurrent entries, vote metadata, precision, personal fields',async()=>{
  const t=setup(), m=t.movie(), before=JSON.stringify(m);
  let release; const gate=new Promise(r=>{release=r;});
  const fetchImpl=async(...args)=>{await gate;return t.response()(...args);};
  const one=t.service.fetch(m,{fetchImpl}), two=t.service.fetch(m,{fetchImpl});release();
  assert.deepEqual(await Promise.all([one,two]),[7.86,7.86]);
  assert.equal(t.calls.length,1);assert.equal(t.service.display(m).text,'★ 7.9');assert.equal(JSON.stringify(m),before);
  const row=t.service.state(m).row;assert.equal(row.voteCount,120);assert.equal(row.fetchedAt,1_000_000);assert.equal(row.expiresAt-row.fetchedAt,t.policy.SUCCESS_TTL);
});
test('movie and TV keys never share a response; reassociation during fetch',async()=>{
  const t=setup(), m=t.movie(); let resolve;
  const p=t.service.fetch(m,{fetchImpl:()=>new Promise(r=>{resolve=r;})});
  m.info.tmdbId=43;resolve({ok:true,json:async()=>({id:42,vote_average:7.86,vote_count:120})});await p;
  assert.equal(t.service.state(m).kind,'miss');
  await t.service.fetch(t.movie(42,'tv'),{fetchImpl:t.response({id:42,vote_average:6.4,vote_count:3})});
  assert.equal(t.service.read(t.movie()),7.86);assert.equal(t.service.read(t.movie(42,'tv')),6.4);
});
test('verified empty suppresses all old fields and has 24h TTL; explicit refresh',async()=>{
  const t=setup(),m=t.movie();await t.service.fetch(m,{fetchImpl:t.response({id:42,vote_average:0,vote_count:0})});
  assert.equal(t.service.read(m),null);assert.equal(t.service.display(m).text,'暂无评分');assert.equal(t.service.shouldFetch(m),false);
  const row=t.service.state(m).row;assert.equal(row.expiresAt-row.fetchedAt,24*60*60*1000);
  await t.service.refresh(m,{fetchImpl:t.response()});assert.equal(t.service.read(m),7.86);
});
test('malformed details and HTTP failures are errors, never empty; stale success retained',async()=>{
  for(const [data,status] of [[{},200],[{id:43,vote_average:8,vote_count:2},200],
    [{id:42,vote_average:true,vote_count:2},200],[{id:42,vote_average:'',vote_count:2},200],
    [{id:42,vote_average:NaN,vote_count:2},200],[{id:42,vote_average:11,vote_count:2},200],
    [{id:42,vote_average:8,vote_count:-1},200],[{id:42,vote_average:8,vote_count:'2'},200],
    [null,401],[null,403],[null,429],[null,500]]) {
    const t=setup({rows:{'movie:42':{status:'success',score:8.1,expiresAt:999999,fetchedAt:10}}}),m=t.movie();
    await t.service.fetch(m,{fetchImpl:t.response(data,status)});
    assert.equal(t.service.state(m).row.status,'error');assert.equal(t.service.read(m),8.1);
    assert.match(t.service.display(m).title,/缓存/);assert.equal(t.service.shouldFetch(m),false);
    t.tick(30001);assert.equal(t.service.shouldFetch(m),true);
  }
});
test('no proxy, missing type and invalid IDs cannot trigger requests',async()=>{
  const t=setup({noProxy:true});assert.equal(t.service.shouldFetch(t.movie()),false);
  assert.equal(await t.service.fetch(t.movie(),{fetchImpl:t.response()}),9);assert.equal(t.calls.length,0);
  for(const id of [true,'',1.2,-1,0])assert.equal(t.service.scoreKey(t.movie(id)),'');
  assert.equal(t.service.scoreKey(t.movie(42,'unknown')),'');
});
test('storage read/write errors preserve memory success, empty and error backoff',async()=>{
  for(const options of [{storageThrows:true},{writeThrows:true}]){
    const t=setup(options),m=t.movie();await t.service.fetch(m,{fetchImpl:t.response()});
    assert.equal(t.service.read(m),7.86);assert.equal(t.service.shouldFetch(m),false);
    t.tick(t.policy.SUCCESS_TTL+1);await t.service.fetch(m,{fetchImpl:t.response(null,500)});
    assert.equal(t.service.read(m),7.86);assert.equal(t.service.shouldFetch(m),false);
  }
});
test('legacy null/zero rows retry and zero with real votes is a valid score',async()=>{
  for(const score of [null,0]) {
    const t=setup({rows:{'movie:42':{score,expiresAt:9_000_000}}});assert.equal(t.service.shouldFetch(t.movie()),true);
    await t.service.fetch(t.movie(),{fetchImpl:t.response({id:42,vote_average:0,vote_count:2})});assert.equal(t.service.read(t.movie()),0);
  }
});
test('timeout produces error and bounded backoff',async()=>{
  const t=setup();await t.service.fetch(t.movie(),{timeoutMs:5,fetchImpl:(u,{signal})=>new Promise((r,j)=>{
    signal.addEventListener('abort',()=>{const error=Error('abort');error.name='AbortError';j(error);});
  })});assert.equal(t.service.state(t.movie()).row.status,'error');assert.equal(t.service.shouldFetch(t.movie()),false);
});

test('changed ID/type cannot show old field or late request while new request is pending',async()=>{
  for(const next of [{id:43,type:'movie'},{id:42,type:'tv'}]){
    const t=setup(),m=t.movie();
    let oldResponse,newResponse;
    const old=t.service.refresh(m,{fetchImpl:()=>new Promise(r=>{oldResponse=r;})});
    // Also cover writers which mutate the association directly: provenance must reject them.
    m.info.tmdbId=next.id;m.mediaType=next.type;
    assert.equal(t.service.read(m),null);
    const fresh=t.service.fetch(m,{fetchImpl:()=>new Promise(r=>{newResponse=r;})});
    oldResponse({ok:true,json:async()=>({id:42,vote_average:9.8,vote_count:100})});await old;
    assert.equal(t.service.read(m),null);assert.equal(t.service.display(m).text,'暂未获取');
    newResponse({ok:true,json:async()=>({id:next.id,vote_average:6.4,vote_count:100})});await fresh;
    assert.equal(t.service.read(m),6.4);assert.equal(m.personal.rating,6.2);
  }
});
