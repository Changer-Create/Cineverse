(() => {
  'use strict';
  if (/(?:^|\/)(?:admin|admin-console)\.html$/i.test(location.pathname)) return;

  const STORAGE_KEY = 'movie-collection-v2';
  const TMDB_PROXY_URL = 'https://bjjralybdcuczwllxbvo.supabase.co/functions/v1/tmdb-proxy';
  let previewRadarId = '';
  let previewRequestId = 0;

  const safeParse = raw => { try { return JSON.parse(raw); } catch { return null; } };
  const readState = () => safeParse(localStorage.getItem(STORAGE_KEY)) || { movies: [], home: { radar: [] }, settings: {} };
  const normalizeText = value => String(value || '')
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[\s·・:：,，.。!！?？'"“”‘’()（）\[\]【】_-]+/g, '');
  const movieYear = movie => Number(movie?.info?.year) || Number(String(movie?.info?.releaseDate || '').slice(0, 4)) || null;
  const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value ?? '—'; };

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
      poster.title = movie ? `查看《${movie.info?.title || radar?.title || '影片'}》详情` : `查看《${radar?.title || '影片'}》详情预览`;
      poster.classList.add('detail-poster-link');
      if (movie?.id) poster.dataset.openDetail = movie.id;
      else delete poster.dataset.openDetail;
    });
  }

  function ensureStyle() {
    if (document.getElementById('homeRadarDetailNavigationStyle')) return;
    const style = document.createElement('style');
    style.id = 'homeRadarDetailNavigationStyle';
    style.textContent = `
      .detail-poster-link{cursor:pointer;transition:transform .18s ease,filter .18s ease,box-shadow .18s ease}
      .detail-poster-link:hover{transform:translateY(-2px);filter:brightness(1.05)}
      .detail-poster-link:focus-visible{outline:2px solid rgba(159,124,255,.82);outline-offset:3px}
      .radar-preview-note{display:none;margin:10px 0 0;padding:10px 12px;border:1px solid rgba(159,124,255,.2);border-radius:12px;background:rgba(117,86,220,.08);color:#aeb9d6;font-size:11px;line-height:1.7}
      html.radar-detail-preview .radar-preview-note{display:block}
      html.radar-detail-preview #detailFavorite,
      html.radar-detail-preview #detailView .detail-actions,
      html.radar-detail-preview #detailView .detail-section,
      html.radar-detail-preview #detailView .detail-bottom{display:none!important}
    `;
    document.head.appendChild(style);
  }

  function ensurePreviewNote() {
    let note = document.getElementById('radarPreviewNote');
    if (note) return note;
    const overview = document.querySelector('#detailView .detail-overview');
    if (!overview) return null;
    note = document.createElement('div');
    note.id = 'radarPreviewNote';
    note.className = 'radar-preview-note';
    note.textContent = '电影雷达详情预览 · 查看不会自动加入影视库。收藏或加入计划仍需由你主动操作。';
    overview.insertAdjacentElement('beforebegin', note);
    return note;
  }

  function clearPreviewMode() {
    previewRadarId = '';
    previewRequestId += 1;
    document.documentElement.classList.remove('radar-detail-preview');
    const back = document.getElementById('detailBack');
    if (back) back.textContent = '‹ 返回影视库';
  }

  function showDetailView() {
    document.querySelectorAll('.page-view').forEach(view => view.classList.add('hidden'));
    document.getElementById('detailView')?.classList.remove('hidden');
    document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('active', a.dataset.view === 'library'));
  }

  function setPreviewPoster(url, title) {
    const poster = document.getElementById('detailPoster');
    if (!poster) return;
    poster.innerHTML = '';
    poster.classList.toggle('has-image', Boolean(url));
    if (url) {
      const img = document.createElement('img');
      img.src = url;
      img.alt = `${title || '影片'} 海报`;
      poster.appendChild(img);
    } else {
      const label = document.createElement('div');
      label.className = 'poster-title';
      label.textContent = title || '电影雷达';
      poster.appendChild(label);
    }
  }

  function setPreviewTags(genres) {
    const tags = document.getElementById('detailTags');
    if (!tags) return;
    tags.innerHTML = '';
    for (const genre of genres || []) {
      const span = document.createElement('span');
      span.textContent = genre;
      tags.appendChild(span);
    }
  }

  function fillPreview(radar, detail = null, credits = null) {
    if (!radar || previewRadarId !== radar.id) return;
    const title = detail?.title || radar.title || '未命名电影';
    const year = Number(String(detail?.release_date || radar.releaseDate || '').slice(0, 4)) || radar.year || '';
    const directors = (credits?.crew || []).filter(person => person?.job === 'Director').map(person => person.name).filter(Boolean);
    const fallbackDirectors = Array.isArray(radar.directors) ? radar.directors : [];
    const countries = (detail?.production_countries || []).map(item => item.name).filter(Boolean);
    const fallbackCountries = Array.isArray(radar.countries) ? radar.countries : [];
    const genres = (detail?.genres || []).map(item => item.name).filter(Boolean);
    const fallbackGenres = Array.isArray(radar.genres) ? radar.genres : [];
    const posterUrl = detail?.poster_path ? `https://image.tmdb.org/t/p/w500${detail.poster_path}` : (radar.posterUrl || '');

    setText('detailTitle', title);
    setText('detailOriginal', [detail?.original_title, year].filter(Boolean).join(' · ') || String(year || ''));
    setText('detailCreatorLabel', '导演');
    setText('detailDirectors', (directors.length ? directors : fallbackDirectors).join(' / ') || '未知');
    setText('detailCountries', (countries.length ? countries : fallbackCountries).join(' / ') || '未知');
    setText('detailGenres', (genres.length ? genres : fallbackGenres).join(' / ') || '待补全');
    setText('detailRuntimeLabel', '片长');
    setText('detailRuntime', (detail?.runtime || radar.runtime) ? `${detail?.runtime || radar.runtime} 分钟` : '未知');
    setText('detailReleaseLabel', '上映');
    setText('detailRelease', detail?.release_date || radar.releaseDate || year || '未知');
    setText('detailMediaType', '电影');
    document.getElementById('detailSeriesFact')?.classList.add('hidden');
    setText('detailTmdb', radar.tmdbId || detail?.id || '未关联');
    setText('detailOverview', detail?.overview || '暂无剧情简介。当前展示电影雷达已有资料，加入影视库后可继续完善个人记录。');
    setPreviewTags(genres.length ? genres : fallbackGenres);
    setPreviewPoster(posterUrl, title);

    setText('detailRating', '—');
    setText('detailStars', '☆☆☆☆☆');
    setText('detailLastWatch', '尚未加入影视库');
    setText('detailPlanMeta', '未加入月度计划');
    setText('detailRadarBadge', radar.ignored ? '已忽略' : (radar.badge || '电影雷达'));
    setText('detailRadarDate', radar.discoveredAt || '—');
    setText('detailPublicScore', radar.public != null ? Number(radar.public).toFixed(1) : '—');
    setText('detailMatchScore', radar.match != null ? `${Math.round(Number(radar.match))}%` : '—');
    setText('detailRadarReason', radar.reason || '来自电影雷达的推荐。');
    const back = document.getElementById('detailBack');
    if (back) back.textContent = '‹ 返回电影雷达';
    ensurePreviewNote();
  }

  async function tmdbFetch(path, params = {}) {
    const res = await fetch(TMDB_PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, params })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async function enrichPreview(radar, requestId) {
    if (!radar?.tmdbId) return;
    const language = readState()?.settings?.tmdbLanguage || 'zh-CN';
    const [detailResult, creditsResult] = await Promise.allSettled([
      tmdbFetch(`/movie/${radar.tmdbId}`, { language }),
      tmdbFetch(`/movie/${radar.tmdbId}/credits`, { language })
    ]);
    if (requestId !== previewRequestId || previewRadarId !== radar.id) return;
    const detail = detailResult.status === 'fulfilled' ? detailResult.value : null;
    const credits = creditsResult.status === 'fulfilled' ? creditsResult.value : null;
    if (detail || credits) fillPreview(radar, detail, credits);
  }

  function openRadarPreview(radar) {
    if (!radar) return;
    previewRadarId = radar.id;
    const requestId = ++previewRequestId;
    document.documentElement.classList.add('radar-detail-preview');
    showDetailView();
    fillPreview(radar);
    location.hash = `radar-preview/${encodeURIComponent(radar.id)}`;
    enrichPreview(radar, requestId).catch(() => {});
  }

  function boot() {
    ensureStyle();
    swapHomePlanAndInsight();
    syncRandomPosterLink();
    annotateRadarPosters();
    ensurePreviewNote();

    const randomTitle = document.getElementById('randomTitle');
    const randomPoster = document.getElementById('randomPoster');
    if (randomTitle) new MutationObserver(syncRandomPosterLink).observe(randomTitle, { childList: true, characterData: true, subtree: true });
    if (randomPoster) new MutationObserver(syncRandomPosterLink).observe(randomPoster, { childList: true, subtree: true });

    const radarGrid = document.getElementById('radarPageGrid');
    if (radarGrid) new MutationObserver(annotateRadarPosters).observe(radarGrid, { childList: true, subtree: true });
  }

  document.addEventListener('click', event => {
    const back = event.target.closest?.('#detailBack');
    if (back && previewRadarId) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      clearPreviewMode();
      document.getElementById('detailView')?.classList.add('hidden');
      document.getElementById('radarView')?.classList.remove('hidden');
      location.hash = 'radar';
      return;
    }

    if (previewRadarId && event.target.closest?.('.nav a,[data-view-link],[data-open-detail]')) clearPreviewMode();

    const radarPoster = event.target.closest?.('.radar-result-poster[data-radar-preview-id]');
    if (!radarPoster) return;
    const radar = radarById(radarPoster.dataset.radarPreviewId);
    if (!radar) return;
    const movie = findMovieForRadar(radar);
    if (movie?.id) {
      radarPoster.dataset.openDetail = movie.id;
      clearPreviewMode();
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openRadarPreview(radar);
  }, true);

  document.addEventListener('keydown', event => {
    if (!['Enter', ' '].includes(event.key)) return;
    const target = event.target.closest?.('#randomPoster[data-open-detail],.radar-result-poster[data-radar-preview-id]');
    if (!target) return;
    event.preventDefault();
    target.click();
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
