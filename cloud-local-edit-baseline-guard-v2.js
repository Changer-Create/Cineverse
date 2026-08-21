(() => {
  'use strict';
  if (/(?:^|\/)(?:admin|admin-console)\.html$/i.test(location.pathname)) return;

  const APP_KEY = 'movie-collection-v2';
  const OWNER_KEY = 'movie-cloud-owner-v1';
  const LAST_SYNC_KEY = 'movie-cloud-last-sync-v1';
  const DIRTY_KEY = 'movie-cloud-dirty-v1';
  const BASELINE_KEY = 'movie-cloud-baseline-fingerprint-v1';
  const PATCH_FLAG = '__movieCloudLocalBaselineGuardV2__';

  if (Storage.prototype[PATCH_FLAG]) return;

  const safeParse = raw => { try { return JSON.parse(raw); } catch { return null; } };
  const usable = data => data && typeof data === 'object' && Array.isArray(data.movies);
  const stableValue = value => {
    if (Array.isArray(value)) return value.map(stableValue);
    if (value && typeof value === 'object') {
      const out = {};
      for (const key of Object.keys(value).sort()) out[key] = stableValue(value[key]);
      return out;
    }
    return value;
  };

  // Small deterministic fingerprint. We keep only the fingerprint in localStorage,
  // not a second full copy of the movie database.
  function fingerprint(data) {
    const text = JSON.stringify(stableValue({ data }));
    let h1 = 0xdeadbeef ^ 0x9e3779b9;
    let h2 = 0x41c6ce57 ^ 0x85ebca6b;
    for (let i = 0; i < text.length; i++) {
      const ch = text.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return `${text.length}:${(h2 >>> 0).toString(36)}:${(h1 >>> 0).toString(36)}`;
  }

  function currentData() {
    return safeParse(localStorage.getItem(APP_KEY));
  }

  function readBaseline() {
    const value = safeParse(localStorage.getItem(BASELINE_KEY));
    return value && value.userId && value.fingerprint ? value : null;
  }

  function writeBaseline(userId, data, updatedAt='') {
    if (!userId || !usable(data)) return;
    try {
      localStorage.setItem(BASELINE_KEY, JSON.stringify({
        userId,
        fingerprint:fingerprint(data),
        updated_at:updatedAt || localStorage.getItem(LAST_SYNC_KEY) || '',
        saved_at:new Date().toISOString()
      }));
    } catch {}
  }

  const previousSetItem = Storage.prototype.setItem;
  const previousRemoveItem = Storage.prototype.removeItem;
  let editBaseFingerprint = '';
  let editBaseOwner = '';
  let verifyTimer = 0;
  let verifySeq = 0;

  Object.defineProperty(Storage.prototype, PATCH_FLAG, { value:true, configurable:true });

  async function getCloudContext() {
    const account = window.MovieCloudAccount;
    const client = account?.client;
    if (!client) return null;
    const { data:{ session } } = await client.auth.getSession();
    const user = session?.user;
    if (!user) return null;
    const owner = localStorage.getItem(OWNER_KEY) || '';
    if (!owner || owner !== user.id) return null;
    return { client, user };
  }

  async function verifyBeforeAutoUpload(seq, attempt=0) {
    if (seq !== verifySeq) return;
    const local = currentData();
    if (!usable(local)) return;

    let context = null;
    try { context = await getCloudContext(); } catch {}
    if (!context) {
      if (attempt < 10) {
        verifyTimer = setTimeout(() => verifyBeforeAutoUpload(seq, attempt + 1), 100);
      }
      return;
    }

    const { client, user } = context;
    try {
      const { data:row, error } = await client
        .from('user_data')
        .select('data_json,updated_at')
        .eq('user_id',user.id)
        .maybeSingle();
      if (error || seq !== verifySeq || !usable(row?.data_json)) return;

      const remoteFp = fingerprint(row.data_json);
      const localFp = fingerprint(local);
      const saved = readBaseline();
      const savedFp = saved?.userId === user.id ? saved.fingerprint : '';
      const baseFp = savedFp || (editBaseOwner === user.id ? editBaseFingerprint : '');

      // Case 1: remote already equals the current local state. This is not pending
      // work at all; repair the local sync baseline immediately.
      if (remoteFp === localFp) {
        localStorage.setItem(LAST_SYNC_KEY, row.updated_at || new Date().toISOString());
        writeBaseline(user.id, row.data_json, row.updated_at || '');
        localStorage.removeItem(DIRTY_KEY);
        editBaseFingerprint = '';
        editBaseOwner = '';
        return;
      }

      // Case 2: remote still equals the last confirmed synced state (or, on the
      // first run after upgrade, the state immediately before this local edit).
      // Therefore no other device changed the cloud copy. Align the timestamp so
      // cloud-auth can silently upload the local edit instead of staging a false
      // cloud update/conflict.
      if (baseFp && remoteFp === baseFp) {
        localStorage.setItem(LAST_SYNC_KEY, row.updated_at || localStorage.getItem(LAST_SYNC_KEY) || new Date().toISOString());
        if (!savedFp) writeBaseline(user.id, row.data_json, row.updated_at || '');
      }
      // Otherwise the remote content is genuinely different from both the current
      // local state and our last synced baseline. Do nothing: cloud-auth will keep
      // its normal conflict protection.
    } catch {
      // Network errors fall back to cloud-auth's existing retry/error behavior.
    }
  }

  function scheduleVerify(delay=30) {
    clearTimeout(verifyTimer);
    const seq = ++verifySeq;
    verifyTimer = setTimeout(() => verifyBeforeAutoUpload(seq, 0), delay);
  }

  Storage.prototype.setItem = function(key, value) {
    if (this === localStorage && key === APP_KEY) {
      const previousRaw = localStorage.getItem(APP_KEY) || '';
      const owner = localStorage.getItem(OWNER_KEY) || '';
      const result = previousSetItem.call(this, key, value);
      if (previousRaw && previousRaw !== String(value) && owner) {
        if (!editBaseFingerprint) {
          const previousData = safeParse(previousRaw);
          if (usable(previousData)) {
            editBaseFingerprint = fingerprint(previousData);
            editBaseOwner = owner;
          }
        }
        scheduleVerify(30);
      }
      return result;
    }
    return previousSetItem.call(this, key, value);
  };

  Storage.prototype.removeItem = function(key) {
    const result = previousRemoveItem.call(this, key);
    if (this === localStorage && key === DIRTY_KEY) {
      // cloud-auth only clears DIRTY after it has established that local and cloud
      // are the same (successful upload, applying cloud, or same-content reconcile).
      // Persist that state as the next content baseline.
      setTimeout(() => {
        const owner = localStorage.getItem(OWNER_KEY) || '';
        const data = currentData();
        if (owner && usable(data)) writeBaseline(owner, data);
        editBaseFingerprint = '';
        editBaseOwner = '';
      }, 0);
    }
    return result;
  };

  async function bootstrapBaseline(attempt=0) {
    let context = null;
    try { context = await getCloudContext(); } catch {}
    if (!context) {
      if (attempt < 12) setTimeout(() => bootstrapBaseline(attempt + 1), 150);
      return;
    }
    const { client, user } = context;
    const local = currentData();
    if (!usable(local)) return;
    try {
      const { data:row, error } = await client
        .from('user_data')
        .select('data_json,updated_at')
        .eq('user_id',user.id)
        .maybeSingle();
      if (error || !usable(row?.data_json)) return;
      if (fingerprint(row.data_json) === fingerprint(local)) {
        localStorage.setItem(LAST_SYNC_KEY, row.updated_at || localStorage.getItem(LAST_SYNC_KEY) || new Date().toISOString());
        writeBaseline(user.id, row.data_json, row.updated_at || '');
        localStorage.removeItem(DIRTY_KEY);
      }
    } catch {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(() => bootstrapBaseline(0), 0), { once:true });
  } else {
    setTimeout(() => bootstrapBaseline(0), 0);
  }
})();
