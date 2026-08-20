from pathlib import Path
import re

p=Path('index.html')
s=p.read_text(encoding='utf-8')

def sub(pattern,repl,label,flags=0):
    global s
    s2,n=re.subn(pattern,repl,s,count=1,flags=flags)
    if n!=1:
        raise SystemExit(f'{label}: expected 1 match, got {n}')
    s=s2

def once(old,new,label):
    global s
    n=s.count(old)
    if n!=1:
        raise SystemExit(f'{label}: expected 1 occurrence, got {n}')
    s=s.replace(old,new,1)

# Home CSS: tolerate the compressed CSS used by the current public build.
sub(r'\.home-top-grid>\.panel\{height:100%\}', '.home-top-grid>.panel{height:100%}.home-top-grid .recent-grid{grid-template-columns:repeat(4,minmax(0,1fr));align-content:start}', 'home recent css')
sub(r'\.home-triple>\.panel\{height:100%;min-height:286px\}', '.home-triple>.panel{height:100%;min-height:330px;display:flex;flex-direction:column}', 'home triple panel')
sub(r'\.home-triple \.recent-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\);align-content:start\}\.home-triple \.recent\{grid-template-columns:50px minmax\(0,1fr\)\}\.home-triple \.mini-poster\{width:50px;height:72px\}', '.home-triple .radar-grid{grid-template-columns:repeat(2,minmax(0,1fr));align-content:start;flex:1}.home-triple .movie-card .poster{aspect-ratio:2/2.45}.home-triple .movie-body{padding:9px 10px 10px}.home-triple .scores{display:grid;gap:3px}.home-triple .plan{flex:1}', 'home triple content css')
sub(r'\.home-triple \.insight\{display:flex;flex-direction:column\}', '.home-triple .insight{padding:0}.home-triple .insight-body{padding:8px 18px 18px;display:flex;flex-direction:column;flex:1}', 'home insight css')
if '.home-top-grid .recent-grid{grid-template-columns:repeat(2,1fr)}' not in s:
    s=s.replace('.home-triple .insight{grid-column:1/-1}', '.home-triple .insight{grid-column:1/-1}.home-top-grid .recent-grid{grid-template-columns:repeat(2,1fr)}',1)
if '.home-top-grid .recent-grid{grid-template-columns:1fr}' not in s:
    s=s.replace('.home-triple .insight{grid-column:auto}.home-triple .recent-grid{grid-template-columns:1fr}', '.home-triple .insight{grid-column:auto}.home-top-grid .recent-grid{grid-template-columns:1fr}.home-triple .radar-grid{grid-template-columns:1fr 1fr}',1)

# Swap Recent Watched and Weekly Radar.
radar=re.search(r'<section class="panel" id="radar">.*?<div class="radar-grid" id="radarGrid"></div>\s*</section>',s,re.S)
watched=re.search(r'<section class="panel" id="watched">.*?<div class="recent-grid" id="recentGrid"></div>\s*</section>',s,re.S)
if not radar or not watched: raise SystemExit('home modules not found')
rb,wb=radar.group(0),watched.group(0)
s=s.replace(rb,'__NEXT_RADAR__',1).replace(wb,'__NEXT_WATCHED__',1)
s=s.replace('__NEXT_RADAR__',wb,1).replace('__NEXT_WATCHED__',rb,1)

# Align the three lower module headers exactly.
sub(r'<section class="panel insight">\s*<div class="panel-title">这一月的星图</div>\s*(<div class="insight-grid">.*?</div></div></div>)\s*(<div class="quote-card">.*?</div>)\s*</section>', r'<section class="panel insight">\n        <div class="panel-head"><div class="panel-title">这一月的星图</div></div>\n        <div class="insight-body">\n          \1\n          \2\n        </div>\n      </section>', 'insight html', re.S)
once('.sort((a,b)=>(b.match||0)-(a.match||0)).slice(0,4);','.sort((a,b)=>(b.match||0)-(a.match||0)).slice(0,2);','radar count')

# True bulk title -> TMDb auto matching flow.
sub(r'<div class="data-note">每行一部影视。支持“中文名 / 外文原名”，也可以直接粘贴带序号的片单；已存在的同名作品会自动跳过。</div>\s*(<textarea id="bulkAddTitlesText".*?</textarea>)\s*<div id="bulkAddTitlesStatus" class="tmdb-status">.*?</div>', r'<div class="data-note">每行一部影视。支持“中文名 / 外文原名”和带序号片单；已存在作品自动跳过。点击自动匹配后，唯一精确结果会直接关联 TMDb 并新增，歧义结果才进入待确认。</div>\n    \1\n    <div id="bulkAddTitlesStatus" class="tmdb-status">粘贴片名后即可批量匹配；不会使用年份或观看日期参与自动确认。</div>', 'bulk copy', re.S)
once('<button type="button" id="bulkAddTitlesOnly">只添加</button><button class="save" type="button" id="bulkAddTitlesMatch">添加并打开匹配中心</button>', '<button type="button" id="bulkAddTitlesOnly">只添加不匹配</button><button class="save" type="button" id="bulkAddTitlesMatch">自动匹配并新增</button>', 'bulk buttons')

m=re.search(r'  function openBulkAddTitles\(\)\{.*?  function openMovieModal\(id=null\)\{',s,re.S)
if not m: raise SystemExit('bulk function block not found')
funcs=r'''  function bulkTitleExisting(row){
    const t=cleanTmdbTitle(row.title),o=cleanTmdbTitle(row.originalTitle);
    return (appState.movies||[]).find(m=>{const mt=cleanTmdbTitle(m.info?.title),mo=cleanTmdbTitle(m.info?.originalTitle);return (t&&(t===mt||t===mo))||(o&&(o===mt||o===mo))})||null;
  }
  function makeBulkTitleMovie(row){return normalizeMovie({id:uid(),mediaType:'unknown',info:{title:row.title,originalTitle:row.originalTitle},personal:{status:'want',rating:null,tags:[],shortReview:'',favorite:false},watchHistory:[],plans:[],radar:{discovered:false,ignored:false}})}
  function setBulkTitleBusy(busy){els.bulkAddTitlesText.disabled=busy;els.bulkAddTitlesOnly.disabled=busy;els.bulkAddTitlesMatch.disabled=busy;els.bulkAddTitlesCancel.disabled=busy;els.bulkAddTitlesClose.disabled=busy}
  function openBulkAddTitles(){els.bulkAddTitlesText.value='';els.bulkAddTitlesStatus.className='tmdb-status';els.bulkAddTitlesStatus.textContent='粘贴片名后即可批量匹配；不会使用年份或观看日期参与自动确认。';setBulkTitleBusy(false);els.bulkAddTitlesDialog.showModal();setTimeout(()=>els.bulkAddTitlesText.focus(),0)}
  function addBulkTitles(){
    const rows=parseBulkTitles(els.bulkAddTitlesText.value);if(!rows.length){els.bulkAddTitlesStatus.className='tmdb-status bad';els.bulkAddTitlesStatus.textContent='没有识别到片名，请按“每行一部”粘贴片单。';return}
    let added=0,skipped=0;for(const row of rows){if(bulkTitleExisting(row)){skipped++;continue}appState.movies.push(makeBulkTitleMovie(row));added++}
    save();renderAll();els.bulkAddTitlesDialog.close();toastMsg(`批量添加完成：新增 ${added} 部${skipped?` · 跳过 ${skipped} 部已存在作品`:''}`)
  }
  async function addBulkTitlesAutoMatch(){
    const rows=parseBulkTitles(els.bulkAddTitlesText.value);if(!rows.length){els.bulkAddTitlesStatus.className='tmdb-status bad';els.bulkAddTitlesStatus.textContent='没有识别到片名，请按“每行一部”粘贴片单。';return}
    try{tmdbCredential()}catch(err){els.bulkAddTitlesStatus.className='tmdb-status bad';els.bulkAddTitlesStatus.textContent='请先在“设置 → TMDb”填写并保存 API Key / Token，再使用自动匹配。';return}
    setBulkTitleBusy(true);let added=0,skipped=0,auto=0,pending=0,failed=0;
    try{
      for(let i=0;i<rows.length;i++){
        const row=rows[i];els.bulkAddTitlesStatus.className='tmdb-status';els.bulkAddTitlesStatus.textContent=`正在匹配 ${i+1}/${rows.length} · 《${row.title}》`;
        if(bulkTitleExisting(row)){skipped++;continue}
        const movie=makeBulkTitleMovie(row);
        try{
          const match=await matchBatchTmdbMovie(movie);
          if(match.auto){
            const mt=match.auto.media_type||'movie',existing=(appState.movies||[]).find(m=>m.mediaType===mt&&Number(m.info?.tmdbId)===Number(match.auto.id));if(existing){skipped++;continue}
            appState.movies.push(movie);const bundle=await fetchTmdbBundle(match.auto.id,mt);applyTmdbBundleToMovie(movie,bundle);if(bundle.mediaType==='tv')collapseTvSeriesForMovie(movie,bundle);removeMatchRow(movie.id);added++;auto++;
          }else{
            appState.movies.push(movie);added++;if((match.candidates||[]).length){upsertMatchRow({movieId:movie.id,status:'pending',candidates:match.candidates,reason:match.reason||'存在多个候选，需要确认'});pending++}else{upsertMatchRow({movieId:movie.id,status:'noresult',candidates:[],reason:match.reason||'TMDb 没有返回候选'});failed++}
          }
        }catch(err){appState.movies.push(movie);added++;failed++;upsertMatchRow({movieId:movie.id,status:'failed',candidates:[],reason:`请求失败：${err.message}`})}
        if((i+1)%2===0)save();await new Promise(r=>setTimeout(r,80));
      }
      save();renderAll();els.bulkAddTitlesStatus.className='tmdb-status good';els.bulkAddTitlesStatus.textContent=`完成：输入 ${rows.length} · 自动关联 ${auto} · 已存在 ${skipped} · 待确认 ${pending} · 未找到/失败 ${failed}`;toastMsg(`批量导入完成：自动关联 ${auto} 部${pending||failed?` · ${pending+failed} 部待处理`:''}`);
      if(pending||failed){setTimeout(()=>{els.bulkAddTitlesDialog.close();setView('match');renderMatchCenter()},450)}else setTimeout(()=>els.bulkAddTitlesDialog.close(),450)
    }finally{setBulkTitleBusy(false)}
  }
  function openMovieModal(id=null){'''
s=s[:m.start()]+funcs+s[m.end():]
once("els.bulkAddTitlesOnly.addEventListener('click',()=>addBulkTitles(false));els.bulkAddTitlesMatch.addEventListener('click',()=>addBulkTitles(true));","els.bulkAddTitlesOnly.addEventListener('click',addBulkTitles);els.bulkAddTitlesMatch.addEventListener('click',addBulkTitlesAutoMatch);",'bulk listeners')

# Remove stale element-registry entries for UI cards/buttons that no longer exist.
for key in ['quoteSourceBtn','quoteSourceDialog','quoteSourceClose','quoteSourceText','quoteSourceCredit','quoteSourceVerification','quoteSourceType','quoteSourceTitle','quoteSourceTranslation','quoteSourceLink','quoteSourceNext','quoteSourceDone','settingsMovieCount','settingsWatchCount','settingsPlanCount','settingsRadarCount','settingsLastUpdated','settingsLegacySeedStatus','settingsCleanupLegacySeed','settingsClearData']:
    s=re.sub(rf"\b{re.escape(key)}:\$\('{re.escape(key)}'\),?",'',s)

p.write_text(s,encoding='utf-8')
print('next round applied')
