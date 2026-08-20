(() => {
  'use strict';
  const CC=window.MovieCollectionContentCenter;
  if(!CC)return;

  const removedKeys=new Set([
    'match.pause','nav.watched',
    'stats.tab.overview','stats.tab.history','stats.history.title','stats.history.rewatch'
  ]);

  function ensureSchema(row){
    if(!Array.isArray(CC.schema))return;
    const existing=CC.schema.find(item=>item?.key===row.key||item?.selector===row.selector);
    if(existing){Object.assign(existing,row,{key:existing.key||row.key});return}
    CC.schema.push(row);
  }

  if(Array.isArray(CC.schema)){
    for(let i=CC.schema.length-1;i>=0;i--){
      const item=CC.schema[i];
      const key=String(item?.key||'');
      if(key.startsWith('watched.')||removedKeys.has(key)){
        removedKeys.add(key);
        CC.schema.splice(i,1);
        continue;
      }
      if(item.group==='统计分析')item.group='观影分析';
      if(key==='nav.stats'){
        item.group='导航';
        item.label='导航：观影分析';
        item.defaultValue='观影分析';
      }
    }

    ensureSchema({key:'stats.title',group:'观影分析',label:'观影分析页标题',selector:'#statsView .stats-title-row h2',prop:'ownText',defaultValue:'观影分析'});
    ensureSchema({key:'stats.sub',group:'观影分析',label:'观影分析页副文案',selector:'#statsView .stats-title-row p',prop:'text',defaultValue:'把你的观影记录连成星图，看见节奏、偏爱与重逢。'});
  }

  try{
    const state=CC.load();
    let changed=false;
    for(const key of removedKeys){
      if(state?.values&&Object.prototype.hasOwnProperty.call(state.values,key)){
        delete state.values[key];
        changed=true;
      }
    }
    if(changed)CC.save(state);
  }catch{}
})();
