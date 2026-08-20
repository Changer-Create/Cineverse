(() => {
  'use strict';
  if (/(?:^|\/)(?:admin|admin-console)\.html$/i.test(location.pathname)) return;

  const PENDING_KEY = 'movie-cloud-pending-v1';
  let pendingValue = null;

  try { localStorage.removeItem(PENDING_KEY); } catch {}

  if (Storage.prototype.__movieCloudPendingMemoryPatchedV1) return;

  const nativeGetItem = Storage.prototype.getItem;
  const nativeSetItem = Storage.prototype.setItem;
  const nativeRemoveItem = Storage.prototype.removeItem;

  Object.defineProperty(Storage.prototype,'__movieCloudPendingMemoryPatchedV1',{
    value:true,
    configurable:true
  });

  Storage.prototype.getItem = function(key) {
    if (this === localStorage && key === PENDING_KEY) return pendingValue;
    return nativeGetItem.call(this,key);
  };

  Storage.prototype.setItem = function(key,value) {
    if (this === localStorage && key === PENDING_KEY) {
      pendingValue = String(value);
      return;
    }
    return nativeSetItem.call(this,key,value);
  };

  Storage.prototype.removeItem = function(key) {
    if (this === localStorage && key === PENDING_KEY) {
      pendingValue = null;
      return;
    }
    return nativeRemoveItem.call(this,key);
  };
})();
