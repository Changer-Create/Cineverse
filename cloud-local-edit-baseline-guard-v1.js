(() => {
  'use strict';
  if (/(?:^|\/)(?:admin|admin-console)\.html$/i.test(location.pathname)) return;

  const APP_KEY = 'movie-collection-v2';
  const OWNER_KEY = 'movie-cloud-owner-v1';
  const LAST_SYNC_KEY = 'movie-cloud-last-sync-v1';
  const DIRTY_KEY = 'movie-cloud-dirty-v1';
  const PATCH_FLAG = '__movieCloudLocalBaselineGuardV1__';

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
  const signature = data => JSON.stringify(stableValue({ data }));

  const previousSetItem = Storage.prototype.setItem;
  let baselineRaw = '';
  let baselineOwner = '';
  let verifyTimer = 0;
  let verifySequence = 0;

  Object.defineProperty(Storage.prototype, PATCH_FLAG, { value:true, configurable:true });

  function clearBaselineIfSynced() {
    if (localStorage.getItem(DIRTY_KEY) !== '1') {
      baselineRaw = '';
      baselineOwner = '';
    }
  }

  async function verifyRemoteStillMatchesBaseline(sequence) {
    if (!baselineRaw || sequence !== verifySequence) return;
    if (localStorage.getItem(DIRTY_KEY) !== '1') {
      clearBaselineIfSynced();
      return;
    }

    const baseline = safeParse(baselineRaw);
    if (!usable(baseline)) return;

    const account = window.MovieCloudAccount;
    const client = account?.client;
    if (!client) {
      scheduleVerify(120);
      return;
    }

    try {
      const { data:{ session } } = await client.auth.getSession();
      const user = session?.user;
      if (!user) return;

      const owner = localStorage.getItem(OWNER_KEY) || '';
      if (!owner || owner !== user.id || baselineOwner !== user.id) return;

      const { data:row, error } = await client
        .from('user_data')
        .select('data_json,updated_at')
        .eq('user_id',user.id)
        .maybeSingle();
      if (error || sequence !== verifySequence || !usable(row?.data_json)) return;

      // 云端内容仍然等于“本次本地编辑之前”的已同步内容，说明远端并未
      // 被另一设备修改。此时只校准时间基线，随后由 cloud-auth 正常静默上传。
      // 如果云端内容已经不同，则什么都不做，保留原有冲突保护逻辑。
      if (signature(row.data_json) === signature(baseline)) {
        localStorage.setItem(
          LAST_SYNC_KEY,
          row.updated_at || localStorage.getItem(LAST_SYNC_KEY) || new Date().toISOString()
        );
      }
    } catch {
      // 网络异常时不强行覆盖任何状态，交回 cloud-auth 原逻辑处理。
    } finally {
      setTimeout(clearBaselineIfSynced, 1700);
    }
  }

  function scheduleVerify(delay=0) {
    clearTimeout(verifyTimer);
    const sequence = ++verifySequence;
    verifyTimer = setTimeout(() => verifyRemoteStillMatchesBaseline(sequence), delay);
  }

  Storage.prototype.setItem = function(key, value) {
    if (this === localStorage && key === APP_KEY) {
      const wasDirty = localStorage.getItem(DIRTY_KEY) === '1';
      const previousRaw = localStorage.getItem(APP_KEY) || '';
      const ownerBefore = localStorage.getItem(OWNER_KEY) || '';
      const result = previousSetItem.call(this, key, value);

      if (!wasDirty && previousRaw && previousRaw !== String(value)) {
        baselineRaw = previousRaw;
        baselineOwner = ownerBefore;
        scheduleVerify(0);
      } else if (baselineRaw && previousRaw !== String(value)) {
        // 同一轮 debounce 内连续编辑时，始终保留第一次编辑之前的同步基线。
        scheduleVerify(0);
      }
      return result;
    }
    return previousSetItem.call(this, key, value);
  };
})();
