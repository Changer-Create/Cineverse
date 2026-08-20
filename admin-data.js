(() => {
  'use strict';

  const APP_KEY = 'movie-collection-v2';
  const TMDB_PROXY_URL = 'https://bjjralybdcuczwllxbvo.supabase.co/functions/v1/tmdb-proxy';
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const esc = v => String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const escAttr = esc;
  const splitList = v => String(v||'').split(/[\/，,、;；]+/).map(x=>x.trim()).filter(Boolean);
  const uid = (prefix='m') => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2,8)}`;
  const nowIso = () => new Date().toISOString();
  const localToday = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const currentMonth = () => localToday().slice(0,7);
  const monthLabel = v => { const [y,m]=String(v||'').split('-'); return y&&m?`${y} 年 ${Number(m)} 月`:v||''; };

  function toast(msg){
    const el=$('#toast'); if(!el) return;
    el.textContent=msg; el.classList.add('show'); clearTimeout(toast.t);
    toast.t=setTimeout(()=>el.classList.remove('show'),2200);
  }

  function readState(){
    try{
      const raw=JSON.parse(localStorage.getItem(APP_KEY)||'null');
      return raw && typeof raw==='object' ? normalizeState(raw) : normalizeState({});
    }catch{ return normalizeState({}); }
  }
  function normalizeState(s){
    s.movies=Array.isArray(s.movies)?s.movies:[];
    s.home=s.home&&typeof s.home==='object'?s.home:{};
    s.home.radar=Array.isArray(s.home.radar)?s.home.radar:[];
    s.home.featured=Array.isArray(s.home.featured)?[...new Set(s.home.featured.filter(Boolean))]:[];
    return s;
  }
  function writeState(state,msg='已保存到影视收藏夹'){
    localStorage.setItem(APP_KEY,JSON.stringify(normalizeState(state)));
    refreshAll();
    toast(msg);
  }
  let state=readState();

  function movieStatusLabel(m){
    const v=m?.personal?.status||'want';
    return ({follow:'关注',want:'想看',watching:'在看',watched:'已看',paused:'暂停',dropped:'弃剧'})[v]||v;
  }
  function ensureMovie(m={}){
    const info=m.info||{}, personal=m.personal||{};
    return {
      ...m,
      id:m.id||uid('m'),
      mediaType:['movie','tv','unknown'].includes(m.mediaType)?m.mediaType:'movie',
      info:{
        title:info.title||'', originalTitle:info.originalTitle||'', year:info.year?Number(info.year):null,
        releaseDate:info.releaseDate||'', firstAirDate:info.firstAirDate||info.releaseDate||'', lastAirDate:info.lastAirDate||'',
        numberOfSeasons:info.numberOfSeasons!=null&&info.numberOfSeasons!==''?Number(info.numberOfSeasons):null,
        numberOfEpisodes:info.numberOfEpisodes!=null&&info.numberOfEpisodes!==''?Number(info.numberOfEpisodes):null,
        tvStatus:info.tvStatus||'', directors:Array.isArray(info.directors)?info.directors:splitList(info.directors),
        countries:Array.isArray(info.countries)?info.countries:splitList(info.countries), runtime:info.runtime?Number(info.runtime):null,
        genres:Array.isArray(info.genres)?info.genres:splitList(info.genres), posterUrl:info.posterUrl||'', overview:info.overview||'',
        tmdbId:info.tmdbId||null, doubanId:info.doubanId||null
      },
      personal:{
        status:personal.status||'want', rating:personal.rating!==''&&personal.rating!=null?Number(personal.rating):null,
        tags:Array.isArray(personal.tags)?personal.tags:splitList(personal.tags), shortReview:personal.shortReview||'', favorite:Boolean(personal.favorite)
      },
      watchHistory:Array.isArray(m.watchHistory)?m.watchHistory:[], plans:Array.isArray(m.plans)?m.plans:[],
      radar:m.radar||{discovered:false,ignored:false}, external:m.external||{},
      createdAt:m.createdAt||nowIso(), updatedAt:nowIso()
    };
  }
  function ensureRadar(r={},i=0){
    return {
      ...r,
      id:r.id||uid('radar'), title:String(r.title||'').trim(), year:r.year?Number(r.year):null,
      releaseDate:r.releaseDate||'', meta:r.meta||'', public:r.public!==''&&r.public!=null?Number(r.public):null,
      match:r.match!==''&&r.match!=null?Number(r.match):null, badge:r.badge||'值得关注',
      kind:r.kind||((Number(r.match)||0)>=93?'hot':(Number(r.public)||0)>=9?'good':'focus'),
      poster:r.poster||`p${(i%4)+1}`, posterUrl:r.posterUrl||'', category:r.category||'week',
      reason:r.reason||'这部电影值得继续观察，等待更多口碑与个人观看判断。',
      discoveredAt:r.discoveredAt||localToday(), source:r.source||'后台手动维护', ignored:Boolean(r.ignored),
      runtime:r.runtime?Number(r.runtime):null, directors:Array.isArray(r.directors)?r.directors:splitList(r.directors),
      countries:Array.isArray(r.countries)?r.countries:splitList(r.countries), genres:Array.isArray(r.genres)?r.genres:splitList(r.genres),
      tmdbId:r.tmdbId||null
    };
  }

  function injectStyle(){
    const style=document.createElement('style');
    style.textContent=`
      .ops-table{width:100%;border-collapse:collapse;font-size:11px}.ops-table th,.ops-table td{padding:11px 10px;border-bottom:1px solid rgba(255,255,255,.055);text-align:left;vertical-align:middle}.ops-table th{color:#8792af;font-weight:500;font-size:9px;letter-spacing:.05em}.ops-table tr:hover td{background:rgba(255,255,255,.018)}
      .ops-title{display:flex;align-items:center;gap:9px;min-width:210px}.ops-poster{width:34px;height:46px;border-radius:7px;object-fit:cover;background:#111d38;flex:0 0 auto}.ops-title b{display:block;font-size:12px}.ops-title small{display:block;color:#75819f;margin-top:3px}.pill{display:inline-flex;align-items:center;border:1px solid var(--line);border-radius:999px;padding:4px 7px;font-size:9px;color:#aeb8d3}.pill.on{color:#d9ccff;border-color:rgba(159,124,255,.32);background:rgba(159,124,255,.08)}
      .ops-actions{display:flex;gap:6px;flex-wrap:wrap}.btn.mini{padding:6px 8px;font-size:9px}.ops-form{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:11px}.ops-form .wide{grid-column:1/-1}.ops-form .span2{grid-column:span 2}.ops-form input,.ops-form select,.ops-form textarea{width:100%;border:1px solid var(--line);background:#08132d;color:var(--text);border-radius:10px;padding:9px 10px;outline:none}.ops-form textarea{min-height:78px;resize:vertical}.ops-form label{display:grid;gap:6px;color:#929dbc;font-size:9px}.ops-form label>span{color:#929dbc}.ops-split{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(280px,.7fr);gap:14px;align-items:start}.ops-card{border:1px solid rgba(255,255,255,.055);border-radius:14px;padding:14px;background:rgba(255,255,255,.018)}.ops-card h3{font-size:12px;margin:0 0 9px}.ops-card p{margin:0;color:#8490ad;font-size:10px;line-height:1.7}.ops-list{display:grid;gap:9px}.ops-item{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;border:1px solid rgba(255,255,255,.055);border-radius:12px;padding:11px;background:rgba(255,255,255,.016)}.ops-item b{font-size:11px}.ops-item small{display:block;color:#7f8ba8;font-size:9px;margin-top:4px}.drag-hint{color:#697795;font-size:9px}.ops-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}.ops-kpi{border:1px solid rgba(255,255,255,.055);border-radius:13px;padding:12px;background:rgba(255,255,255,.018)}.ops-kpi span{font-size:9px;color:#7886a7}.ops-kpi b{display:block;font:600 21px Georgia,serif;margin-top:4px}.empty-ops{padding:32px 14px;text-align:center;color:#7784a4;font-size:10px}.tmdb-results{display:grid;gap:7px;margin-top:10px}.tmdb-hit{display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:10px;align-items:center;border:1px solid rgba(255,255,255,.055);border-radius:11px;padding:8px}.tmdb-hit img{width:44px;height:62px;object-fit:cover;border-radius:7px;background:#101a33}.tmdb-hit b{font-size:10px}.tmdb-hit small{display:block;color:#7d89a7;font-size:9px;margin-top:3px}.ops-check{display:flex!important;grid-template-columns:auto 1fr!important;align-items:center;gap:8px!important}.ops-check input{width:auto!important}.ops-callout{border:1px solid rgba(245,198,108,.17);background:rgba(96,70,25,.08);border-radius:13px;padding:12px;color:#aa9c79;font-size:10px;line-height:1.7;margin-bottom:12px}
      @media(max-width:1000px){.ops-form{grid-template-columns:1fr 1fr}.ops-split{grid-template-columns:1fr}.ops-kpis{grid-template-columns:1fr 1fr}.ops-table{min-width:760px}.table-wrap{overflow:auto}.ops-form .span2{grid-column:auto}.nav{grid-template-columns:repeat(4,1fr)!important}}
      @media(max-width:650px){.ops-form{grid-template-columns:1fr}.ops-form .wide{grid-column:auto}.ops-kpis{grid-template-columns:1fr 1fr}.nav{grid-template-columns:1fr 1fr!important}}
    `;
    document.head.appendChild(style);
  }

  function addNav(tab,label,icon){
    const nav=$('.nav'); if(!nav||nav.querySelector(`[data-tab="${tab}"]`)) return;
    const b=document.createElement('button'); b.dataset.tab=tab; b.innerHTML=`${icon} ${label}`;
    b.addEventListener('click',()=>activate(tab)); nav.appendChild(b);
  }
  function activate(tab){
    $$('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
    $$('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${tab}`));
    if(tab==='movies')renderMovies(); if(tab==='homeops')renderHomeOps(); if(tab==='radarops')renderRadarOps(); if(tab==='plansops')renderPlans();
  }
  function addView(id,html){
    const main=$('.main'); if(!main||$(`#view-${id}`)) return;
    const s=document.createElement('section'); s.className='view'; s.id=`view-${id}`; s.innerHTML=html; main.appendChild(s);
  }

  function injectUi(){
    injectStyle();
    const brand=$('.brand b'); if(brand)brand.textContent='管理后台 V1.1';
    const hero=$('.hero h1'); if(hero)hero.textContent='影视收藏夹管理后台 V1.1';
    const heroP=$('.hero p'); if(heroP)heroP.textContent='内容中心之外，新增影视条目、首页推荐位、电影雷达与月度计划的日常运营维护。';

    addNav('movies','影视条目','▤');
    addNav('homeops','首页运营','⌂');
    addNav('radarops','电影雷达','✦');
    addNav('plansops','月度计划','◫');
    const nav=$('.nav'); ['overview','movies','homeops','radarops','plansops','copy','quotes','data'].forEach(tab=>{const b=nav?.querySelector(`[data-tab="${tab}"]`);if(b)nav.appendChild(b)});

    addView('movies',`
      <section class="panel"><div class="panel-head"><h2>影视条目管理</h2><div><button class="btn" id="movieTmdbOpen">TMDb 快速添加</button> <button class="btn primary" id="movieAdd">＋ 新增条目</button></div></div><div class="panel-body">
        <div class="ops-kpis" id="movieKpis"></div>
        <div class="toolbar"><input id="movieAdminSearch" placeholder="搜索片名、导演、标签、TMDb ID…"><select id="movieAdminType"><option value="">全部类型</option><option value="movie">电影</option><option value="tv">剧集</option><option value="unknown">未识别</option></select><select id="movieAdminStatus"><option value="">全部状态</option><option value="want">想看</option><option value="watching">在看</option><option value="watched">已看</option><option value="follow">关注</option><option value="paused">暂停</option><option value="dropped">弃剧</option></select></div>
        <div class="table-wrap"><table class="ops-table"><thead><tr><th>作品</th><th>类型</th><th>状态</th><th>评分</th><th>观看</th><th>计划</th><th>操作</th></tr></thead><tbody id="movieAdminRows"></tbody></table></div>
      </div></section>
      <div style="height:14px"></div>
      <section class="panel" id="movieEditorPanel" style="display:none"><div class="panel-head"><h2 id="movieEditorTitle">新增影视条目</h2><button class="btn" id="movieEditorClose">关闭</button></div><div class="panel-body"><form class="ops-form" id="movieEditor">
        <input type="hidden" id="meId"><label><span>片名 *</span><input id="meTitle" required></label><label><span>原名</span><input id="meOriginal"></label><label><span>类型</span><select id="meType"><option value="movie">电影</option><option value="tv">剧集</option><option value="unknown">未识别</option></select></label>
        <label><span>年份</span><input id="meYear" type="number" min="1880" max="2100"></label><label><span>上映 / 首播日期</span><input id="meRelease" type="date"></label><label><span>片长（分钟）</span><input id="meRuntime" type="number" min="1"></label>
        <label><span>导演</span><input id="meDirectors" placeholder="多人用 / 分隔"></label><label><span>国家 / 地区</span><input id="meCountries"></label><label><span>类型标签</span><input id="meGenres"></label>
        <label><span>个人状态</span><select id="meStatus"><option value="want">想看</option><option value="follow">关注</option><option value="watching">在看</option><option value="watched">已看</option><option value="paused">暂停</option><option value="dropped">弃剧</option></select></label><label><span>个人评分（0-10）</span><input id="meRating" type="number" min="0" max="10" step="0.1"></label><label class="ops-check"><input id="meFavorite" type="checkbox"><span>设为收藏 / 喜爱</span></label>
        <label class="span2"><span>个人标签</span><input id="meTags"></label><label><span>TMDb ID</span><input id="meTmdb" type="number"></label>
        <label class="wide"><span>海报 URL</span><input id="mePoster"></label><label class="wide"><span>简介</span><textarea id="meOverview"></textarea></label><label class="wide"><span>短评 / 备注</span><textarea id="meReview"></textarea></label>
        <div class="wide"><button class="btn primary" type="submit">保存影视条目</button></div>
      </form></div></section>
      <section class="panel" id="tmdbAdminPanel" style="display:none;margin-top:14px"><div class="panel-head"><h2>TMDb 快速添加</h2><button class="btn" id="tmdbAdminClose">关闭</button></div><div class="panel-body"><div class="toolbar"><input id="tmdbAdminQuery" placeholder="输入中文片名或原名…"><select id="tmdbAdminMedia"><option value="movie">电影</option><option value="tv">剧集</option></select><button class="btn primary" id="tmdbAdminSearch">搜索</button></div><div class="note" id="tmdbAdminState">通过现有 Supabase TMDb 代理读取公开影视资料。</div><div class="tmdb-results" id="tmdbAdminResults"></div></div></section>
    `);

    addView('homeops',`
      <section class="panel"><div class="panel-head"><h2>首页运营 ·「今晚看什么」推荐池</h2><button class="btn" id="homeOpenFront">打开前台首页</button></div><div class="panel-body">
        <div class="ops-callout">首页的「最近观看」「本月计划」「电影雷达」仍由真实数据自动生成，不在后台制造重复配置。这里仅管理「今晚看什么」的优先推荐池：设置后先从推荐池中随机；池内没有可用“想看”作品时自动回退到全部想看片单。</div>
        <div class="ops-split"><div><div class="ops-list" id="featuredList"></div></div><div class="ops-card"><h3>加入推荐池</h3><p>建议放 3–8 部近期确实想看的作品。已看或不再处于“想看”状态的条目不会进入前台抽取。</p><div style="height:10px"></div><select id="featuredMovieSelect" style="width:100%;border:1px solid var(--line);background:#08132d;color:var(--text);border-radius:10px;padding:9px"></select><div style="height:8px"></div><button class="btn primary" id="featuredAdd">＋ 加入推荐池</button></div></div>
      </div></section>
    `);

    addView('radarops',`
      <section class="panel"><div class="panel-head"><h2>电影雷达管理</h2><button class="btn primary" id="radarAdd">＋ 手动新增雷达</button></div><div class="panel-body">
        <div class="ops-kpis" id="radarKpis"></div><div class="toolbar"><input id="radarAdminSearch" placeholder="搜索片名、来源、理由…"><select id="radarAdminCategory"><option value="">全部分类</option><option value="week">本周雷达</option><option value="upcoming">即将上映</option></select><select id="radarAdminVisible"><option value="">全部状态</option><option value="active">关注中</option><option value="ignored">已忽略</option></select></div>
        <div class="table-wrap"><table class="ops-table"><thead><tr><th>作品</th><th>分类</th><th>公众口碑</th><th>匹配度</th><th>来源</th><th>状态</th><th>操作</th></tr></thead><tbody id="radarAdminRows"></tbody></table></div>
      </div></section>
      <section class="panel" id="radarEditorPanel" style="display:none;margin-top:14px"><div class="panel-head"><h2 id="radarEditorTitle">新增雷达</h2><button class="btn" id="radarEditorClose">关闭</button></div><div class="panel-body"><form class="ops-form" id="radarEditor"><input type="hidden" id="reId">
        <label><span>片名 *</span><input id="reTitle" required></label><label><span>年份</span><input id="reYear" type="number"></label><label><span>上映日期</span><input id="reRelease" type="date"></label>
        <label><span>分类</span><select id="reCategory"><option value="week">本周雷达</option><option value="upcoming">即将上映</option></select></label><label><span>公众口碑（0-10）</span><input id="rePublic" type="number" min="0" max="10" step="0.1"></label><label><span>匹配度（0-100）</span><input id="reMatch" type="number" min="0" max="100"></label>
        <label><span>徽标</span><input id="reBadge" placeholder="强烈推荐 / 高口碑 / 值得关注"></label><label><span>来源</span><input id="reSource" placeholder="TMDb 自动雷达 / 手动策展"></label><label class="ops-check"><input id="reIgnored" type="checkbox"><span>设为已忽略</span></label>
        <label class="wide"><span>海报 URL</span><input id="rePoster"></label><label class="wide"><span>推荐理由</span><textarea id="reReason"></textarea></label><div class="wide"><button class="btn primary" type="submit">保存雷达条目</button></div>
      </form></div></section>
    `);

    addView('plansops',`
      <section class="panel"><div class="panel-head"><h2>月度计划管理</h2><button class="btn primary" id="planAdd">＋ 新增计划</button></div><div class="panel-body">
        <div class="ops-kpis" id="planKpis"></div><div class="toolbar"><input id="planAdminMonth" type="month"><select id="planAdminStatus"><option value="">全部状态</option><option value="planned">计划中</option><option value="completed">已完成</option><option value="deferred">已延期</option></select></div>
        <div class="table-wrap"><table class="ops-table"><thead><tr><th>作品</th><th>月份</th><th>计划日期</th><th>状态</th><th>操作</th></tr></thead><tbody id="planAdminRows"></tbody></table></div>
      </div></section>
      <section class="panel" id="planEditorPanel" style="display:none;margin-top:14px"><div class="panel-head"><h2 id="planEditorTitle">新增月度计划</h2><button class="btn" id="planEditorClose">关闭</button></div><div class="panel-body"><form class="ops-form" id="planEditor"><input type="hidden" id="peMovieId"><input type="hidden" id="peOldMonth">
        <label><span>作品 *</span><select id="peMovie" required></select></label><label><span>月份 *</span><input id="peMonth" type="month" required></label><label><span>计划日期</span><input id="peDate" type="date"></label><label><span>状态</span><select id="peStatus"><option value="planned">计划中</option><option value="completed">已完成</option><option value="deferred">已延期</option></select></label><div class="wide"><button class="btn primary" type="submit">保存计划</button></div>
      </form></div></section>
    `);

    bindUi(); refreshAll();
  }

  function bindUi(){
    $('#movieAdminSearch')?.addEventListener('input',renderMovies); $('#movieAdminType')?.addEventListener('change',renderMovies); $('#movieAdminStatus')?.addEventListener('change',renderMovies);
    $('#movieAdd')?.addEventListener('click',()=>openMovieEditor()); $('#movieEditorClose')?.addEventListener('click',()=>$('#movieEditorPanel').style.display='none'); $('#movieEditor')?.addEventListener('submit',saveMovieEditor);
    $('#movieTmdbOpen')?.addEventListener('click',()=>{$('#tmdbAdminPanel').style.display='block';$('#tmdbAdminQuery').focus()}); $('#tmdbAdminClose')?.addEventListener('click',()=>$('#tmdbAdminPanel').style.display='none'); $('#tmdbAdminSearch')?.addEventListener('click',searchTmdbAdmin); $('#tmdbAdminQuery')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();searchTmdbAdmin()}});
    $('#featuredAdd')?.addEventListener('click',addFeatured); $('#homeOpenFront')?.addEventListener('click',()=>window.open('index.html#home','_blank'));
    $('#radarAdminSearch')?.addEventListener('input',renderRadarOps); $('#radarAdminCategory')?.addEventListener('change',renderRadarOps); $('#radarAdminVisible')?.addEventListener('change',renderRadarOps); $('#radarAdd')?.addEventListener('click',()=>openRadarEditor()); $('#radarEditorClose')?.addEventListener('click',()=>$('#radarEditorPanel').style.display='none'); $('#radarEditor')?.addEventListener('submit',saveRadarEditor);
    $('#planAdminMonth')?.addEventListener('change',renderPlans); $('#planAdminStatus')?.addEventListener('change',renderPlans); $('#planAdd')?.addEventListener('click',()=>openPlanEditor()); $('#planEditorClose')?.addEventListener('click',()=>$('#planEditorPanel').style.display='none'); $('#planEditor')?.addEventListener('submit',savePlanEditor);
    window.addEventListener('storage',e=>{if(e.key===APP_KEY){state=readState();refreshAll()}});
  }

  function refreshAll(){
    state=readState(); updateOpsOverview();
    if($('#view-movies')?.classList.contains('active'))renderMovies();
    if($('#view-homeops')?.classList.contains('active'))renderHomeOps();
    if($('#view-radarops')?.classList.contains('active'))renderRadarOps();
    if($('#view-plansops')?.classList.contains('active'))renderPlans();
  }
  function updateOpsOverview(){
    const overview=$('#view-overview'); if(!overview) return;
    let box=$('#opsOverviewStats');
    if(!box){box=document.createElement('div');box.id='opsOverviewStats';box.className='stats';box.style.marginTop='12px';overview.querySelector('.stats')?.after(box)}
    const plans=(state.movies||[]).reduce((n,m)=>n+(m.plans||[]).length,0);
    const watched=(state.movies||[]).filter(m=>m.personal?.status==='watched'||(m.watchHistory||[]).length).length;
    box.innerHTML=`<div class="stat"><span>影视条目</span><b>${state.movies.length}</b><small>${watched} 部有观看记录</small></div><div class="stat"><span>首页推荐池</span><b>${state.home.featured.length}</b><small>今晚看什么优先池</small></div><div class="stat"><span>雷达条目</span><b>${state.home.radar.length}</b><small>${state.home.radar.filter(x=>!x.ignored).length} 条关注中</small></div><div class="stat"><span>月度计划</span><b>${plans}</b><small>跨全部月份</small></div>`;
  }

  function renderMovies(){
    const q=String($('#movieAdminSearch')?.value||'').trim().toLowerCase(), type=$('#movieAdminType')?.value||'', status=$('#movieAdminStatus')?.value||'';
    const movies=(state.movies||[]).map(ensureMovie).filter(m=>{
      const hay=[m.info.title,m.info.originalTitle,(m.info.directors||[]).join(' '),(m.personal.tags||[]).join(' '),m.info.tmdbId].join(' ').toLowerCase();
      return (!q||hay.includes(q))&&(!type||m.mediaType===type)&&(!status||m.personal.status===status);
    }).sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
    const k=$('#movieKpis'); if(k){const watched=state.movies.filter(m=>m.personal?.status==='watched'||(m.watchHistory||[]).length).length,want=state.movies.filter(m=>m.personal?.status==='want').length,fav=state.movies.filter(m=>m.personal?.favorite).length;k.innerHTML=`<div class="ops-kpi"><span>总条目</span><b>${state.movies.length}</b></div><div class="ops-kpi"><span>想看</span><b>${want}</b></div><div class="ops-kpi"><span>已看 / 有记录</span><b>${watched}</b></div><div class="ops-kpi"><span>收藏</span><b>${fav}</b></div>`}
    const body=$('#movieAdminRows'); if(!body)return;
    body.innerHTML=movies.length?movies.map(m=>`<tr><td><div class="ops-title">${m.info.posterUrl?`<img class="ops-poster" src="${escAttr(m.info.posterUrl)}" alt="">`:`<div class="ops-poster"></div>`}<div><b>${esc(m.info.title||'未命名')}</b><small>${esc([m.info.year,(m.info.directors||[]).slice(0,2).join(' / ')].filter(Boolean).join(' · '))}</small></div></div></td><td><span class="pill">${m.mediaType==='tv'?'剧集':m.mediaType==='unknown'?'未识别':'电影'}</span></td><td>${esc(movieStatusLabel(m))}</td><td>${m.personal.rating!=null?Number(m.personal.rating).toFixed(1):'—'}</td><td>${(m.watchHistory||[]).length}</td><td>${(m.plans||[]).length}</td><td><div class="ops-actions"><button class="btn mini" data-edit-movie="${escAttr(m.id)}">编辑</button><button class="btn mini danger" data-delete-movie="${escAttr(m.id)}">删除</button></div></td></tr>`).join(''):`<tr><td colspan="7"><div class="empty-ops">没有符合条件的影视条目</div></td></tr>`;
    $$('[data-edit-movie]',body).forEach(b=>b.addEventListener('click',()=>openMovieEditor(b.dataset.editMovie)));
    $$('[data-delete-movie]',body).forEach(b=>b.addEventListener('click',()=>deleteMovie(b.dataset.deleteMovie)));
  }
  function openMovieEditor(id=null,prefill=null){
    const m=id?ensureMovie(state.movies.find(x=>x.id===id)||{}):ensureMovie(prefill||{}); const editing=Boolean(id);
    $('#movieEditorPanel').style.display='block'; $('#movieEditorTitle').textContent=editing?'编辑影视条目':'新增影视条目';
    $('#meId').value=editing?m.id:''; $('#meTitle').value=m.info.title||''; $('#meOriginal').value=m.info.originalTitle||''; $('#meType').value=m.mediaType||'movie'; $('#meYear').value=m.info.year||''; $('#meRelease').value=m.info.releaseDate||m.info.firstAirDate||''; $('#meRuntime').value=m.info.runtime||''; $('#meDirectors').value=(m.info.directors||[]).join(' / '); $('#meCountries').value=(m.info.countries||[]).join(' / '); $('#meGenres').value=(m.info.genres||[]).join(' / '); $('#meStatus').value=m.personal.status||'want'; $('#meRating').value=m.personal.rating??''; $('#meFavorite').checked=Boolean(m.personal.favorite); $('#meTags').value=(m.personal.tags||[]).join(' / '); $('#meTmdb').value=m.info.tmdbId||''; $('#mePoster').value=m.info.posterUrl||''; $('#meOverview').value=m.info.overview||''; $('#meReview').value=m.personal.shortReview||'';
    $('#movieEditorPanel').scrollIntoView({behavior:'smooth',block:'start'}); $('#meTitle').focus();
  }
  function saveMovieEditor(e){
    e.preventDefault(); const id=$('#meId').value; const old=id?state.movies.find(x=>x.id===id):null;
    const payload=ensureMovie({...(old||{}),id:id||(old?.id),mediaType:$('#meType').value,info:{...(old?.info||{}),title:$('#meTitle').value.trim(),originalTitle:$('#meOriginal').value.trim(),year:$('#meYear').value||null,releaseDate:$('#meRelease').value,firstAirDate:$('#meRelease').value,runtime:$('#meRuntime').value||null,directors:splitList($('#meDirectors').value),countries:splitList($('#meCountries').value),genres:splitList($('#meGenres').value),posterUrl:$('#mePoster').value.trim(),overview:$('#meOverview').value.trim(),tmdbId:$('#meTmdb').value||null},personal:{...(old?.personal||{}),status:$('#meStatus').value,rating:$('#meRating').value===''?null:Number($('#meRating').value),favorite:$('#meFavorite').checked,tags:splitList($('#meTags').value),shortReview:$('#meReview').value.trim()}});
    if(!payload.info.title){toast('片名不能为空');return}
    if(id){const i=state.movies.findIndex(x=>x.id===id);if(i>=0)state.movies[i]=payload}else state.movies.unshift(payload);
    writeState(state,id?'影视条目已更新':'影视条目已新增'); $('#movieEditorPanel').style.display='none';
  }
  function deleteMovie(id){
    const m=state.movies.find(x=>x.id===id); if(!m)return;
    if(!confirm(`确定删除《${m.info?.title||'未命名'}》？\n\n观看记录和月度计划也会一起删除。`))return;
    state.movies=state.movies.filter(x=>x.id!==id); state.home.featured=state.home.featured.filter(x=>x!==id); writeState(state,'影视条目已删除');
  }

  async function tmdbFetch(path,params={}){
    const res=await fetch(TMDB_PROXY_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path,params})}); let body=null; try{body=await res.json()}catch{}
    if(!res.ok)throw new Error(body?.message||body?.error||`TMDb 代理 HTTP ${res.status}`); return body;
  }
  const tmdbImage=(p,size='w342')=>p?`https://image.tmdb.org/t/p/${size}${p}`:'';
  async function searchTmdbAdmin(){
    const q=$('#tmdbAdminQuery').value.trim(), type=$('#tmdbAdminMedia').value; if(!q){toast('请输入片名');return}
    const btn=$('#tmdbAdminSearch'); btn.disabled=true; $('#tmdbAdminState').textContent='正在搜索 TMDb…'; $('#tmdbAdminResults').innerHTML='';
    try{const data=await tmdbFetch(type==='tv'?'/search/tv':'/search/movie',{query:q,include_adult:false,language:'zh-CN',page:1}); const rows=(data.results||[]).slice(0,8); $('#tmdbAdminState').textContent=rows.length?`找到 ${rows.length} 个候选，选用后会先进入编辑器确认。`:'没有找到候选。'; $('#tmdbAdminResults').innerHTML=rows.map(x=>{const title=type==='tv'?x.name:x.title,orig=type==='tv'?x.original_name:x.original_title,date=type==='tv'?x.first_air_date:x.release_date;return `<div class="tmdb-hit">${x.poster_path?`<img src="${tmdbImage(x.poster_path,'w92')}" alt="">`:`<div class="ops-poster"></div>`}<div><b>${esc(title||orig||'未命名')}</b><small>${esc([orig&&orig!==title?orig:'',String(date||'').slice(0,4),`TMDb ${x.id}`].filter(Boolean).join(' · '))}</small></div><button class="btn mini primary" data-tmdb-use="${x.id}" data-media="${type}">选用</button></div>`}).join(''); $$('[data-tmdb-use]',$('#tmdbAdminResults')).forEach(b=>b.addEventListener('click',()=>loadTmdbDetail(b.dataset.tmdbUse,b.dataset.media)))}catch(err){$('#tmdbAdminState').textContent=`搜索失败：${err.message}`}finally{btn.disabled=false}
  }
  async function loadTmdbDetail(id,type){
    $('#tmdbAdminState').textContent='正在读取详情与主创…';
    try{const [d,c]=await Promise.all([tmdbFetch(`/${type}/${id}`,{language:'zh-CN'}),tmdbFetch(`/${type}/${id}/credits`,{language:'zh-CN'})]); const directors=(c.crew||[]).filter(x=>x.job==='Director'||(type==='tv'&&['Creator','Executive Producer'].includes(x.job))).slice(0,4).map(x=>x.name); const title=type==='tv'?d.name:d.title,original=type==='tv'?d.original_name:d.original_title,release=type==='tv'?d.first_air_date:d.release_date; openMovieEditor(null,{mediaType:type,info:{title:title||original||'',originalTitle:original||'',year:Number(String(release||'').slice(0,4))||null,releaseDate:release||'',firstAirDate:release||'',runtime:type==='tv'?(d.episode_run_time||[])[0]:d.runtime,directors,countries:(d.production_countries||d.origin_country||[]).map(x=>typeof x==='string'?x:x.name).filter(Boolean),genres:(d.genres||[]).map(x=>x.name),posterUrl:tmdbImage(d.poster_path,'w500'),overview:d.overview||'',tmdbId:d.id},personal:{status:'want',tags:[],shortReview:'',favorite:false}}); $('#tmdbAdminState').textContent='已载入编辑器，请确认后保存。'}catch(err){$('#tmdbAdminState').textContent=`读取失败：${err.message}`}
  }

  function featuredMovies(){return state.home.featured.map(id=>state.movies.find(m=>m.id===id)).filter(Boolean)}
  function renderHomeOps(){
    const list=$('#featuredList'); if(!list)return; const rows=featuredMovies();
    list.innerHTML=rows.length?rows.map((m,i)=>`<div class="ops-item"><div><b>${i+1}. ${esc(m.info?.title||'未命名')}</b><small>${esc([m.info?.year,movieStatusLabel(m),m.personal?.rating!=null?`评分 ${m.personal.rating}`:''].filter(Boolean).join(' · '))}</small></div><div class="ops-actions"><button class="btn mini" data-feature-up="${m.id}" ${i===0?'disabled':''}>↑</button><button class="btn mini" data-feature-down="${m.id}" ${i===rows.length-1?'disabled':''}>↓</button><button class="btn mini danger" data-feature-remove="${m.id}">移除</button></div></div>`).join(''):`<div class="empty-ops">尚未设置优先推荐池，前台会继续从全部“想看”作品中随机。</div>`;
    const sel=$('#featuredMovieSelect'); if(sel){const available=state.movies.filter(m=>m.info?.title&&!state.home.featured.includes(m.id)).sort((a,b)=>String(a.info.title).localeCompare(String(b.info.title),'zh-CN'));sel.innerHTML=`<option value="">选择影视作品…</option>`+available.map(m=>`<option value="${escAttr(m.id)}">${esc(m.info.title)}${m.info.year?` (${m.info.year})`:''} · ${esc(movieStatusLabel(m))}</option>`).join('')}
    $$('[data-feature-up]',list).forEach(b=>b.addEventListener('click',()=>moveFeatured(b.dataset.featureUp,-1))); $$('[data-feature-down]',list).forEach(b=>b.addEventListener('click',()=>moveFeatured(b.dataset.featureDown,1))); $$('[data-feature-remove]',list).forEach(b=>b.addEventListener('click',()=>removeFeatured(b.dataset.featureRemove)));
  }
  function addFeatured(){const id=$('#featuredMovieSelect').value;if(!id)return toast('先选择一部作品');if(!state.home.featured.includes(id))state.home.featured.push(id);writeState(state,'已加入首页推荐池')}
  function removeFeatured(id){state.home.featured=state.home.featured.filter(x=>x!==id);writeState(state,'已从首页推荐池移除')}
  function moveFeatured(id,delta){const a=state.home.featured,i=a.indexOf(id),j=i+delta;if(i<0||j<0||j>=a.length)return;[a[i],a[j]]=[a[j],a[i]];writeState(state,'推荐顺序已调整')}

  function renderRadarOps(){
    const all=(state.home.radar||[]).map(ensureRadar), q=String($('#radarAdminSearch')?.value||'').trim().toLowerCase(), cat=$('#radarAdminCategory')?.value||'', vis=$('#radarAdminVisible')?.value||'';
    const rows=all.filter(r=>{const hay=[r.title,r.source,r.reason,r.badge].join(' ').toLowerCase();return(!q||hay.includes(q))&&(!cat||r.category===cat)&&(!vis||(vis==='ignored'?r.ignored:!r.ignored))}).sort((a,b)=>String(b.discoveredAt||'').localeCompare(String(a.discoveredAt||''))||(Number(b.match)||0)-(Number(a.match)||0));
    const k=$('#radarKpis');if(k)k.innerHTML=`<div class="ops-kpi"><span>总雷达</span><b>${all.length}</b></div><div class="ops-kpi"><span>本周</span><b>${all.filter(x=>x.category==='week').length}</b></div><div class="ops-kpi"><span>即将上映</span><b>${all.filter(x=>x.category==='upcoming').length}</b></div><div class="ops-kpi"><span>已忽略</span><b>${all.filter(x=>x.ignored).length}</b></div>`;
    const body=$('#radarAdminRows');if(!body)return;body.innerHTML=rows.length?rows.map(r=>`<tr><td><div class="ops-title">${r.posterUrl?`<img class="ops-poster" src="${escAttr(r.posterUrl)}" alt="">`:`<div class="ops-poster"></div>`}<div><b>${esc(r.title||'未命名')}</b><small>${esc([r.year,r.releaseDate,r.badge].filter(Boolean).join(' · '))}</small></div></div></td><td>${r.category==='upcoming'?'即将上映':'本周雷达'}</td><td>${r.public!=null?Number(r.public).toFixed(1):'—'}</td><td>${r.match!=null?Math.round(r.match)+'%':'—'}</td><td>${esc(r.source||'—')}</td><td><span class="pill ${r.ignored?'':'on'}">${r.ignored?'已忽略':'关注中'}</span></td><td><div class="ops-actions"><button class="btn mini" data-edit-radar="${r.id}">编辑</button><button class="btn mini danger" data-delete-radar="${r.id}">删除</button></div></td></tr>`).join(''):`<tr><td colspan="7"><div class="empty-ops">没有符合条件的雷达条目</div></td></tr>`;
    $$('[data-edit-radar]',body).forEach(b=>b.addEventListener('click',()=>openRadarEditor(b.dataset.editRadar)));$$('[data-delete-radar]',body).forEach(b=>b.addEventListener('click',()=>deleteRadar(b.dataset.deleteRadar)));
  }
  function openRadarEditor(id=null){const r=id?ensureRadar(state.home.radar.find(x=>x.id===id)||{}):ensureRadar({});$('#radarEditorPanel').style.display='block';$('#radarEditorTitle').textContent=id?'编辑雷达条目':'新增雷达条目';$('#reId').value=id||'';$('#reTitle').value=id?r.title:'';$('#reYear').value=r.year||'';$('#reRelease').value=r.releaseDate||'';$('#reCategory').value=r.category||'week';$('#rePublic').value=r.public??'';$('#reMatch').value=r.match??'';$('#reBadge').value=r.badge||'值得关注';$('#reSource').value=r.source||'后台手动维护';$('#reIgnored').checked=Boolean(r.ignored);$('#rePoster').value=r.posterUrl||'';$('#reReason').value=r.reason||'';$('#radarEditorPanel').scrollIntoView({behavior:'smooth'});$('#reTitle').focus()}
  function saveRadarEditor(e){e.preventDefault();const id=$('#reId').value,old=id?state.home.radar.find(x=>x.id===id):null,r=ensureRadar({...(old||{}),id:id||(old?.id),title:$('#reTitle').value.trim(),year:$('#reYear').value||null,releaseDate:$('#reRelease').value,category:$('#reCategory').value,public:$('#rePublic').value===''?null:Number($('#rePublic').value),match:$('#reMatch').value===''?null:Number($('#reMatch').value),badge:$('#reBadge').value.trim()||'值得关注',source:$('#reSource').value.trim()||'后台手动维护',ignored:$('#reIgnored').checked,posterUrl:$('#rePoster').value.trim(),reason:$('#reReason').value.trim(),discoveredAt:old?.discoveredAt||localToday()});if(!r.title)return toast('片名不能为空');if(id){const i=state.home.radar.findIndex(x=>x.id===id);if(i>=0)state.home.radar[i]=r}else state.home.radar.unshift(r);writeState(state,id?'雷达条目已更新':'雷达条目已新增');$('#radarEditorPanel').style.display='none'}
  function deleteRadar(id){const r=state.home.radar.find(x=>x.id===id);if(!r)return;if(!confirm(`确定删除雷达条目《${r.title||'未命名'}》？`))return;state.home.radar=state.home.radar.filter(x=>x.id!==id);writeState(state,'雷达条目已删除')}

  function flattenPlans(){return state.movies.flatMap(movie=>(movie.plans||[]).map(plan=>({movie,plan:typeof plan==='string'?{month:plan,status:'planned',plannedDate:null}:plan})))}
  function renderPlans(){
    const month=$('#planAdminMonth')?.value||currentMonth(),status=$('#planAdminStatus')?.value||''; if($('#planAdminMonth')&&!$('#planAdminMonth').value)$('#planAdminMonth').value=month;
    const all=flattenPlans(),rows=all.filter(x=>(!month||x.plan.month===month)&&(!status||x.plan.status===status)).sort((a,b)=>String(a.plan.plannedDate||'9999').localeCompare(String(b.plan.plannedDate||'9999'))||String(a.movie.info?.title||'').localeCompare(String(b.movie.info?.title||''),'zh-CN'));
    const monthAll=all.filter(x=>x.plan.month===month),k=$('#planKpis');if(k)k.innerHTML=`<div class="ops-kpi"><span>${monthLabel(month)}计划</span><b>${monthAll.length}</b></div><div class="ops-kpi"><span>计划中</span><b>${monthAll.filter(x=>x.plan.status==='planned').length}</b></div><div class="ops-kpi"><span>已完成</span><b>${monthAll.filter(x=>x.plan.status==='completed').length}</b></div><div class="ops-kpi"><span>已延期</span><b>${monthAll.filter(x=>x.plan.status==='deferred').length}</b></div>`;
    const body=$('#planAdminRows');if(!body)return;body.innerHTML=rows.length?rows.map(({movie,plan})=>`<tr><td><b>${esc(movie.info?.title||'未命名')}</b></td><td>${esc(monthLabel(plan.month))}</td><td>${esc(plan.plannedDate||'待定')}</td><td><span class="pill ${plan.status==='completed'?'on':''}">${plan.status==='completed'?'已完成':plan.status==='deferred'?'已延期':'计划中'}</span></td><td><div class="ops-actions"><button class="btn mini" data-edit-plan="${movie.id}" data-plan-month="${plan.month}">编辑</button><button class="btn mini danger" data-delete-plan="${movie.id}" data-plan-month="${plan.month}">删除</button></div></td></tr>`).join(''):`<tr><td colspan="5"><div class="empty-ops">${monthLabel(month)}暂无符合条件的计划</div></td></tr>`;
    $$('[data-edit-plan]',body).forEach(b=>b.addEventListener('click',()=>openPlanEditor(b.dataset.editPlan,b.dataset.planMonth)));$$('[data-delete-plan]',body).forEach(b=>b.addEventListener('click',()=>deletePlan(b.dataset.deletePlan,b.dataset.planMonth)));
  }
  function fillPlanMovies(selected=''){const sel=$('#peMovie');if(!sel)return;sel.innerHTML=`<option value="">选择影视作品…</option>`+state.movies.filter(m=>m.info?.title).sort((a,b)=>String(a.info.title).localeCompare(String(b.info.title),'zh-CN')).map(m=>`<option value="${escAttr(m.id)}" ${m.id===selected?'selected':''}>${esc(m.info.title)}${m.info.year?` (${m.info.year})`:''}</option>`).join('')}
  function openPlanEditor(movieId=null,month=null){const movie=movieId?state.movies.find(m=>m.id===movieId):null,plan=movie?(movie.plans||[]).map(p=>typeof p==='string'?{month:p,status:'planned',plannedDate:null}:p).find(p=>p.month===month):null;$('#planEditorPanel').style.display='block';$('#planEditorTitle').textContent=plan?'编辑月度计划':'新增月度计划';$('#peMovieId').value=movieId||'';$('#peOldMonth').value=month||'';fillPlanMovies(movieId||'');$('#peMovie').disabled=Boolean(plan);$('#peMonth').value=plan?.month||$('#planAdminMonth').value||currentMonth();$('#peDate').value=plan?.plannedDate||'';$('#peStatus').value=plan?.status||'planned';$('#planEditorPanel').scrollIntoView({behavior:'smooth'})}
  function savePlanEditor(e){e.preventDefault();const lockedMovie=$('#peMovieId').value,movieId=lockedMovie||$('#peMovie').value,oldMonth=$('#peOldMonth').value,month=$('#peMonth').value;if(!movieId||!month)return toast('请选择作品和月份');const movie=state.movies.find(m=>m.id===movieId);if(!movie)return toast('影视条目不存在');movie.plans=Array.isArray(movie.plans)?movie.plans.map(p=>typeof p==='string'?{month:p,status:'planned',plannedDate:null}:p):[];if(oldMonth&&oldMonth!==month)movie.plans=movie.plans.filter(p=>p.month!==oldMonth);const next={month,status:$('#peStatus').value,plannedDate:$('#peDate').value||null};const i=movie.plans.findIndex(p=>p.month===month);if(i>=0)movie.plans[i]={...movie.plans[i],...next};else movie.plans.push(next);movie.updatedAt=nowIso();writeState(state,oldMonth?'月度计划已更新':'月度计划已新增');$('#planEditorPanel').style.display='none'}
  function deletePlan(movieId,month){const movie=state.movies.find(m=>m.id===movieId);if(!movie)return;if(!confirm(`确定从 ${monthLabel(month)} 计划中移除《${movie.info?.title||'未命名'}》？`))return;movie.plans=(movie.plans||[]).filter(p=>(typeof p==='string'?p:p.month)!==month);movie.updatedAt=nowIso();writeState(state,'月度计划已删除')}

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',injectUi);else injectUi();
})();
