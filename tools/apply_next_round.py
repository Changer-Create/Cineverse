from pathlib import Path
import re

p=Path('index.html')
s=p.read_text(encoding='utf-8')

def once(old,new,label):
    global s
    n=s.count(old)
    if n!=1:
        raise SystemExit(f'{label}: expected 1 occurrence, got {n}')
    s=s.replace(old,new,1)

old_css='''  .home-top-grid{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(330px,.85fr);gap:18px;margin-top:18px;align-items:stretch}\n  .home-top-grid>.panel{height:100%}\n  .home-triple{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;margin-top:18px;align-items:stretch}\n  .home-triple>.panel{height:100%;min-height:286px}\n  .home-triple .recent-grid{grid-template-columns:repeat(2,minmax(0,1fr));align-content:start}\n  .home-triple .recent{grid-template-columns:50px minmax(0,1fr)}\n  .home-triple .mini-poster{width:50px;height:72px}\n  .home-triple .insight{display:flex;flex-direction:column}\n  .home-triple .quote-card{margin-top:auto}\n'''
new_css='''  .home-top-grid{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(330px,.85fr);gap:18px;margin-top:18px;align-items:stretch}\n  .home-top-grid>.panel{height:100%}\n  .home-top-grid .recent-grid{grid-template-columns:repeat(4,minmax(0,1fr));align-content:start}\n  .home-triple{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;margin-top:18px;align-items:stretch}\n  .home-triple>.panel{height:100%;min-height:330px;display:flex;flex-direction:column}\n  .home-triple .radar-grid{grid-template-columns:repeat(2,minmax(0,1fr));align-content:start;flex:1}\n  .home-triple .movie-card .poster{aspect-ratio:2/2.45}\n  .home-triple .movie-body{padding:9px 10px 10px}\n  .home-triple .scores{display:grid;gap:3px}\n  .home-triple .plan{flex:1}\n  .home-triple .insight{padding:0}\n  .home-triple .insight-body{padding:8px 18px 18px;display:flex;flex-direction:column;flex:1}\n  .home-triple .quote-card{margin-top:auto}\n'''
once(old_css,new_css,'home css')
s=s.replace('.home-triple .insight{grid-column:1/-1}', '.home-triple .insight{grid-column:1/-1}.home-top-grid .recent-grid{grid-template-columns:repeat(2,1fr)}',1)
s=s.replace('.home-triple .insight{grid-column:auto}.home-triple .recent-grid{grid-template-columns:1fr}', '.home-triple .insight{grid-column:auto}.home-top-grid .recent-grid{grid-template-columns:1fr}.home-triple .radar-grid{grid-template-columns:1fr 1fr}',1)

radar='''      <section class="panel" id="radar">\n        <div class="panel-head"><div class="panel-title"><span class="star">✦</span> 本周电影雷达 <span class="panel-kicker">为你精选的值得关注</span></div><button class="link-btn" data-view-link="radar">查看全部 ›</button></div>\n        <div class="radar-grid" id="radarGrid"></div>\n      </section>'''
watched='''      <section class="panel" id="watched">\n        <div class="panel-head"><div class="panel-title"><span class="star">★</span> 最近观看</div><button class="link-btn" id="recentSeeAll">查看全部 ›</button></div>\n        <div class="recent-grid" id="recentGrid"></div>\n      </section>'''
if s.count(radar)!=1 or s.count(watched)!=1: raise SystemExit('home blocks not unique')
s=s.replace(radar,'__RADAR__',1).replace(watched,'__WATCHED__',1)
s=s.replace('__RADAR__',watched,1).replace('__WATCHED__',radar,1)

old_insight='''      <section class="panel insight">\n        <div class="panel-title">这一月的星图</div>\n        <div class="insight-grid"><div class="insight-item"><div class="n" id="monthRadarCount">0</div><div class="l">本月新增雷达</div></div><div class="insight-item"><div class="n" id="monthNinePlus">0</div><div class="l">9分以上</div></div><div class="insight-item"><div class="n" id="monthTopDirector">—</div><div class="l">最常见主创</div></div></div>\n        <div class="quote-card">“每一部作品，都是一次平行宇宙的旅行。”<br><span style="color:#8f99b8">愿你在光影里，遇见更好的自己。</span></div>\n      </section>'''
new_insight='''      <section class="panel insight">\n        <div class="panel-head"><div class="panel-title">这一月的星图</div></div>\n        <div class="insight-body">\n          <div class="insight-grid"><div class="insight-item"><div class="n" id="monthRadarCount">0</div><div class="l">本月新增雷达</div></div><div class="insight-item"><div class="n" id="monthNinePlus">0</div><div class="l">9分以上</div></div><div class="insight-item"><div class="n" id="monthTopDirector">—</div><div class="l">最常见主创</div></div></div>\n          <div class="quote-card">“每一部作品，都是一次平行宇宙的旅行。”<br><span style="color:#8f99b8">愿你在光影里，遇见更好的自己。</span></div>\n        </div>\n      </section>'''
once(old_insight,new_insight,'insight')
once('.sort((a,b)=>(b.match||0)-(a.match||0)).slice(0,4);','.sort((a,b)=>(b.match||0)-(a.match||0)).slice(0,2);','radar count')

old_modal='''    <div class="data-note">每行一部影视。支持“中文名 / 外文原名”，也可以直接粘贴带序号的片单；已存在的同名作品会自动跳过。</div>\n    <textarea id="bulkAddTitlesText" class="bulk-title-textarea" placeholder="爱乐之城 / La La Land\n爆裂鼓手 / Whiplash\n花样年华\n1. 公民凯恩"></textarea>\n    <div id="bulkAddTitlesStatus" class="tmdb-status">新条目会先以“待识别”加入影视库，之后可统一进入 TMDb 匹配中心补全。</div>\n  </div>\n  <div class="modal-foot"><button type="button" id="bulkAddTitlesCancel">取消</button><button type="button" id="bulkAddTitlesOnly">只添加</button><button class="save" type="button" id="bulkAddTitlesMatch">添加并打开匹配中心</button></div>'''
new_modal='''    <div class="data-note">每行一部影视。支持“中文名 / 外文原名”和带序号片单；已存在作品自动跳过。点击自动匹配后，唯一精确结果会直接关联 TMDb 并新增，歧义结果才进入待确认。</div>\n    <textarea id="bulkAddTitlesText" class="bulk-title-textarea" placeholder="爱乐之城 / La La Land\n爆裂鼓手 / Whiplash\n花样年华\n1. 公民凯恩"></textarea>\n    <div id="bulkAddTitlesStatus" class="tmdb-status">粘贴片名后即可批量匹配；不会使用年份或观看日期参与自动确认。</div>\n  </div>\n  <div class="modal-foot"><button type="button" id="bulkAddTitlesCancel">取消</button><button type="button" id="bulkAddTitlesOnly">只添加不匹配</button><button class="save" type="button" id="bulkAddTitlesMatch">自动匹配并新增</button></div>'''
once(old_modal,new_modal,'bulk modal')

pat=re.compile(r"  function openBulkAddTitles\(\)\{.*?\n  function openMovieModal\(id=null\)\{",re.S)
m=pat.search(s)
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

for key in ['quoteSourceBtn','quoteSourceDialog','quoteSourceClose','quoteSourceText','quoteSourceCredit','quoteSourceVerification','quoteSourceType','quoteSourceTitle','quoteSourceTranslation','quoteSourceLink','quoteSourceNext','quoteSourceDone','settingsMovieCount','settingsWatchCount','settingsPlanCount','settingsRadarCount','settingsLastUpdated','settingsLegacySeedStatus','settingsCleanupLegacySeed','settingsClearData']:
    s=re.sub(rf"\b{re.escape(key)}:\$\('{re.escape(key)}'\),?",'',s)

p.write_text(s,encoding='utf-8')
print('next round applied')
