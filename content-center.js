(() => {
  'use strict';

  const COPY_KEY = 'movie-collection-content-v1';
  const QUOTE_KEY = 'movie-collection-quote-library-v1';
  const VERSION = 1;

  const schema = [
    {key:'global.search.placeholder',group:'全局',label:'全局搜索框占位文案',selector:'#globalSearch',prop:'placeholder',defaultValue:'搜索电影、剧集、主创、标签…'},
    {key:'nav.home',group:'导航',label:'导航：首页',selector:'.nav a[data-view="home"] span:last-child',prop:'text',defaultValue:'首页'},
    {key:'nav.library',group:'导航',label:'导航：影视库',selector:'.nav a[data-view="library"] span:last-child',prop:'text',defaultValue:'影视库'},
    {key:'nav.match',group:'导航',label:'导航：匹配中心',selector:'.nav a[data-view="match"] span:last-child',prop:'text',defaultValue:'匹配中心'},
    {key:'nav.radar',group:'导航',label:'导航：电影雷达',selector:'.nav a[data-view="radar"] span:last-child',prop:'text',defaultValue:'电影雷达'},
    {key:'nav.plan',group:'导航',label:'导航：月度计划',selector:'.nav a[data-view="plan"] span:last-child',prop:'text',defaultValue:'月度计划'},
    {key:'nav.watched',group:'导航',label:'导航：已观看',selector:'.nav a[data-view="watched"] span:last-child',prop:'text',defaultValue:'已观看'},
    {key:'nav.stats',group:'导航',label:'导航：统计分析',selector:'.nav a[data-view="stats"] span:last-child',prop:'text',defaultValue:'统计分析'},
    {key:'nav.settings',group:'导航',label:'导航：设置',selector:'.nav a[data-view="settings"] span:last-child',prop:'text',defaultValue:'设置'},

    {key:'home.hero.sub',group:'首页',label:'首页欢迎区副文案',selector:'#homeView .hero .sub',prop:'text',defaultValue:'每一部作品，都是你宇宙里独一无二的星光。'},
    {key:'home.random.title',group:'首页',label:'随机观影模块标题',selector:'#homeView .random-panel .panel-title',prop:'ownText',defaultValue:'今晚交给星星决定'},
    {key:'home.random.sub',group:'首页',label:'随机观影模块说明',selector:'#homeView .random-panel > .stat-note',prop:'text',defaultValue:'从你的想看片单中，随机为你推荐一部'},
    {key:'home.recent.title',group:'首页',label:'最近观看标题',selector:'#homeView #watched .panel-title',prop:'ownText',defaultValue:'最近观看'},
    {key:'home.radar.title',group:'首页',label:'本周电影雷达标题',selector:'#homeView #radar .panel-title',prop:'ownText',defaultValue:'本周电影雷达'},
    {key:'home.radar.kicker',group:'首页',label:'本周电影雷达辅助说明',selector:'#homeView #radar .panel-kicker',prop:'text',defaultValue:'为你精选的值得关注'},
    {key:'home.plan.title',group:'首页',label:'本月观影计划标题',selector:'#homeView #plan .panel-title',prop:'text',defaultValue:'本月观影计划'},
    {key:'home.insight.title',group:'首页',label:'这一月的星图标题',selector:'#homeView .insight .panel-title',prop:'text',defaultValue:'这一月的星图'},

    {key:'library.title',group:'影视库',label:'影视库页标题',selector:'#libraryView .library-hero h2',prop:'ownText',defaultValue:'影视库'},
    {key:'library.sub',group:'影视库',label:'影视库页副文案',selector:'#libraryView .library-head > div:first-child > p',prop:'text',defaultValue:'电影与剧集，都在这里成为你的光影坐标。'},
    {key:'library.search.placeholder',group:'影视库',label:'影视库搜索框占位文案',selector:'#libKeyword',prop:'placeholder',defaultValue:'片名 / 导演 / 国家 / 标签…'},

    {key:'match.search.placeholder',group:'匹配中心',label:'匹配中心搜索框占位文案',selector:'#matchKeyword',prop:'placeholder',defaultValue:'搜索中文名 / 外文原名 / 豆瓣 ID…'},

    {key:'radar.title',group:'电影雷达',label:'电影雷达页标题',selector:'#radarView .radar-title-row h2',prop:'ownText',defaultValue:'电影雷达'},
    {key:'radar.sub',group:'电影雷达',label:'电影雷达页副文案',selector:'#radarView .radar-title-row p',prop:'text',defaultValue:'把值得抵达的电影，提前标记在你的星图上。'},
    {key:'radar.empty',group:'电影雷达',label:'电影雷达空状态',selector:'#radarEmpty',prop:'text',defaultValue:'这一片星域暂时没有新的电影信号。'},
    {key:'radar.search.placeholder',group:'电影雷达',label:'电影雷达搜索框占位文案',selector:'#radarKeyword',prop:'placeholder',defaultValue:'搜索片名 / 推荐理由 / 来源…'},
    {key:'radar.taste.title',group:'电影雷达',label:'审美共振模块标题',selector:'#radarView .radar-side-card:first-child h3',prop:'text',defaultValue:'与你的审美共振'},
    {key:'radar.pulse.title',group:'电影雷达',label:'雷达强度模块标题',selector:'#radarView .radar-side-card:nth-child(2) h3',prop:'text',defaultValue:'本周雷达强度'},

    {key:'plan.title',group:'月度计划',label:'月度计划页标题',selector:'#planView .plan-title-row h2',prop:'ownText',defaultValue:'月度观影计划'},
    {key:'plan.unscheduled.title',group:'月度计划',label:'待安排日期标题',selector:'#planSide .plan-side-card:nth-child(2) h3',prop:'text',defaultValue:'待安排日期'},

    {key:'watched.title',group:'已观看',label:'已观看页标题',selector:'#watchedView .watched-title-row h2',prop:'ownText',defaultValue:'已观看'},
    {key:'watched.sub',group:'已观看',label:'已观看页副文案',selector:'#watchedView .watched-title-row p',prop:'text',defaultValue:'每一次观看都是不同的夜晚；重看，也会留下新的坐标。'},

    {key:'detail.overview.title',group:'详情页',label:'剧情简介标题',selector:'#detailView .detail-overview h3',prop:'text',defaultValue:'剧情简介'},
    {key:'detail.overview.empty',group:'详情页',label:'剧情简介空状态',selector:'#detailOverview',prop:'textIfEmpty',defaultValue:'暂无简介。可在编辑电影时通过 TMDb 搜索补全。'},
    {key:'detail.watch.title',group:'详情页',label:'观影记录标题',selector:'#detailView .detail-section-head h3',prop:'text',defaultValue:'观影记录'},
    {key:'detail.review.title',group:'详情页',label:'影评笔记标题',selector:'#detailView .detail-subcard:first-child h3',prop:'text',defaultValue:'我的影评笔记'},
    {key:'detail.review.placeholder',group:'详情页',label:'影评笔记占位文案',selector:'#detailReview',prop:'placeholder',defaultValue:'写下一句话短评，或记录这次电影留给你的东西……'},
    {key:'detail.related.title',group:'详情页',label:'相关推荐标题',selector:'#detailView .detail-subcard:nth-child(2) h3',prop:'text',defaultValue:'与你的收藏相关'},

    {key:'settings.title',group:'设置',label:'设置页标题',selector:'#settingsView .settings-title h2',prop:'ownText',defaultValue:'设置与数据管理'},
    {key:'settings.sub',group:'设置',label:'设置页副文案',selector:'#settingsView .settings-title p',prop:'text',defaultValue:'调整你的电影宇宙，也把每一次观看安全地留在本地。'},
    {key:'settings.profile.title',group:'设置',label:'个人资料卡标题',selector:'#settingsView .settings-stack:first-child .settings-card:nth-child(1) .settings-card-head h3',prop:'text',defaultValue:'个人资料 · 你的影视名片'},
    {key:'settings.brand.title',group:'设置',label:'收藏夹品牌卡标题',selector:'#settingsView .settings-stack:first-child .settings-card:nth-child(2) .settings-card-head h3',prop:'text',defaultValue:'收藏夹品牌 · 左侧导航'},
    {key:'settings.appearance.title',group:'设置',label:'外观卡标题',selector:'#settingsView .settings-stack:first-child .settings-card:nth-child(3) .settings-card-head h3',prop:'text',defaultValue:'外观 · 星空主题'},
    {key:'settings.tmdb.title',group:'设置',label:'TMDb 卡标题',selector:'#settingsView .settings-stack:nth-child(2) .settings-card:nth-child(1) .settings-card-head h3',prop:'text',defaultValue:'TMDb · 影视资料服务'},
    {key:'settings.douban.title',group:'设置',label:'豆瓣导入卡标题',selector:'#settingsView .settings-stack:nth-child(2) .settings-card:nth-child(2) .settings-card-head h3',prop:'text',defaultValue:'豆瓣片单 · 本地导入'}
  ];

  const deepClone = value => JSON.parse(JSON.stringify(value));
  const nowIso = () => new Date().toISOString();

  function loadCopyState(){
    try{
      const parsed = JSON.parse(localStorage.getItem(COPY_KEY) || '{}');
      return {version:VERSION,updatedAt:parsed.updatedAt||'',values:parsed.values&&typeof parsed.values==='object'?parsed.values:{}};
    }catch{
      return {version:VERSION,updatedAt:'',values:{}};
    }
  }

  function saveCopyState(next){
    const state = {version:VERSION,updatedAt:nowIso(),values:{...(next?.values||{})}};
    localStorage.setItem(COPY_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent('movie-collection:content-updated',{detail:deepClone(state)}));
    return state;
  }

  function ownTextNode(el){
    return [...el.childNodes].find(n=>n.nodeType===Node.TEXT_NODE && n.nodeValue.trim()) || null;
  }

  function applyItem(item,value){
    const el = document.querySelector(item.selector);
    if(!el) return false;
    const finalValue = value ?? item.defaultValue;
    if(item.prop==='placeholder') el.setAttribute('placeholder', finalValue);
    else if(item.prop==='ownText'){
      const node = ownTextNode(el);
      if(node) node.nodeValue = ` ${finalValue} `;
    }else if(item.prop==='textIfEmpty'){
      if(!el.dataset.contentCenterTouched && (!el.textContent.trim() || el.textContent.trim()===item.defaultValue)) el.textContent = finalValue;
    }else el.textContent = finalValue;
    el.dataset.contentKey = item.key;
    return true;
  }

  let applying = false;
  function applyCopy(){
    if(applying) return;
    applying = true;
    const state = loadCopyState();
    for(const item of schema){
      if(!Object.prototype.hasOwnProperty.call(state.values,item.key)) continue;
      applyItem(item, state.values[item.key]);
    }
    applying = false;
  }

  function getQuoteState(){
    try{
      const parsed = JSON.parse(localStorage.getItem(QUOTE_KEY)||'{}');
      return {
        version:VERSION,
        updatedAt:parsed.updatedAt||'',
        custom:Array.isArray(parsed.custom)?parsed.custom:[],
        disabledDefaultIds:Array.isArray(parsed.disabledDefaultIds)?parsed.disabledDefaultIds:[]
      };
    }catch{
      return {version:VERSION,updatedAt:'',custom:[],disabledDefaultIds:[]};
    }
  }

  function saveQuoteState(next){
    const state={
      version:VERSION,
      updatedAt:nowIso(),
      custom:Array.isArray(next?.custom)?next.custom:[],
      disabledDefaultIds:Array.isArray(next?.disabledDefaultIds)?next.disabledDefaultIds:[]
    };
    localStorage.setItem(QUOTE_KEY,JSON.stringify(state));
    return state;
  }

  function quoteCredit(q){
    if(q.type==='movie_line') return `— 《${q.film||'未知影片'}》${q.character?` · ${q.character}`:''}`;
    return `— ${q.author||'未知影人'}`;
  }

  let runtimeQuote = null;
  function quotePool(){
    const state=getQuoteState();
    const defaults = window.MovieQuoteEngine?.getAll?.() || [];
    const disabled = new Set(state.disabledDefaultIds);
    return [...defaults.filter(q=>!disabled.has(q.id)), ...state.custom.filter(q=>q&&q.enabled!==false)];
  }

  function renderQuote(q){
    if(!q) return;
    runtimeQuote=q;
    const text=document.querySelector('#sidebarQuoteText');
    const credit=document.querySelector('#sidebarQuoteCredit');
    if(text) text.textContent=`“${q.textZh||''}”`;
    if(credit) credit.textContent=quoteCredit(q);
  }

  function randomQuote(){
    const pool=quotePool();
    if(!pool.length) return null;
    let candidates=runtimeQuote?.id?pool.filter(q=>q.id!==runtimeQuote.id):pool;
    if(!candidates.length) candidates=pool;
    const q=candidates[Math.floor(Math.random()*candidates.length)];
    renderQuote(q);
    return q;
  }

  function showQuoteSource(q=runtimeQuote){
    if(!q) return;
    const dialog=document.querySelector('#quoteSourceDialog');
    if(dialog){
      const set=(sel,value)=>{const el=document.querySelector(sel);if(el)el.textContent=value||'—'};
      set('#quoteSourceText',`“${q.textZh||''}”`);
      set('#quoteSourceCredit',quoteCredit(q));
      set('#quoteSourceVerification',q.verification==='A'?'A · 强核验':'B · 剧本 / 权威转录核验');
      set('#quoteSourceType',q.sourceType||'—');
      set('#quoteSourceTitle',q.sourceTitle||'—');
      set('#quoteSourceTranslation',q.translationNote||'中文为收藏夹展示用自译/意译，不声称为官方译文。');
      const link=document.querySelector('#quoteSourceLink');
      if(link){link.href=q.sourceUrl||'#';link.classList.toggle('hidden',!q.sourceUrl)}
      dialog.showModal?.();
      return;
    }
    if(q.sourceUrl) window.open(q.sourceUrl,'_blank','noopener');
  }

  function enhanceQuoteCard(){
    const button=document.querySelector('#quoteNextBtn');
    const card=document.querySelector('#sidebarQuoteCard');
    if(!button||!card||button.dataset.contentCenterBound) return;
    button.dataset.contentCenterBound='1';
    button.addEventListener('click',e=>{
      const state=getQuoteState();
      if(!state.custom.length && !state.disabledDefaultIds.length) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      randomQuote();
    },true);
    const actions=card.querySelector('.quote-actions');
    if(actions&&!document.querySelector('#quoteSourceContentBtn')){
      const sourceBtn=document.createElement('button');
      sourceBtn.className='quote-action';
      sourceBtn.type='button';
      sourceBtn.id='quoteSourceContentBtn';
      sourceBtn.textContent='↗ 查看来源';
      sourceBtn.addEventListener('click',e=>{e.stopPropagation();showQuoteSource(runtimeQuote||window.MovieQuoteEngine?.getCurrent?.())});
      actions.appendChild(sourceBtn);
    }
    const state=getQuoteState();
    if(state.custom.length||state.disabledDefaultIds.length) randomQuote();
    else runtimeQuote=window.MovieQuoteEngine?.getCurrent?.()||null;
  }

  function injectAdminEntry(){
    const nav=document.querySelector('.sidebar .nav');
    if(!nav||document.querySelector('#contentCenterAdminEntry')) return;
    const a=document.createElement('a');
    a.id='contentCenterAdminEntry';
    a.href='admin.html';
    a.innerHTML='<span class="ico">◇</span><span>管理后台</span>';
    a.title='影视收藏夹管理后台';
    a.addEventListener('click',e=>{e.stopImmediatePropagation()});
    nav.appendChild(a);
  }

  function injectLayoutFix(){
    if(document.querySelector('#contentCenterLayoutFix')) return;
    const style=document.createElement('style');
    style.id='contentCenterLayoutFix';
    style.textContent=`
      #settingsView .settings-layout{grid-template-columns:repeat(3,minmax(0,1fr));grid-auto-flow:row;align-items:start}
      #settingsView .settings-stack{display:contents}
      #contentCenterAdminEntry{margin-top:8px;border-top:1px solid var(--line);padding-top:13px}
      @media(max-width:1420px){#settingsView .settings-layout{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:980px){#settingsView .settings-layout{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function boot(){
    injectLayoutFix();
    injectAdminEntry();
    applyCopy();
    enhanceQuoteCard();

    let timer=0;
    const observer=new MutationObserver(()=>{
      if(applying) return;
      clearTimeout(timer);
      timer=setTimeout(()=>{applyCopy();enhanceQuoteCard()},80);
    });
    observer.observe(document.body,{childList:true,subtree:true});
  }

  window.MovieCollectionContentCenter={
    version:VERSION,
    key:COPY_KEY,
    quoteKey:QUOTE_KEY,
    schema:deepClone(schema),
    load:loadCopyState,
    save:saveCopyState,
    apply:applyCopy,
    quote:{load:getQuoteState,save:saveQuoteState,pool:quotePool,random:randomQuote,showSource:showQuoteSource}
  };

  const IS_ADMIN_PAGE = /(?:^|\/)admin\.html$/i.test(location.pathname);
  if(!IS_ADMIN_PAGE){
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
    else boot();
    window.addEventListener('storage',e=>{if(e.key===COPY_KEY)applyCopy();if(e.key===QUOTE_KEY)enhanceQuoteCard()});
  }
})();
