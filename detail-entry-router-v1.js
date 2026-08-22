(() => {
  'use strict';
  if (/(?:^|\/)(?:admin|admin-console)\.html$/i.test(location.pathname)) return;
  if (window.__CINEVERSE_DETAIL_ENTRY_ROUTER_V1__) return;
  window.__CINEVERSE_DETAIL_ENTRY_ROUTER_V1__ = true;

  const APP_KEY = 'movie-collection-v2';
  const RETURN_KEY = 'movie-detail-return-v1';
  const SCROLL_KEY = 'movie-detail-return-scroll-v1';
  const VALID_SOURCES = new Set(['home','library','match','radar','plan','watched','stats','settings']);

  const safeParse = raw => { try { return JSON.parse(raw); } catch { return null; } };
  const readState = () => safeParse(localStorage.getItem(APP_KEY)) || { movies: [], home: { radar: [] } };
  const normalize = value => String(value || '')
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[\s·・:：,，.。!！?？'"“”‘’()（）\[\]【】_-]+/g, '');

  function visibleSource() {
    const map = {
      home:'homeView', library:'libraryView', match:'matchView', radar:'radarView',
      plan:'planView', watched:'watchedView', stats:'statsView', settings:'settingsView'
    };
    for (const [source,id] of Object.entries(map)) {
      const view = document.getElementById(id);
      if (view && !view.classList.contains('hidden')) return source;
    }
    const raw = location.hash.replace(/^#/, '');
    return VALID_SOURCES.has(raw) ? raw : '';
  }

  function currentReturnSource() {
    try {
      const value = sessionStorage.getItem(RETURN_KEY) || '';
      return VALID_SOURCES.has(value) ? value : '';
    } catch { return ''; }
  }

  function rememberSource(source = '') {
    const finalSource = VALID_SOURCES.has(source) ? source : visibleSource();
    if (!finalSource) return;
    try {
      sessionStorage.setItem(RETURN_KEY, finalSource);
      sessionStorage.setItem(SCROLL_KEY, JSON.stringify({
        view: finalSource,
        y: Math.max(0, window.scrollY || 0)
      }));
    } catch {}
  }

  function clearPreviewResidue() {
    document.documentElement.classList.remove('cv-search-detail-preview','radar-detail-preview');
    document.getElementById('globalSearchPreviewNote')?.remove();
    document.getElementById('radarPreviewNote')?.remove();
  }

  function movieExists(movieId) {
    if (!movieId) return false;
    const state = readState();
    return Array.isArray(state.movies) && state.movies.some(movie => String(movie?.id || '') === String(movieId));
  }

  function findRadarMovie(radarId) {
    const state = readState();
    const radar = (state?.home?.radar || []).find(item => String(item?.id || '') === String(radarId || ''));
    if (!radar) return null;
    const movies = Array.isArray(state.movies) ? state.movies : [];
    if (radar.tmdbId) {
      const exact = movies.find(movie => Number(movie?.info?.tmdbId) === Number(radar.tmdbId));
      if (exact) return exact;
    }
    const title = normalize(radar.title);
    const year = Number(radar.year) || Number(String(radar.releaseDate || '').slice(0,4)) || null;
    return movies.find(movie => {
      const mt = normalize(movie?.info?.title);
      const mo = normalize(movie?.info?.originalTitle);
      if (!title || (title !== mt && title !== mo)) return false;
      const my = Number(movie?.info?.year) || Number(String(movie?.info?.releaseDate || '').slice(0,4)) || null;
      return !year || !my || year === my;
    }) || null;
  }

  function openLocal(movieId, source = '') {
    const id = String(movieId || '');
    if (!movieExists(id)) return false;

    const effectiveSource = VALID_SOURCES.has(source)
      ? source
      : (visibleSource() || currentReturnSource() || 'library');
    if (effectiveSource !== 'detail') rememberSource(effectiveSource);

    clearPreviewResidue();
    const nextHash = `detail/${encodeURIComponent(id)}`;
    const current = location.hash.replace(/^#/, '');
    if (current === nextHash) {
      window.dispatchEvent(new Event('hashchange'));
    } else {
      location.hash = nextHash;
    }
    window.dispatchEvent(new CustomEvent('cineverse:detail-entry', {
      detail: { movieId:id, source:effectiveSource, mode:'local' }
    }));
    return true;
  }

  function sourceForTrigger(target) {
    if (target?.closest?.('#radarView')) return 'radar';
    return visibleSource() || currentReturnSource() || 'library';
  }

  function isCoreBridgeTrigger(node) {
    return node?.tagName === 'BUTTON'
      && node.parentElement === document.body
      && node.style.display === 'none';
  }

  function handleLocalTrigger(event) {
    if (event.defaultPrevented) return false;

    const related = event.target.closest?.('[data-related-id]');
    if (related) {
      const id = related.dataset.relatedId;
      if (!movieExists(id)) return false;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      return openLocal(id, currentReturnSource() || 'library');
    }

    const direct = event.target.closest?.('[data-open-detail]');
    if (direct) {
      const id = direct.dataset.openDetail;
      if (!movieExists(id)) return false;
      if (isCoreBridgeTrigger(direct)) {
        clearPreviewResidue();
        return false;
      }
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      return openLocal(id, sourceForTrigger(direct));
    }

    const radarDetail = event.target.closest?.('[data-radar-detail]');
    if (radarDetail) {
      const movie = findRadarMovie(radarDetail.dataset.radarDetail);
      if (!movie?.id) return false;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      return openLocal(movie.id, 'radar');
    }

    return false;
  }

  function handleBackFromRadar(event) {
    const back = event.target.closest?.('#detailBack');
    if (!back || !location.hash.startsWith('#detail/')) return false;
    if (currentReturnSource() !== 'radar') return false;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    clearPreviewResidue();
    location.hash = 'radar';
    return true;
  }

  document.addEventListener('click', event => {
    if (handleBackFromRadar(event)) return;
    handleLocalTrigger(event);
  }, true);

  window.addEventListener('hashchange', () => {
    if (location.hash.startsWith('#detail/')) clearPreviewResidue();
  });

  window.CineverseDetailRouter = Object.freeze({
    openLocal,
    cleanup: clearPreviewResidue,
    source: () => currentReturnSource() || visibleSource() || 'library'
  });

  if (location.hash.startsWith('#detail/')) clearPreviewResidue();
})();
