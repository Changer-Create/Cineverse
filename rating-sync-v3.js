(() => {
  'use strict';
  if (/(?:^|\/)(?:admin|admin-console)\.html$/i.test(location.pathname)) return;

  const APP_KEY = 'movie-collection-v2';
  const CLOUD_DIRTY_KEY = 'movie-cloud-dirty-v1';
  const nativeStringify = JSON.stringify;
  const nativeParse = JSON.parse;
  const patchedFlag = '__movieRatingSyncV3__';
  if (JSON.stringify[patchedFlag]) return;

  // 评分语义：0/负数/空值都代表“未评分”，只有 > 0 才是有效评分。
  const normalRating = value => {
    if (value === null || value === '' || value === undefined) return null;
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const sameRating = (a, b) => Object.is(normalRating(a), normalRating(b));
  let pendingMovieFormRatingEdit = null;

  function captureMovieFormRatingEdit(form) {
    if (form?.id !== 'movieForm') return;
    const rawTmdbId = String(document.getElementById('movieTmdbIdInput')?.value || '').trim();
    const parsedTmdbId = rawTmdbId === '' ? null : Number(rawTmdbId);
    pendingMovieFormRatingEdit = {
      rating: normalRating(document.getElementById('movieRatingInput')?.value),
      mediaType: document.getElementById('movieMediaTypeInput')?.value === 'tv' ? 'tv' : 'movie',
      tmdbId: Number.isFinite(parsedTmdbId) ? parsedTmdbId : null,
      title: String(document.getElementById('movieTitleInput')?.value || '').trim(),
      originalTitle: String(document.getElementById('movieOriginalTitleInput')?.value || '').trim()
    };
    queueMicrotask(() => { pendingMovieFormRatingEdit = null; });
  }

  function isPendingMovieFormTarget(movie, currentRating) {
    const edit = pendingMovieFormRatingEdit;
    if (!edit || !sameRating(edit.rating, currentRating)) return false;
    const mediaType = movie?.mediaType === 'tv' ? 'tv' : 'movie';
    if (mediaType !== edit.mediaType) return false;
    if (edit.tmdbId != null) return Number(movie?.info?.tmdbId) === edit.tmdbId;
    return String(movie?.info?.title || '').trim() === edit.title
      && String(movie?.info?.originalTitle || '').trim() === edit.originalTitle;
  }

  function historyRows(movie) {
    return Array.isArray(movie?.watchHistory) ? movie.watchHistory : [];
  }

  function latestWatch(movie) {
    const rows = historyRows(movie);
    if (!rows.length) return null;
    let best = rows[0];
    let bestDate = String(best?.date || '');
    for (let i = 1; i < rows.length; i++) {
      const date = String(rows[i]?.date || '');
      if (date > bestDate) {
        best = rows[i];
        bestDate = date;
      }
    }
    return best;
  }

  function historySignature(movie) {
    return nativeStringify(historyRows(movie).map(w => [
      String(w?.date || ''),
      normalRating(w?.rating),
      String(w?.venue || ''),
      String(w?.note || ''),
      w?.sourceSeason ?? null,
      String(w?.sourceDoubanId || ''),
      String(w?.sourceTitle || '')
    ]));
  }

  function normalizeZeroRatings(state) {
    if (!state || !Array.isArray(state.movies)) return false;
    let changed = false;
    for (const movie of state.movies) {
      if (movie?.personal && movie.personal.rating !== null && movie.personal.rating !== '' && movie.personal.rating !== undefined) {
        const normalized = normalRating(movie.personal.rating);
        if (normalized === null) {
          movie.personal.rating = null;
          changed = true;
        }
      }
      for (const watch of historyRows(movie)) {
        if (watch?.rating !== null && watch?.rating !== '' && watch?.rating !== undefined) {
          const normalized = normalRating(watch.rating);
          if (normalized === null) {
            watch.rating = null;
            changed = true;
          }
        }
      }
    }
    return changed;
  }

  function syncMovie(movie, previousMovie) {
    if (!movie || typeof movie !== 'object') return false;
    const latest = latestWatch(movie);
    if (!latest) return false;
    movie.personal = movie.personal && typeof movie.personal === 'object' ? movie.personal : {};

    const currentRating = normalRating(movie.personal.rating);
    const latestRating = normalRating(latest.rating);
    const hasPrevious = Boolean(previousMovie && typeof previousMovie === 'object');
    const historyChanged = hasPrevious && historySignature(movie) !== historySignature(previousMovie);
    const personalChanged = hasPrevious && !sameRating(currentRating, previousMovie?.personal?.rating);
    let changed = false;

    // watchHistory 是存在观看记录时的评分事实源。
    // 仅“编辑影视资料”中的显式评分提交，被解释为修改最新观看记录的命令。
    if (hasPrevious && !historyChanged && personalChanged && isPendingMovieFormTarget(movie, currentRating)) {
      if (!sameRating(latest.rating, currentRating) || latest.rating !== currentRating) {
        latest.rating = currentRating;
        changed = true;
      }
      if (!sameRating(movie.personal.rating, currentRating) || movie.personal.rating !== currentRating) {
        movie.personal.rating = currentRating;
        changed = true;
      }
      return changed;
    }

    if (!sameRating(currentRating, latestRating) || movie.personal.rating !== latestRating) {
      movie.personal.rating = latestRating;
      changed = true;
    }
    return changed;
  }

  function previousState() {
    try {
      const raw = localStorage.getItem(APP_KEY);
      return raw ? nativeParse(raw) : null;
    } catch {
      return null;
    }
  }

  function syncStateInPlace(state, previous) {
    if (!state || !Array.isArray(state.movies)) return false;
    let changed = normalizeZeroRatings(state);
    const previousById = new Map((previous?.movies || []).map(m => [String(m?.id || ''), m]));
    for (const movie of state.movies) {
      if (syncMovie(movie, previousById.get(String(movie?.id || '')))) changed = true;
    }
    return changed;
  }

  function isAppState(value) {
    return Boolean(value && typeof value === 'object' && Array.isArray(value.movies) && value.settings && value.home);
  }

  function patchedStringify(value, replacer, space) {
    if (isAppState(value)) {
      try { syncStateInPlace(value, previousState()); } catch {}
    }
    return nativeStringify(value, replacer, space);
  }
  Object.defineProperty(patchedStringify, patchedFlag, { value: true });
  JSON.stringify = patchedStringify;

  function storedNeedsRepair() {
    try {
      const state = previousState();
      if (!state?.movies) return false;
      if (state.movies.some(movie => {
        const p = movie?.personal?.rating;
        if (p !== null && p !== '' && p !== undefined && normalRating(p) === null) return true;
        return historyRows(movie).some(w => w?.rating !== null && w?.rating !== '' && w?.rating !== undefined && normalRating(w.rating) === null);
      })) return true;
      return state.movies.some(movie => {
        const latest = latestWatch(movie);
        return latest && !sameRating(movie?.personal?.rating, latest?.rating);
      });
    } catch {
      return false;
    }
  }

  function migrateStoredZeroRatings() {
    try {
      const state = previousState();
      if (!state?.movies) return false;
      if (!normalizeZeroRatings(state)) return false;
      const gateway = window.CineverseStateGateway;
      if (gateway?.replace) gateway.replace(state, { source:'rating-sync', reason:'rating-migration' });
      else localStorage.setItem(APP_KEY, nativeStringify(state));
      localStorage.setItem(CLOUD_DIRTY_KEY, '1');
      return true;
    } catch {
      return false;
    }
  }

  function currentDetailMovieFromStorage() {
    const raw = location.hash.replace(/^#/, '');
    if (!raw.startsWith('detail/')) return null;
    let id = raw.slice(7);
    try { id = decodeURIComponent(id); } catch {}
    const state = previousState();
    return state?.movies?.find(m => String(m?.id || '') === id) || null;
  }

  function renderDetailRatingFromStorage() {
    const movie = currentDetailMovieFromStorage();
    if (!movie) return;
    const latest = latestWatch(movie);
    const rating = latest ? normalRating(latest.rating) : normalRating(movie?.personal?.rating);
    const score = document.getElementById('detailRating');
    const stars = document.getElementById('detailStars');
    if (score) score.textContent = rating == null ? '—' : rating.toFixed(1);
    if (stars) {
      if (rating == null) stars.textContent = '☆☆☆☆☆';
      else {
        const filled = Math.max(1, Math.round(rating / 2));
        stars.textContent = '★★★★★'.slice(0, filled) + '☆☆☆☆☆'.slice(filled);
      }
    }
  }

  function forceOneSafeSave() {
    if (!storedNeedsRepair()) return;
    const language = document.getElementById('settingsTmdbLanguage');
    if (!language) return;
    language.dispatchEvent(new Event('change', { bubbles: true }));
    queueMicrotask(renderDetailRatingFromStorage);
  }

  document.addEventListener('submit', e => {
    if (e.target?.id === 'movieForm') captureMovieFormRatingEdit(e.target);
  }, true);

  document.addEventListener('click', e => {
    if (e.target.closest?.('[data-delete-watch]')) setTimeout(renderDetailRatingFromStorage, 0);
  });
  document.addEventListener('submit', e => {
    if (e.target?.id === 'watchForm' || e.target?.id === 'movieForm') setTimeout(renderDetailRatingFromStorage, 0);
  });
  window.addEventListener('hashchange', () => setTimeout(renderDetailRatingFromStorage, 0));

  function boot() {
    if (migrateStoredZeroRatings()) {
      location.reload();
      return;
    }
    setTimeout(forceOneSafeSave, 0);
    setTimeout(renderDetailRatingFromStorage, 0);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
