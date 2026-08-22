(() => {
  'use strict';
  if (window.CineverseTmdbClient) return;

  const DEFAULT_PROXY_URL = 'https://bjjralybdcuczwllxbvo.supabase.co/functions/v1/tmdb-proxy';

  function createClient({ proxyUrl = DEFAULT_PROXY_URL, getLanguage = () => 'zh-CN', fetchImpl = window.fetch.bind(window) } = {}) {
    async function request(path, params = {}) {
      const response = await fetchImpl(proxyUrl, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body:JSON.stringify({ path, params })
      });
      let body = null;
      try { body = await response.json(); } catch {}
      if (!response.ok) throw new Error(body?.message || body?.error || `TMDb 代理 HTTP ${response.status}`);
      return body;
    }

    async function search(query, { tvOnly = false, limit = 16 } = {}) {
      const value = String(query || '').trim();
      if (!value) return [];
      const data = await request('/search/multi', {
        query:value, include_adult:false, language:getLanguage() || 'zh-CN', page:1
      });
      return (data.results || [])
        .filter(result => tvOnly ? result.media_type === 'tv' : ['movie', 'tv'].includes(result.media_type))
        .slice(0, limit);
    }

    async function bundle(tmdbId, mediaType = 'movie') {
      const type = mediaType === 'tv' ? 'tv' : 'movie';
      const language = getLanguage() || 'zh-CN';
      const [detail, credits] = await Promise.all([
        request(`/${type}/${tmdbId}`, { language }),
        request(type === 'tv' ? `/tv/${tmdbId}/aggregate_credits` : `/movie/${tmdbId}/credits`, { language })
      ]);
      return { detail, credits, mediaType:type };
    }

    return Object.freeze({ request, search, bundle });
  }

  const image = (path, size = 'w500') => path ? `https://image.tmdb.org/t/p/${size}${path}` : '';
  window.CineverseTmdbClient = Object.freeze({ createClient, image, DEFAULT_PROXY_URL });
})();
