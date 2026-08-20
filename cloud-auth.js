(() => {
  'use strict';
  if (/(?:^|\/)(?:admin|admin-console)\.html$/i.test(location.pathname)) return;

  const APP_KEY = 'movie-collection-v2';
  const OWNER_KEY = 'movie-cloud-owner-v1';
  const LAST_SYNC_KEY = 'movie-cloud-last-sync-v1';
  const DIRTY_KEY = 'movie-cloud-dirty-v1';
  const SUPABASE_URL = 'https://bjjralybdcuczwllxbvo.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_QiJNdLR-qykVqPkPrmePFg_x5wW7Owu';

  let client = null;
  let currentUser = null;
  let suppressUpload = false;
  let uploadTimer = 0;
  let syncing = false;
  let lastSyncError = '';

  const $ = id => document.getElementById(id);
  const safeParse = raw => { try { return JSON.parse(raw); } catch { return null; } };
  const localData = () => safeParse(localStorage.getItem(APP_KEY));
  const hasUsableData = data => data && typeof data === 'object' && Array.isArray(data.movies);
  const formatTime = iso => {
    if (!iso) return '尚未同步';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '尚未同步';
    return `最近同步 ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };

  function toast(message) {
    const el = $('toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove('show'), 3600);
  }

  function friendlyError(error) {
    const message = String(error?.message || error || '未知错误');
    if (/Invalid login credentials/i.test(message)) return '邮箱或密码不正确';
    if (/Email not confirmed/i.test(message)) return '请先前往邮箱完成验证';
    if (/User already registered/i.test(message)) return '这个邮箱已经注册，可以直接登录';
    if (/Password should be at least/i.test(message)) return '密码至少需要 6 位';
    if (/rate limit/i.test(message)) return '操作太频繁，请稍后再试';
    if (/Failed to fetch|NetworkError|Load failed/i.test(message)) return '网络连接失败，请稍后重试';
    return message;
  }

  function loadSupabase() {
    if (window.supabase?.createClient) return Promise.resolve(window.supabase);
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-movie-supabase]');
      if (existing) {
        existing.addEventListener('load', () => resolve(window.supabase), { once:true });
        existing.addEventListener('error', reject, { once:true });
        return;
      }
      const script = document.createElement('script');
      script.dataset.movieSupabase = '1';
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      script.async = true;
      script.onload = () => window.supabase?.createClient ? resolve(window.supabase) : reject(new Error('Supabase SDK 未加载'));
      script.onerror = () => reject(new Error('Supabase SDK 加载失败'));
      document.head.appendChild(script);
    });
  }

  function injectStyles() {
    if ($('movieCloudAuthStyle')) return;
    const style = document.createElement('style');
    style.id = 'movieCloudAuthStyle';
    style.textContent = `
      .profile[data-cloud-account]{cursor:pointer;border-radius:14px;padding:5px 7px;margin-left:-7px;transition:.18s ease}
      .profile[data-cloud-account]:hover{background:rgba(255,255,255,.045)}
      .profile[data-cloud-account] .avatar{position:relative}
      .profile[data-cloud-account] .avatar::after{content:'';position:absolute;right:-1px;bottom:1px;width:8px;height:8px;border-radius:50%;background:#7d8aa8;border:2px solid #0b1530;box-sizing:content-box}
      .profile[data-cloud-account].cloud-online .avatar::after{background:#62d2a2;box-shadow:0 0 9px rgba(98,210,162,.5)}
      .profile[data-cloud-account].cloud-syncing .avatar::after{background:#f5c66c;box-shadow:0 0 9px rgba(245,198,108,.45)}
      #movieAccountDialog{width:min(470px,calc(100vw - 28px));border:1px solid rgba(161,179,255,.22);border-radius:22px;background:linear-gradient(155deg,rgba(11,23,52,.985),rgba(6,14,33,.99));color:#f6f3ff;padding:0;box-shadow:0 32px 90px rgba(0,0,0,.55);overflow:hidden}
      #movieAccountDialog::backdrop{background:rgba(2,6,17,.72);backdrop-filter:blur(7px)}
      .movie-account-head{padding:24px 25px 16px;border-bottom:1px solid rgba(161,179,255,.12);display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
      .movie-account-kicker{font-size:10px;color:#8b96b3;letter-spacing:.16em}
      .movie-account-head h3{margin:7px 0 4px;font-size:22px;font-weight:650}
      .movie-account-head p{margin:0;color:#929db9;font-size:12px;line-height:1.7}
      .movie-account-close{width:34px;height:34px;border-radius:10px;border:1px solid rgba(161,179,255,.15);background:rgba(255,255,255,.035);color:#cdd4e8}
      .movie-account-body{padding:20px 25px 25px}
      .movie-auth-tabs{display:grid;grid-template-columns:1fr 1fr;background:rgba(3,10,27,.5);border:1px solid rgba(161,179,255,.12);border-radius:12px;padding:3px;margin-bottom:17px}
      .movie-auth-tab{height:34px;border:0;border-radius:9px;background:transparent;color:#8995b4}
      .movie-auth-tab.active{background:rgba(111,97,244,.22);color:#fff}
      .movie-auth-field{margin-top:12px}
      .movie-auth-field label{display:block;color:#929db9;font-size:11px;margin:0 0 6px}
      .movie-auth-input{width:100%;height:43px;border:1px solid rgba(161,179,255,.17);border-radius:12px;background:rgba(6,15,36,.8);outline:0;color:#eef1fb;padding:0 12px}
      .movie-auth-input:focus{border-color:rgba(159,124,255,.52);box-shadow:0 0 0 3px rgba(159,124,255,.08)}
      .movie-auth-submit{width:100%;height:42px;margin-top:17px;border:1px solid rgba(168,143,255,.35);border-radius:12px;background:linear-gradient(135deg,rgba(111,97,244,.82),rgba(91,75,204,.9));color:#fff;font-weight:600}
      .movie-auth-submit:disabled{opacity:.55;cursor:wait}
      .movie-auth-status{min-height:19px;margin-top:10px;color:#919dbb;font-size:11px;line-height:1.6}
      .movie-auth-status.error{color:#ff9aae}
      .movie-account-card{border:1px solid rgba(161,179,255,.14);border-radius:16px;background:rgba(13,25,55,.52);padding:16px}
      .movie-account-email{font-size:14px;color:#f0eff8;word-break:break-all}
      .movie-account-syncstate{margin-top:6px;color:#8e9ab8;font-size:11px}
      .movie-account-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}
      .movie-account-actions button{height:38px;border-radius:11px;border:1px solid rgba(161,179,255,.17);background:rgba(18,31,67,.75);color:#dce2f5}
      .movie-account-actions button.primary{border-color:rgba(159,124,255,.32);background:rgba(111,97,244,.25);color:#fff}
      .movie-account-actions button.danger{color:#ff9aae}
      .movie-cloud-note{margin-top:13px;padding:11px 12px;border-radius:11px;background:rgba(100,167,255,.07);color:#8996b6;font-size:10px;line-height:1.7}
      @media(max-width:560px){#movieAccountDialog{width:calc(100vw - 18px)}.movie-account-head,.movie-account-body{padding-left:18px;padding-right:18px}}
    `;
    document.head.appendChild(style);
  }

  function ensureDialog() {
    let dialog = $('movieAccountDialog');
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = 'movieAccountDialog';
    dialog.innerHTML = `
      <div class="movie-account-head">
        <div><div class="movie-account-kicker">LIGHT & SHADOW ACCOUNT</div><h3>光影账户</h3><p>让你的电影星图跟着账号一起走。</p></div>
        <button class="movie-account-close" type="button" data-account-close>✕</button>
      </div>
      <div class="movie-account-body" id="movieAccountBody"></div>`;
    document.body.appendChild(dialog);
    return dialog;
  }

  function profileElements() {
    return {
      wrap: document.querySelector('.profile'),
      name: $('profileName') || document.querySelector('.profile .name'),
      role: $('profileRole') || document.querySelector('.profile .role'),
    };
  }

  function renderProfile() {
    const { wrap, name, role } = profileElements();
    if (!wrap) return;
    wrap.dataset.cloudAccount = '1';
    wrap.classList.toggle('cloud-online', Boolean(currentUser) && !syncing);
    wrap.classList.toggle('cloud-syncing', Boolean(currentUser) && syncing);
    wrap.title = currentUser ? '打开光影账户' : '登录并同步光影宇宙';
    if (currentUser) {
      const stateName = localData()?.profile?.name || localData()?.settings?.profileName || '';
      if (name && !stateName) name.textContent = currentUser.email?.split('@')[0] || '我的光影宇宙';
      if (role) role.textContent = syncing ? '云端同步中…' : (lastSyncError ? '云端同步待重试' : '云端已同步');
    } else if (role) {
      role.textContent = '本机数据 · 点击登录';
    }
  }

  function renderSignedOut(mode = 'login', status = '', isError = false) {
    const body = $('movieAccountBody');
    if (!body) return;
    body.innerHTML = `
      <div class="movie-auth-tabs">
        <button type="button" class="movie-auth-tab ${mode==='login'?'active':''}" data-auth-mode="login">登录</button>
        <button type="button" class="movie-auth-tab ${mode==='signup'?'active':''}" data-auth-mode="signup">注册</button>
      </div>
      <form id="movieAuthForm" data-mode="${mode}">
        <div class="movie-auth-field"><label>邮箱</label><input class="movie-auth-input" id="movieAuthEmail" type="email" autocomplete="email" required placeholder="name@example.com"></div>
        <div class="movie-auth-field"><label>密码</label><input class="movie-auth-input" id="movieAuthPassword" type="password" autocomplete="${mode==='login'?'current-password':'new-password'}" minlength="6" required placeholder="至少 6 位"></div>
        <button class="movie-auth-submit" id="movieAuthSubmit" type="submit">${mode==='login'?'登录光影宇宙':'创建光影账户'}</button>
        <div class="movie-auth-status ${isError?'error':''}" id="movieAuthStatus">${status || (mode==='signup'?'注册后可能需要前往邮箱完成一次验证。':'登录后会自动读取这个账号的云端数据。')}</div>
      </form>
      <div class="movie-cloud-note">第一版云同步会保存你的影视库、评分、观影记录、想看状态、月度计划、电影雷达和个人设置。海报仍使用原有 TMDb 图片链接，不额外占用云存储。</div>`;
  }

  function renderSignedIn() {
    const body = $('movieAccountBody');
    if (!body || !currentUser) return;
    const lastSync = localStorage.getItem(LAST_SYNC_KEY) || '';
    body.innerHTML = `
      <div class="movie-account-card">
        <div class="movie-account-email">${String(currentUser.email || '').replace(/[&<>]/g, '')}</div>
        <div class="movie-account-syncstate" id="movieAccountSyncState">${syncing ? '正在同步…' : (lastSyncError ? `同步失败：${friendlyError(lastSyncError)}` : formatTime(lastSync))}</div>
        <div class="movie-account-actions">
          <button class="primary" type="button" data-account-sync>立即同步</button>
          <button class="danger" type="button" data-account-logout>退出登录</button>
        </div>
      </div>
      <div class="movie-cloud-note">当前使用账号隔离的云端数据。数据库已启用行级权限，每个账号只能读取和修改自己的数据。</div>`;
  }

  function openDialog() {
    const dialog = ensureDialog();
    currentUser ? renderSignedIn() : renderSignedOut('login');
    dialog.showModal();
  }

  function setAuthBusy(busy, message = '') {
    const button = $('movieAuthSubmit');
    if (button) button.disabled = busy;
    const status = $('movieAuthStatus');
    if (status && message) status.textContent = message;
  }

  async function fetchCloudRow(userId) {
    const { data, error } = await client.from('user_data').select('data_json,updated_at').eq('user_id', userId).maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async function uploadCurrentData({ silent = false } = {}) {
    if (!currentUser || syncing) return false;
    const data = localData();
    if (!hasUsableData(data)) return false;
    syncing = true;
    lastSyncError = '';
    renderProfile();
    if ($('movieAccountSyncState')) $('movieAccountSyncState').textContent = '正在同步…';
    try {
      const now = new Date().toISOString();
      const { error } = await client.from('user_data').upsert({ user_id: currentUser.id, data_json: data, updated_at: now }, { onConflict: 'user_id' });
      if (error) throw error;
      localStorage.setItem(OWNER_KEY, currentUser.id);
      localStorage.setItem(LAST_SYNC_KEY, now);
      localStorage.removeItem(DIRTY_KEY);
      lastSyncError = '';
      if (!silent) toast('云端数据已同步');
      return true;
    } catch (error) {
      lastSyncError = error;
      localStorage.setItem(DIRTY_KEY, '1');
      if (!silent) toast(`同步失败：${friendlyError(error)}`);
      return false;
    } finally {
      syncing = false;
      renderProfile();
      if ($('movieAccountSyncState')) $('movieAccountSyncState').textContent = lastSyncError ? `同步失败：${friendlyError(lastSyncError)}` : formatTime(localStorage.getItem(LAST_SYNC_KEY));
    }
  }

  function queueUpload() {
    if (!currentUser || suppressUpload) return;
    localStorage.setItem(DIRTY_KEY, '1');
    clearTimeout(uploadTimer);
    uploadTimer = setTimeout(() => uploadCurrentData({ silent:true }), 1200);
  }

  function installStorageHook() {
    if (Storage.prototype.__movieCloudAuthPatched) return;
    const previousSetItem = Storage.prototype.setItem;
    Object.defineProperty(Storage.prototype, '__movieCloudAuthPatched', { value:true, configurable:true });
    Storage.prototype.setItem = function(key, value) {
      const result = previousSetItem.call(this, key, value);
      if (this === localStorage && key === APP_KEY && !suppressUpload) queueUpload();
      return result;
    };
  }

  async function reconcileUserData(user) {
    const row = await fetchCloudRow(user.id);
    const local = localData();
    const cloud = row?.data_json;

    if (hasUsableData(cloud)) {
      const same = JSON.stringify(cloud) === JSON.stringify(local);
      localStorage.setItem(OWNER_KEY, user.id);
      localStorage.setItem(LAST_SYNC_KEY, row.updated_at || new Date().toISOString());
      localStorage.removeItem(DIRTY_KEY);
      if (!same) {
        suppressUpload = true;
        try { localStorage.setItem(APP_KEY, JSON.stringify(cloud)); }
        finally { suppressUpload = false; }
        location.reload();
        return;
      }
    } else if (hasUsableData(local)) {
      await uploadCurrentData({ silent:true });
    }
  }

  async function setUser(user, { reconcile = true } = {}) {
    currentUser = user || null;
    lastSyncError = '';
    renderProfile();
    if (!currentUser) return;
    if (reconcile) {
      try { await reconcileUserData(currentUser); }
      catch (error) {
        lastSyncError = error;
        renderProfile();
        toast(`账号已登录，但云同步失败：${friendlyError(error)}`);
      }
    }
  }

  async function handleAuthSubmit(form) {
    const mode = form.dataset.mode || 'login';
    const email = String($('movieAuthEmail')?.value || '').trim();
    const password = String($('movieAuthPassword')?.value || '');
    if (!email || password.length < 6) return;
    setAuthBusy(true, mode === 'login' ? '正在登录…' : '正在创建账号…');
    try {
      if (mode === 'login') {
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await setUser(data.user, { reconcile:true });
        renderSignedIn();
        toast('已登录光影宇宙');
      } else {
        const redirectTo = `${location.origin}${location.pathname}`;
        const { data, error } = await client.auth.signUp({ email, password, options:{ emailRedirectTo: redirectTo } });
        if (error) throw error;
        if (data.session && data.user) {
          await setUser(data.user, { reconcile:true });
          renderSignedIn();
          toast('光影账户已创建');
        } else {
          renderSignedOut('login', '注册成功。请前往邮箱点击验证链接，完成后回来登录。', false);
        }
      }
    } catch (error) {
      renderSignedOut(mode, friendlyError(error), true);
      const emailInput = $('movieAuthEmail');
      if (emailInput) emailInput.value = email;
    }
  }

  async function logout() {
    if (!client || !currentUser) return;
    if (localStorage.getItem(DIRTY_KEY) === '1') await uploadCurrentData({ silent:true });
    const { error } = await client.auth.signOut();
    if (error) {
      toast(`退出失败：${friendlyError(error)}`);
      return;
    }
    currentUser = null;
    renderProfile();
    renderSignedOut('login', '已退出账号。本机数据仍保留在当前浏览器。', false);
    toast('已退出光影账户');
  }

  function bindEvents() {
    document.addEventListener('click', event => {
      const profile = event.target.closest?.('.profile[data-cloud-account]');
      if (profile) {
        event.preventDefault();
        openDialog();
        return;
      }
      const mode = event.target.closest?.('[data-auth-mode]');
      if (mode) {
        event.preventDefault();
        renderSignedOut(mode.dataset.authMode === 'signup' ? 'signup' : 'login');
        return;
      }
      if (event.target.closest?.('[data-account-close]')) {
        event.preventDefault();
        $('movieAccountDialog')?.close();
        return;
      }
      if (event.target.closest?.('[data-account-sync]')) {
        event.preventDefault();
        uploadCurrentData();
        return;
      }
      if (event.target.closest?.('[data-account-logout]')) {
        event.preventDefault();
        logout();
      }
    });

    document.addEventListener('submit', event => {
      const form = event.target.closest?.('#movieAuthForm');
      if (!form) return;
      event.preventDefault();
      handleAuthSubmit(form);
    });

    window.addEventListener('online', () => {
      if (currentUser && localStorage.getItem(DIRTY_KEY) === '1') uploadCurrentData({ silent:true });
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && currentUser && localStorage.getItem(DIRTY_KEY) === '1') uploadCurrentData({ silent:true });
    });
  }

  async function boot() {
    injectStyles();
    ensureDialog();
    installStorageHook();
    bindEvents();
    renderProfile();
    try {
      await loadSupabase();
      client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true }
      });
      window.MovieCloudAccount = { client, sync:() => uploadCurrentData(), open:openDialog };
      const { data:{ session } } = await client.auth.getSession();
      await setUser(session?.user || null, { reconcile:true });
      client.auth.onAuthStateChange((event, session) => {
        if (event === 'TOKEN_REFRESHED') return;
        const next = session?.user || null;
        if (next?.id === currentUser?.id) {
          renderProfile();
          return;
        }
        setUser(next, { reconcile:Boolean(next) });
      });
    } catch (error) {
      lastSyncError = error;
      const { role } = profileElements();
      if (role) role.textContent = '账号服务暂不可用';
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
