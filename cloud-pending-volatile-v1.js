(() => {
  'use strict';
  if (/(?:^|\/)(?:admin|admin-console)\.html$/i.test(location.pathname)) return;

  const PENDING_KEY = 'movie-cloud-pending-v1';
  if (Storage.prototype.__movieCloudPendingVolatileV1) return;

  const nativeGetItem = Storage.prototype.getItem;
  const nativeSetItem = Storage.prototype.setItem;
  const nativeRemoveItem = Storage.prototype.removeItem;
  let pendingValue = null;

  // v5 之前可能已经把整份待处理云端数据写进 localStorage。
  // 先清掉旧残留，避免继续占用浏览器配额。
  try { nativeRemoveItem.call(localStorage, PENDING_KEY); } catch {}

  Object.defineProperty(Storage.prototype, '__movieCloudPendingVolatileV1', {
    value: true,
    configurable: true
  });

  Storage.prototype.getItem = function(key) {
    if (this === localStorage && key === PENDING_KEY) return pendingValue;
    return nativeGetItem.call(this, key);
  };

  Storage.prototype.setItem = function(key, value) {
    if (this === localStorage && key === PENDING_KEY) {
      pendingValue = String(value);
      return;
    }
    return nativeSetItem.call(this, key, value);
  };

  Storage.prototype.removeItem = function(key) {
    if (this === localStorage && key === PENDING_KEY) {
      pendingValue = null;
      try { nativeRemoveItem.call(this, key); } catch {}
      return;
    }
    return nativeRemoveItem.call(this, key);
  };
})();
