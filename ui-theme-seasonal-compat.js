(() => {
  'use strict';
  if(/(?:^|\/)(?:admin|admin-console)\.html$/i.test(location.pathname))return;
  const seasonal=new Set(['snow','forest']);
  const api=()=>window.MovieCollectionThemeSystem;
  const current=()=>api()?.current?.()||'';
  const reapply=id=>{
    if(!seasonal.has(id))return;
    api()?.save?.(id);
    api()?.apply?.(id);
  };

  document.addEventListener('click',e=>{
    const themeBtn=e.target.closest?.('[data-ui-theme-choice]');
    if(themeBtn){
      const id=themeBtn.dataset.uiThemeChoice;
      if(id==='star'||id==='ocean')queueMicrotask(()=>{api()?.save?.(id);api()?.apply?.(id)});
    }
    if(e.target.closest?.('#settingsSaveAppearance')){
      const id=current();
      if(seasonal.has(id))queueMicrotask(()=>reapply(id));
    }
    if(e.target.closest?.('#settingsResetAppearance'))queueMicrotask(()=>{api()?.save?.('star');api()?.apply?.('star')});
    if(e.target.closest?.('#settingsMotion')){
      const id=current();
      if(seasonal.has(id))queueMicrotask(()=>api()?.apply?.(id));
    }
  });

  document.addEventListener('input',e=>{
    if(!['settingsAccent','settingsPanelOpacity'].includes(e.target?.id))return;
    const id=current();
    if(seasonal.has(id))queueMicrotask(()=>api()?.apply?.(id));
  });
  document.addEventListener('change',e=>{
    if(e.target?.id!=='settingsStarDensity')return;
    const id=current();
    if(seasonal.has(id))queueMicrotask(()=>api()?.apply?.(id));
  });
})();