(() => {
  'use strict';
  if(/(?:^|\/)(?:admin|admin-console)\.html$/i.test(location.pathname))return;

  const q=s=>document.querySelector(s);
  let activeTab='analysis';
  let historyPane=null;
  let analysisPane=null;
  let tabs=null;

  function copyValues(){
    try{return window.MovieCollectionContentCenter?.load?.()?.values||{}}catch{return {}}
  }

  function ownText(el,value){
    if(!el)return;
    const node=[...el.childNodes].find(n=>n.nodeType===Node.TEXT_NODE&&n.nodeValue.trim());
    if(node)node.nodeValue=`${value} `;
    else el.insertBefore(document.createTextNode(`${value} `),el.firstChild);
  }

  function applyAnalysisNaming(){
    const values=copyValues();
    const navStats=q('.sidebar .nav a[data-view="stats"] span:last-child');
    if(navStats&&!Object.prototype.hasOwnProperty.call(values,'nav.stats'))navStats.textContent='观影分析';

    const h2=q('#statsView .stats-title-row h2');
    const titleItem=window.MovieCollectionContentCenter?.schema?.find?.(item=>String(item?.selector||'').includes('#statsView')&&String(item?.selector||'').includes('h2'));
    const titleCustom=titleItem&&Object.prototype.hasOwnProperty.call(values,titleItem.key)?values[titleItem.key]:'';
    ownText(h2,titleCustom||'观影分析');

    const sub=q('#statsView .stats-title-row p');
    const subItem=window.MovieCollectionContentCenter?.schema?.find?.(item=>String(item?.selector||'').includes('#statsView')&&String(item?.selector||'').includes('.stats-title-row p'));
    const subCustom=subItem&&Object.prototype.hasOwnProperty.call(values,subItem.key)?values[subItem.key]:'';
    if(sub&&!subCustom)sub.textContent='把每一次观看留在时间流里，也把节奏、偏爱与重逢连成你的光影星图。';
    q('#statsView')?.setAttribute('aria-label','观影分析');
  }

  function injectStyle(){
    if(q('#statsWatchIntegrationStyle'))return;
    const style=document.createElement('style');
    style.id='statsWatchIntegrationStyle';
    style.textContent=`
      .stats-integrated-tabs{display:flex;gap:7px;margin:14px 0;border:1px solid var(--line);border-radius:15px;background:rgba(8,18,42,.62);padding:6px;width:max-content;max-width:100%}
      .stats-integrated-tabs button{height:34px;border:1px solid transparent;border-radius:10px;background:transparent;color:#8d99b6;padding:0 13px;font-size:10px;cursor:pointer}
      .stats-integrated-tabs button:hover{color:#fff;background:rgba(255,255,255,.035)}
      .stats-integrated-tabs button.active{color:#fff;border-color:rgba(159,124,255,.34);background:linear-gradient(135deg,rgba(126,89,232,.28),rgba(76,96,214,.20));box-shadow:0 8px 22px rgba(0,0,0,.12)}
      .stats-history-pane{display:grid;gap:14px}
      .stats-history-pane.hidden,.stats-analysis-pane.hidden{display:none!important}
      .stats-history-card{border:1px solid var(--line);border-radius:21px;background:rgba(8,18,42,.69);overflow:hidden}
      .stats-history-head{padding:13px 16px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;gap:12px}
      .stats-history-head h3{margin:0;font-size:13px}.stats-history-head p{margin:4px 0 0;color:#7683a1;font-size:9px}
      #statsView #watchedRecordBtn{height:34px;border-radius:10px;border:1px solid rgba(159,124,255,.38);background:linear-gradient(90deg,#7657e8,#596fdc);color:#fff;padding:0 11px;cursor:pointer}
      .stats-history-body{padding:13px}
      .stats-history-pane .watched-toolbar{grid-template-columns:minmax(190px,1.5fr) repeat(4,minmax(105px,.8fr));margin:0 0 13px}
      .stats-history-pane #watchedYear{display:none!important}
      .stats-history-layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(235px,.34fr);gap:13px;align-items:start}
      .stats-history-layout .watched-feed{min-width:0}
      .stats-history-rewatch{border:1px solid var(--line);border-radius:18px;background:rgba(8,18,42,.69);overflow:hidden}
      .stats-history-rewatch-head{padding:13px 14px;border-bottom:1px solid var(--line)}
      .stats-history-rewatch-head h3{margin:0;font-size:12px}.stats-history-rewatch-head span{display:block;margin-top:3px;color:#73809d;font-size:8px}
      .stats-history-rewatch-body{padding:12px}
      @media(max-width:1180px){.stats-history-pane .watched-toolbar{grid-template-columns:repeat(3,1fr)}.stats-history-pane .watched-toolbar input{grid-column:1/-1}.stats-history-layout{grid-template-columns:1fr}.stats-history-rewatch{max-width:none}}
      @media(max-width:760px){.stats-integrated-tabs{width:100%}.stats-integrated-tabs button{flex:1}.stats-history-pane .watched-toolbar{grid-template-columns:1fr 1fr}.stats-history-head{align-items:flex-start;flex-direction:column}.stats-history-layout{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function forceHistoryRender(){
    const keyword=q('#watchedKeyword');
    const watchedYear=q('#watchedYear');
    const statsYear=q('#statsYear');
    if(!keyword||!watchedYear||!statsYear)return;
    // First pass lets the existing watched renderer rebuild its filter options.
    keyword.dispatchEvent(new Event('input'));
    watchedYear.value=statsYear.value==='all'?'':String(statsYear.value||'');
    watchedYear.dispatchEvent(new Event('change'));
  }

  function showTab(tab){
    activeTab=tab==='history'?'history':'analysis';
    if(analysisPane)analysisPane.classList.toggle('hidden',activeTab!=='analysis');
    if(historyPane)historyPane.classList.toggle('hidden',activeTab!=='history');
    tabs?.querySelectorAll('[data-stats-integrated-tab]').forEach(btn=>btn.classList.toggle('active',btn.dataset.statsIntegratedTab===activeTab));
    if(activeTab==='history')requestAnimationFrame(forceHistoryRender);
  }

  function openStatsHistory(){
    const statsLink=q('.sidebar .nav a[data-view="stats"]');
    if(statsLink)statsLink.click();
    else location.hash='stats';
    requestAnimationFrame(()=>showTab('history'));
  }

  function build(){
    const statsView=q('#statsView');
    const watchedView=q('#watchedView');
    if(!statsView||!watchedView||q('#statsIntegratedTabs'))return;

    injectStyle();
    applyAnalysisNaming();

    q('.sidebar .nav a[data-view="watched"]')?.remove();

    const statsHero=q('#statsView .stats-hero');
    analysisPane=q('#statsView .stats-layout');
    if(!statsHero||!analysisPane)return;
    analysisPane.classList.add('stats-analysis-pane');

    tabs=document.createElement('div');
    tabs.id='statsIntegratedTabs';
    tabs.className='stats-integrated-tabs';
    tabs.innerHTML='<button type="button" class="active" data-stats-integrated-tab="analysis">分析总览</button><button type="button" data-stats-integrated-tab="history">观影记录</button>';
    statsHero.insertAdjacentElement('afterend',tabs);

    historyPane=document.createElement('section');
    historyPane.id='statsHistoryPane';
    historyPane.className='stats-history-pane hidden';
    historyPane.innerHTML='<section class="stats-history-card"><div class="stats-history-head"><div><h3 id="statsHistoryTitle">观影记录</h3><p>按当前统计年份查看每一次真实观看、评分、场景与笔记。</p></div><div id="statsHistoryRecordAction"></div></div><div class="stats-history-body"><div id="statsHistoryToolbarSlot"></div><div class="stats-history-layout"><div id="statsHistoryFeedSlot"></div><aside class="stats-history-rewatch"><div class="stats-history-rewatch-head"><h3>重看作品</h3><span>全部历史中观看次数最多</span></div><div class="stats-history-rewatch-body"><div class="rewatch-list" id="statsHistoryRewatchSlot"></div></div></aside></div></div></section>';
    analysisPane.insertAdjacentElement('afterend',historyPane);

    const recordBtn=q('#watchedRecordBtn');
    const toolbar=q('#watchedView .watched-toolbar');
    const feed=q('#watchedView .watched-feed');
    const rewatchList=q('#watchedRewatchList');
    if(recordBtn)q('#statsHistoryRecordAction')?.appendChild(recordBtn);
    if(toolbar)q('#statsHistoryToolbarSlot')?.appendChild(toolbar);
    if(feed)q('#statsHistoryFeedSlot')?.appendChild(feed);
    if(rewatchList)q('#statsHistoryRewatchSlot')?.replaceWith(rewatchList);

    const hiddenYear=q('#watchedYear');
    if(hiddenYear){hiddenYear.setAttribute('aria-hidden','true');hiddenYear.tabIndex=-1}

    // The former top-level page is no longer part of the visible application.
    watchedView.classList.add('hidden');
    watchedView.remove();

    tabs.addEventListener('click',e=>{
      const btn=e.target.closest('[data-stats-integrated-tab]');
      if(btn)showTab(btn.dataset.statsIntegratedTab);
    });

    q('#statsYear')?.addEventListener('change',()=>{if(activeTab==='history')requestAnimationFrame(forceHistoryRender)});
    q('#watchModal')?.addEventListener('close',()=>{if(activeTab==='history')requestAnimationFrame(forceHistoryRender)});

    // "最近观看 → 查看全部" now enters the record tab instead of the removed page.
    document.addEventListener('click',e=>{
      const target=e.target.closest('#recentSeeAll,[data-view-link="watched"],.nav a[data-view="watched"]');
      if(!target)return;
      e.preventDefault();
      e.stopImmediatePropagation();
      openStatsHistory();
    },true);

    window.addEventListener('hashchange',()=>{
      if(location.hash.replace('#','')==='watched')openStatsHistory();
    });

    const observer=new MutationObserver(()=>{
      if(!statsView.classList.contains('hidden')&&activeTab==='history')requestAnimationFrame(forceHistoryRender);
    });
    observer.observe(statsView,{attributes:true,attributeFilter:['class']});

    if(location.hash.replace('#','')==='watched')openStatsHistory();
    else showTab('analysis');
  }

  // This script is loaded after the main application has initialized, so the
  // source elements already exist even while document.readyState is "loading".
  build();
})();
