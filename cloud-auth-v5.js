(() => {
  'use strict';
  if (/(?:^|\/)(?:admin|admin-console)\.html$/i.test(location.pathname)) return;

  const APP_KEY = 'movie-collection-v2';
  const OWNER_KEY = 'movie-cloud-owner-v1';
  const LAST_SYNC_KEY = 'movie-cloud-last-sync-v1';
  const DIRTY_KEY = 'movie-cloud-dirty-v1';
  const PENDING_KEY = 'movie-cloud-pending-v1';
  const BASELINE_KEY = 'movie-cloud-baseline-fingerprint-v1';
  const SUPABASE_URL = 'https://bjjralybdcuczwllxbvo.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_QiJNdLR-qykVqPkPrmePFg_x5wW7Owu';
  const APP_URL = 'https://cj956151388-png.github.io/movie-collection/';

  let client = null;
  let currentUser = null;
  let suppressUpload = false;
  let uploadTimer = 0;
  let syncPromise = null;
  let syncing = false;
  let lastSyncError = '';
  let pendingApply = false;
  let pendingConflict = false;

  const $ = id => document.getElementById(id);
  const safeParse = raw => { try { return JSON.parse(raw); } catch { return null; } };
  const localData = () => safeParse(localStorage.getItem(APP_KEY));
  const hasUsableData = data => data && typeof data === 'object' && Array.isArray(data.movies);
  const ts = value => {
    const n = Date.parse(value || '');
    return Number.isFinite(n) ? n : 0;
  };
  const stableValue = value => {
    if (Array.isArray(value)) return value.map(stableValue);
    if (value && typeof value === 'object') {
      const out = {};
      for (const key of Object.keys(value).sort()) out[key] = stableValue(value[key]);
      return out;
    }
    return value;
  };
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

  function readBaseline(userId=currentUser?.id) {
    const value = safeParse(localStorage.getItem(BASELINE_KEY));
    if (!value || !userId || value.userId !== userId || !value.fingerprint) return null;
    return value;
  }
  function writeBaseline(userId,data,updatedAt='') {
    if (!userId || !hasUsableData(data)) return;
    localStorage.setItem(BASELINE_KEY,JSON.stringify({
      userId,
      fingerprint:fingerprint(data),
      updated_at:updatedAt || localStorage.getItem(LAST_SYNC_KEY) || '',
      saved_at:new Date().toISOString()
    }));
  }
  function readPendingCloud(userId=currentUser?.id) {
    const pending = safeParse(localStorage.getItem(PENDING_KEY));
    if (!pending || !userId || pending.userId !== userId || !hasUsableData(pending.data_json)) return null;
    return pending;
  }
  function restorePendingCloud(userId=currentUser?.id) {
    const pending = readPendingCloud(userId);
    pendingApply = Boolean(pending);
    pendingConflict = Boolean(pending?.conflict);
    return pending;
  }
  function clearPendingCloud(userId=currentUser?.id) {
    const pending = safeParse(localStorage.getItem(PENDING_KEY));
    if (!pending || !userId || pending.userId === userId) localStorage.removeItem(PENDING_KEY);
    pendingApply = false;
    pendingConflict = false;
  }
  function commitSyncedState(userId,data,updatedAt='') {
    const stamp = updatedAt || new Date().toISOString();
    localStorage.setItem(OWNER_KEY,userId);
    localStorage.setItem(LAST_SYNC_KEY,stamp);
    writeBaseline(userId,data,stamp);
    localStorage.removeItem(DIRTY_KEY);
    clearPendingCloud(userId);
    lastSyncError = '';
  }

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
  function formatTime(iso) {
    if (!iso) return '尚未同步';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '尚未同步';
    return `最近同步 ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }

  function loadSupabase() {
    if (window.supabase?.createClient) return Promise.resolve(window.supabase);
    return new Promise((resolve,reject) => {
      const existing = document.querySelector('script[data-movie-supabase]');
      if (existing) {
        if (window.supabase?.createClient) return resolve(window.supabase);
        existing.addEventListener('load',() => resolve(window.supabase),{ once:true });
        existing.addEventListener('error',() => reject(new Error('Supabase SDK 加载失败')),{ once:true });
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
      .movie-account-kicker{font-size:10px;color:#8b96b3;letter-spacing:.16em}.movie-account-head h3{margin:7px 0 4px;font-size:22px}.movie-account-head p{margin:0;color:#929db9;font-size:12px;line-height:1.7}
      .movie-account-close{width:34px;height:34px;border-radius:10px;border:1px solid rgba(161,179,255,.15);background:rgba(255,255,255,.035);color:#cdd4e8}
      .movie-account-body{padding:20px 25px 25px}.movie-auth-tabs{display:grid;grid-template-columns:1fr 1fr;background:rgba(3,10,27,.5);border:1px solid rgba(161,179,255,.12);border-radius:12px;padding:3px;margin-bottom:17px}
      .movie-auth-tab{height:34px;border:0;border-radius:9px;background:transparent;color:#8995b4}.movie-auth-tab.active{background:rgba(111,97,244,.22);color:#fff}
      .movie-auth-field{margin-top:12px}.movie-auth-field label{display:block;color:#929db9;font-size:11px;margin:0 0 6px}
      .movie-auth-input{width:100%;height:43px;border:1px solid rgba(161,179,255,.17);border-radius:12px;background:rgba(6,15,36,.8);outline:0;color:#eef1fb;padding:0 12px}.movie-auth-input:focus{border-color:rgba(159,124,255,.52);box-shadow:0 0 0 3px rgba(159,124,255,.08)}
      .movie-auth-submit{width:100%;height:42px;margin-top:17px;border:1px solid rgba(168,143,255,.35);border-radius:12px;background:linear-gradient(135deg,rgba(111,97,244,.82),rgba(91,75,204,.9));color:#fff;font-weight:600}.movie-auth-submit:disabled{opacity:.55;cursor:wait}
      .movie-auth-status{min-height:19px;margin-top:10px;color:#919dbb;font-size:11px;line-height:1.6}.movie-auth-status.error{color:#ff9aae}
      .movie-account-card{border:1px solid rgba(161,179,255,.14);border-radius:16px;background:rgba(13,25,55,.52);padding:16px}.movie-account-email{font-size:14px;color:#f0eff8;word-break:break-all}.movie-account-syncstate{margin-top:6px;color:#8e9ab8;font-size:11px}
      .movie-account-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}.movie-account-actions button{height:38px;border-radius:11px;border:1px solid rgba(161,179,255,.17);background:rgba(18,31,67,.75);color:#dce2f5}.movie-account-actions button.primary{border-color:rgba(159,124,255,.32);background:rgba(111,97,244,.25);color:#fff}.movie-account-actions button.danger{color:#ff9aae}.movie-account-actions.has-conflict .danger{grid-column:1/-1}
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
    dialog.innerHTML = `<div class="movie-account-head"><div><div class="movie-account-kicker">LIGHT & SHADOW ACCOUNT</div><h3>光影账户</h3><p>让你的电影星图跟着账号一起走。</p></div><button class="movie-account-close" type="button" data-account-close>✕</button></div><div class="movie-account-body" id="movieAccountBody"></div>`;
    document.body.appendChild(dialog);
    return dialog;
  }
  function profileElements() {
    return { wrap:document.querySelector('.profile'), name:$('profileName') || document.querySelector('.profile .name'), role:$('profileRole') || document.querySelector('.profile .role') };
  }
  function renderProfile() {
    const { wrap,name,role } = profileElements();
    if (!wrap) return;
    wrap.dataset.cloudAccount = '1';
    wrap.classList.toggle('cloud-online',Boolean(currentUser) && !syncing);
    wrap.classList.toggle('cloud-syncing',Boolean(currentUser) && syncing);
    wrap.title = currentUser ? '打开光影账户' : '登录并同步光影宇宙';
    if (currentUser) {
      const stateName = localData()?.profile?.name || localData()?.settings?.profileName || '';
      if (name && !stateName) name.textContent = currentUser.email?.split('@')[0] || '我的光影宇宙';
      if (role) role.textContent = syncing ? '云端同步中…' : (lastSyncError ? '云端同步待重试' : (pendingConflict ? '云端与本机冲突' : (pendingApply ? '云端更新待应用' : '云端已同步')));
    } else if (role) role.textContent = '本机数据 · 点击登录';
  }
  function renderSignedOut(mode='login',status='',isError=false) {
    const body = $('movieAccountBody');
    if (!body) return;
    body.innerHTML = `<div class="movie-auth-tabs"><button type="button" class="movie-auth-tab ${mode==='login'?'active':''}" data-auth-mode="login">登录</button><button type="button" class="movie-auth-tab ${mode==='signup'?'active':''}" data-auth-mode="signup">注册</button></div><form id="movieAuthForm" data-mode="${mode}"><div class="movie-auth-field"><label>邮箱</label><input class="movie-auth-input" id="movieAuthEmail" type="email" autocomplete="email" required placeholder="name@example.com"></div><div class="movie-auth-field"><label>密码</label><input class="movie-auth-input" id="movieAuthPassword" type="password" autocomplete="${mode==='login'?'current-password':'new-password'}" minlength="6" required placeholder="至少 6 位"></div><button class="movie-auth-submit" id="movieAuthSubmit" type="submit">${mode==='login'?'登录光影宇宙':'创建光影账户'}</button><div class="movie-auth-status ${isError?'error':''}" id="movieAuthStatus">${status || (mode==='signup'?'注册后请前往邮箱完成验证。':'登录后会自动读取这个账号的云端数据。')}</div></form><div class="movie-cloud-note">云同步保存影视库、评分、观影记录、月度计划、电影雷达和个人设置。每个账号的数据彼此隔离。</div>`;
  }
  function renderSignedIn() {
    const body = $('movieAccountBody');
    if (!body || !currentUser) return;
    const pending = readPendingCloud(currentUser.id);
    pendingApply = Boolean(pending);
    pendingConflict = Boolean(pending?.conflict);
    const actions = pendingConflict
      ? '<button class="primary" type="button" data-account-apply>使用云端</button><button type="button" data-account-force-upload>保留本机</button><button class="danger" type="button" data-account-logout>退出登录</button>'
      : `${pendingApply ? '<button class="primary" type="button" data-account-apply>应用云端数据</button>' : '<button class="primary" type="button" data-account-sync>立即同步</button>'}<button class="danger" type="button" data-account-logout>退出登录</button>`;
    const stateText = pendingConflict ? '云端与本机都有更新，需要选择保留版本' : (pendingApply ? '检测到另一设备的云端更新，等待应用' : (syncing ? '正在同步…' : (lastSyncError ? `同步失败：${friendlyError(lastSyncError)}` : formatTime(localStorage.getItem(LAST_SYNC_KEY) || ''))));
    const note = pendingConflict
      ? '“使用云端”会放弃本机尚未上传的更改；“保留本机”会覆盖云端较新的版本。两种操作都会再次确认。'
      : (pendingApply ? '这里只在云端内容真的发生变化时出现。应用后会替换本机数据并刷新一次。' : '日常本地修改会自动静默同步；只有另一设备同时修改时才需要手动选择版本。');
    body.innerHTML = `<div class="movie-account-card"><div class="movie-account-email">${String(currentUser.email || '').replace(/[&<>]/g,'')}</div><div class="movie-account-syncstate" id="movieAccountSyncState">${stateText}</div><div class="movie-account-actions ${pendingConflict?'has-conflict':''}">${actions}</div></div><div class="movie-cloud-note">${note}</div>`;
  }
  function openDialog() {
    const dialog = ensureDialog();
    currentUser ? renderSignedIn() : renderSignedOut('login');
    if (!dialog.open) dialog.showModal();
  }

  async function fetchCloudMeta(userId) {
    const { data,error } = await client.from('user_data').select('updated_at').eq('user_id',userId).maybeSingle();
    if (error) throw error;
    return data || null;
  }
  async function fetchCloudRow(userId) {
    const { data,error } = await client.from('user_data').select('data_json,updated_at').eq('user_id',userId).maybeSingle();
    if (error) throw error;
    return data || null;
  }
  function sameCloudVersion(remoteUpdatedAt,baselineUpdatedAt) {
    const remoteTs = ts(remoteUpdatedAt);
    const baselineTs = ts(baselineUpdatedAt);
    return Boolean(remoteTs && baselineTs && remoteTs === baselineTs);
  }
  function stageCloudData(user,row,{ conflict=false }={}) {
    const cloud = row?.data_json;
    if (!hasUsableData(cloud)) return false;
    if (hasUsableData(localData()) && fingerprint(cloud) === fingerprint(localData())) {
      commitSyncedState(user.id,cloud,row.updated_at || '');
      return false;
    }
    localStorage.setItem(PENDING_KEY,JSON.stringify({
      userId:user.id,
      data_json:cloud,
      updated_at:row.updated_at || new Date().toISOString(),
      conflict:Boolean(conflict),
      staged_at:new Date().toISOString()
    }));
    pendingApply = true;
    pendingConflict = Boolean(conflict);
    renderProfile();
    if ($('movieAccountDialog')?.open) renderSignedIn();
    return true;
  }
  function applyPendingCloud() {
    const pending = readPendingCloud();
    if (!pending) {
      clearPendingCloud();
      renderProfile();
      if ($('movieAccountDialog')?.open) renderSignedIn();
      return false;
    }
    if (pending.conflict && !confirm('云端和本机都有尚未合并的更新。使用云端将放弃本机未上传的更改，继续吗？')) return false;
    suppressUpload = true;
    try {
      localStorage.setItem(APP_KEY,JSON.stringify(pending.data_json));
      commitSyncedState(currentUser.id,pending.data_json,pending.updated_at || new Date().toISOString());
    } finally { suppressUpload = false; }
    location.reload();
    return true;
  }

  async function upsertLocal(data,{ silent=false }={}) {
    const now = new Date().toISOString();
    const { error } = await client.from('user_data').upsert({ user_id:currentUser.id,data_json:data,updated_at:now },{ onConflict:'user_id' });
    if (error) throw error;
    commitSyncedState(currentUser.id,data,now);
    if (!silent) toast('云端数据已同步');
    return true;
  }

  async function performSync({ silent=false,force=false,startup=false,cloudMeta=null }={}) {
    if (!currentUser) return false;
    const local = localData();
    if (!hasUsableData(local)) return false;
    const owner = localStorage.getItem(OWNER_KEY) || '';
    if (!force && owner && owner !== currentUser.id) throw new Error('本机数据属于另一个账号，已阻止自动上传');
    if (force) return upsertLocal(local,{ silent });

    const baseline = readBaseline(currentUser.id);
    const baselineFp = baseline?.fingerprint || '';
    const lastSync = localStorage.getItem(LAST_SYNC_KEY) || '';
    const localFp = fingerprint(local);
    const meta = cloudMeta || await fetchCloudMeta(currentUser.id);

    if (!meta) return upsertLocal(local,{ silent:true });

    // 正常状态只读取 updated_at。只要云端版本戳仍与 baseline 一致，
    // 就可以确认云端内容未变化，无需下载整份 data_json。
    if (baselineFp) {
      const baselineStamp = baseline?.updated_at || lastSync;
      if (sameCloudVersion(meta.updated_at,baselineStamp)) {
        if (localFp === baselineFp) {
          commitSyncedState(currentUser.id,local,meta.updated_at || baselineStamp || new Date().toISOString());
          return true;
        }
        clearPendingCloud(currentUser.id);
        return upsertLocal(local,{ silent:true });
      }
    }

    // 只有首次建立 baseline、云端版本戳变化，或旧数据需要兜底比对时，才下载完整 JSON。
    const row = await fetchCloudRow(currentUser.id);
    const cloud = row?.data_json;
    if (!hasUsableData(cloud)) return upsertLocal(local,{ silent:true });

    const cloudFp = fingerprint(cloud);
    if (localFp === cloudFp) {
      commitSyncedState(currentUser.id,cloud,row.updated_at || new Date().toISOString());
      return true;
    }

    const dirty = localStorage.getItem(DIRTY_KEY) === '1';
    if (baselineFp) {
      if (cloudFp === baselineFp && localFp !== baselineFp) {
        clearPendingCloud(currentUser.id);
        return upsertLocal(local,{ silent:true });
      }
      if (localFp === baselineFp && cloudFp !== baselineFp) {
        stageCloudData(currentUser,row,{ conflict:false });
        if (!startup && !silent) toast('检测到另一设备的云端更新，请在账户面板应用');
        return false;
      }
      stageCloudData(currentUser,row,{ conflict:true });
      if (!startup && !silent) toast('云端与本机都有更新，请选择保留版本');
      return false;
    }

    // 旧版升级的一次性兜底。正常运行建立 baseline 后不再依赖时间戳。
    if (dirty && (!lastSync || ts(row.updated_at) <= ts(lastSync) + 1500)) {
      clearPendingCloud(currentUser.id);
      return upsertLocal(local,{ silent:true });
    }
    if (!dirty && lastSync && ts(row.updated_at) > ts(lastSync) + 500) {
      stageCloudData(currentUser,row,{ conflict:false });
      return false;
    }
    stageCloudData(currentUser,row,{ conflict:true });
    return false;
  }

  function uploadCurrentData(options={}) {
    if (syncPromise) return syncPromise;
    if (!currentUser) return Promise.resolve(false);
    syncing = true;
    lastSyncError = '';
    renderProfile();
    syncPromise = performSync(options)
      .catch(error => {
        lastSyncError = error;
        localStorage.setItem(DIRTY_KEY,'1');
        if (!options.silent) toast(`同步失败：${friendlyError(error)}`);
        return false;
      })
      .finally(() => {
        syncing = false;
        syncPromise = null;
        restorePendingCloud(currentUser?.id);
        renderProfile();
        if ($('movieAccountDialog')?.open && currentUser) renderSignedIn();
      });
    return syncPromise;
  }
  async function forceUploadLocal() {
    const pending = readPendingCloud();
    if (pending?.conflict && !confirm('这会用本机当前数据覆盖云端较新的版本。确认保留本机并覆盖云端吗？')) return false;
    return uploadCurrentData({ force:true,silent:false });
  }
  async function syncBeforeReload() {
    clearTimeout(uploadTimer);
    if (!currentUser) return true;
    if (readPendingCloud(currentUser.id)) return false;
    if (localStorage.getItem(DIRTY_KEY) !== '1') return true;
    return uploadCurrentData({ silent:true });
  }
  function queueUpload() {
    if (!currentUser || suppressUpload) return;
    localStorage.setItem(DIRTY_KEY,'1');
    const pending = readPendingCloud(currentUser.id);
    if (pending) {
      pending.conflict = true;
      localStorage.setItem(PENDING_KEY,JSON.stringify(pending));
      pendingApply = true;
      pendingConflict = true;
      renderProfile();
      return;
    }
    clearTimeout(uploadTimer);
    uploadTimer = setTimeout(() => uploadCurrentData({ silent:true }),500);
  }
  function installStorageHook() {
    if (Storage.prototype.__movieCloudAuthPatchedV5) return;
    const previousSetItem = Storage.prototype.setItem;
    Object.defineProperty(Storage.prototype,'__movieCloudAuthPatchedV5',{ value:true,configurable:true });
    Storage.prototype.setItem = function(key,value) {
      const result = previousSetItem.call(this,key,value);
      if (this === localStorage && key === APP_KEY && !suppressUpload) queueUpload();
      return result;
    };
  }

  async function reconcileUserData(user) {
    const local = localData();
    const owner = localStorage.getItem(OWNER_KEY) || '';
    const meta = await fetchCloudMeta(user.id);

    if (!meta) {
      clearPendingCloud(user.id);
      if (hasUsableData(local)) {
        if (owner && owner !== user.id) throw new Error('本机数据属于另一个账号，已阻止自动上传');
        await upsertLocal(local,{ silent:true });
      }
      return;
    }

    // 没有可用本机数据或切换了账号时，必须真正下载云端内容以供应用。
    if (!hasUsableData(local) || (owner && owner !== user.id)) {
      const row = await fetchCloudRow(user.id);
      if (!hasUsableData(row?.data_json)) {
        clearPendingCloud(user.id);
        if (hasUsableData(local)) {
          if (owner && owner !== user.id) throw new Error('本机数据属于另一个账号，已阻止自动上传');
          await upsertLocal(local,{ silent:true });
        }
        return;
      }
      stageCloudData(user,row,{ conflict:false });
      return;
    }

    // 已有本机 baseline 的正常启动只复用轻量 metadata，避免再次查询整份 JSON。
    await uploadCurrentData({ silent:true,startup:true,cloudMeta:meta });
  }

  async function setUser(user,{ reconcile=true }={}) {
    currentUser = user || null;
    lastSyncError = '';
    pendingApply = false;
    pendingConflict = false;
    if (currentUser) restorePendingCloud(currentUser.id);
    renderProfile();
    if (!currentUser || !reconcile) return;
    try { await reconcileUserData(currentUser); }
    catch (error) {
      lastSyncError = error;
      renderProfile();
      toast(`账号已登录，但云同步失败：${friendlyError(error)}`);
    }
  }

  async function handleAuthSubmit(form) {
    const mode = form.dataset.mode || 'login';
    const email = String($('movieAuthEmail')?.value || '').trim();
    const password = String($('movieAuthPassword')?.value || '');
    if (!email || password.length < 6) return;
    const button = $('movieAuthSubmit');
    const status = $('movieAuthStatus');
    if (button) button.disabled = true;
    if (status) status.textContent = mode === 'login' ? '正在登录…' : '正在创建账号…';
    try {
      if (mode === 'login') {
        const { data,error } = await client.auth.signInWithPassword({ email,password });
        if (error) throw error;
        await setUser(data.user,{ reconcile:true });
        renderSignedIn();
        toast(pendingConflict ? '已登录，云端与本机数据需要处理' : (pendingApply ? '已登录，检测到另一设备的云端更新' : '已登录光影宇宙'));
      } else {
        const { data,error } = await client.auth.signUp({ email,password,options:{ emailRedirectTo:APP_URL } });
        if (error) throw error;
        if (data.session && data.user) {
          await setUser(data.user,{ reconcile:true });
          renderSignedIn();
          toast('光影账户已创建');
        } else renderSignedOut('login','注册成功。请前往邮箱点击验证链接，完成后回来登录。');
      }
    } catch (error) {
      renderSignedOut(mode,friendlyError(error),true);
      const input = $('movieAuthEmail');
      if (input) input.value = email;
    } finally {
      if (button) button.disabled = false;
    }
  }
  async function logout() {
    if (!client || !currentUser) return;
    if (!readPendingCloud(currentUser.id) && localStorage.getItem(DIRTY_KEY) === '1') await uploadCurrentData({ silent:true });
    const { error } = await client.auth.signOut();
    if (error) return toast(`退出失败：${friendlyError(error)}`);
    currentUser = null;
    pendingApply = false;
    pendingConflict = false;
    renderProfile();
    renderSignedOut('login','已退出账号。本机数据仍保留在当前浏览器。');
    toast('已退出光影账户');
  }
  function bindEvents() {
    document.addEventListener('click',event => {
      const profile = event.target.closest?.('.profile[data-cloud-account]');
      if (profile) { event.preventDefault(); openDialog(); return; }
      const mode = event.target.closest?.('[data-auth-mode]');
      if (mode) { event.preventDefault(); renderSignedOut(mode.dataset.authMode === 'signup' ? 'signup':'login'); return; }
      if (event.target.closest?.('[data-account-close]')) { event.preventDefault(); $('movieAccountDialog')?.close(); return; }
      if (event.target.closest?.('[data-account-sync]')) { event.preventDefault(); uploadCurrentData({ silent:false }); return; }
      if (event.target.closest?.('[data-account-apply]')) { event.preventDefault(); applyPendingCloud(); return; }
      if (event.target.closest?.('[data-account-force-upload]')) { event.preventDefault(); forceUploadLocal(); return; }
      if (event.target.closest?.('[data-account-logout]')) { event.preventDefault(); logout(); }
    });
    document.addEventListener('submit',event => {
      const form = event.target.closest?.('#movieAuthForm');
      if (!form) return;
      event.preventDefault();
      handleAuthSubmit(form);
    });
    window.addEventListener('online',() => {
      if (currentUser && !readPendingCloud(currentUser.id) && localStorage.getItem(DIRTY_KEY) === '1') uploadCurrentData({ silent:true });
    });
    document.addEventListener('visibilitychange',() => {
      if (document.visibilityState === 'hidden' && currentUser && !readPendingCloud(currentUser.id) && localStorage.getItem(DIRTY_KEY) === '1') uploadCurrentData({ silent:true });
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
      client = window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{ auth:{ persistSession:true,autoRefreshToken:true,detectSessionInUrl:true } });
      window.MovieCloudAccount = {
        client,
        sync:(options={}) => uploadCurrentData({ silent:false,...options }),
        syncNow:(options={}) => uploadCurrentData({ silent:true,...options }),
        syncBeforeReload,
        open:openDialog,
        getState:() => ({ syncing,pendingApply,pendingConflict,dirty:localStorage.getItem(DIRTY_KEY)==='1',lastSync:localStorage.getItem(LAST_SYNC_KEY)||'' })
      };
      const { data:{ session } } = await client.auth.getSession();
      await setUser(session?.user || null,{ reconcile:true });
      client.auth.onAuthStateChange((event,session) => {
        if (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') return;
        const next = session?.user || null;
        if (next?.id === currentUser?.id) { renderProfile(); return; }
        setUser(next,{ reconcile:Boolean(next) });
      });
    } catch (error) {
      lastSyncError = error;
      const { role } = profileElements();
      if (role) role.textContent = '账号服务暂不可用';
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{ once:true });
  else boot();
})();
