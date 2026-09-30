const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const {execFileSync}=require('node:child_process');
const {chromium}=require('playwright');
const ROOT=path.resolve(__dirname,'../..');
const OUT=process.env.SCORE_ARTIFACTS || path.join(os.tmpdir(),'cineverse-public-score');
const BASE_REF=process.env.SCORE_BASELINE_REF;
const fixture=JSON.parse(fs.readFileSync(path.join(ROOT,'tests/fixtures/app-state-v2.json'),'utf8'));
const template=fixture.movies[0];
const make=(id,type,tmdbId,title,score=null)=>({...structuredClone(template),id,mediaType:type,
 info:{...structuredClone(template.info),title,tmdbId,tmdbVoteAverage:score},
 personal:{...structuredClone(template.personal),rating:6.2},radar:{discovered:false,ignored:false,publicReputation:score},
 watchHistory:[{date:'2026-10-01',rating:6.2,note:'保留观影记录',venue:'家'}],plans:[]});
const seed={...fixture,movies:[make('cold','movie',42,'冷启动有效评分'),make('empty','tv',42,'零投票作品',9),
 make('error','movie',43,'上游失败保留缓存'),make('unlinked','movie',null,'未关联作品')],
 home:{...fixture.home,radar:[],featured:['random']}};
const random=make('random','movie',42,'同 ID 想看推荐');random.watchHistory=[];random.personal.status='want';seed.movies.push(random);
const cache={'movie:43':{status:'success',score:8.1,fetchedAt:1,expiresAt:2}};
const report={base:BASE_REF||'working-tree',url:'',viewport:[],requests:[],errors:[],console:[],checks:[]};
let server,browser;
let reassociating=false, releaseOldScore, releaseNewScore;
function check(name,value){report.checks.push({name,passed:Boolean(value)});assert.ok(value,name);}
async function main(){
 fs.mkdirSync(OUT,{recursive:true});
 server=http.createServer((req,res)=>{
  const name=decodeURIComponent(new URL(req.url,'http://local').pathname).slice(1)||'index.html';
  const file=path.resolve(ROOT,name);
  if(!file.startsWith(ROOT+path.sep)){res.writeHead(403).end();return;}
  try {
   const data=fs.readFileSync(file);const ext=path.extname(file);
   res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json'})[ext]||'application/octet-stream');
   res.end(data);
  }catch{res.writeHead(404).end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 report.url=base+'/index.html#home';
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
 const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'Asia/Shanghai',serviceWorkers:'block'});
 await context.addInitScript(({seed,cache})=>{
  if(!sessionStorage.getItem('score-seeded')){
   localStorage.setItem('movie-collection-v2',JSON.stringify(seed));localStorage.setItem('movie-tmdb-score-cache-v1',JSON.stringify(cache));sessionStorage.setItem('score-seeded','1');
  }
 },{seed,cache});
 const page=await context.newPage();
 page.on('pageerror',e=>report.errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')report.console.push(m.text());});
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.origin===base) {
   if(BASE_REF && /\.(js|html)$/.test(url.pathname)){
    try {const body=execFileSync('git',['show',BASE_REF+':'+url.pathname.slice(1)],{cwd:ROOT,encoding:'utf8'});
     await route.fulfill({status:200,contentType:url.pathname.endsWith('.js')?'text/javascript':'text/html',body});return;
    } catch{}
   }
   return route.continue();
  }
  if(url.pathname.endsWith('/tmdb-proxy')){
   const body=route.request().postDataJSON(),p=body.path;
   if(/^\/(movie|tv)\/\d+$/.test(p)){
    const id=Number(p.split('/')[2]),status=p==='/movie/43'?503:200;
    const data={id,vote_average:(p.startsWith('/tv/') || id===77)?0:7.86,vote_count:(p.startsWith('/tv/') || id===77)?0:120,title:'Mock',credits:{crew:[]},genres:[]};
    report.requests.push({path:p,status,id,score:data.vote_average,voteCount:data.vote_count});
    if(reassociating && p==='/movie/42') await new Promise(r=>{releaseOldScore=r;});
    else if(reassociating && p==='/movie/84') await new Promise(r=>{releaseNewScore=r;});
    else await new Promise(r=>setTimeout(r,id===77?600:150));
    return route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
   }
   const results = p==='/search/multi' ? [{id:77,media_type:'movie',title:'外部暂无评分',release_date:'2026-01-01'},{id:78,media_type:'movie',title:'外部有效评分',release_date:'2026-01-01'}] : [];
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({results,total_results:results.length})});
  }
  return route.fulfill({status:200,contentType:url.pathname.includes('css')?'text/css':'application/json',body:url.pathname.includes('css')?'':'[]'});
 });
 await page.goto(report.url,{waitUntil:'networkidle'});
 check('correct page',await page.title()==='光影宇宙');
 check('meaningful home',await page.locator('#recentGrid .recent').count()===4);
 const recent=()=>page.locator('#recentGrid .recent-public strong').allTextContents();
 report.recent=await recent();
 await page.locator('#recentGrid').screenshot({path:path.join(OUT,BASE_REF?'before.png':'after.png')});
 await page.screenshot({path:path.join(OUT,BASE_REF?'before-desktop.png':'after-desktop.png'),fullPage:true});
 if(BASE_REF){check('reproduced cold score missing',report.recent[0]==='—');return;}
 check('cold home automatically shows 7.9',report.recent[0]==='★ 7.9');
 check('zero votes never falls back',report.recent[1]==='暂无评分');
 check('HTTP failure retains 8.1',report.recent[2]==='★ 8.1');
 check('unlinked state',report.recent[3]==='未关联 TMDb');
 check('random uses same score',await page.locator('#randomPublicScore').textContent()==='★ 7.9');
 check('one in-flight request per key',report.requests.filter(x=>x.path==='/movie/42').length===1);
 check('TV uses distinct key',report.requests.filter(x=>x.path==='/tv/42').length===1);
 await page.locator('.nav [data-view="library"]').click();
 await page.waitForTimeout(200);
 check('library scores agree',await page.locator('.library-score-box.public b').filter({hasText:'★ 7.9'}).count()===2);
 await page.locator('#libraryGrid [data-open-detail="empty"]').first().click();
 await page.waitForFunction(()=>!document.getElementById('detailView').classList.contains('hidden') && document.getElementById('detailPublicScore').textContent==='暂无评分');
 check('local detail respects empty',await page.locator('#detailPublicScore').textContent()==='暂无评分');
 await page.locator('.nav [data-view="home"]').click();
 for(let i=0;i<3;i++){await page.locator('.nav [data-view="library"]').click();await page.locator('.nav [data-view="home"]').click();}
 check('repeated renders do not request again',report.requests.filter(x=>x.path==='/movie/42').length===1);
 const unchanged=await page.evaluate(seed=>{
  const state=JSON.parse(localStorage.getItem('movie-collection-v2'));
  const pick=m=>({id:m.id,rating:m.personal.rating,shortReview:m.personal.shortReview,history:m.watchHistory,plans:m.plans});
  return JSON.stringify(state.movies.map(pick))===JSON.stringify(seed.movies.map(pick));
 },seed);
 check('ratings reviews histories plans and count preserved',unchanged);
 const roundTrip=await page.evaluate(()=>{
   const state=JSON.parse(localStorage.getItem('movie-collection-v2'));
   const restored=window.CineverseState.restore(window.CineverseState.backup(state).state);
   return JSON.stringify(restored.movies)===JSON.stringify(state.movies);
 });
 check('backup restore retains all movie fields',roundTrip);
 const search=async()=>{
   await page.locator('#globalSearch').fill('外部');await page.locator('#globalSearch').press('Enter');
   await page.locator('#globalTmdbSearchDrop .cv-global-search-result').first().waitFor({state:'visible'});
 };
 await search();await page.locator('#globalTmdbSearchDrop .cv-global-search-result').nth(0).click();
 await search();await page.locator('#globalTmdbSearchDrop .cv-global-search-result').nth(1).click();
 await page.waitForTimeout(1000);
 check('external score and enrichment share request',report.requests.filter(x=>x.path==='/movie/78').length===1);
 check('external detail ignores old in-flight response',await page.locator('#detailTmdb').textContent()==='78' && await page.locator('#detailPublicScore').textContent()==='7.9');
 await search();await page.locator('#globalTmdbSearchDrop .cv-global-search-result').nth(0).click();
 await page.waitForTimeout(800);
 check('external detail respects cached empty',await page.locator('#detailPublicScore').textContent()==='暂无评分');
 await page.locator('.nav [data-view="home"]').click();


 // Exercise the real manual editor with both old and new scoring requests held in flight.
 reassociating=true;
 await page.evaluate(()=>{
   const movie=window.CineverseStateGateway.snapshot().movies.find(m=>m.id==='cold');
   window.oldScorePending=window.CineversePublicScoreService.refresh(movie);
 });
 await page.locator('#recentGrid [data-open-detail="cold"]').click();
 await page.locator('#detailEditBtn').click();
 // The readonly field is normally populated by the TMDb picker; exercise its save boundary.
 await page.locator('#movieTmdbIdInput').evaluate(input=>{input.value='84';});
 await page.locator('#movieForm').evaluate(form=>form.requestSubmit());
 await page.locator('.nav [data-view="home"]').click();
 await page.waitForFunction(()=>document.querySelector('#recentGrid [data-open-detail="cold"] .recent-public strong')?.textContent==='暂未获取');
 check('manual reassociation clears old score before new response',await page.locator('#recentGrid [data-open-detail="cold"] .recent-public strong').textContent()==='暂未获取');
 // Route callbacks have already captured the deferred responses by this rendered state.
 assert.equal(typeof releaseOldScore,'function');assert.equal(typeof releaseNewScore,'function');
 releaseOldScore();await page.evaluate(()=>window.oldScorePending);
 check('late old response cannot display on newly associated movie',await page.locator('#recentGrid [data-open-detail="cold"] .recent-public strong').textContent()==='暂未获取');
 releaseNewScore();
 await page.waitForFunction(()=>document.querySelector('#recentGrid [data-open-detail="cold"] .recent-public strong')?.textContent==='★ 7.9');
 check('new association renders only its own response',await page.evaluate(()=>{
   const movie=window.CineverseStateGateway.snapshot().movies.find(m=>m.id==='cold');
   return movie.info.tmdbId===84 && movie.info.tmdbVoteAverage===null && movie.personal.rating===6.2;
 }));
 reassociating=false;
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);
 await page.screenshot({path:path.join(OUT,'after-mobile.png'),fullPage:true});
 check('mobile public states contain no invalid numbers',!(await page.locator('#recentGrid').innerText()).match(/NaN|undefined/));
 check('mobile document fits viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 report.viewport=[{width:1440,height:1000},{width:390,height:844}];
 check('no page errors',report.errors.length===0);
 check('no unexpected console errors',report.console.every(x=>x.includes('503')));
 // Missing configuration and failed score script must terminate without refresh storms.
 for(const mode of ['no-config','no-service']){
  const p=await context.newPage();let requests=0;
  await p.route('**/public-config-v1.js?*',r=>mode==='no-config'?r.fulfill({contentType:'text/javascript',body:'window.CineversePublicConfig={tmdbProxyUrl:""};'}):r.continue());
  if(mode==='no-service')await p.route('**/public-score-service-v1.js?*',r=>r.fulfill({contentType:'text/javascript',body:''}));
  p.on('request',r=>{if(r.url().endsWith('/tmdb-proxy'))requests++;});
  await p.goto(base+'/index.html#home',{waitUntil:'networkidle'});
  await p.waitForTimeout(300);
  check(mode+' finite degradation',requests===0);await p.close();
 }
}
main().catch(e=>{report.failure=e.stack;process.exitCode=1;}).finally(async()=>{
 if(browser)await browser.close();if(server)server.close();
 fs.mkdirSync(OUT,{recursive:true});fs.writeFileSync(path.join(OUT,BASE_REF?'baseline.json':'result.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
});
