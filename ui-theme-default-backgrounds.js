(() => {
  'use strict';
  if(/(?:^|\/)(?:admin|admin-console)\.html$/i.test(location.pathname)) return;

  const THEME_KEY='movie-collection-ui-theme-v1';
  const APP_KEY='movie-collection-v2';
  const DEFAULT_BACKGROUNDS={
    star:{
      asset:'assets/theme-bg-star-cosmic.webp',
      overlay:'linear-gradient(145deg,rgba(4,8,23,.36),rgba(8,18,42,.48) 46%,rgba(4,8,23,.62))',
      position:'center center'
    }
  };

  let applying=false;
  const safeJson=raw=>{try{return JSON.parse(raw)}catch{return null}};

  function appSettings(){
    const app=safeJson(localStorage.getItem(APP_KEY)||'{}');
    return app?.settings&&typeof app.settings==='object'?app.settings:{};
  }

  function storedTheme(){
    const rec=safeJson(localStorage.getItem(THEME_KEY)||'{}');
    return String(rec?.theme||'star');
  }

  function currentTheme(){
    return document.body?.dataset.uiTheme||storedTheme()||'star';
  }

  function hasCustomWallpaper(){
    return Boolean(String(appSettings().wallpaperDataUrl||''));
  }

  function applyDefaultBackground(){
    const body=document.body;
    if(!body||applying)return;
    const theme=currentTheme();
    const config=DEFAULT_BACKGROUNDS[theme];
    if(!config||hasCustomWallpaper()){
      delete body.dataset.defaultThemeBackground;
      return;
    }
    if((body.style.backgroundImage||'').includes(config.asset)){
      body.dataset.defaultThemeBackground=theme;
      return;
    }
    applying=true;
    try{
      body.style.backgroundImage=`${config.overlay},url("${config.asset}")`;
      body.style.backgroundSize='cover';
      body.style.backgroundPosition=config.position;
      body.style.backgroundRepeat='no-repeat';
      body.style.backgroundAttachment='fixed';
      body.dataset.defaultThemeBackground=theme;
    }finally{
      queueMicrotask(()=>{applying=false});
    }
  }

  function schedule(){setTimeout(applyDefaultBackground,0)}

  function boot(){
    if(!document.body)return;
    applyDefaultBackground();
    const observer=new MutationObserver(()=>{
      if(!applying)queueMicrotask(applyDefaultBackground);
    });
    observer.observe(document.body,{attributes:true,attributeFilter:['style','data-ui-theme']});
    window.addEventListener('storage',e=>{
      if(e.key===THEME_KEY||e.key===APP_KEY)schedule();
    });
    document.addEventListener('click',e=>{
      if(e.target.closest?.('[data-ui-theme-choice],#settingsSaveAppearance,#settingsResetAppearance,#settingsWallpaperClear'))schedule();
    });
    document.addEventListener('change',e=>{
      if(['settingsWallpaperFile','settingsStarDensity'].includes(e.target?.id)){
        [0,120,500,1200].forEach(ms=>setTimeout(applyDefaultBackground,ms));
      }
    });
    document.addEventListener('input',e=>{
      if(['settingsAccent','settingsPanelOpacity'].includes(e.target?.id))schedule();
    });
  }

  window.MovieCollectionThemeBackgrounds={defaults:DEFAULT_BACKGROUNDS,apply:applyDefaultBackground};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();