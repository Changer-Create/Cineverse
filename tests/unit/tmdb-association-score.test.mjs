import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
const main=readFileSync('app-main-v1.js','utf8');
function setup(){
 const c=vm.createContext({window:{},Date});
 for(const f of ['app-domain-model-v1.js','score-cache-policy-v1.js'])vm.runInContext(readFileSync(f,'utf8'),c);
 c.Domain=c.window.CineverseDomain;c.uniq=c.Domain.uniq;c.zhCountry=(id,name)=>name;c.tmdbImage=v=>v||'';
 for(const name of ['applyTmdbBundleToMovie','saveMovieFromModal']){
  const start=main.indexOf('  function '+name+'('),end=main.indexOf('\n  function ',start+10);
  vm.runInContext(main.slice(start,end),c);
 }
 return c;
}
const movie=()=>({id:'local',mediaType:'movie',info:{title:'Original',tmdbId:42,tmdbVoteAverage:9.1,tmdbScoreSourceKey:'movie:42'},
 personal:{rating:6.2,status:'watched',tags:[]},watchHistory:[{date:'2026-09-01',rating:6.2}],plans:[{month:'2026-10'}],
 radar:{publicReputation:9.1,matchScore:88}});
test('manual editor clears old ID/type score, preserves personal data and normalized equal IDs',()=>{
 for(const [type,id] of [['movie','43'],['tv','42'],['movie','']]){
  const c=setup(),m=movie();c.appState={movies:[m]};c.libraryState={editingId:m.id};
  c.els={};for(const name of ['movieTitleInput','movieOriginalTitleInput','movieYearInput','movieReleaseDateInput','movieLastAirDateInput',
   'movieSeasonsInput','movieEpisodesInput','movieTvStatusInput','movieRuntimeInput','movieTmdbIdInput','movieDirectorInput',
   'movieCountryInput','movieGenresInput','movieOverviewInput','moviePosterInput','movieStatusInput','movieRatingInput','movieTagsInput','movieMediaTypeInput'])
    c.els[name]={value:''};
  Object.assign(c.els,{movieModal:{close(){}},matchView:null});
  c.els.movieTitleInput.value='Original';c.els.movieMediaTypeInput.value=type;c.els.movieTmdbIdInput.value=id;
  c.els.movieStatusInput.value='watched';c.els.movieRatingInput.value='6.2';
  for(const name of ['save','renderAll','toastMsg','removeMatchRow'])c[name]=()=>{};
  c.movieNeedsTmdb=()=>false;c.mediaTypeLabel=c.Domain.mediaTypeLabel;c.splitList=()=>[];
  const history=JSON.stringify(m.watchHistory),plans=JSON.stringify(m.plans);
  c.saveMovieFromModal();
  assert.equal(m.info.tmdbVoteAverage,null);assert.equal(m.info.tmdbScoreSourceKey,null);assert.equal(c.Domain.publicScore(m),null);
  assert.equal(m.radar.publicReputation,null);assert.equal(m.radar.matchScore,88);
  assert.equal(m.personal.rating,6.2);assert.equal(JSON.stringify(m.watchHistory),history);assert.equal(JSON.stringify(m.plans),plans);
 }
 const c=setup(),m=movie();c.Domain.setTmdbAssociation(m,'movie','42');assert.equal(m.info.tmdbVoteAverage,9.1);
});
test('automatic bundle reassociation replaces old field only with a score from the new key',()=>{
 for(const type of ['movie','tv']){
  const c=setup(),m=movie();c.applyTmdbBundleToMovie(m,{mediaType:type,detail:{id:43},credits:{}});
  assert.equal(m.info.tmdbId,43);assert.equal(m.info.tmdbVoteAverage,null);assert.equal(c.Domain.publicScore(m),null);
  c.applyTmdbBundleToMovie(m,{mediaType:type,detail:{id:43,vote_average:7.4,vote_count:10},credits:{}});
  assert.equal(m.info.tmdbVoteAverage,7.4);assert.equal(m.info.tmdbScoreSourceKey,type+':43');assert.equal(c.Domain.publicScore(m),7.4);
  assert.equal(m.personal.rating,6.2);
 }
});
test('normalization and backup/restore preserve source key, including mismatches',()=>{
 const c=setup();Object.assign(c,{structuredClone,crypto:{randomUUID:()=> 'id'},localStorage:{getItem:()=>null,setItem(){}}});
 for(const f of ['app-constants-v1.js','app-core-utils-v1.js','app-state-storage-v1.js'])vm.runInContext(readFileSync(f,'utf8'),c);
 const m=movie();m.info.tmdbId=43;
 const restored=c.window.CineverseState.restore(c.window.CineverseState.backup({movies:[m]}).state).movies[0];
 assert.equal(restored.info.tmdbScoreSourceKey,'movie:42');assert.equal(c.Domain.publicScore(restored),null);
});
