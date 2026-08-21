(() => {
  'use strict';
  if (/(?:^|\/)(?:admin|admin-console)\.html$/i.test(location.pathname)) return;

  const STORAGE_KEY = 'movie-collection-v2';
  const TMDB_PROXY_URL = 'https://bjjralybdcuczwllxbvo.supabase.co/functions/v1/tmdb-proxy';
  const RETURN_KEY = 'movie-detail-return-v1';
  const OVERVIEW_CACHE_KEY = 'movie-radar-overview-cache-v1';
  const detailFetches = new Map();

  const safeParse = raw => { try { return JSON.parse(raw); } catch { return null; } };
  const readState = () => safeParse(localStorage.getItem(STORAGE_KEY)) || { movies: [], home: { radar: [] }, settings: {} };
  const normalizeText = value => String(value || '').toLowerCase().normalize('NFKC').replace(/[\s·・:：,，.。!！?？'"“”‘’()（）\[\]【】_-]+/g, '');
  const movieYear = movie => Number(movie?.info?.year) || Number(String(movie?.info?.releaseDate || '').slice(0, 4)) || null;

  function radarById(id, state = readState()) {
    return (state?.home?.radar || []).find(item => String(item?.id || '') === String(id || '')) || null;
  }

  function radarIdFromCard(card) {
    const source = card?.querySelector('[data-radar-detail],[data-radar-collect],[data-radar-plan],[data-radar-ignore]');
    if (!source) return '';
    return source.dataset.radarDetail || source.dataset.radarCollect || source.dataset.radarPlan || source.dataset.radarIgnore || '';
  }

  function findMovieForRadar(radar, state = readState()) {
    if (!radar) return null;
    const movies = Array.isArray(state.movies) ? state.movies : [];
    if (radar.tmdbId) {
      const exact = movies.find(movie => Number(movie?.info?.tmdbId) === Number(radar.tmdbId));
      if (exact) return exact;
    }
    const rt = normalizeText(radar.title);
    const ry = Number(radar.year) || Number(String(radar.releaseDate || '').slice(0, 4)) || null;
    return movies.find(movie => {
      const title = normalizeText(movie?.info?.title);
      const original = normalizeText(movie?.info?.originalTitle);
      if (!rt || (rt !== title && rt !== original)) return false;
      const my = movieYear(movie);
      return !ry || !my || ry === my;
    }) || null;
  }

  function sourceLabel(radar) {
    return String(radar?.source || '').includes('想看') || String(radar?.id || '').startsWith('want-')
      ? '想看库推荐'
      : 'TMDB推荐';
  }

  function readOverviewCache() {
    try { return safeParse(sessionStorage.getItem(OVERVIEW_CACHE_KEY)) || {}; }
    catch { return {}; }
  }

  function writeOverviewCache(cache) {
    try { sessionStorage.setItem(OVERVIEW_CACHE_KEY, JSON.stringify(cache)); } catch {}
  }

  async function tmdbFetch(path, params = {}) {
    const res = await fetch(TMDB_PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, params })
    });
    let body = null;
    try { body = await res.json(); } catch {}
    if (!res.ok) throw new Error(body?.message || body?.error || `TMDb 代理 HTTP ${res.status}`);
    return body || {};
  }

  function getTmdbDetail(tmdbId) {
    const id = Number(tmdbId);
    if (!id) return Promise.resolve(null);
    if (detailFetches.has(id)) return detailFetches.get(id);
    const language = readState()?.settings?.tmdbLanguage || 'zh-CN';
    const promise = tmdbFetch(`/movie/${id}`, { language }).catch(() => null);
    detailFetches.set(id, promise);
    return promise;
  }

  function localOverviewForRadar(radar, movie) {
    const cache = readOverviewCache();
    return String(radar?.overview || movie?.info?.overview || (radar?.tmdbId ? cache[String(radar.tmdbId)] : '') || '').trim();
  }

  function setCardSummary(card, text) {
    const summary = card?.querySelector('.radar-reason');
    if (!summary) return;
    const next = String(text || '').trim() || '暂无影片摘要。';
    if (summary.textContent !== next) summary.textContent = next;
    if (summary.title !== next) summary.title = next;
  }

  async function fillCardSummary(card, radar, movie) {
    if (!card || card.dataset.radarOverviewState === 'done' || card.dataset.radarOverviewState === 'loading') return;
    const existing = localOverviewForRadar(radar, movie);
    if (existing) {
      card.dataset.radarOverviewState = 'done';
      setCardSummary(card, existing);
      return;
    }
    if (!radar?.tmdbId) {
      card.dataset.radarOverviewState = 'done';
      setCardSummary(card, '暂无影片摘要。');
      return;
    }

    card.dataset.radarOverviewState = 'loading';
    setCardSummary(card, '正在读取影片摘要…');
    const detail = await getTmdbDetail(radar.tmdbId);
    const overview = String(detail?.overview || '').trim();
    if (overview) {
      const cache = readOverviewCache();
      cache[String(radar.tmdbId)] = overview;
      writeOverviewCache(cache);
    }
    if (!card.isConnected || radarIdFromCard(card) !== String(radar.id || '')) return;
    card.dataset.radarOverviewState = 'done';
    setCardSummary(card, overview);
  }

  function enhanceRadarCards() {
    const state = readState();
    document.querySelectorAll('#radarPageGrid .radar-result-card').forEach(card => {
      const id = radarIdFromCard(card);
      const radar = radarById(id, state);
      if (!radar) return;
      const movie = findMovieForRadar(radar, state);
      const badge = card.querySelector('.radar-result-badge');
      const label = sourceLabel(radar);
      if (badge && badge.textContent !== label) badge.textContent = label;
      fillCardSummary(card, radar, movie);
    });
  }

  function setRadarReturnContext() {
    try { sessionStorage.setItem(RETURN_KEY, 'radar'); } catch {}
  }
  function hasRadarReturnContext() {
    try { return sessionStorage.getItem(RETURN_KEY) === 'radar'; } catch { return false; }
  }
  function clearRadarReturnContext() {
    try { sessionStorage.removeItem(RETURN_KEY); } catch {}
  }
  function isRadarPreview() { return location.hash.startsWith('#radar-preview/'); }
  function currentPreviewRadarId() {
    if (!isRadarPreview()) return '';
    try { return decodeURIComponent(location.hash.slice('#radar-preview/'.length)); }
    catch { return location.hash.slice('#radar-preview/'.length); }
  }

  function syncDetailReturnLabel() {
    if (!hasRadarReturnContext()) return;
    const detail = document.getElementById('detailView');
    if (!detail || detail.classList.contains('hidden')) return;
    const back = document.getElementById('detailBack');
    const text = '‹ 返回电影雷达';
    if (back && back.textContent !== text) back.textContent = text;
  }

  function syncPreviewWantUi() {
    if (!isRadarPreview()) return;
    const button = document.getElementById('detailStatusBtn');
    if (button) {
      if (button.textContent !== '想看') button.textContent = '想看';
      if (button.disabled) button.disabled = false;
      if (button.title !== '加入影视库并标记为想看') button.title = '加入影视库并标记为想看';
    }
    const note = document.getElementById('radarPreviewNote');
    const copy = '当前影片尚未收藏。点击「想看」即可加入影视库；查看详情本身不会自动收藏。';
    if (note && note.textContent !== copy) note.textContent = copy;
  }

  function ensureStyle() {
    if (document.getElementById('radarExperienceV3Style')) return;
    const style = document.createElement('style');
    style.id = 'radarExperienceV3Style';
    style.textContent = `
      #radarPageGrid .radar-reason{
        display:-webkit-box!important;
        -webkit-box-orient:vertical!important;
        -webkit-line-clamp:3!important;
        overflow:hidden!important;
        text-overflow:ellipsis!important;
        min-height:0!important;
        max-height:4.65em!important;
      }
      html.radar-detail-preview #detailView .detail-actions{display:flex!important}
      html.radar-detail-preview #detailView .detail-actions>*{display:none!important}
      html.radar-detail-preview #detailStatusBtn{display:inline-flex!important}
    `;
    document.head.appendChild(style);
  }

  function findCollectButton(radarId) {
    return [...document.querySelectorAll('#radarView [data-radar-collect]')]
      .find(button => String(button.dataset.radarCollect || '') === String(radarId || '')) || null;
  }

  async function enrichCollectedMovie(movie, radar, state) {
    if (!movie || !radar?.tmdbId) return;
    const language = state?.settings?.tmdbLanguage || 'zh-CN';
    const [detailResult, creditsResult] = await Promise.allSettled([
      getTmdbDetail(radar.tmdbId),
      tmdbFetch(`/movie/${radar.tmdbId}/credits`, { language })
    ]);
    const detail = detailResult.status === 'fulfilled' ? detailResult.value : null;
    const credits = creditsResult.status === 'fulfilled' ? creditsResult.value : null;
    if (!detail && !credits) return;

    movie.info = movie.info || {};
    if (detail?.title) movie.info.title = detail.title;
    if (detail?.original_title) movie.info.originalTitle = detail.original_title;
    if (detail?.release_date) {
      movie.info.releaseDate = detail.release_date;
      movie.info.year = Number(String(detail.release_date).slice(0, 4)) || movie.info.year || null;
    }
    if (detail?.runtime) movie.info.runtime = Number(detail.runtime);
    if (detail?.overview) movie.info.overview = detail.overview;
    if (detail?.poster_path) movie.info.posterUrl = `https://image.tmdb.org/t/p/w500${detail.poster_path}`;
    if (Array.isArray(detail?.genres) && detail.genres.length) movie.info.genres = detail.genres.map(item => item.name).filter(Boolean);
    if (Array.isArray(detail?.production_countries) && detail.production_countries.length) movie.info.countries = detail.production_countries.map(item => item.name).filter(Boolean);
    const directors = (credits?.crew || []).filter(person => person?.job === 'Director').map(person => person.name).filter(Boolean);
    if (directors.length) movie.info.directors = directors;
    movie.info.tmdbId = radar.tmdbId;
    movie.personal = { ...(movie.personal || {}), status: 'want' };
    movie.updatedAt = new Date().toISOString();
  }

  async function collectPreviewAsWant(button) {
    const radarId = currentPreviewRadarId();
    const before = readState();
    const radar = radarById(radarId, before);
    if (!radar) return;

    let existing = findMovieForRadar(radar, before);
    if (!existing) {
      const collectButton = findCollectButton(radarId);
      if (collectButton) collectButton.click();
    }

    const state = readState();
    existing = findMovieForRadar(radar, state);
    if (!existing) throw new Error('收藏失败');

    if (button) {
      button.disabled = true;
      button.textContent = '正在加入…';
    }

    await enrichCollectedMovie(existing, radar, state);
    existing.personal = { ...(existing.personal || {}), status: 'want' };
    existing.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

    setRadarReturnContext();
    location.hash = `detail/${encodeURIComponent(existing.id)}`;
    location.reload();
  }

  function goBackToRadar() {
    clearRadarReturnContext();
    location.hash = 'radar';
  }

  function syncDetailContextSoon() {
    requestAnimationFrame(() => {
      syncDetailReturnLabel();
      syncPreviewWantUi();
    });
  }

  function boot() {
    ensureStyle();
    enhanceRadarCards();
    syncDetailReturnLabel();
    syncPreviewWantUi();

    const grid = document.getElementById('radarPageGrid');
    if (grid) new MutationObserver(enhanceRadarCards).observe(grid, { childList: true, subtree: true });
  }

  document.addEventListener('click', event => {
    const radarDetailButton = event.target.closest?.('#radarView [data-radar-detail]');
    const collectedRadarPoster = event.target.closest?.('#radarView .radar-result-poster[data-open-detail]');
    if (radarDetailButton || collectedRadarPoster) {
      setRadarReturnContext();
      syncDetailContextSoon();
    }

    const back = event.target.closest?.('#detailBack');
    if (back && hasRadarReturnContext() && !isRadarPreview()) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      goBackToRadar();
      return;
    }

    const want = event.target.closest?.('#detailStatusBtn');
    if (want && isRadarPreview()) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      collectPreviewAsWant(want).catch(() => {
        want.disabled = false;
        want.textContent = '想看';
      });
      return;
    }

    const nav = event.target.closest?.('.nav a,[data-view-link]');
    if (nav && !event.target.closest?.('#radarView')) clearRadarReturnContext();

    const nonRadarDetail = event.target.closest?.('[data-open-detail]');
    if (nonRadarDetail && !event.target.closest?.('#radarView') && !isRadarPreview()) clearRadarReturnContext();
  }, true);

  window.addEventListener('hashchange', () => {
    const raw = location.hash.replace(/^#/, '');
    if (raw.startsWith('detail/') && hasRadarReturnContext()) {
      syncDetailContextSoon();
      return;
    }
    if (raw.startsWith('radar-preview/')) {
      setRadarReturnContext();
      syncDetailContextSoon();
      return;
    }
    if (raw === 'radar') {
      clearRadarReturnContext();
      return;
    }
    if (!raw.startsWith('detail/')) clearRadarReturnContext();
  });

  window.addEventListener('pageshow', syncDetailContextSoon);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
