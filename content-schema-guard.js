(() => {
  'use strict';
  const CC=window.MovieCollectionContentCenter;
  if(!CC)return;

  const removedKeys=new Set(['match.pause','nav.watched']);
  const keptWatched=new Set(['watched.record','watched.search.placeholder','watched.feed.title']);

  function ensureSchema(row){
    if(!Array.isArray(CC.schema))return;
    const existing=CC.schema.find(item=>item?.key===row.key||item?.selector===row.selector);
    if(existing){
      Object.assign(existing,row,{key:existing.key||row.key});
      return;
    }
    CC.schema.push(row);
  }

  if(Array.isArray(CC.schema)){
    for(let i=CC.schema.length-1;i>=0;i--){
      const item=CC.schema[i];
      const key=String(item?.key||'');
      if(key==='nav.watched'||(key.startsWith('watched.')&&!keptWatched.has(key))||removedKeys.has(key)){
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
      if(key==='watched.record'){
        item.group='观影分析';
        item.label='观影记录：记录一次观看按钮';
      }
      if(key==='watched.search.placeholder'){
        item.group='观影分析';
        item.label='观影记录：搜索框占位文案';
      }
      if(key==='watched.feed.title'){
        item.group='观影分析';
        item.label='观影记录：时间流标题';
        item.selector='#statsHistoryPane .watched-feed-head h3';
      }
    }

    ensureSchema({key:'stats.title',group:'观影分析',label:'观影分析页标题',selector:'#statsView .stats-title-row h2',prop:'ownText',defaultValue:'观影分析'});
    ensureSchema({key:'stats.sub',group:'观影分析',label:'观影分析页副文案',selector:'#statsView .stats-title-row p',prop:'text',defaultValue:'把每一次观看留在时间流里，也把节奏、偏爱与重逢连成你的光影星图。'});
    ensureSchema({key:'stats.tab.overview',group:'观影分析',label:'内部标签：分析总览',selector:'#statsIntegratedTabs [data-stats-integrated-tab="analysis"]',prop:'text',defaultValue:'分析总览'});
    ensureSchema({key:'stats.tab.history',group:'观影分析',label:'内部标签：观影记录',selector:'#statsIntegratedTabs [data-stats-integrated-tab="history"]',prop:'text',defaultValue:'观影记录'});
    ensureSchema({key:'stats.history.title',group:'观影分析',label:'观影记录模块标题',selector:'#statsHistoryTitle',prop:'text',defaultValue:'观影记录'});
    ensureSchema({key:'stats.history.rewatch',group:'观影分析',label:'重看作品模块标题',selector:'#statsHistoryPane .stats-history-rewatch-head h3',prop:'text',defaultValue:'重看作品'});
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