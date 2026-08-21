(() => {
  'use strict';

  const SUPABASE_PUBLISHABLE_KEY = window.CineverseConfig.supabasePublishableKey;
  const ADMIN_FUNCTION_URL = window.CineverseConfig.endpoints.adminGlobalConfig;
  const TABLE_URL = window.CineverseConfig.endpoints.globalConfigTable;
  const ADMIN_TOKEN_KEY = 'movie-collection-admin-session-v1';
  const ADMIN_RELOAD_KEY = 'movie-global-config-admin-reload-v1';
  const IS_ADMIN = /(?:^|\/)(?:admin|admin-console)\.html$/i.test(location.pathname);

  const CONFIGS = {
    copy: {
      storageKey: 'movie-collection-content-v1',
      event: 'movie-collection:content-updated'
    },
    quotes: {
      storageKey: 'movie-collection-quote-library-v1',
      event: 'movie-collection:quote-library-updated'
    },
    brand: {
      storageKey: 'movie-collection-site-brand-v1',
      event: 'movie-collection:brand-updated'
    },
    navigation: {
      storageKey: 'movie-collection-nav-order-v1',
      event: 'movie-collection:nav-order-updated'
    }
  };
  const BY_STORAGE_KEY = Object.fromEntries(Object.entries(CONFIGS).map(([key, meta]) => [meta.storageKey, key]));

  let applyingRemote = false;
  let pulling = false;
  let pushInFlight = 0;
  let lastRemoteKeys = new Set();
  const pushTimers = new Map();
  let readyResolve;
  const ready = new Promise(resolve => { readyResolve = resolve; });

  const safeParse = raw => { try { return JSON.parse(raw); } catch { return null; } };
  const clone = value => JSON.parse(JSON.stringify(value));

  function stableValue(value) {
    if (Array.isArray(value)) return value.map(stableValue);
    if (value && typeof value === 'object') {
      const out = {};
      for (const key of Object.keys(value).sort()) out[key] = stableValue(value[key]);
      return out;
    }
    return value;
  }

  function signature(value) {
    try { return JSON.stringify(stableValue(value)); }
    catch { return ''; }
  }

  function adminToken() {
    try { return sessionStorage.getItem(ADMIN_TOKEN_KEY) || ''; }
    catch { return ''; }
  }

  function showAdminToast(message, isError = false) {
    if (!IS_ADMIN) return;
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    if (isError) el.dataset.globalSyncError = '1';
    else delete el.dataset.globalSyncError;
    clearTimeout(showAdminToast.timer);
    showAdminToast.timer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  function notifyConfig(key, data) {
    const meta = CONFIGS[key];
    if (!meta) return;
    window.dispatchEvent(new CustomEvent(meta.event, { detail: clone(data) }));
    window.dispatchEvent(new CustomEvent('movie-global-config:updated', { detail: { key, data: clone(data) } }));

    if (key === 'copy') window.MovieCollectionContentCenter?.apply?.();
    if (key === 'quotes') {
      try { window.MovieCollectionContentCenter?.quote?.random?.(); } catch {}
    }
    if (key === 'brand') window.MovieCollectionBrand?.apply?.();
    if (key === 'navigation') window.MovieCollectionNavigation?.apply?.();
  }

  function fallbackStateForStorage(storageKey) {
    if (storageKey === CONFIGS.copy.storageKey) {
      return window.MovieCollectionContentCenter?.load?.() || { version:1, updatedAt:'', values:{} };
    }
    if (storageKey === CONFIGS.quotes.storageKey) {
      return window.MovieCollectionContentCenter?.quote?.load?.() || { version:1, updatedAt:'', custom:[], disabledDefaultIds:[] };
    }
    if (storageKey === CONFIGS.brand.storageKey) {
      return window.MovieCollectionBrand?.load?.() || { version:1, updatedAt:'', title:'光影宇宙', subtitle:'定制化影视收藏夹', logoDataUrl:'' };
    }
    if (storageKey === CONFIGS.navigation.storageKey) {
      return window.MovieCollectionNavigation?.load?.() || { version:1, updatedAt:'', order:['home','library','match','radar','plan','stats','settings','admin'] };
    }
    return null;
  }

  async function push(key, data, { silent = false } = {}) {
    if (!IS_ADMIN) return false;
    if (!CONFIGS[key] || !data || typeof data !== 'object' || Array.isArray(data)) return false;
    const token = adminToken();
    if (!token) {
      if (!silent) showAdminToast('全局同步失败：管理员会话已失效', true);
      return false;
    }

    pushInFlight += 1;
    try {
      const res = await fetch(ADMIN_FUNCTION_URL, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_PUBLISHABLE_KEY,
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action:'upsert', key, data })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || payload?.ok !== true) throw new Error(payload?.message || `HTTP ${res.status}`);
      lastRemoteKeys.add(key);
      window.dispatchEvent(new CustomEvent('movie-global-config:saved', { detail: { key, updatedAt: payload.updatedAt || '' } }));
      if (!silent) showAdminToast('已同步到全用户');
      return true;
    } catch (error) {
      console.error('global config push failed', key, error);
      window.dispatchEvent(new CustomEvent('movie-global-config:error', { detail: { key, error } }));
      if (!silent) showAdminToast(`全局同步失败：${error?.message || '网络错误'}`, true);
      return false;
    } finally {
      pushInFlight = Math.max(0, pushInFlight - 1);
    }
  }

  function queuePushByStorage(storageKey, explicitData) {
    if (!IS_ADMIN || applyingRemote) return;
    const key = BY_STORAGE_KEY[storageKey];
    if (!key) return;
    clearTimeout(pushTimers.get(storageKey));
    const timer = setTimeout(() => {
      pushTimers.delete(storageKey);
      const data = explicitData || safeParse(localStorage.getItem(storageKey)) || fallbackStateForStorage(storageKey);
      if (data) push(key, data);
    }, 180);
    pushTimers.set(storageKey, timer);
  }

  function applyRemoteRow(row) {
    const key = String(row?.config_key || '');
    const meta = CONFIGS[key];
    const data = row?.data_json;
    if (!meta || !data || typeof data !== 'object' || Array.isArray(data)) return false;

    const current = safeParse(localStorage.getItem(meta.storageKey));
    if (signature(current) === signature(data)) return false;

    applyingRemote = true;
    try { localStorage.setItem(meta.storageKey, JSON.stringify(data)); }
    finally { applyingRemote = false; }
    notifyConfig(key, data);
    return true;
  }

  async function pull({ allowAdminReload = true } = {}) {
    if (pulling || pushInFlight > 0) return false;
    pulling = true;
    try {
      const res = await fetch(TABLE_URL, {
        cache: 'no-store',
        headers: { 'apikey': SUPABASE_PUBLISHABLE_KEY, 'Accept':'application/json' }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rows = await res.json();
      if (!Array.isArray(rows)) return false;
      lastRemoteKeys = new Set(rows.map(row => String(row?.config_key || '')).filter(Boolean));

      let changed = false;
      for (const row of rows) changed = applyRemoteRow(row) || changed;

      if (IS_ADMIN && changed && allowAdminReload) {
        const remoteSignature = signature(rows.map(row => [row.config_key, row.updated_at]));
        let previous = '';
        try { previous = sessionStorage.getItem(ADMIN_RELOAD_KEY) || ''; } catch {}
        if (remoteSignature && previous !== remoteSignature) {
          try { sessionStorage.setItem(ADMIN_RELOAD_KEY, remoteSignature); } catch {}
          setTimeout(() => location.reload(), 0);
        }
      }
      return changed;
    } catch (error) {
      console.warn('global config pull failed', error);
      return false;
    } finally {
      pulling = false;
    }
  }

  async function bootstrapMissingAdminConfig() {
    if (!IS_ADMIN || !adminToken()) return 0;
    let migrated = 0;
    for (const [key, meta] of Object.entries(CONFIGS)) {
      if (lastRemoteKeys.has(key)) continue;
      const local = safeParse(localStorage.getItem(meta.storageKey));
      if (!local || typeof local !== 'object' || Array.isArray(local)) continue;
      if (await push(key, local, { silent:true })) migrated += 1;
    }
    if (migrated > 0) showAdminToast(`已将 ${migrated} 类现有后台配置迁移到云端`);
    return migrated;
  }

  function localChanged(storageKey, data) {
    if (!IS_ADMIN || applyingRemote || !BY_STORAGE_KEY[storageKey]) return;
    queuePushByStorage(storageKey, data);
  }

  function localRemoved(storageKey) {
    if (!IS_ADMIN || applyingRemote || !BY_STORAGE_KEY[storageKey]) return;
    setTimeout(() => queuePushByStorage(storageKey, fallbackStateForStorage(storageKey)), 0);
  }

  window.MovieGlobalConfig = {
    version:1,
    configs: clone(CONFIGS),
    ready,
    pull,
    push,
    localChanged,
    localRemoved
  };

  const initial = pull({ allowAdminReload:true })
    .then(() => bootstrapMissingAdminConfig())
    .finally(() => readyResolve?.());
  void initial;

  if (!IS_ADMIN) {
    setInterval(() => pull({ allowAdminReload:false }), 30000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') pull({ allowAdminReload:false });
    });
    window.addEventListener('focus', () => pull({ allowAdminReload:false }));
  }
})();
