(() => {
  'use strict';
  if (window.CineverseState) return;

  const V2_KEY = 'movie-collection-v2';
  const LEGACY_KEY = 'movie-collection-state-v1';
  const { DEFAULT_SETTINGS, EMPTY_HOME } = window.CineverseAppConstants;
  const { uid, safeJSON, splitList } = window.CineverseCoreUtils;
  const EMPTY_MATCH_CENTER = Object.freeze({
    lastScanAt:'', lastTotal:0, lastAuto:0, lastManual:0,
    rows:[], resumeIds:[], paused:false
  });

  function normalizeSettings(value) {
    const settings = { ...DEFAULT_SETTINGS, ...(value || {}) };
    delete settings.tmdbKey;
    delete settings.brandTitle;
    delete settings.brandSubtitle;
    delete settings.brandLogoDataUrl;
    delete settings.libraryPageSize;
    return settings;
  }

  function normalizeMovie(movie = {}) {
    const normalizeType = value => ['movie', 'tv', 'unknown'].includes(String(value || '')) ? String(value) : 'movie';
    if (movie.info) return {
      id:movie.id || uid(),
      mediaType:normalizeType(movie.mediaType || movie.info.mediaType),
      info:{
        title:movie.info.title || '', originalTitle:movie.info.originalTitle || '',
        year:movie.info.year ? Number(movie.info.year) : null,
        releaseDate:movie.info.releaseDate || movie.info.firstAirDate || '',
        firstAirDate:movie.info.firstAirDate || movie.info.releaseDate || '',
        lastAirDate:movie.info.lastAirDate || '',
        numberOfSeasons:movie.info.numberOfSeasons != null ? Number(movie.info.numberOfSeasons) : null,
        numberOfEpisodes:movie.info.numberOfEpisodes != null ? Number(movie.info.numberOfEpisodes) : null,
        tvStatus:movie.info.tvStatus || '',
        directors:Array.isArray(movie.info.directors) ? movie.info.directors : splitList(movie.info.directors),
        countries:Array.isArray(movie.info.countries) ? movie.info.countries : splitList(movie.info.countries),
        runtime:movie.info.runtime ? Number(movie.info.runtime) : null,
        genres:Array.isArray(movie.info.genres) ? movie.info.genres : splitList(movie.info.genres),
        posterUrl:movie.info.posterUrl || '', overview:movie.info.overview || '',
        tmdbId:movie.info.tmdbId || movie.tmdbId || null,
        doubanId:movie.info.doubanId || movie.doubanId || null
      },
      personal:{
        status:movie.personal?.status || 'want',
        want:movie.personal?.want == null ? (movie.personal?.status || 'want') === 'want' : Boolean(movie.personal.want),
        rating:movie.personal?.rating !== '' && movie.personal?.rating != null ? Number(movie.personal.rating) : null,
        tags:Array.isArray(movie.personal?.tags) ? movie.personal.tags : splitList(movie.personal?.tags),
        shortReview:movie.personal?.shortReview || '', favorite:Boolean(movie.personal?.favorite)
      },
      watchHistory:Array.isArray(movie.watchHistory) ? movie.watchHistory : [],
      plans:Array.isArray(movie.plans) ? movie.plans : [],
      radar:movie.radar || { discovered:false, ignored:false },
      createdAt:movie.createdAt || new Date().toISOString(),
      updatedAt:movie.updatedAt || new Date().toISOString(),
      external:movie.external || {}
    };
    return {
      id:movie.id || uid(), mediaType:normalizeType(movie.mediaType),
      info:{
        title:movie.title || '', originalTitle:'', year:movie.year ? Number(movie.year) : null,
        releaseDate:'', firstAirDate:'', lastAirDate:'', numberOfSeasons:null,
        numberOfEpisodes:null, tvStatus:'',
        directors:Array.isArray(movie.directors) ? movie.directors : splitList(movie.directors),
        countries:Array.isArray(movie.countries) ? movie.countries : splitList(movie.countries),
        runtime:movie.runtime ? Number(movie.runtime) : null, genres:[], posterUrl:movie.posterUrl || '',
        overview:'', tmdbId:movie.tmdbId || null, doubanId:movie.doubanId || null
      },
      personal:{ status:movie.watched ? 'watched' : 'want', rating:null, tags:[], shortReview:'', favorite:false },
      watchHistory:movie.watched ? [{ date:null, rating:null, note:'', venue:'' }] : [],
      plans:(movie.plans || []).map(plan => typeof plan === 'string' ? { month:plan, status:'planned' } : plan),
      radar:{ discovered:false, ignored:false },
      createdAt:movie.updatedAt || new Date().toISOString(),
      updatedAt:movie.updatedAt || new Date().toISOString(), external:movie.external || {}
    };
  }

  function normalizeState(candidate = {}) {
    const matchCenter = { ...EMPTY_MATCH_CENTER, ...(candidate.tmdbMatchCenter || {}) };
    matchCenter.rows = Array.isArray(matchCenter.rows) ? matchCenter.rows : [];
    matchCenter.resumeIds = Array.isArray(matchCenter.resumeIds) ? matchCenter.resumeIds : [];
    return {
      ...candidate,
      movies:(candidate.movies || []).map(normalizeMovie),
      settings:normalizeSettings(candidate.settings),
      home:{ ...structuredClone(EMPTY_HOME), ...(candidate.home || {}) },
      tmdbMatchCenter:matchCenter
    };
  }

  function persist(state) {
    localStorage.setItem(V2_KEY, JSON.stringify(state));
    return state;
  }

  function load() {
    const saved = safeJSON(localStorage.getItem(V2_KEY));
    if (saved) {
      const oldSettings = saved.settings || {};
      const state = normalizeState(saved);
      if (oldSettings.profileName === '锦荣' && oldSettings.profileRole === '影视收藏家' && !oldSettings.profileAvatarDataUrl) {
        state.settings.profileName = '电影爱好者';
        state.settings.profileRole = '';
        persist(state);
      }
      return state;
    }
    const legacy = safeJSON(localStorage.getItem(LEGACY_KEY));
    return persist(normalizeState({ movies:Array.isArray(legacy) ? legacy : [] }));
  }

  function restore(candidate) {
    if (!candidate || !Array.isArray(candidate.movies)) throw new Error('不是可识别的 V2 备份');
    return normalizeState(candidate);
  }

  function backup(state) {
    const clean = normalizeState(structuredClone(state));
    return { schemaVersion:2, exportedAt:new Date().toISOString(), app:'影视收藏夹 V2', state:clean };
  }

  function createStore(initialState = load()) {
    let state = initialState;
    const listeners = new Set();
    return Object.freeze({
      getState:() => state,
      replace(nextState, metadata = {}) {
        state = nextState;
        if (metadata.persist !== false) persist(state);
        if (!metadata.silent) listeners.forEach(listener => listener(state, metadata));
        return state;
      },
      update(updater, metadata = {}) {
        const nextState = structuredClone(state);
        updater(nextState);
        return this.replace(nextState, metadata);
      },
      subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      }
    });
  }

  window.CineverseState = Object.freeze({
    keys:Object.freeze({ app:V2_KEY, legacy:LEGACY_KEY }),
    normalizeSettings, normalizeMovie, normalizeState, load, persist, restore, backup, createStore
  });
})();
