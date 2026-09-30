(() => {
  'use strict';

  const moviesOf = state => Array.isArray(state?.movies) ? state.movies : [];
  const uniq = values => [...new Set((values || []).filter(Boolean))];
  const uniqBy = (values, keyOf) => {
    const seen = new Set();
    return (values || []).filter(value => {
      const key = keyOf(value);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const tmdbSourceKey = movie => {
    const raw = movie?.info?.tmdbId;
    const id = typeof raw === 'number' || (typeof raw === 'string' && /^\d+$/.test(raw)) ? Number(raw) : NaN;
    return Number.isSafeInteger(id) && id > 0 && ['movie','tv'].includes(movie?.mediaType) ? `${movie.mediaType}:${id}` : '';
  };
  function setTmdbAssociation(movie, mediaType, tmdbId) {
    const previous = tmdbSourceKey(movie);
    movie.info ||= {};
    movie.mediaType = mediaType;
    movie.info.tmdbId = tmdbId;
    if (previous !== tmdbSourceKey(movie)) {
      movie.info.tmdbVoteAverage = null;
      movie.info.tmdbScoreSourceKey = null;
      if (movie.radar) movie.radar.publicReputation = null;
    }
    return movie;
  }

  // Unkeyed legacy fields remain in backups, but cannot prove their association.
  const publicScore = (movie, cache = {}, now = Date.now()) => {
    const valid = value => {
      return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 10 ? value : null;
    };
    const key = tmdbSourceKey(movie);
    if (!key) return null;
    const row = cache[key];
    if (row?.status === 'empty') return null;
    if (row && Number(row.expiresAt) > now && valid(row.score) != null) return valid(row.score);
    // Imported TMDb fields have no verified freshness; UI labels them as prior values.
    if (movie?.info?.tmdbScoreSourceKey !== key) return null;
    const legacy = valid(movie?.info?.tmdbVoteAverage);
    return legacy != null && legacy > 0 ? legacy : null;
  };

  const hasPlan = (movie, month) => (movie?.plans || []).some(plan => !month || plan.month === month);
  const getPlan = (movie, month) => (movie?.plans || []).find(plan => plan.month === month);
  const planEntries = (state, month) => moviesOf(state).flatMap(movie =>
    (movie.plans || []).filter(plan => plan.month === month).map(plan => ({ movie, plan }))
  );
  const watchEntries = state => moviesOf(state).flatMap(movie => {
    const history = movie.watchHistory || [];
    return history.map((watch, index) => ({ movie, watch, index, totalForMovie: history.length }));
  });

  const mediaTypeLabel = movie => movie?.mediaType === 'tv' ? '剧集' : movie?.mediaType === 'unknown' ? '待识别' : '电影';
  const mediaTypeIcon = movie => movie?.mediaType === 'tv' ? '📺' : movie?.mediaType === 'unknown' ? '◌' : '🎬';
  const displayStatus = (movie, month) => {
    const status = movie?.personal?.status || 'want';
    if (movie?.mediaType === 'tv') {
      if (status === 'watching') return ['watching', '在看'];
      if (status === 'watched') return ['watched', '已看完'];
      if (status === 'paused') return ['paused', '暂停'];
      if (status === 'dropped') return ['dropped', '弃剧'];
      if (hasPlan(movie, month)) return ['planned', '已计划'];
      return ['want', '想看'];
    }
    if (status === 'watched') return ['watched', '已看'];
    if (hasPlan(movie, month)) return ['planned', '已计划'];
    if (status === 'follow') return ['follow', '关注'];
    return ['want', '想看'];
  };

  const isSeasonSourceWatch = (movie, watch) => movie?.mediaType === 'tv'
    && Number(watch?.sourceSeason) > 0
    && Boolean(watch?.sourceDoubanId || String(watch?.venue || '').includes('豆瓣'));
  const posterHue = movie => [...String(movie?.info?.title || '')]
    .reduce((hue, character) => (hue + character.charCodeAt(0) * 7) % 360, 0);
  const metrics = (state, { year, month }) => {
    const movies = moviesOf(state);
    const current = new Set();
    const previous = new Set();
    for (const movie of movies) for (const watch of movie.watchHistory || []) {
      const date = String(watch.date || '');
      if (date.startsWith(String(year))) current.add(movie.id);
      if (date.startsWith(String(year - 1))) previous.add(movie.id);
    }
    const plans = movies.flatMap(movie => (movie.plans || []).filter(plan => plan.month === month));
    return {
      yearWatched: current.size,
      prevYearWatched: previous.size,
      want: movies.filter(movie => movie.personal?.status === 'want').length,
      plans: plans.length,
      done: plans.filter(plan => plan.status === 'completed').length,
      total: movies.length
    };
  };

  window.CineverseDomain = Object.freeze({
    publicScore, tmdbSourceKey, setTmdbAssociation, moviesOf, uniq, uniqBy, hasPlan, getPlan, planEntries, watchEntries,
    mediaTypeLabel, mediaTypeIcon, displayStatus, isSeasonSourceWatch, posterHue, metrics
  });
})();
