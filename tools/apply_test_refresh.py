from pathlib import Path
import re

p=Path('index.html')
s=p.read_text(encoding='utf-8')
orig=s

def rep(old,new,label):
    global s
    n=s.count(old)
    if n!=1:
        raise SystemExit(f'{label}: expected 1 occurrence, got {n}')
    s=s.replace(old,new,1)

# Home: radar + random on top, three aligned modules below.
old='''    <section class="dashboard">
      <div class="stack">
        <section class="panel" id="radar">
          <div class="panel-head"><div class="panel-title"><span class="star">✦</span> 本周电影雷达 <span class="panel-kicker">为你精选的值得关注</span></div><button class="link-btn" data-view-link="radar">查看全部 ›</button></div>
          <div class="radar-grid" id="radarGrid"></div>
        </section>

        <div class="lower-grid">
          <section class="panel" id="watched">
            <div class="panel-head"><div class="panel-title"><span class="star">★</span> 最近观看</div><button class="link-btn" id="recentSeeAll">查看全部 ›</button></div>
            <div class="recent-grid" id="recentGrid"></div>
          </section>
          <section class="panel" id="plan">
            <div class="panel-head"><div class="panel-title">本月观影计划</div><button class="link-btn" data-view-link="plan">查看日历 ›</button></div>
            <div class="plan">
              <div class="plan-top"><div><div class="plan-count"><span id="planTopDone">0</span> / <span id="planTopAll">0</span></div><div class="stat-note" id="homePlanMonthLabel">本月</div></div><div style="text-align:right"><div class="plan-count" id="planPercent">0%</div><div class="stat-note">完成率</div></div></div>
              <div class="progress"><i id="planBar"></i></div>
              <div class="plan-list" id="planList"></div>
            </div>
          </section>
        </div>
      </div>

      <div class="stack">
        <section class="panel random-panel">
          <div class="panel-title"><span class="star">✦</span> 今晚交给星星决定</div>
          <div class="stat-note" style="margin-top:4px">从你的想看片单中，随机为你推荐一部</div>
          <div class="constellation" aria-hidden="true"><svg viewBox="0 0 110 82"><path d="M9 37 L36 21 L62 31 L89 11 M62 31 L78 62" fill="none" stroke="rgba(196,181,255,.45)" stroke-width="1"/></svg><i></i><i></i><i></i><i></i><i></i></div>
          <div class="random-content">
            <div class="random-poster" id="randomPoster"></div>
            <div><div class="random-title" id="randomTitle">正在读取想看片单…</div><div class="random-meta" id="randomMeta">—</div><div class="random-quote" id="randomQuote">从你的真实想看片单中抽取一部作品。</div><div class="random-actions"><button class="primary" id="watchTonight">就看这一部 ✦</button><button class="secondary" id="reroll">换一部</button></div></div>
          </div>
        </section>
        <section class="panel insight">
          <div class="panel-title">这一月的星图</div>
          <div class="insight-grid"><div class="insight-item"><div class="n" id="monthRadarCount">0</div><div class="l">本月新增雷达</div></div><div class="insight-item"><div class="n" id="monthNinePlus">0</div><div class="l">9分以上</div></div><div class="insight-item"><div class="n" id="monthTopDirector">—</div><div class="l">最常见主创</div></div></div>
          <div class="quote-card">“每一部作品，都是一次平行宇宙的旅行。”<br><span style="color:#8f99b8">愿你在光影里，遇见更好的自己。</span></div>
        </section>
      </div>
    </section>'''
new='''    <section class="home-top-grid">
      <section class="panel" id="radar">
        <div class="panel-head"><div class="panel-title"><span class="star">✦</span> 本周电影雷达 <span class="panel-kicker">为你精选的值得关注</span></div><button class="link-btn" data-view-link="radar">查看全部 ›</button></div>
        <div class="radar-grid" id="radarGrid"></div>
      </section>
      <section class="panel random-panel">
        <div class="panel-title"><span class="star">✦</span> 今晚交给星星决定</div>
        <div class="stat-note" style="margin-top:4px">从你的想看片单中，随机为你推荐一部</div>
        <div class="constellation" aria-hidden="true"><svg viewBox="0 0 110 82"><path d="M9 37 L36 21 L62 31 L89 11 M62 31 L78 62" fill="none" stroke="rgba(196,181,255,.45)" stroke-width="1"/></svg><i></i><i></i><i></i><i></i><i></i></div>
        <div class="random-content"><div class="random-poster" id="randomPoster"></div><div><div class="random-title" id="randomTitle">正在读取想看片单…</div><div class="random-meta" id="randomMeta">—</div><div class="random-quote" id="randomQuote">从你的真实想看片单中抽取一部作品。</div><div class="random-actions"><button class="primary" id="watchTonight">就看这一部 ✦</button><button class="secondary" id="reroll">换一部</button></div></div></div>
      </section>
    </section>
    <section class="home-triple">
      <section class="panel" id="watched"><div class="panel-head"><div class="panel-title"><span class="star">★</span> 最近观看</div><button class="link-btn" id="recentSeeAll">查看全部 ›</button></div><div class="recent-grid" id="recentGrid"></div></section>
      <section class="panel" id="plan"><div class="panel-head"><div class="panel-title">本月观影计划</div><button class="link-btn" data-view-link="plan">查看日历 ›</button></div><div class="plan"><div class="plan-top"><div><div class="plan-count"><span id="planTopDone">0</span> / <span id="planTopAll">0</span></div><div class="stat-note" id="homePlanMonthLabel">本月</div></div><div style="text-align:right"><div class="plan-count" id="planPercent">0%</div><div class="stat-note">完成率</div></div></div><div class="progress"><i id="planBar"></i></div><div class="plan-list" id="planList"></div></div></section>
      <section class="panel insight"><div class="panel-title">这一月的星图</div><div class="insight-grid"><div class="insight-item"><div class="n" id="monthRadarCount">0</div><div class="l">本月新增雷达</div></div><div class="insight-item"><div class="n" id="monthNinePlus">0</div><div class="l">9分以上</div></div><div class="insight-item"><div class="n" id="monthTopDirector">—</div><div class="l">最常见主创</div></div></div><div class="quote-card">“每一部作品，都是一次平行宇宙的旅行。”<br><span style="color:#8f99b8">愿你在光影里，遇见更好的自己。</span></div></section>
    </section>'''
rep(old,new,'home layout')

rep('''  .dashboard{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(300px,.9fr);gap:18px;margin-top:18px}
  .stack{display:grid;gap:18px;align-content:start}''','''  .dashboard{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(300px,.9fr);gap:18px;margin-top:18px}
  .stack{display:grid;gap:18px;align-content:start}
  .home-top-grid{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(330px,.85fr);gap:18px;margin-top:18px;align-items:stretch}.home-top-grid>.panel{height:100%}
  .home-triple{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;margin-top:18px;align-items:stretch}.home-triple>.panel{height:100%;min-height:286px}.home-triple .recent-grid{grid-template-columns:repeat(2,minmax(0,1fr));align-content:start}.home-triple .recent{grid-template-columns:50px minmax(0,1fr)}.home-triple .mini-poster{width:50px;height:72px}.home-triple .insight{display:flex;flex-direction:column}.home-triple .quote-card{margin-top:auto}''','home css')
s=s.replace('.stats{grid-template-columns:repeat(2,1fr)}.dashboard{grid-template-columns:1fr}.lower-grid{grid-template-columns:1fr}.hero::before{width:120px;height:120px}', '.stats{grid-template-columns:repeat(2,1fr)}.dashboard{grid-template-columns:1fr}.lower-grid{grid-template-columns:1fr}.home-top-grid{grid-template-columns:1fr}.home-triple{grid-template-columns:1fr 1fr}.home-triple .insight{grid-column:1/-1}.hero::before{width:120px;height:120px}',1)
s=s.replace('.radar-grid{grid-template-columns:1fr 1fr}.recent-grid{grid-template-columns:1fr}.random-content{grid-template-columns:94px 1fr}', '.radar-grid{grid-template-columns:1fr 1fr}.recent-grid{grid-template-columns:1fr}.home-triple{grid-template-columns:1fr}.home-triple .insight{grid-column:auto}.home-triple .recent-grid{grid-template-columns:1fr}.random-content{grid-template-columns:94px 1fr}',1)

# Remove quote source UI.
rep('''        <button class="quote-action" type="button" id="quoteSourceBtn" title="查看原始来源">◎ 看出处</button>\n''','', 'quote source button')
s=re.sub(r'\n<dialog class="movie-modal" id="quoteSourceDialog">.*?</dialog>\n','\n',s,count=1,flags=re.S)
for line in [
"  if(els.quoteSourceBtn)els.quoteSourceBtn.addEventListener('click',e=>{e.stopPropagation();showQuoteSource()});\n",
"  if(els.sidebarQuoteText)els.sidebarQuoteText.addEventListener('click',()=>showQuoteSource());\n",
"  if(els.quoteSourceClose)els.quoteSourceClose.addEventListener('click',()=>els.quoteSourceDialog.close());\n",
"  if(els.quoteSourceDone)els.quoteSourceDone.addEventListener('click',()=>els.quoteSourceDialog.close());\n",
"  if(els.quoteSourceNext)els.quoteSourceNext.addEventListener('click',()=>{chooseVerifiedQuote({avoidCurrent:true});showQuoteSource()});\n",
"    showSource:()=>showQuoteSource(),\n"]: s=s.replace(line,'')

# Bulk title add.
rep('''              <button class="tool-btn" id="clearLibFilters">清除筛选</button>
              <button class="tool-btn gold" id="addMovieBtn">＋ 添加影视</button>''','''              <button class="tool-btn" id="clearLibFilters">清除筛选</button>
              <button class="tool-btn" id="bulkAddTitlesBtn">＋ 批量添加片名</button>
              <button class="tool-btn gold" id="addMovieBtn">＋ 添加影视</button>''','bulk add button')
bulk='''<dialog class="movie-modal" id="bulkAddTitlesDialog">
  <div class="modal-head"><div><div class="eyebrow">BULK TITLE IMPORT</div><h3>批量添加片名</h3></div><button class="modal-close" type="button" id="bulkAddTitlesClose">×</button></div>
  <div class="modal-body"><div class="data-note">每行一部影视。支持“中文名 / 外文原名”，也可以直接粘贴带序号的片单；已存在的同名作品会自动跳过。</div><textarea id="bulkAddTitlesText" class="bulk-title-textarea" placeholder="爱乐之城 / La La Land&#10;爆裂鼓手 / Whiplash&#10;花样年华&#10;1. 公民凯恩"></textarea><div id="bulkAddTitlesStatus" class="tmdb-status">新条目会先以“待识别”加入影视库，之后可统一进入 TMDb 匹配中心补全。</div></div>
  <div class="modal-foot"><button type="button" id="bulkAddTitlesCancel">取消</button><button type="button" id="bulkAddTitlesOnly">只添加</button><button class="save" type="button" id="bulkAddTitlesMatch">添加并打开匹配中心</button></div>
</dialog>\n\n'''
rep('<dialog class="movie-modal" id="movieModal">',bulk+'<dialog class="movie-modal" id="movieModal">','bulk dialog')

# Settings: two useful columns, remove the four obsolete cards.
rep('''            <section class="settings-card">
              <div class="settings-card-head"><h3>TMDb · 影视资料补全</h3></div>''','''          </div>
          <div class="settings-stack">
            <section class="settings-card">
              <div class="settings-card-head"><h3>TMDb · 影视资料补全</h3></div>''','settings split')
s=re.sub(r'\n\s*<aside class="settings-stack">\s*<section class="settings-card">\s*<div class="settings-card-head"><h3>本地数据概览</h3>.*?</aside>','',s,count=1,flags=re.S)
rep('''                <div class="setting-row"><div class="setting-copy"><b>TMDb API Key / Read Access Token</b><span>用于搜索并补全影视资料。</span></div><div class="setting-control"><input id="settingsTmdbKey" type="password" autocomplete="off" placeholder="输入 API Key 或 API Read Access Token"></div></div>''','''                <div class="setting-row"><div class="setting-copy"><b>TMDb API Key / Read Access Token</b><span>首次填写一次即可，之后保存在当前浏览器，用于搜索并补全影视资料。</span></div><div class="setting-control"><input id="settingsTmdbKey" type="password" autocomplete="off" placeholder="输入 API Key 或 Read Access Token"></div></div>''','tmdb copy')
s=s.replace('需要先在 <b>设置 → TMDb</b> 保存凭证。','首次在 <b>设置 → TMDb</b> 填写并保存一次即可。',1)

# Douban pictorial guide.
guide='''                <div class="data-note">支持导入豆瓣“想看 / 看过”HTML、CSV 或 JSON，文件仅在本地解析。</div>
                <details class="douban-guide"><summary>查看批量导入图文教程 <span>4 步完成</span></summary><div class="douban-guide-steps">
                  <article class="douban-guide-step"><div class="douban-guide-visual"><div class="guide-browser"><i></i><i></i><i></i></div><div class="guide-screen"><b>豆瓣电影 · 我的主页</b><span class="guide-pill">看过</span><span class="guide-pill">想看</span><em>进入需要导出的片单列表</em></div></div><b>1. 打开豆瓣片单</b><p>在电脑浏览器进入豆瓣电影个人主页，打开“看过”或“想看”列表。</p></article>
                  <article class="douban-guide-step"><div class="douban-guide-visual"><div class="guide-save"><kbd>Ctrl</kbd><b>+</b><kbd>S</kbd><span>Mac：⌘ S</span></div><div class="guide-file">HTML</div></div><b>2. 每页保存为 HTML</b><p>在列表页按 Ctrl+S（Mac 按 ⌘S），保存网页。不要保存成截图或 PDF。</p></article>
                  <article class="douban-guide-step"><div class="douban-guide-visual"><div class="guide-pages"><span>01.html</span><span>02.html</span><span>03.html</span><b>…</b></div></div><b>3. 多页一起选择</b><p>片单有多页就逐页保存。回到这里一次选择全部 HTML 文件，可同时导入几十页。</p></article>
                  <article class="douban-guide-step"><div class="douban-guide-visual"><div class="guide-drop">⇩<b>拖入全部文件</b><span>预览 → 导入 → TMDb 补全</span></div></div><b>4. 预览后导入</b><p>确认识别数量后点击“导入豆瓣片单”。重复导入会按豆瓣 ID 更新，不会重复堆叠。</p></article>
                </div><div class="douban-guide-tip">提示：豆瓣“看过”的标记日期只会作为观看日期保存，不参与 TMDb 影片身份匹配。</div></details>'''
rep('''                <div class="data-note">支持导入豆瓣“想看 / 看过”HTML、CSV 或 JSON，文件仅在本地解析。</div>''',guide,'douban guide')

rep('''.settings-title p{margin:8px 0 0;color:#a9b3cf;font-size:13px}.settings-layout{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(300px,.8fr);gap:18px}.settings-stack{display:grid;gap:16px;align-content:start}.settings-card{''','''.settings-title p{margin:8px 0 0;color:#a9b3cf;font-size:13px}.settings-layout{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;align-items:start}.settings-stack{display:grid;gap:16px;align-content:start;min-width:0}.settings-card{''','settings css')
s=s.replace('@media(max-width:1120px){.settings-layout{grid-template-columns:1fr}.theme-presets{grid-template-columns:repeat(4,1fr)}}','@media(max-width:1180px){.settings-layout{grid-template-columns:1fr}.theme-presets{grid-template-columns:repeat(4,1fr)}}',1)
extra='''  .bulk-title-textarea{width:100%;min-height:310px;margin-top:12px;border:1px solid var(--line);border-radius:14px;background:rgba(5,14,34,.78);color:#edf1ff;padding:13px 14px;outline:none;resize:vertical;line-height:1.75;font:12px/1.75 ui-monospace,SFMono-Regular,Menlo,"Microsoft YaHei",sans-serif}.bulk-title-textarea:focus{border-color:rgba(159,124,255,.5);box-shadow:0 0 0 3px rgba(159,124,255,.07)}
  .douban-guide{border:1px solid rgba(159,124,255,.16);border-radius:14px;background:linear-gradient(135deg,rgba(109,82,216,.07),rgba(78,158,255,.025));overflow:hidden}.douban-guide summary{list-style:none;cursor:pointer;padding:12px 13px;color:#dfe4f6;font-size:11px;font-weight:650;display:flex;align-items:center;gap:7px}.douban-guide summary::-webkit-details-marker{display:none}.douban-guide summary::before{content:"▸";color:#b8a6ff}.douban-guide[open] summary::before{content:"▾"}.douban-guide summary span{margin-left:auto;color:#7f8ba8;font-size:9px;font-weight:400}.douban-guide-steps{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:0 12px 12px}.douban-guide-step{border:1px solid rgba(255,255,255,.055);border-radius:12px;background:rgba(5,14,34,.46);padding:10px;min-width:0}.douban-guide-step>b{display:block;font-size:10px;color:#e8ecf8;margin-top:8px}.douban-guide-step p{margin:4px 0 0;color:#8995b2;font-size:9px;line-height:1.6}.douban-guide-visual{height:92px;border-radius:10px;border:1px solid rgba(153,168,214,.12);background:linear-gradient(145deg,#0c1835,#111b3a);position:relative;overflow:hidden;padding:10px}.guide-browser{height:12px;display:flex;gap:4px}.guide-browser i{width:5px;height:5px;border-radius:50%;background:#66718f}.guide-browser i:nth-child(1){background:#e88991}.guide-browser i:nth-child(2){background:#d5b15d}.guide-browser i:nth-child(3){background:#65b28e}.guide-screen{display:flex;gap:5px;align-items:center;flex-wrap:wrap;padding-top:6px}.guide-screen>b{width:100%;font-size:8px;color:#cfd7ec}.guide-screen em{width:100%;font-size:7px;color:#697690;font-style:normal;margin-top:4px}.guide-pill{font-size:7px;padding:3px 6px;border-radius:999px;background:rgba(93,164,118,.14);color:#8ad0a3}.guide-save{height:100%;display:flex;align-items:center;justify-content:center;gap:5px;flex-wrap:wrap}.guide-save kbd{font:700 12px ui-monospace,monospace;color:#f2f4fa;background:#172341;border:1px solid #34466e;border-bottom-width:3px;border-radius:7px;padding:5px 8px}.guide-save>b{font-size:10px;color:#8b96b3}.guide-save span{width:100%;text-align:center;font-size:7px;color:#6f7d99}.guide-file{position:absolute;right:10px;bottom:8px;font:700 8px ui-monospace,monospace;color:#84caff}.guide-pages{height:100%;display:grid;grid-template-columns:repeat(3,1fr);gap:6px;align-items:center}.guide-pages span{height:54px;border:1px solid rgba(151,168,214,.16);border-radius:7px;background:rgba(255,255,255,.035);display:grid;place-items:center;font-size:7px;color:#9ba8c5}.guide-pages b{position:absolute;right:7px;bottom:3px;color:#6e7a97}.guide-drop{height:100%;display:grid;place-items:center;align-content:center;gap:5px;border:1px dashed rgba(159,124,255,.28);border-radius:8px;color:#b9a7ff;font-size:18px}.guide-drop b{font-size:9px;color:#dce2f1}.guide-drop span{font-size:7px;color:#71809d}.douban-guide-tip{margin:0 12px 12px;padding:9px 10px;border-radius:9px;background:rgba(245,198,108,.055);color:#a79878;font-size:8px;line-height:1.55}@media(max-width:760px){.douban-guide-steps{grid-template-columns:1fr}}
'''
rep('''  .douban-drop{border:1px dashed rgba(159,124,255,.34);border-radius:14px;padding:16px;background:linear-gradient(135deg,rgba(112,79,219,.08),rgba(78,158,255,.035));text-align:center;color:#9eabc8;transition:.18s ease;cursor:pointer}''',extra+'''  .douban-drop{border:1px dashed rgba(159,124,255,.34);border-radius:14px;padding:16px;background:linear-gradient(135deg,rgba(112,79,219,.08),rgba(78,158,255,.035));text-align:center;color:#9eabc8;transition:.18s ease;cursor:pointer}''','extra css')

# JS refs, functions and listeners for bulk add.
rep("clearLibFilters:$('clearLibFilters'),addMovieBtn:$('addMovieBtn'),batchTmdbBtn:$('batchTmdbBtn')","clearLibFilters:$('clearLibFilters'),bulkAddTitlesBtn:$('bulkAddTitlesBtn'),bulkAddTitlesDialog:$('bulkAddTitlesDialog'),bulkAddTitlesClose:$('bulkAddTitlesClose'),bulkAddTitlesCancel:$('bulkAddTitlesCancel'),bulkAddTitlesText:$('bulkAddTitlesText'),bulkAddTitlesStatus:$('bulkAddTitlesStatus'),bulkAddTitlesOnly:$('bulkAddTitlesOnly'),bulkAddTitlesMatch:$('bulkAddTitlesMatch'),addMovieBtn:$('addMovieBtn'),batchTmdbBtn:$('batchTmdbBtn')",'bulk refs')
marker='''  function openMovieModal(id=null){libraryState.editingId=id;'''
func='''  function normalizeBulkTitleLine(line){let v=String(line||'').trim();v=v.replace(/^\\s*(?:(?:[-*•]+)|(?:\\d+[.、)）])|(?:[（(]\\d+[）)]))\\s*/,'').trim();v=v.replace(/^《(.+)》$/,'$1').trim();return v}
  function parseBulkTitles(raw){const seen=new Set(),rows=[];for(const line of String(raw||'').split(/\\r?\\n/)){const clean=normalizeBulkTitleLine(line);if(!clean)continue;const pair=doubanParseTitlePair(clean),title=String(pair.title||'').trim(),originalTitle=String(pair.originalTitle||'').trim();if(!title)continue;const key=cleanTmdbTitle(originalTitle||title);if(!key||seen.has(key))continue;seen.add(key);rows.push({title,originalTitle})}return rows}
  function openBulkAddTitles(){els.bulkAddTitlesText.value='';els.bulkAddTitlesStatus.className='tmdb-status';els.bulkAddTitlesStatus.textContent='新条目会先以“待识别”加入影视库，之后可统一进入 TMDb 匹配中心补全。';els.bulkAddTitlesDialog.showModal();setTimeout(()=>els.bulkAddTitlesText.focus(),0)}
  function addBulkTitles(openMatch=false){const rows=parseBulkTitles(els.bulkAddTitlesText.value);if(!rows.length){els.bulkAddTitlesStatus.className='tmdb-status bad';els.bulkAddTitlesStatus.textContent='没有识别到片名，请按“每行一部”粘贴片单。';return}let added=0,skipped=0;for(const row of rows){const t=cleanTmdbTitle(row.title),o=cleanTmdbTitle(row.originalTitle),exists=(appState.movies||[]).some(m=>{const mt=cleanTmdbTitle(m.info?.title),mo=cleanTmdbTitle(m.info?.originalTitle);return(t&&(t===mt||t===mo))||(o&&(o===mt||o===mo))});if(exists){skipped++;continue}appState.movies.push(normalizeMovie({id:uid(),mediaType:'unknown',info:{title:row.title,originalTitle:row.originalTitle},personal:{status:'want',rating:null,tags:[],shortReview:'',favorite:false},watchHistory:[],plans:[],radar:{discovered:false,ignored:false}}));added++}save();renderAll();els.bulkAddTitlesDialog.close();toastMsg(`批量添加完成：新增 ${added} 部${skipped?` · 跳过 ${skipped} 部已存在作品`:''}`);if(openMatch){setView('match');renderMatchCenter()}}
  function openMovieModal(id=null){libraryState.editingId=id;'''
rep(marker,func,'bulk functions')
rep("  els.clearLibFilters.addEventListener('click',clearFilters);els.addMovieBtn.addEventListener('click',()=>openMovieModal());els.quickAdd.addEventListener('click',()=>openMovieModal());","  els.clearLibFilters.addEventListener('click',clearFilters);els.bulkAddTitlesBtn.addEventListener('click',openBulkAddTitles);els.bulkAddTitlesClose.addEventListener('click',()=>els.bulkAddTitlesDialog.close());els.bulkAddTitlesCancel.addEventListener('click',()=>els.bulkAddTitlesDialog.close());els.bulkAddTitlesOnly.addEventListener('click',()=>addBulkTitles(false));els.bulkAddTitlesMatch.addEventListener('click',()=>addBulkTitles(true));els.addMovieBtn.addEventListener('click',()=>openMovieModal());els.quickAdd.addEventListener('click',()=>openMovieModal());",'bulk listeners')

# Removed settings cards leave nullable refs; keep storage size text working.
old_update="""  function updateSettingsStorage(){if(!els.settingsMovieCount)return;const movies=appState.movies||[],watch=movies.reduce((n,m)=>n+(m.watchHistory||[]).length,0),plans=movies.reduce((n,m)=>n+(m.plans||[]).length,0),radar=(appState.home?.radar||[]).length,raw=localStorage.getItem(V2_KEY)||'',bytes=new Blob([raw]).size,kb=bytes/1024;els.settingsMovieCount.textContent=movies.length;els.settingsWatchCount.textContent=watch;els.settingsPlanCount.textContent=plans;els.settingsRadarCount.textContent=radar;if(els.settingsStorageCopy)els.settingsStorageCopy.textContent=`当前本地数据约 ${kb<1024?kb.toFixed(1)+' KB':(kb/1024).toFixed(2)+' MB'} · 建议定期导出完整备份。`;const latest=movies.map(m=>m.updatedAt).filter(Boolean).sort().at(-1);els.settingsLastUpdated.textContent=latest?`最近更新 ${String(latest).slice(0,10)}`:'暂无更新记录'}"""
new_update="""  function updateSettingsStorage(){const movies=appState.movies||[],watch=movies.reduce((n,m)=>n+(m.watchHistory||[]).length,0),plans=movies.reduce((n,m)=>n+(m.plans||[]).length,0),radar=(appState.home?.radar||[]).length,raw=localStorage.getItem(V2_KEY)||'',bytes=new Blob([raw]).size,kb=bytes/1024;if(els.settingsMovieCount)els.settingsMovieCount.textContent=movies.length;if(els.settingsWatchCount)els.settingsWatchCount.textContent=watch;if(els.settingsPlanCount)els.settingsPlanCount.textContent=plans;if(els.settingsRadarCount)els.settingsRadarCount.textContent=radar;if(els.settingsStorageCopy)els.settingsStorageCopy.textContent=`当前本地数据约 ${kb<1024?kb.toFixed(1)+' KB':(kb/1024).toFixed(2)+' MB'} · 建议定期导出完整备份。`;const latest=movies.map(m=>m.updatedAt).filter(Boolean).sort().at(-1);if(els.settingsLastUpdated)els.settingsLastUpdated.textContent=latest?`最近更新 ${String(latest).slice(0,10)}`:'暂无更新记录'}"""
rep(old_update,new_update,'storage guard')
s=s.replace("els.settingsExportJson.addEventListener('click',exportFullBackup);els.settingsCleanupLegacySeed.addEventListener('click',cleanupLegacySeedArtifacts);els.settingsExportCsv.addEventListener('click',exportMoviesCsv);","els.settingsExportJson.addEventListener('click',exportFullBackup);if(els.settingsCleanupLegacySeed)els.settingsCleanupLegacySeed.addEventListener('click',cleanupLegacySeedArtifacts);els.settingsExportCsv.addEventListener('click',exportMoviesCsv);",1)
s=s.replace("  els.settingsClearData.addEventListener('click',()=>{","  if(els.settingsClearData)els.settingsClearData.addEventListener('click',()=>{",1)

# Public test build deliberately does not hard-code the user's TMDb credential.
s=s.replace("  const DEFAULT_SETTINGS={profileName:","  // Public test build: TMDb credentials are never hard-coded; each browser stores its own key locally.\n  const DEFAULT_SETTINGS={profileName:",1)

p.write_text(s,encoding='utf-8')
print('patched index.html',len(s),'delta',len(s)-len(orig))
