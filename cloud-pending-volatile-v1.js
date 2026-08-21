(() => {
  'use strict';
  if (/(?:^|\/)(?:admin|admin-console)\.html$/i.test(location.pathname)) return;
  if (window.MovieCloudPending) return;

  const PENDING_KEY = 'movie-cloud-pending-v1';
  let pendingValue = null;

  // Older releases persisted the complete pending cloud payload. Remove that
  // one legacy value, then keep all future conflict payloads in this tab only.
  try { localStorage.removeItem(PENDING_KEY); } catch {}

  window.MovieCloudPending = Object.freeze({
    get() {
      return pendingValue;
    },
    set(value) {
      pendingValue = String(value);
    },
    remove() {
      pendingValue = null;
    },
  });
})();
