/* Cineverse canonical detail controller. Local and external entries share #detailView. */
(() => {
  'use strict';
  if (/(?:^|\/)(?:admin|admin-console)\.html$/i.test(location.pathname)) return;
  if (window.__CINEVERSE_EXTERNAL_DETAIL_PREVIEW_V1__) return;
  window.__CINEVERSE_EXTERNAL_DETAIL_PREVIEW_V1__ = true;

  const APP_KEY = 'movie-collection-v2';
  const ACTION_IDS = ['detailFavorite','detailEditBtn'];
  const JOIN_ACTIONS = ['detailStatusBtn','detailPlanBtn','detailAddWatchBtn','detailAddWatchBtn2'];
  const VIEW_MAP = {
    homeView:'home', libraryView:'library', matchView:'match', radarView:'radar',
    planView:'plan', watchedView:'watched', statsView:'stats', settingsView:'settings'
  };
  let active = null;
  let requestSeq = 0;

  const $ = id => document.getElementById(id);
  const safeParse = raw => { try { return JSON.parse(raw); } catch { return null; } };
  const readState = () => safeParse(localStorage.getItem(APP_KEY)) || { movies: [], home: { radar: [] }, settings: {} };
  const normalize = value => String(value || '')
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[\s·・:：,，.。!！?？'"“”‘’()（）\[\]【】_-]+/g, '');
  const setText = (id, value, fallback = '—') => {
    const el = $(id);
    if (el) el.textContent = value == null || value === '' ? fallback : String(value);
  };
  const visibleViewId = () => [...document.querySelectorAll('.page-view')].find(el => !el.classList.contains('hidden'))?.id || 'homeView';
  const sourceFromViewId = id => VIEW_MAP[id] || 'library';
  const mediaTypeOf = item => item?.media_type === 'tv' || item?.mediaType === 'tv' ? 'tv' : 'movie';
  const titleOf = item => mediaTypeOf(item) === 'tv'
    ? (item?.name || item?.title || item?.info?.title || '')
    : (item?.title || item?.name || item?.info?.title || '');
  const dateOf = item => String(item?.release_date || item?.first_air_date || item?.info?.releaseDate || item?.info?.firstAirDate || '');
  const yearOf = item => String(item?.info?.year || dateOf(item)).slice(0, 4);

  function injectStyle() {
    if ($('externalDetailPreviewUnifiedStyleV1')) return;
    const style = document.createElement('style');
    style.id = 'externalDetailPreviewUnifiedStyleV1';
    style.textContent = `
      html.cv-external-detail-preview #detailView .external-detail-disabled{
        opacity:.52!important;
        cursor:not-allowed!important;
        filter:saturate(.65);
      }
      html.cv-external-detail-preview #detailView .external-detail-empty{
        min-height:74px;
        border:1px dashed rgba(161,179,255,.16);
        border-radius:14px;
        display:flex;
        align-items:center;
        justify-content:center;
        padding:16px;
        color:#8894b3;
        font-size:11px;
        line-height:1.7;
        text-align:center;
        background:rgba(11,22,49,.24);
      }
    `;
    document.head.appendChild(style);
  }

  function tmdbEndpoint() {
    return window.CineverseConfig?.endpoints?.tmdbProxy
      || 'https://bjjralybdcuczwllxbvo.supabase.co/functions/v1/tmdb-proxy';
  }

  async function tmdbFetch(path, params = {}) {
    const response = await fetch(tmdbEndpoint(), {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ path, params })
    });
    let body = null;
    try { body = await response.json(); } catch {}
    if (!response.ok) throw new Error(body?.message || body?.error || `TMDb ${response.status}`);
    return body || {};
  }

  function findLocal({ tmdbId, type, title, year }) {
    const movies = readState().movies || [];
    const numericTmdb = Number(tmdbId);
    if (numericTmdb) {
      const exact = movies.find(movie => mediaTypeOf(movie) === type && Number(movie?.info?.tmdbId) === numericTmdb);
      if (exact) return exact;
    }
    const nt = normalize(title);
    if (!nt) return null;
    return movies.find(movie => {
      if (mediaTypeOf(movie) !== type) return false;
      const names = [normalize(movie?.info?.title), normalize(movie?.info?.originalTitle)].filter(Boolean);
      if (!names.includes(nt)) return false;
      const my = yearOf(movie);
      return !year || !my || String(year) === String(my);
    }) || null;
  }

  function radarById(id) {
    return (readState()?.home?.radar || []).find(item => String(item?.id || '') === String(id || '')) || null;
  }

  function findLocalForRadar(radar) {
    if (!radar) return null;
    const movies = readState().movies || [];
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

  function disableLocalActions() {
    for (const id of ACTION_IDS) {
      const el = $(id);
      if (!el) continue;
      if (!el.dataset.externalPreviewWasDisabled) el.dataset.externalPreviewWasDisabled = el.disabled ? '1' : '0';
      el.disabled = true;
      el.classList.add('external-detail-disabled');
      el.setAttribute('aria-disabled', 'true');
    }
    const favorite = $('detailFavorite');
    favorite?.classList.remove('on');
    if (favorite) favorite.title = '加入影视库后可收藏';
    for (const id of JOIN_ACTIONS) {
      const el = $(id);
      if (!el) continue;
      el.disabled = false;
      el.classList.remove('external-detail-disabled');
      el.removeAttribute('aria-disabled');
    }
  }

  function snapshotLocalActions() {
    for (const id of ACTION_IDS) {
      const el = $(id);
      if (!el || Object.prototype.hasOwnProperty.call(el.dataset, 'externalPreviewText')) continue;
      el.dataset.externalPreviewText = el.textContent;
    }
  }

  function restoreLocalActions() {
    for (const id of ACTION_IDS) {
      const el = $(id);
      if (!el) continue;
      const wasDisabled = el.dataset.externalPreviewWasDisabled === '1';
      el.disabled = wasDisabled;
      delete el.dataset.externalPreviewWasDisabled;
      if (Object.prototype.hasOwnProperty.call(el.dataset, 'externalPreviewText')) {
        el.textContent = el.dataset.externalPreviewText;
        delete el.dataset.externalPreviewText;
      }
      el.classList.remove('external-detail-disabled');
      el.removeAttribute('aria-disabled');
    }
    const favorite = $('detailFavorite');
    if (favorite) favorite.title = '收藏';
  }

  function setPoster(url, title) {
    const poster = $('detailPoster');
    if (!poster) return;
    poster.replaceChildren();
    poster.classList.toggle('has-image', Boolean(url));
    if (url) {
      const img = document.createElement('img');
      img.src = url;
      img.alt = `${title || '影片'} 海报`;
      poster.appendChild(img);
    } else {
      const label = document.createElement('div');
      label.className = 'poster-title';
      label.textContent = title || '影片';
      poster.appendChild(label);
    }
  }

  function setTags(tags) {
    const target = $('detailTags');
    if (!target) return;
    target.replaceChildren();
    for (const tag of tags || []) {
      if (!tag) continue;
      const span = document.createElement('span');
      span.textContent = tag;
      target.appendChild(span);
    }
  }

  function emptyLowerSections() {
    const watchList = $('detailWatchList');
    if (watchList) watchList.innerHTML = '<div class="external-detail-empty">尚未加入影视库，因此这里暂时没有个人观看记录。</div>';
    setText('detailWatchCount', '0');
    setText('detailFirstWatch', '—');
    setText('detailTotalMinutes', '—');
    setText('detailTrend', '—');
    const related = $('detailRelated');
    if (related) related.innerHTML = '<div class="external-detail-empty">加入影视库后，这里会展示与你的收藏相关的作品。</div>';
  }

  function showDetailView() {
    document.querySelectorAll('.page-view').forEach(view => view.classList.add('hidden'));
    $('detailView')?.classList.remove('hidden');
    document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('active', a.dataset.view === 'library'));
  }

  function renderUnified(model) {
    const tv = model.type === 'tv';
    setText('detailTitle', model.title || (tv ? '未命名剧集' : '未命名电影'));
    setText('detailOriginal', [model.originalTitle && normalize(model.originalTitle) !== normalize(model.title) ? model.originalTitle : '', model.year].filter(Boolean).join(' · '), '');
    setText('detailCreatorLabel', tv ? '主创' : '导演');
    setText('detailDirectors', (model.creators || []).join(' / ') || '未知');
    setText('detailCountries', (model.countries || []).join(' / ') || '未知');
    setText('detailGenres', (model.genres || []).join(' / ') || '待补全');
    setText('detailRuntimeLabel', tv ? '单集时长' : '片长');
    setText('detailRuntime', model.runtime ? `${model.runtime} 分钟` : '未知');
    setText('detailReleaseLabel', tv ? '首播' : '上映');
    setText('detailRelease', model.releaseDate || model.year || '未知');
    setText('detailMediaType', tv ? '剧集' : '电影');
    const series = $('detailSeriesFact');
    if (series) series.classList.toggle('hidden', !tv);
    setText('detailSeriesMeta', model.seriesMeta || (tv ? '剧集资料待补全' : '—'));
    setText('detailTmdb', model.tmdbId || '未关联');
    setText('detailOverview', model.overview || '暂无剧情简介。');
    setPoster(model.posterUrl, model.title);
    setTags(model.genres || []);

    setText('detailStatusBtn', '想看');
    setText('detailPlanBtn', '加入计划');
    setText('detailEditBtn', '✎ 加入影视库后可编辑');
    setText('detailAddWatchBtn', '看过');
    setText('detailAddWatchBtn2', '添加观影记录');
    setText('detailRating', '—');
    setText('detailStars', '☆☆☆☆☆');
    setText('detailLastWatch', '尚未加入影视库');
    setText('detailPlanMeta', '未加入月度计划');

    setText('detailRadarBadge', model.badge || (model.source === 'radar' ? '电影雷达' : 'TMDb 搜索'));
    setText('detailRadarDate', model.discoveredAt || '—');
    setText('detailPublicScore', model.publicScore != null && Number.isFinite(Number(model.publicScore)) ? Number(model.publicScore).toFixed(1) : '—');
    setText('detailMatchScore', model.matchScore != null && Number.isFinite(Number(model.matchScore)) ? `${Math.round(Number(model.matchScore))}%` : '—');
    setText('detailRadarReason', model.reason || (model.source === 'radar' ? '来自电影雷达的推荐。' : '来自顶部 TMDb 全库搜索。'));

    emptyLowerSections();
    disableLocalActions();
    const back = $('detailBack');
    if (back) back.textContent = model.source === 'radar' ? '‹ 返回电影雷达' : '‹ 返回搜索结果';
  }

  function baseFromSearchRow(row) {
    const action = row.querySelector('[data-tmdb-search-id][data-tmdb-search-type]');
    const tmdbId = Number(action?.dataset.tmdbSearchId || 0);
    const type = action?.dataset.tmdbSearchType === 'tv' ? 'tv' : 'movie';
    const title = row.querySelector('.cv-global-search-title-text')?.textContent?.trim() || '未命名作品';
    const meta = row.querySelector('.cv-global-search-meta')?.textContent || '';
    const year = (meta.match(/(?:^|\D)(19|20)\d{2}(?:\D|$)/) || [])[0]?.match(/\d{4}/)?.[0] || '';
    const posterUrl = row.querySelector('.cv-global-search-poster img')?.src || '';
    return { source:'search', type, tmdbId, title, year, posterUrl, originalTitle:'', releaseDate:'', creators:[], countries:[], genres:[], runtime:null, seriesMeta:'', overview:'正在读取 TMDb 详情…', publicScore:null, matchScore:null, badge:'TMDb 搜索', discoveredAt:'—', reason:'来自顶部 TMDb 全库搜索。' };
  }

  function baseFromRadar(radar) {
    return {
      source:'radar', type:'movie', tmdbId:Number(radar?.tmdbId || 0), title:radar?.title || '未命名电影',
      originalTitle:radar?.originalTitle || '', year:radar?.year || String(radar?.releaseDate || '').slice(0,4),
      releaseDate:radar?.releaseDate || '', creators:Array.isArray(radar?.directors) ? radar.directors : [],
      countries:Array.isArray(radar?.countries) ? radar.countries : [], genres:Array.isArray(radar?.genres) ? radar.genres : [],
      runtime:radar?.runtime || null, seriesMeta:'', overview:radar?.overview || '正在读取 TMDb 详情…',
      posterUrl:radar?.posterUrl || '', publicScore:radar?.publicReputation ?? radar?.public ?? null,
      matchScore:radar?.match ?? null, badge:radar?.ignored ? '已忽略' : (radar?.badge || '电影雷达'),
      discoveredAt:radar?.discoveredAt || '—', reason:radar?.reason || '来自电影雷达的推荐。'
    };
  }

  function mergeTmdb(model, detail, credits) {
    const tv = model.type === 'tv';
    const creators = tv
      ? (detail?.created_by || []).map(person => person?.name).filter(Boolean)
      : (credits?.crew || []).filter(person => person?.job === 'Director').map(person => person?.name).filter(Boolean);
    const countries = (detail?.production_countries || []).map(item => item?.name).filter(Boolean);
    const genres = (detail?.genres || []).map(item => item?.name).filter(Boolean);
    const runtime = tv ? (detail?.episode_run_time || [])[0] : detail?.runtime;
    const releaseDate = tv ? detail?.first_air_date : detail?.release_date;
    const title = tv ? detail?.name : detail?.title;
    const originalTitle = tv ? detail?.original_name : detail?.original_title;
    const posterUrl = detail?.poster_path ? `https://image.tmdb.org/t/p/w500${detail.poster_path}` : model.posterUrl;
    return {
      ...model,
      title:title || model.title,
      originalTitle:originalTitle || model.originalTitle,
      year:String(releaseDate || model.year || '').slice(0,4),
      releaseDate:releaseDate || model.releaseDate,
      creators:creators.length ? creators : model.creators,
      countries:countries.length ? countries : model.countries,
      genres:genres.length ? genres : model.genres,
      runtime:runtime || model.runtime,
      seriesMeta:tv ? [detail?.number_of_seasons != null ? `${detail.number_of_seasons} 季` : null, detail?.number_of_episodes != null ? `${detail.number_of_episodes} 集` : null].filter(Boolean).join(' · ') : '',
      overview:detail?.overview || model.overview || '暂无剧情简介。',
      posterUrl,
      tmdbId:detail?.id || model.tmdbId,
      publicScore:detail?.vote_average || model.publicScore
    };
  }

  async function enrichActive(model, token) {
    if (!model.tmdbId) return;
    const language = readState()?.settings?.tmdbLanguage || 'zh-CN';
    const detailPath = `/${model.type}/${model.tmdbId}`;
    const creditsPath = `/${model.type}/${model.tmdbId}/credits`;
    const [detailResult, creditsResult] = await Promise.allSettled([
      tmdbFetch(detailPath, { language }),
      tmdbFetch(creditsPath, { language })
    ]);
    if (!active || token !== requestSeq) return;
    const detail = detailResult.status === 'fulfilled' ? detailResult.value : null;
    const credits = creditsResult.status === 'fulfilled' ? creditsResult.value : null;
    if (!detail && !credits) return;
    const merged = mergeTmdb(model, detail, credits);
    active.model = merged;
    renderUnified(merged);
  }

  function beginPreview(model, previousViewId, searchDropWasOpen = false) {
    requestSeq += 1;
    active = { source:model.source, previousViewId, searchDropWasOpen, model };
    snapshotLocalActions();
    document.documentElement.classList.remove('cv-search-detail-preview','radar-detail-preview');
    document.documentElement.classList.add('cv-external-detail-preview');
    $('globalSearchPreviewNote')?.remove();
    $('radarPreviewNote')?.remove();
    $('globalTmdbSearchDrop')?.classList.add('hidden');
    showDetailView();
    renderUnified(model);
    location.hash = `external-preview/${model.source}/${model.type}/${encodeURIComponent(model.tmdbId || model.title)}`;
    enrichActive(model, requestSeq).catch(() => {});
  }

  function leaveStateOnly() {
    requestSeq += 1;
    active = null;
    document.documentElement.classList.remove('cv-external-detail-preview');
    restoreLocalActions();
  }

  function restorePrevious() {
    if (!active) return false;
    const prev = active;
    leaveStateOnly();
    document.querySelectorAll('.page-view').forEach(view => view.classList.add('hidden'));
    const target = $(prev.previousViewId) || $('libraryView') || $('homeView');
    target?.classList.remove('hidden');
    const source = sourceFromViewId(prev.previousViewId);
    document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('active', a.dataset.view === source));
    location.hash = source;
    if (prev.source === 'search' && prev.searchDropWasOpen) {
      requestAnimationFrame(() => {
        const drop = $('globalTmdbSearchDrop');
        if (drop?.children?.length) drop.classList.remove('hidden');
        $('globalSearch')?.focus();
      });
    }
    return true;
  }

  function handleSearchRow(row, event) {
    if (!row || event?.target?.closest?.('[data-tmdb-search-status]')) return false;
    const model = baseFromSearchRow(row);
    const local = findLocal(model);
    if (local) return false;
    if (!model.tmdbId) return false;
    const previousViewId = visibleViewId();
    const drop = $('globalTmdbSearchDrop');
    const wasOpen = Boolean(drop && !drop.classList.contains('hidden'));
    beginPreview(model, previousViewId, wasOpen);
    return true;
  }

  function handleRadarPoster(poster) {
    const radar = radarById(poster?.dataset?.radarPreviewId);
    if (!radar) return false;
    if (findLocalForRadar(radar)) return false;
    beginPreview(baseFromRadar(radar), 'radarView', false);
    return true;
  }

  document.addEventListener('click', event => {
    if (active) {
      const actionButton = event.target.closest?.('#detailStatusBtn,#detailPlanBtn,#detailAddWatchBtn,#detailAddWatchBtn2');
      if (actionButton) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        const action = actionButton.id === 'detailPlanBtn' ? 'plan'
          : actionButton.id === 'detailStatusBtn' ? 'want' : 'watch';
        const model = active.model;
        leaveStateOnly();
        window.CineverseLibrary?.collectExternalDetail?.(model, action);
        return;
      }
    }

    if (active && event.target.closest?.('#detailBack')) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      restorePrevious();
      return;
    }

    if (active && event.target.closest?.('.nav a,[data-view-link],[data-open-detail],[data-related-id]')) {
      leaveStateOnly();
      return;
    }

    const row = event.target.closest?.('#globalTmdbSearchDrop .cv-global-search-result');
    if (row && !event.target.closest?.('[data-tmdb-search-status]')) {
      if (handleSearchRow(row, event)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
      }
      return;
    }

    const radarPoster = event.target.closest?.('.radar-result-poster[data-radar-preview-id]');
    if (radarPoster && handleRadarPoster(radarPoster)) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key === 'Enter' && event.target?.id === 'globalSearch') {
      const drop = $('globalTmdbSearchDrop');
      const row = drop && !drop.classList.contains('hidden') ? drop.querySelector('.cv-global-search-result.active') : null;
      if (row && handleSearchRow(row, event)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        return;
      }
    }
    if (!['Enter',' '].includes(event.key)) return;
    const radarPoster = event.target.closest?.('.radar-result-poster[data-radar-preview-id]');
    if (radarPoster && handleRadarPoster(radarPoster)) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
  }, true);

  window.addEventListener('hashchange', () => {
    if (!active) return;
    if (!location.hash.startsWith('#external-preview/')) leaveStateOnly();
  });

  window.CineverseExternalDetailPreview = Object.freeze({
    isActive: () => Boolean(active),
    close: restorePrevious,
    cleanup: leaveStateOnly
  });

  injectStyle();
})();
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
