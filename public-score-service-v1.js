(() => {
  'use strict';
  if (window.CineversePublicScoreService) return;

  const CACHE_KEY = 'movie-tmdb-score-cache-v1';
  const policy = () => window.CineverseScoreCachePolicy;
  const safeParse = raw => { try { return JSON.parse(raw); } catch { return null; } };
  const cache = () => {
    const value = safeParse(localStorage.getItem(CACHE_KEY));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  };
  const save = value => localStorage.setItem(CACHE_KEY, JSON.stringify(value));
  const scoreKey = movie => {
    const id = Number(movie?.info?.tmdbId);
    return Number.isFinite(id) && id > 0 ? `${movie?.mediaType === 'tv' ? 'tv' : 'movie'}:${id}` : '';
  };
  const fallback = movie => window.CineverseDomain?.publicScore?.(movie, cache()) ?? null;
  const requests = new Map();

  function state(movie, now = Date.now()) {
    const key = scoreKey(movie);
    if (!key || !policy()) return { kind:'miss', row:null };
    return policy().read(cache(), key, now);
  }
  function read(movie) {
    const current = state(movie);
    if (current.kind === 'success') return current.score;
    if (current.kind === 'empty' || current.kind === 'backoff') return null;
    return fallback(movie);
  }
  function shouldFetch(movie) {
    const current = state(movie);
    return Boolean(scoreKey(movie)) && current.kind === 'miss';
  }
  async function fetchScore(movie, { fetchImpl = window.fetch.bind(window), proxyUrl = window.CineversePublicConfig?.tmdbProxyUrl || '', timeoutMs = 8000 } = {}) {
    const key = scoreKey(movie);
    if (!key || !policy() || !proxyUrl) return read(movie);
    const current = state(movie);
    if (current.kind === 'success') return current.score;
    if (current.kind === 'empty' || current.kind === 'backoff') return null;
    if (requests.has(key)) return requests.get(key);
    const promise = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const type = movie?.mediaType === 'tv' ? 'tv' : 'movie';
        const response = await fetchImpl(proxyUrl, {
          method:'POST',
          headers:{ 'Content-Type':'application/json' },
          body:JSON.stringify({ path:`/${type}/${Number(movie.info.tmdbId)}`, params:{ language:'zh-CN' } }),
          signal:controller.signal
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const value = Number(data?.vote_average);
        const currentCache = cache();
        if (Number.isFinite(value) && value > 0 && value <= 10) policy().writeSuccess(currentCache, key, value);
        else policy().writeEmpty(currentCache, key);
        policy().prune(currentCache);
        save(currentCache);
        return Number.isFinite(value) && value > 0 && value <= 10 ? value : null;
      } catch {
        const currentCache = cache();
        policy().writeFailure(currentCache, key);
        policy().prune(currentCache);
        save(currentCache);
        return fallback(movie);
      } finally {
        clearTimeout(timeout);
        requests.delete(key);
      }
    })();
    requests.set(key, promise);
    return promise;
  }

  window.CineversePublicScoreService = Object.freeze({
    CACHE_KEY, scoreKey, state, read, shouldFetch, fetch:fetchScore
  });
})();