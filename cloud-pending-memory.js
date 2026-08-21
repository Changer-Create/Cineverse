(() => {
  'use strict';
  if (/(?:^|\/)(?:admin|admin-console)\.html$/i.test(location.pathname)) return;

  const PENDING_KEY = 'movie-cloud-pending-v1';
  const OWNER_KEY = 'movie-cloud-owner-v1';
  const LAST_SYNC_KEY = 'movie-cloud-last-sync-v1';
  const DIRTY_KEY = 'movie-cloud-dirty-v1';
  const ACCEPTED_CLOUD_KEY = 'movie-cloud-accepted-v1';
  let pendingValue = null;
  let applyCandidate = null;

  const safeParse = raw => { try { return JSON.parse(raw); } catch { return null; } };
  const ts = value => {
    const n = Date.parse(value || '');
    return Number.isFinite(n) ? n : 0;
  };

  try { localStorage.removeItem(PENDING_KEY); } catch {}

  // A successful “use cloud” action reloads the page. During startup the app may
  // normalize/migrate that cloud payload, making its JSON differ from the raw row.
  // Mark that one reload as dirty so cloud-auth uploads the normalized canonical
  // state instead of treating the normalization difference as a fresh conflict.
  try {
    const accepted = safeParse(sessionStorage.getItem(ACCEPTED_CLOUD_KEY));
    if (accepted?.userId) {
      const owner = localStorage.getItem(OWNER_KEY) || '';
      const lastSync = localStorage.getItem(LAST_SYNC_KEY) || '';
      const sameOwner = owner === accepted.userId;
      const sameOrNewerBaseline = !accepted.updated_at || ts(lastSync) + 500 >= ts(accepted.updated_at);
      if (sameOwner && sameOrNewerBaseline) localStorage.setItem(DIRTY_KEY,'1');
    }
    sessionStorage.removeItem(ACCEPTED_CLOUD_KEY);
  } catch {}

  if (Storage.prototype.__movieCloudPendingMemoryPatchedV2) return;

  const nativeGetItem = Storage.prototype.getItem;
  const nativeSetItem = Storage.prototype.setItem;
  const nativeRemoveItem = Storage.prototype.removeItem;

  Object.defineProperty(Storage.prototype,'__movieCloudPendingMemoryPatchedV2',{
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

  // Capture an explicit cloud choice before cloud-auth handles the click. We only
  // persist the marker on pagehide after pending data has actually been cleared,
  // so cancelling the confirmation cannot create a false resolution marker.
  document.addEventListener('click',event => {
    if (event.target.closest?.('[data-account-apply]')) {
      const pending = safeParse(localStorage.getItem(PENDING_KEY));
      applyCandidate = pending?.userId ? {
        userId:pending.userId,
        updated_at:pending.updated_at || ''
      } : null;
      return;
    }
    if (event.target.closest?.('[data-account-force-upload],[data-account-logout]')) {
      applyCandidate = null;
    }
  },true);

  window.addEventListener('pagehide',() => {
    if (!applyCandidate) return;
    const pending = safeParse(localStorage.getItem(PENDING_KEY));
    if (pending?.userId === applyCandidate.userId) return;
    const owner = localStorage.getItem(OWNER_KEY) || '';
    if (owner !== applyCandidate.userId) return;
    try {
      sessionStorage.setItem(ACCEPTED_CLOUD_KEY,JSON.stringify(applyCandidate));
    } catch {}
  });
})();
