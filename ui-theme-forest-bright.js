(() => {
  'use strict';
  if(/(?:^|\/)(?:admin|admin-console)\.html$/i.test(location.pathname)) return;

  function injectStyles(){
    if(document.querySelector('#movieCollectionForestBrightStyle')) return;
    const style=document.createElement('style');
    style.id='movieCollectionForestBrightStyle';
    style.textContent=`
      .swatch-forest{background:radial-gradient(circle at 72% 18%,rgba(255,244,166,.38),transparent 25%),radial-gradient(ellipse at 28% 74%,rgba(116,196,98,.34),transparent 34%),linear-gradient(180deg,#7fcf63 0%,#3f9650 52%,#1f5f38 100%)!important}
      .swatch-forest::before{content:''!important;position:absolute;inset:0;background:linear-gradient(112deg,transparent 0 52%,rgba(255,245,184,.26) 53% 56%,transparent 57%),radial-gradient(circle at 30% 28%,rgba(240,255,214,.70) 0 2px,transparent 3px),radial-gradient(circle at 66% 58%,rgba(226,247,188,.56) 0 1px,transparent 2px)!important}
      .swatch-forest::after{content:'✦'!important;color:#f3e6a2!important;text-shadow:0 0 14px rgba(243,230,162,.62)!important}
      body[data-ui-theme="forest"]::before{background-image:radial-gradient(circle at 10% 82%,rgba(236,255,213,.23) 0 2px,transparent 3px),radial-gradient(circle at 28% 68%,rgba(208,242,184,.19) 0 2px,transparent 3px),radial-gradient(circle at 47% 86%,rgba(235,255,214,.16) 0 1px,transparent 2px),radial-gradient(circle at 66% 70%,rgba(215,244,189,.20) 0 2px,transparent 3px),radial-gradient(circle at 85% 84%,rgba(239,255,214,.18) 0 2px,transparent 3px)!important;opacity:.28!important;filter:none!important}
      body[data-ui-theme="forest"]::after{background:radial-gradient(ellipse at 72% 0%,rgba(255,244,180,.13),transparent 42%),linear-gradient(180deg,rgba(112,174,92,.04),rgba(7,35,17,.18))!important;opacity:.52!important}
      body[data-ui-theme="forest"] .constellation i{background:#b9d98f!important;box-shadow:0 0 10px rgba(190,224,142,.36)!important}
    `;
    document.head.appendChild(style);
  }

  function patchCopy(){
    const api=window.MovieCollectionThemeSystem;
    if(api?.themes?.forest){
      api.themes.forest.name='翠绿森林';
      api.themes.forest.description='翠绿 · 阳光与林间清风';
    }
    document.querySelectorAll('[data-ui-theme-choice="forest"]').forEach(btn=>{
      const title=btn.querySelector('b');
      const desc=btn.querySelector('small');
      if(title) title.textContent='翠绿森林';
      if(desc) desc.textContent='翠绿 · 阳光与林间清风';
    });
    const density=document.querySelector('#settingsStarDensity');
    const copy=density?.closest('.setting-row')?.querySelector('.setting-copy span');
    if(copy) copy.textContent='控制星点、气泡、飘雪、林间光尘等主题环境装饰的强度。';
  }

  function schedulePatch(){[0,80,260,700].forEach(ms=>setTimeout(patchCopy,ms));}
  function boot(){
    injectStyles();
    schedulePatch();
    window.addEventListener('movie-collection:content-updated',schedulePatch);
    document.addEventListener('click',e=>{
      if(e.target.closest?.('[data-ui-theme-choice],a[href="#settings"],#settingsView')) schedulePatch();
    });
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();