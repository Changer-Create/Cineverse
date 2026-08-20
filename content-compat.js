(() => {
  'use strict';
  const CC=window.MovieCollectionContentCenter;
  if(!CC)return;
  try{
    const state=CC.load();
    if(state?.values&&Object.prototype.hasOwnProperty.call(state.values,'settings.brand.title')){
      delete state.values['settings.brand.title'];
      CC.save(state);
    }
  }catch{}
})();