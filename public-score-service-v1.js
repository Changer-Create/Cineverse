(() => {
  'use strict';
  if (window.CineversePublicScoreService) return;
  const CACHE_KEY = 'movie-tmdb-score-cache-v1';
  const policy = () => window.CineverseScoreCachePolicy;
  let memory;
  function cache() {
    if (memory) return memory;
    try {
      const value = JSON.parse(localStorage.getItem(CACHE_KEY));
      memory = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch { memory = {}; }
    return memory;
  }
  function save() { try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache())); } catch {} }
  const scoreKey = movie => window.CineverseDomain?.tmdbSourceKey(movie) || '';
  const requests = new Map();
  const details = new Map();
  const configured = proxyUrl => Boolean(policy() && typeof proxyUrl === 'string' && proxyUrl.trim());
  function state(movie, now = Date.now()) {
    const key = scoreKey(movie);
    return key && policy() ? policy().read(cache(), key, now) : { kind:'miss', row:null };
  }
  function read(movie) {
    if (!scoreKey(movie)) return null;
    const current = state(movie);
    if (current.score != null) return current.score;
    if (current.row) return null;
    return window.CineverseDomain?.publicScore?.(movie) ?? null;
  }
  function display(movie) {
    const current = state(movie), score = read(movie);
    const kind = !scoreKey(movie) ? 'unlinked' : current.kind === 'empty' || current.row?.status === 'empty'
      ? 'empty' : current.row?.status === 'error' ? 'error' : current.kind === 'success' ? 'success' : 'pending';
    const text = score != null ? `★ ${score.toFixed(1)}` : kind === 'unlinked' ? '未关联 TMDb' : kind === 'empty' ? '暂无评分' : '暂未获取';
    const title = score != null && kind !== 'success' ? `TMDb 缓存／上次记录值；${kind === 'error' ? '获取失败：' + (current.row?.error || '请求失败') : '等待更新'}`
      : kind === 'error' ? `TMDb 获取失败：${current.row?.error || '请求失败'}；稍后可重试`
      : !configured(window.CineversePublicConfig?.tmdbProxyUrl) ? 'TMDb 代理未配置' : 'TMDb 公众评分';
    return { kind, score, text, title, fetchedAt:current.row?.fetchedAt ?? null };
  }
  function shouldFetch(movie, { proxyUrl = window.CineversePublicConfig?.tmdbProxyUrl || '' } = {}) {
    return Boolean(scoreKey(movie)) && configured(proxyUrl) && state(movie).kind === 'miss';
  }
  async function fetchScore(movie, { fetchImpl = window.fetch?.bind(window), proxyUrl = window.CineversePublicConfig?.tmdbProxyUrl || '', timeoutMs = 8000, force = false } = {}) {
    const key = scoreKey(movie);
    if (!key || !configured(proxyUrl) || !fetchImpl) return read(movie);
    if (requests.has(key)) return requests.get(key);
    const current = state(movie);
    if (current.kind === 'backoff' || (!force && current.kind !== 'miss')) return read(movie);
    const [type, id] = key.split(':');
    const promise = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(proxyUrl, {
          method:'POST', headers:{ 'Content-Type':'application/json' },
          body:JSON.stringify({ path:`/${type}/${id}`, params:{ language:'zh-CN' } }), signal:controller.signal
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!data || Array.isArray(data) || data.id !== Number(id) || data.success === false
          || policy().validScore(data.vote_average) == null || !Number.isSafeInteger(data.vote_count) || data.vote_count < 0) {
          throw new Error('TMDb 详情响应或评分字段无效');
        }
        if (data.vote_count === 0) policy().writeEmpty(cache(), key);
        else policy().writeSuccess(cache(), key, data.vote_average, Date.now(), policy().SUCCESS_TTL, data.vote_count);
        // Detail enrichment can share the rating request's validated response.
        details.set(key, data);
        if (details.size > 100) details.delete(details.keys().next().value);
        policy().prune(cache()); save();
        return data.vote_count > 0 ? data.vote_average : null;
      } catch (error) {
        policy().writeFailure(cache(), key);
        if (cache()[key]?.status === 'error') cache()[key].error = error?.name === 'AbortError' ? '请求超时' : String(error?.message || '请求失败');
        policy().prune(cache()); save();
        return policy().read(cache(), key).score ?? null;
      } finally { clearTimeout(timeout); }
    })();
    requests.set(key, promise);
    try { return await promise; } finally { requests.delete(key); }
  }
  window.CineversePublicScoreService = Object.freeze({ CACHE_KEY, scoreKey, state, read, display, shouldFetch, fetch:fetchScore,
    detail:async movie => { const key = scoreKey(movie); await fetchScore(movie); return details.get(key) || null; },
    refresh:(movie, options = {}) => fetchScore(movie, { ...options, force:true }) });
})();
