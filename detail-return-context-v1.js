(() => {
  'use strict';
  if (/(?:^|\/)(?:admin|admin-console)\.html$/i.test(location.pathname)) return;

  const RETURN_KEY = 'movie-detail-return-v1';
  const SCROLL_KEY = 'movie-detail-return-scroll-v1';
  const SOURCES = {
    home: { viewId: 'homeView', label: '首页' },
    library: { viewId: 'libraryView', label: '影视库' },
    match: { viewId: 'matchView', label: '影片导入中心' },
    radar: { viewId: 'radarView', label: '电影雷达' },
    plan: { viewId: 'planView', label: '月度计划' },
    watched: { viewId: 'watchedView', label: '观影记录' },
    stats: { viewId: 'statsView', label: '观影分析' },
    settings: { viewId: 'settingsView', label: '设置' }
  };

  let lastNonDetailView = 'library';
  let restoreView = '';

  function validSource(value) {
    return Object.prototype.hasOwnProperty.call(SOURCES, value);
  }

  function readReturnSource() {
    try {
      const value = sessionStorage.getItem(RETURN_KEY) || '';
      return validSource(value) ? value : '';
    } catch {
      return '';
    }
  }

  function writeReturnSource(source) {
    if (!validSource(source)) return;
    try {
      sessionStorage.setItem(RETURN_KEY, source);
      sessionStorage.setItem(SCROLL_KEY, JSON.stringify({ view: source, y: Math.max(0, window.scrollY || 0) }));
    } catch {}
  }

  function clearReturnSource() {
    try {
      sessionStorage.removeItem(RETURN_KEY);
      sessionStorage.removeItem(SCROLL_KEY);
    } catch {}
  }

  function readScroll(source) {
    try {
      const value = JSON.parse(sessionStorage.getItem(SCROLL_KEY) || 'null');
      if (value && value.view === source && Number.isFinite(Number(value.y))) return Number(value.y);
    } catch {}
    return 0;
  }

  function visibleSource() {
    for (const [source, config] of Object.entries(SOURCES)) {
      const view = document.getElementById(config.viewId);
      if (view && !view.classList.contains('hidden')) return source;
    }
    const raw = location.hash.replace(/^#/, '');
    return validSource(raw) ? raw : '';
  }

  function syncBackLabel() {
    if (location.hash.startsWith('#radar-preview/')) return;
    const detailView = document.getElementById('detailView');
    const back = document.getElementById('detailBack');
    if (!detailView || detailView.classList.contains('hidden') || !back) return;
    const source = readReturnSource() || 'library';
    const label = SOURCES[source]?.label || SOURCES.library.label;
    const text = `‹ 返回${label}`;
    if (back.textContent !== text) back.textContent = text;
  }

  function rememberCurrentSource(forceSource = '') {
    const source = validSource(forceSource) ? forceSource : (visibleSource() || lastNonDetailView || 'library');
    if (!validSource(source)) return;
    lastNonDetailView = source;
    writeReturnSource(source);
  }

  function restoreScrollSoon(source) {
    const y = readScroll(source);
    requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo({ top: y, left: 0, behavior: 'auto' })));
  }

  function onDetailEntry(event) {
    const related = event.target.closest?.('[data-related-id]');
    if (related) {
      requestAnimationFrame(syncBackLabel);
      return true;
    }

    const radarDetail = event.target.closest?.('#radarView [data-radar-detail], #radarView [data-open-detail]');
    if (radarDetail) {
      rememberCurrentSource('radar');
      requestAnimationFrame(syncBackLabel);
      return true;
    }

    const detailTrigger = event.target.closest?.('[data-open-detail], #watchTonight');
    if (!detailTrigger) return false;
    const source = visibleSource();
    if (source && source !== 'detail') rememberCurrentSource(source);
    requestAnimationFrame(syncBackLabel);
    return true;
  }

  function onBack(event) {
    const back = event.target.closest?.('#detailBack');
    if (!back || location.hash.startsWith('#radar-preview/')) return false;
    const source = readReturnSource() || 'library';
    if (source === 'radar') return false;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    restoreView = source;
    location.hash = source;
    return true;
  }

  document.addEventListener('click', event => {
    if (onBack(event)) return;
    if (onDetailEntry(event)) return;

    const nav = event.target.closest?.('.nav a[data-view], [data-view-link]');
    if (nav && !event.target.closest?.('#detailView')) {
      const next = nav.dataset.view || nav.dataset.viewLink || '';
      if (validSource(next)) lastNonDetailView = next;
      clearReturnSource();
    }
  }, true);

  window.addEventListener('hashchange', () => {
    const raw = location.hash.replace(/^#/, '');
    if (raw.startsWith('detail/')) {
      if (!readReturnSource()) writeReturnSource(lastNonDetailView || 'library');
      requestAnimationFrame(syncBackLabel);
      return;
    }
    if (raw.startsWith('radar-preview/')) {
      lastNonDetailView = 'radar';
      return;
    }
    if (validSource(raw)) {
      lastNonDetailView = raw;
      if (restoreView === raw) {
        restoreScrollSoon(raw);
        restoreView = '';
      }
      clearReturnSource();
    }
  });

  function boot() {
    const visible = visibleSource();
    if (visible) lastNonDetailView = visible;
    else if (readReturnSource()) lastNonDetailView = readReturnSource();
    if (location.hash.startsWith('#detail/')) syncBackLabel();
  }

  window.addEventListener('pageshow', syncBackLabel);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
