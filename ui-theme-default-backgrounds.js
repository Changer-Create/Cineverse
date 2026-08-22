(() => {
  'use strict';
  if(/(?:^|\/)(?:admin|admin-console)\.html$/i.test(location.pathname)) return;

  const THEME_KEY='movie-collection-ui-theme-v1';
  const APP_KEY='movie-collection-v2';
  const LEGACY_DEFAULT_ASSETS=['assets/theme-bg-star-cosmic.webp','assets/theme-bg-ocean-sunny.webp'];
  const DEFAULT_BACKGROUNDS={
    snow:{
      asset:'assets/theme-bg-snow-dawn.webp',
      overlay:'linear-gradient(145deg,rgba(18,31,44,.18),rgba(22,40,58,.28) 46%,rgba(13,25,38,.44))',
      position:'center center'
    },
    forest:{
      asset:'assets/theme-bg-forest-green.webp',
      overlay:'linear-gradient(145deg,rgba(5,31,13,.10),rgba(7,45,19,.18) 46%,rgba(4,28,12,.32))',
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

  function hasLegacyDefaultBackground(body){
    const image=String(body?.style?.backgroundImage||'');
    return LEGACY_DEFAULT_ASSETS.some(asset=>image.includes(asset));
  }

  function restoreThemeBackground(theme){
    const body=document.body;
    if(!body)return;
    const needsRestore=Boolean(body.dataset.defaultThemeBackground)||hasLegacyDefaultBackground(body);
    delete body.dataset.defaultThemeBackground;
    if(!needsRestore)return;
    const system=window.MovieCollectionThemeSystem;
    if(system?.apply){
      system.apply(theme);
      return;
    }
    body.style.removeProperty('background-image');
    body.style.removeProperty('background-size');
    body.style.removeProperty('background-position');
    body.style.removeProperty('background-repeat');
    body.style.removeProperty('background-attachment');
  }

  function applyDefaultBackground(){
    const body=document.body;
    if(!body||applying)return;
    const theme=currentTheme();
    const config=DEFAULT_BACKGROUNDS[theme];
    if(!config||hasCustomWallpaper()){
      applying=true;
      try{restoreThemeBackground(theme)}finally{queueMicrotask(()=>{applying=false})}
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
      if(e.target?.id==='settingsWallpaperFile'){
        [0,120,500,1200].forEach(ms=>setTimeout(applyDefaultBackground,ms));
      }
    });
  }

  window.MovieCollectionThemeBackgrounds={defaults:DEFAULT_BACKGROUNDS,apply:applyDefaultBackground};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
