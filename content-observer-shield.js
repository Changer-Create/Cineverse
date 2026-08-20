(() => {
  'use strict';
  const NativeObserver=window.MutationObserver;
  if(!NativeObserver||NativeObserver.__movieCollectionEditorShield) return;

  const isEditorNode=node=>{
    const el=node?.nodeType===1?node:node?.parentElement;
    return !!el?.closest?.('#ccVisualMarkerLayer,#ccVisualToolbar,#ccVisualDialog');
  };

  const filterRecords=records=>records.filter(record=>{
    if(isEditorNode(record.target)) return false;
    const changed=[...(record.addedNodes||[]),...(record.removedNodes||[])];
    if(changed.length&&changed.every(isEditorNode)) return false;
    return true;
  });

  class ShieldedMutationObserver{
    constructor(callback){
      this._native=new NativeObserver(records=>{
        const filtered=filterRecords(records);
        if(filtered.length) callback(filtered,this);
      });
    }
    observe(target,options){return this._native.observe(target,options)}
    disconnect(){return this._native.disconnect()}
    takeRecords(){return filterRecords(this._native.takeRecords())}
  }

  ShieldedMutationObserver.__movieCollectionEditorShield=true;
  window.MutationObserver=ShieldedMutationObserver;
})();
