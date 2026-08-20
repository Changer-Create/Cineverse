(() => {
  'use strict';
  if (/(?:^|\/)(?:admin|admin-console)\.html$/i.test(location.pathname)) return;

  const STORAGE_KEY = 'movie-collection-v2';
  const $ = id => document.getElementById(id);
  const safeParse = raw => { try { return JSON.parse(raw); } catch { return null; } };
  const currentMonth = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  };
  const isSeasonSourceWatch = (movie, watch) => movie?.mediaType === 'tv' && Number(watch?.sourceSeason) > 0 && Boolean(watch?.sourceDoubanId || String(watch?.venue || '').includes('豆瓣'));

  function monthRows(state) {
    const month = currentMonth();
    const rows = [];
    for (const movie of (state?.movies || [])) {
      for (const watch of (movie?.watchHistory || [])) {
        if (!String(watch?.date || '').startsWith(month)) continue;
        if (isSeasonSourceWatch(movie, watch)) continue;
        rows.push({ movie, watch });
      }
    }
    return rows;
  }

  function ratingOf(row) {
    const watchRating = Number(row?.watch?.rating);
    if (Number.isFinite(watchRating) && watchRating > 0) return watchRating;
    const movieRating = Number(row?.movie?.personal?.rating);
    return Number.isFinite(movieRating) && movieRating > 0 ? movieRating : null;
  }

  function compute() {
    const state = safeParse(localStorage.getItem(STORAGE_KEY)) || {};
    const rows = monthRows(state);
    const watchedCount = new Set(rows.map(row => row.movie?.id).filter(Boolean)).size;
    const ratedRows = rows.map(row => ({ row, rating: ratingOf(row) })).filter(x => x.rating != null);
    const avg = ratedRows.length ? ratedRows.reduce((sum, x) => sum + x.rating, 0) / ratedRows.length : null;

    let topTitle = '—';
    let topScore = null;
    if (ratedRows.length) {
      ratedRows.sort((a, b) => b.rating - a.rating || String(b.row.watch?.date || '').localeCompare(String(a.row.watch?.date || '')));
      topTitle = ratedRows[0].row.movie?.info?.title || '—';
      topScore = ratedRows[0].rating;
    }

    return { watchedCount, avg, topTitle, topScore };
  }

  function render() {
    const first = $('monthRadarCount');
    const second = $('monthNinePlus');
    const third = $('monthTopDirector');
    if (!first || !second || !third) return;
    const { watchedCount, avg, topTitle, topScore } = compute();

    const firstItem = first.closest('.insight-item');
    const secondItem = second.closest('.insight-item');
    const thirdItem = third.closest('.insight-item');

    first.classList.add('month-top-film-value');
    first.textContent = topScore == null ? '—' : `《${topTitle}》`;
    first.title = topScore == null ? '本月暂无评分作品' : `《${topTitle}》 · ★ ${topScore.toFixed(1)}`;
    if (firstItem) {
      const label = firstItem.querySelector('.l');
      if (label) label.textContent = topScore == null ? '本月最高分作品' : `本月最高分作品 · ★ ${topScore.toFixed(1)}`;
    }

    second.textContent = String(watchedCount);
    if (secondItem) {
      const label = secondItem.querySelector('.l');
      if (label) label.textContent = '本月已观看';
    }

    third.textContent = avg == null ? '—' : avg.toFixed(1);
    if (thirdItem) {
      const label = thirdItem.querySelector('.l');
      if (label) label.textContent = '本月平均分';
    }
  }

  function injectStyle() {
    if ($('homeMonthInsightV2Style')) return;
    const style = document.createElement('style');
    style.id = 'homeMonthInsightV2Style';
    style.textContent = `
      #homeView .insight-grid .month-top-film-value{
        font-family:inherit!important;
        font-size:clamp(18px,1.8vw,28px)!important;
        line-height:1.25!important;
        font-weight:650!important;
        display:-webkit-box!important;
        -webkit-line-clamp:2!important;
        -webkit-box-orient:vertical!important;
        overflow:hidden!important;
        word-break:break-word!important;
      }
    `;
    document.head.appendChild(style);
  }

  let queued = false;
  function queueRender() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      render();
    });
  }

  const originalSetItem = Storage.prototype.setItem;
  if (!Storage.prototype.__movieInsightPatched) {
    Object.defineProperty(Storage.prototype, '__movieInsightPatched', { value: true, configurable: true });
    Storage.prototype.setItem = function(key, value) {
      const result = originalSetItem.call(this, key, value);
      if (this === localStorage && key === STORAGE_KEY) queueRender();
      return result;
    };
  }

  window.addEventListener('storage', event => {
    if (event.key === STORAGE_KEY) queueRender();
  });

  function boot() {
    injectStyle();
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
