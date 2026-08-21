const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = join(__dirname, '..');
const index = readFileSync(join(root, 'index.html'), 'utf8');
const search = readFileSync(join(root, 'global-tmdb-search-v2.js'), 'utf8');
const statusModel = readFileSync(join(root, 'status-model-v3.js'), 'utf8');
const cardActions = readFileSync(join(root, 'library-card-actions-v2.js'), 'utf8');
const returnContext = readFileSync(join(root, 'detail-return-context-v1.js'), 'utf8');

function functionLine(name) {
  const match = index.match(new RegExp(`function ${name}\\([^\\n]+`));
  assert.ok(match, `Missing ${name}`);
  return match[0];
}

function stateHarness(movies = []) {
  const context = {
    appState:{movies:structuredClone(movies)},
    structuredClone,
    uid:()=>'generated-id',
    saveCalls:0,
    save(){this.saveCalls++},
    openWatchCalls:0,
    renderAll(){},renderDetail(){},
    detailState:{movieId:null},
    normalizeMovie(value){
      return structuredClone({...value,personal:{status:'want',rating:null,tags:[],shortReview:'',favorite:false,...value.personal},watchHistory:value.watchHistory||[],plans:value.plans||[]});
    },
  };
  context.openWatchModal=()=>{context.openWatchCalls++};
  const functions = ['libraryMatchForData','tmdbMovieFromData','addTmdbMovieToLibrary','setLibraryStatus','toggleLibraryFavorite'].map(functionLine).join('\n');
  vm.runInNewContext(`${functions};this.find=libraryMatchForData;this.add=addTmdbMovieToLibrary;this.status=setLibraryStatus;this.favorite=toggleLibraryFavorite`,context);
  return context;
}

const bundleData = {
  mediaType:'tv',tmdbId:123,title:'示例剧集',originalTitle:'Example Series',year:2025,
  releaseDate:'2025-01-02',firstAirDate:'2025-01-02',lastAirDate:'2025-02-03',runtime:48,
  numberOfSeasons:2,numberOfEpisodes:16,tvStatus:'Returning Series',directors:['主创甲'],
  countries:['中国'],genres:['剧情'],overview:'完整简介',posterUrl:'https://image.tmdb.org/t/p/w500/example.jpg',
};

test('TMDb browsing has an explicit context and opening details does not save', () => {
  assert.match(index, /detailContext=\{source:'library',mediaType:'movie',tmdbId:null,libraryMovieId:null,data:\{\}\}/);
  const openDetail = functionLine('openDetail');
  assert.doesNotMatch(openDetail, /save\(/);
  assert.match(search, /setDetailContext\(\{source:'tmdb'/);
});

test('first library commit uses the complete cached TMDb bundle', () => {
  const harness = stateHarness();
  const movie = harness.add(bundleData,{status:'watching',favorite:false});
  assert.equal(harness.appState.movies.length,1);
  assert.equal(movie.personal.status,'watching');
  assert.equal(movie.personal.favorite,false);
  assert.equal(movie.info.numberOfEpisodes,16);
  assert.deepEqual(movie.info.directors,['主创甲']);
  assert.equal(movie.info.overview,'完整简介');
});

test('TMDb identity matching prevents duplicates and preserves personal data', () => {
  const existing = stateHarness().add(bundleData,{status:'watching',favorite:false});
  existing.personal.tags=['保留标签'];existing.personal.shortReview='保留影评';existing.watchHistory=[{date:'2025-03-01'}];
  const harness = stateHarness([existing]);
  const matched = harness.add({...bundleData,title:'更新标题'},{status:'want',favorite:false});
  assert.equal(harness.appState.movies.length,1);
  assert.deepEqual(matched.personal.tags,['保留标签']);
  assert.equal(matched.personal.shortReview,'保留影评');
  assert.equal(matched.watchHistory.length,1);
});

test('favorite is independent and watched requires a real record', () => {
  const harness = stateHarness();
  const movie = harness.add(bundleData,{status:'watching',favorite:false});
  harness.favorite(movie.id);
  assert.equal(movie.personal.status,'watching');
  assert.equal(movie.personal.favorite,true);
  assert.throws(()=>harness.add({...bundleData,tmdbId:456},{status:'watched'}),/真实观看记录/);
  const watched=harness.add({...bundleData,tmdbId:456,title:'看过示例'},{status:'watched',watchRecord:{date:'2025-04-01',rating:9,note:'',venue:''}});
  assert.equal(watched.personal.status,'watched');
  assert.equal(watched.watchHistory.length,1);
});

test('status changes preserve favorite and watched opens the record flow', () => {
  const harness=stateHarness();
  const tv=harness.add(bundleData,{status:'want',favorite:true});
  harness.status(tv.id,'watching');
  assert.equal(tv.personal.status,'watching');
  assert.equal(tv.personal.favorite,true);
  harness.status(tv.id,'watched');
  assert.equal(tv.personal.status,'watching');
  assert.equal(harness.openWatchCalls,1);
  const movie=harness.add({...bundleData,mediaType:'movie',tmdbId:789},{status:'want'});
  harness.status(movie.id,'watching');
  assert.equal(movie.personal.status,'want');
});

test('search and detail actions share explicit state APIs without hidden button simulation', () => {
  assert.match(search,/api\.setLibraryStatus\(local\.id,status\)/);
  assert.match(search,/api\.addTmdbMovieToLibrary\(data,\{status,favorite:false\}\)/);
  assert.doesNotMatch(search,/\.click\(\)/);
  assert.doesNotMatch(search,/style\.display\s*=\s*['"]none/);
  assert.doesNotMatch(search,/requestSubmit\(\)/);
  assert.doesNotMatch(search,/location\.reload\(\)/);
  assert.match(search,/if \(bundleCache\.has\(key\)\) return bundleCache\.get\(key\)/);
});

test('TMDb watch cancellation cannot create a library item', () => {
  assert.match(index,/function openPendingWatch\(data\)\{pendingWatchCreate=\{data\}/);
  assert.match(index,/function cancelWatchRecord\(\)\{pendingWatchCreate=null/);
  assert.match(index,/if\(pendingWatchCreate\).*addTmdbMovieToLibrary\(pending\.data,\{status:'watched',watchRecord:record\}\)/);
  assert.doesNotMatch(search,/pendingExternalWatch/);
});

test('watched actions never synthesize a watch record', () => {
  for (const source of [index,statusModel,cardActions,search]) {
    assert.doesNotMatch(source,/watchHistory\s*=\s*\[\{date:localToday/);
    assert.doesNotMatch(source,/watchHistory\.push\(\{\s*date:\s*today\(\)/);
  }
  assert.match(index,/看过状态必须逐部记录真实观看/);
});

test('search return context survives in-place library upgrade', () => {
  assert.match(search,/dataset\.detailReturnSource='search'/);
  assert.match(search,/previewState\.libraryMovieId/);
  assert.match(returnContext,/dataset\.detailReturnSource === 'search'/);
  assert.match(search,/if \(lastResults\.length\) renderResults\(\)/);
  assert.match(search,/history\.replaceState\(null,'',`#\$\{viewKey\}`\)/);
});

test('unified detail poster stretches without image distortion', () => {
  assert.match(index,/\.detail-poster\{grid-column:1;grid-row:1 \/ span 2;height:auto;min-height:360px;align-self:stretch/);
  assert.match(index,/\.detail-poster img\{width:100%;height:100%;object-fit:cover/);
});
