(() => {
  'use strict';

  const KEY='movie-collection-nav-order-v1';
  const VERSION=1;
  const DEFAULT_ORDER=['home','library','match','radar','plan','watched','stats','settings','admin'];
  const DEFAULT_LABELS={
    home:'首页',library:'影视库',match:'匹配中心',radar:'电影雷达',plan:'月度计划',
    watched:'已观看',stats:'统计分析',settings:'设置',admin:'管理后台'
  };
  const FRONT_PAGE=!/(?:^|\/)(?:admin|admin-console)\.html$/i.test(location.pathname);
  let observer=null;
  let timer=0;

  const clone=v=>JSON.parse(JSON.stringify(v));

  function normalize(order){
    const input=Array.isArray(order)?order:[];
    const valid=new Set(DEFAULT_ORDER);
    const out=[];
    for(const key of input){
      if(valid.has(key)&&!out.includes(key))out.push(key);
    }
    for(const key of DEFAULT_ORDER){
      if(!out.includes(key))out.push(key);
    }
    return out;
  }

  function load(){
    try{
      const raw=JSON.parse(localStorage.getItem(KEY)||'{}');
      return {version:VERSION,updatedAt:raw.updatedAt||'',order:normalize(raw.order)};
    }catch{
      return {version:VERSION,updatedAt:'',order:[...DEFAULT_ORDER]};
    }
  }

  function save(order){
    const state={version:VERSION,updatedAt:new Date().toISOString(),order:normalize(order)};
    localStorage.setItem(KEY,JSON.stringify(state));
    window.dispatchEvent(new CustomEvent('movie-collection:nav-order-updated',{detail:clone(state)}));
    apply();
    return state;
  }

  function reset(){
    localStorage.removeItem(KEY);
    const state=load();
    window.dispatchEvent(new CustomEvent('movie-collection:nav-order-updated',{detail:clone(state)}));
    apply();
    return state;
  }

  function keyOf(el){
    if(!(el instanceof HTMLElement))return '';
    if(el.id==='contentCenterAdminEntry'||/admin\.html(?:$|[?#])/.test(el.getAttribute('href')||''))return 'admin';
    return el.dataset?.view||'';
  }

  function apply(){
    if(!FRONT_PAGE)return false;
    const nav=document.querySelector('.sidebar .nav');
    if(!nav)return false;
    const children=[...nav.children].filter(el=>keyOf(el));
    if(!children.length)return false;
    const byKey=new Map(children.map(el=>[keyOf(el),el]));
    const desired=normalize(load().order).filter(key=>byKey.has(key));
    const current=children.map(keyOf);
    if(current.length===desired.length&&current.every((key,i)=>key===desired[i]))return true;
    for(const key of desired)nav.appendChild(byKey.get(key));
    return true;
  }

  function schedule(){
    clearTimeout(timer);
    timer=setTimeout(apply,20);
  }

  function observe(){
    if(!FRONT_PAGE||observer)return;
    const nav=document.querySelector('.sidebar .nav');
    if(!nav)return;
    observer=new MutationObserver(records=>{
      if(records.some(record=>record.type==='childList'))schedule();
    });
    observer.observe(nav,{childList:true});
  }

  function boot(){
    apply();
    observe();
  }

  window.MovieCollectionNavigation={
    key:KEY,
    defaults:[...DEFAULT_ORDER],
    labels:{...DEFAULT_LABELS},
    normalize,
    load,
    save,
    reset,
    apply
  };

  if(FRONT_PAGE){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
    else boot();
    window.addEventListener('storage',e=>{if(e.key===KEY)apply()});
    window.addEventListener('movie-collection:nav-order-updated',apply);
  }
})();