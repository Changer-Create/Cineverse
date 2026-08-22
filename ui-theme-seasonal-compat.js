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
  });
})();
