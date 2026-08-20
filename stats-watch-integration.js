(() => {
  'use strict';
  if(/(?:^|\/)(?:admin|admin-console)\.html$/i.test(location.pathname))return;

  const q=s=>document.querySelector(s);

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
    const titleCustom=Object.prototype.hasOwnProperty.call(values,'stats.title')?values['stats.title']:'';
    ownText(h2,titleCustom||'观影分析');

    const sub=q('#statsView .stats-title-row p');
    const subCustom=Object.prototype.hasOwnProperty.call(values,'stats.sub')?values['stats.sub']:'';
    if(sub)sub.textContent=subCustom||'把你的观影记录连成星图，看见节奏、偏爱与重逢。';
    q('#statsView')?.setAttribute('aria-label','观影分析');
  }

  function openAnalysis(){
    const statsLink=q('.sidebar .nav a[data-view="stats"]');
    if(statsLink)statsLink.click();
    else location.hash='stats';
  }

  function retireWatchedPage(){
    applyAnalysisNaming();
    q('.sidebar .nav a[data-view="watched"]')?.remove();
    const watchedView=q('#watchedView');
    if(watchedView){
      watchedView.classList.add('hidden');
      watchedView.remove();
    }

    document.addEventListener('click',e=>{
      const target=e.target.closest('#recentSeeAll,[data-view-link="watched"],.nav a[data-view="watched"]');
      if(!target)return;
      e.preventDefault();
      e.stopImmediatePropagation();
      openAnalysis();
    },true);

    window.addEventListener('hashchange',()=>{
      if(location.hash.replace('#','')==='watched')openAnalysis();
    });

    if(location.hash.replace('#','')==='watched')openAnalysis();
  }

  retireWatchedPage();
})();
