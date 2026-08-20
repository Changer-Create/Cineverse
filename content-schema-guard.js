(() => {
  'use strict';
  const CC=window.MovieCollectionContentCenter;
  if(!CC)return;
  const excluded=new Set(['match.pause']);
  if(Array.isArray(CC.schema)){
    for(let i=CC.schema.length-1;i>=0;i--)if(excluded.has(CC.schema[i]?.key))CC.schema.splice(i,1);
  }
  try{
    const state=CC.load();
    let changed=false;
    for(const key of excluded)if(state?.values&&Object.prototype.hasOwnProperty.call(state.values,key)){delete state.values[key];changed=true}
    if(changed)CC.save(state);
  }catch{}
})();