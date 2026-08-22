(() => {
  'use strict';
  if (/(?:^|\/)(?:admin|admin-console)\.html$/i.test(location.pathname)) return;
  if (window.__CINEVERSE_HOME_RADAR_DETAIL_NAV_V2__) return;
  window.__CINEVERSE_HOME_RADAR_DETAIL_NAV_V2__ = true;

  const STORAGE_KEY = 'movie-collection-v2';
  const safeParse = raw => { try { return JSON.parse(raw); } catch { return null; } };
  const readState = () => safeParse(localStorage.getItem(STORAGE_KEY)) || { movies: [], home: { radar: [] } };
  const normalizeText = value => String(value || '')
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[\s·・:：,，.。!！?？'"“”‘’()（）\[\]【】_-]+/g, '');
  const movieYear = movie => Number(movie?.info?.year) || Number(String(movie?.info?.releaseDate || '').slice(0, 4)) || null;

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

  function findRandomMovie() {
    const title = String(document.getElementById('randomTitle')?.textContent || '').trim();
    const meta = String(document.getElementById('randomMeta')?.textContent || '');
    if (!title || title === '想看片单还是空的' || title === '正在读取想看片单…') return null;
    const state = readState();
    const matches = (state.movies || []).filter(movie => String(movie?.info?.title || '').trim() === title);
    if (!matches.length) return null;
    const byYear = matches.find(movie => movieYear(movie) && meta.includes(String(movieYear(movie))));
    return byYear || matches.find(movie => movie?.personal?.status === 'want') || matches[0];
  }

  function syncRandomPosterLink() {
    const poster = document.getElementById('randomPoster');
    if (!poster) return;
    const movie = findRandomMovie();
    if (movie?.id) {
      poster.dataset.openDetail = movie.id;
      poster.setAttribute('role', 'link');
      poster.tabIndex = 0;
      poster.title = `查看《${movie.info?.title || '影片'}》详情`;
      poster.classList.add('detail-poster-link');
    } else {
      delete poster.dataset.openDetail;
      poster.removeAttribute('role');
      poster.removeAttribute('tabindex');
      poster.removeAttribute('title');
      poster.classList.remove('detail-poster-link');
    }
  }

  function swapHomePlanAndInsight() {
    const triple = document.querySelector('#homeView .home-triple');
    const plan = triple?.querySelector('#plan');
    const insight = triple?.querySelector('.insight');
    if (!triple || !plan || !insight) return;
    if (plan.previousElementSibling !== insight) triple.insertBefore(insight, plan);
  }

  function radarIdFromCard(card) {
    if (!card) return '';
    const source = card.querySelector('[data-radar-detail],[data-radar-collect],[data-radar-plan],[data-radar-ignore]');
    if (!source) return '';
    return source.dataset.radarDetail || source.dataset.radarCollect || source.dataset.radarPlan || source.dataset.radarIgnore || '';
  }

  function radarById(id, state = readState()) {
    return (state?.home?.radar || []).find(item => String(item?.id || '') === String(id || '')) || null;
  }

  function annotateRadarPosters() {
    const state = readState();
    document.querySelectorAll('#radarPageGrid .radar-result-card').forEach(card => {
      const poster = card.querySelector('.radar-result-poster');
      const id = radarIdFromCard(card);
      if (!poster || !id) return;
      const radar = radarById(id, state);
      const movie = findMovieForRadar(radar, state);
      poster.dataset.radarPreviewId = id;
      poster.setAttribute('role', 'link');
      poster.tabIndex = 0;
      poster.title = movie
        ? `查看《${movie.info?.title || radar?.title || '影片'}》详情`
        : `查看《${radar?.title || '影片'}》详情预览`;
      poster.classList.add('detail-poster-link');
      if (movie?.id) poster.dataset.openDetail = movie.id;
      else delete poster.dataset.openDetail;
    });
  }

  function ensureStyle() {
    if (document.getElementById('homeRadarDetailNavigationStyleV2')) return;
    const style = document.createElement('style');
    style.id = 'homeRadarDetailNavigationStyleV2';
    style.textContent = `
      .detail-poster-link{cursor:pointer;transition:transform .18s ease,filter .18s ease,box-shadow .18s ease}
      .detail-poster-link:hover{transform:translateY(-2px);filter:brightness(1.05)}
      .detail-poster-link:focus-visible{outline:2px solid rgba(159,124,255,.82);outline-offset:3px}
    `;
    document.head.appendChild(style);
  }

  function boot() {
    ensureStyle();
    swapHomePlanAndInsight();
    syncRandomPosterLink();
    annotateRadarPosters();

    const randomTitle = document.getElementById('randomTitle');
    const randomPoster = document.getElementById('randomPoster');
    if (randomTitle) new MutationObserver(syncRandomPosterLink).observe(randomTitle, { childList:true, characterData:true, subtree:true });
    if (randomPoster) new MutationObserver(syncRandomPosterLink).observe(randomPoster, { childList:true, subtree:true });

    const radarGrid = document.getElementById('radarPageGrid');
    if (radarGrid) new MutationObserver(annotateRadarPosters).observe(radarGrid, { childList:true, subtree:true });
  }

  document.addEventListener('keydown', event => {
    if (!['Enter', ' '].includes(event.key)) return;
    const target = event.target.closest?.('#randomPoster[data-open-detail],.radar-result-poster[data-radar-preview-id]');
    if (!target) return;
    event.preventDefault();
    target.click();
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
