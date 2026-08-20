(() => {
  'use strict';

  const STORAGE_KEY = 'movie-collection-v2';
  const TMDB_PROXY_URL = 'https://bjjralybdcuczwllxbvo.supabase.co/functions/v1/tmdb-proxy';
  const TOTAL_TARGET = 20;
  const WANT_TARGET = 10;
  const GENERATED_SOURCES = new Set(['想看片单', 'TMDb 自动雷达']);
  let generating = false;

  const pad = n => String(n).padStart(2, '0');
  const localToday = () => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  const dateOnly = value => {
    const m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
  };
  const isCurrentWeek = value => {
    const d = dateOnly(value);
    if (!d) return false;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const start = new Date(now);
    const day = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - day);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return d >= start && d < end;
  };
  const safeJson = raw => {
    try { return JSON.parse(raw); } catch { return null; }
  };
  const readState = () => safeJson(localStorage.getItem(STORAGE_KEY)) || null;
  const writeState = state => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  const normalizeText = value => String(value || '')
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[\s·・:：,，.。!！?？'"“”‘’()（）\[\]【】_-]+/g, '');
  const movieYear = movie => Number(movie?.info?.year) || Number(String(movie?.info?.releaseDate || '').slice(0, 4)) || null;
  const movieKey = movie => {
    const tmdb = Number(movie?.info?.tmdbId) || null;
    if (tmdb) return `tmdb:${tmdb}`;
    return `title:${normalizeText(movie?.info?.title)}:${movieYear(movie) || ''}`;
  };
  const radarKey = radar => {
    const tmdb = Number(radar?.tmdbId) || null;
    if (tmdb) return `tmdb:${tmdb}`;
    return `title:${normalizeText(radar?.title)}:${Number(radar?.year) || ''}`;
  };
  const isWatchedMovie = movie => movie?.mediaType !== 'tv' && (
    movie?.personal?.status === 'watched' ||
    (movie?.watchHistory || []).some(w => w && !w.sourceSeason)
  );
  const matchesRadarToMovie = (radar, movie) => {
    if (!movie || movie.mediaType === 'tv') return false;
    if (radar?.tmdbId && movie?.info?.tmdbId && Number(radar.tmdbId) === Number(movie.info.tmdbId)) return true;
    const rt = normalizeText(radar?.title);
    const mt = normalizeText(movie?.info?.title);
    const mo = normalizeText(movie?.info?.originalTitle);
    if (!rt || !(rt === mt || rt === mo)) return false;
    const ry = Number(radar?.year) || null;
    const my = movieYear(movie);
    return !ry || !my || ry === my;
  };
  const alreadyWatched = (radar, movies) => movies.some(m => isWatchedMovie(m) && matchesRadarToMovie(radar, m));

  function tasteProfile(movies) {
    const counts = new Map();
    for (const movie of movies) {
      const rating = Number(movie?.personal?.rating) || 0;
      const weight = (movie?.personal?.favorite ? 3 : 0) + (rating >= 9 ? 3 : rating >= 8 ? 1 : 0);
      if (!weight) continue;
      for (const genre of (movie?.info?.genres || [])) {
        if (!genre) continue;
        counts.set(genre, (counts.get(genre) || 0) + weight);
      }
    }
    const names = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(x => x[0]);
    return new Set(names);
  }

  function matchScoreForGenres(genres, publicScore, voteCount, prefs) {
    const overlap = (genres || []).filter(g => prefs.has(g)).length;
    return Math.max(55, Math.min(98,
      60 + overlap * 10 + (Number(publicScore) || 0) * 2 + ((Number(voteCount) || 0) >= 1000 ? 3 : 0)
    ));
  }

  function buildWantCandidates(state, prefs, ignoredKeys) {
    const movies = Array.isArray(state.movies) ? state.movies : [];
    return movies
      .filter(m => m?.mediaType !== 'tv' && m?.personal?.status === 'want' && m?.info?.title && !isWatchedMovie(m))
      .filter(m => !ignoredKeys.has(movieKey(m)))
      .map((m, index) => {
        const genres = Array.isArray(m?.info?.genres) ? m.info.genres.filter(Boolean) : [];
        const existingMatch = Number(m?.radar?.matchScore);
        const score = Number.isFinite(existingMatch) && existingMatch > 0
          ? existingMatch
          : Math.max(68, Math.min(96, 72 + genres.filter(g => prefs.has(g)).length * 8 + (m?.personal?.favorite ? 4 : 0)));
        return {
          id: `want-${String(m.id || index).replace(/[^a-zA-Z0-9_-]/g, '')}-${localToday()}`,
          title: m.info.title,
          year: movieYear(m),
          releaseDate: m.info.releaseDate || '',
          meta: [movieYear(m), m.info.runtime ? `${m.info.runtime} 分钟` : null].filter(Boolean).join(' · '),
          public: m?.radar?.publicReputation != null ? Number(m.radar.publicReputation) : null,
          match: Math.round(score),
          badge: '想看优先',
          kind: score >= 93 ? 'hot' : 'rec',
          poster: `p${(index % 4) + 1}`,
          posterUrl: m.info.posterUrl || '',
          category: 'week',
          reason: '来自你的想看片单：你已经把它标记为「想看」，这次优先把它推到电影雷达前排。',
          discoveredAt: localToday(),
          source: '想看片单',
          ignored: false,
          runtime: Number(m.info.runtime) || null,
          directors: Array.isArray(m.info.directors) ? m.info.directors : [],
          countries: Array.isArray(m.info.countries) ? m.info.countries : [],
          genres,
          tmdbId: m.info.tmdbId || null,
          _jitter: Math.random() * 8,
        };
      })
      .sort((a, b) => (b.match + b._jitter) - (a.match + a._jitter));
  }

  async function tmdbFetch(path, params = {}) {
    const res = await fetch(TMDB_PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, params }),
    });
    let body = null;
    try { body = await res.json(); } catch {}
    if (!res.ok) throw new Error(body?.message || body?.error || `TMDb 代理 HTTP ${res.status}`);
    return body || {};
  }

  function tmdbImage(path, size = 'w500') {
    return path ? `https://image.tmdb.org/t/p/${size}${path}` : '';
  }

  async function buildTmdbCandidates(state, prefs, ignoredKeys, selectedWantKeys, needed) {
    if (needed <= 0) return [];
    const language = state?.settings?.tmdbLanguage || 'zh-CN';
    const [trend, upcoming1, upcoming2, popular, topRated, genres] = await Promise.all([
      tmdbFetch('/trending/movie/week', { language }),
      tmdbFetch('/movie/upcoming', { language, region: 'CN', page: 1 }),
      tmdbFetch('/movie/upcoming', { language, region: 'CN', page: 2 }),
      tmdbFetch('/movie/popular', { language, region: 'CN', page: 1 }),
      tmdbFetch('/movie/top_rated', { language, region: 'CN', page: 1 }),
      tmdbFetch('/genre/movie/list', { language }),
    ]);
    const genreMap = new Map((genres.genres || []).map(g => [g.id, g.name]));
    const movies = Array.isArray(state.movies) ? state.movies : [];
    const pools = [
      ['趋势', trend.results || []],
      ['即将上映', upcoming1.results || []],
      ['即将上映', upcoming2.results || []],
      ['热门', popular.results || []],
      ['高分', topRated.results || []],
    ];
    const seen = new Set();
    const all = [];
    for (const [poolName, list] of pools) {
      for (const x of list) {
        if (!x?.id || !(x.title || x.original_title)) continue;
        const title = x.title || x.original_title;
        const year = Number(String(x.release_date || '').slice(0, 4)) || null;
        const genres = (x.genre_ids || []).map(id => genreMap.get(id)).filter(Boolean);
        const score = matchScoreForGenres(genres, x.vote_average, x.vote_count, prefs);
        const radar = {
          id: `tmdb-week-${x.id}-${localToday()}`,
          title,
          year,
          releaseDate: x.release_date || '',
          meta: [year, poolName].filter(Boolean).join(' · '),
          public: x.vote_average != null ? Number(x.vote_average) : null,
          match: score,
          badge: score >= 90 ? '强烈推荐' : Number(x.vote_average) >= 8.5 ? '高口碑' : '值得关注',
          kind: score >= 93 ? 'hot' : Number(x.vote_average) >= 9 ? 'good' : 'focus',
          poster: `p${(all.length % 4) + 1}`,
          posterUrl: tmdbImage(x.poster_path, 'w500'),
          category: 'week',
          reason: `TMDb 自动雷达：${prefs.size ? '与你高评分/收藏作品的类型偏好进行匹配；' : ''}${poolName}热度与公开评分共同排序。`,
          discoveredAt: localToday(),
          source: 'TMDb 自动雷达',
          ignored: false,
          runtime: null,
          directors: [],
          countries: [],
          genres,
          tmdbId: x.id,
          _pool: poolName,
        };
        const key = radarKey(radar);
        if (seen.has(key) || ignoredKeys.has(key) || selectedWantKeys.has(key)) continue;
        if (alreadyWatched(radar, movies)) continue;
        seen.add(key);
        all.push(radar);
      }
    }

    all.sort((a, b) => {
      const scoreDiff = (b.match || 0) - (a.match || 0);
      if (scoreDiff) return scoreDiff;
      const voteDiff = (b.public || 0) - (a.public || 0);
      if (voteDiff) return voteDiff;
      return Math.random() - 0.5;
    });
    return all.slice(0, needed);
  }

  function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
  }

  function setBusy(busy) {
    generating = busy;
    const button = document.getElementById('radarAutoUpdateBtn');
    if (button) {
      button.disabled = busy;
      button.textContent = busy ? '正在生成 20 部…' : '✦ 重新生成 20 部';
    }
    document.querySelectorAll('[data-view="radar"],[data-view-link="radar"]').forEach(el => {
      el.style.pointerEvents = busy ? 'none' : '';
      el.style.opacity = busy ? '.65' : '';
    });
  }

  async function generateRadar20({ reload = true } = {}) {
    if (generating) return;
    const state = readState();
    if (!state) {
      showToast('电影雷达暂时无法读取本地收藏数据');
      return;
    }
    setBusy(true);
    showToast('正在生成 20 部电影雷达：想看 10 + TMDb 10…');
    try {
      state.home = state.home || {};
      const allRadar = Array.isArray(state.home.radar) ? state.home.radar : [];
      const ignoredKeys = new Set(allRadar.filter(r => r?.ignored).map(radarKey));
      const prefs = tasteProfile(Array.isArray(state.movies) ? state.movies : []);
      const wantPool = buildWantCandidates(state, prefs, ignoredKeys);
      const wantSelected = wantPool.slice(0, WANT_TARGET).map(({ _jitter, ...r }) => r);
      const selectedWantKeys = new Set(wantSelected.map(radarKey));
      const tmdbNeeded = TOTAL_TARGET - wantSelected.length;
      const tmdbSelected = await buildTmdbCandidates(state, prefs, ignoredKeys, selectedWantKeys, tmdbNeeded);

      if (tmdbSelected.length < tmdbNeeded) {
        throw new Error(`TMDb 当前只补足了 ${tmdbSelected.length}/${tmdbNeeded} 部，请稍后再试`);
      }

      const retained = allRadar.filter(r => !isCurrentWeek(r?.discoveredAt));
      const batch = [...wantSelected, ...tmdbSelected].slice(0, TOTAL_TARGET);
      state.home.radar = [...retained, ...batch];
      writeState(state);

      sessionStorage.setItem('movie-radar20-last-count', String(batch.length));
      sessionStorage.setItem('movie-radar20-last-want', String(wantSelected.length));
      if (reload) {
        location.hash = 'radar';
        location.reload();
      }
    } catch (err) {
      showToast(`电影雷达生成失败：${err?.message || err}`);
      setBusy(false);
    }
  }

  function injectStyles() {
    const style = document.createElement('style');
    style.id = 'radar-20-layout';
    style.textContent = `
      @media (min-width:1181px){
        .radar-page-grid{grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:10px!important;padding:14px!important}
        .radar-result-body{padding:10px!important}
        .radar-result-title{font-size:13px!important}
        .radar-result-meta{font-size:9px!important}
        .radar-score-row{gap:5px!important;margin-top:8px!important}
        .radar-score-box{padding:6px!important}
        .radar-score-box b{font-size:12px!important}
        .radar-reason{min-height:48px!important;margin-top:8px!important;font-size:9px!important;line-height:1.55!important}
        .radar-card-actions{gap:5px!important;margin-top:8px!important}
        .radar-card-actions button{padding:6px 4px!important;font-size:9px!important}
      }
      @media (max-width:1180px) and (min-width:761px){
        .radar-page-grid{grid-template-columns:repeat(4,minmax(0,1fr))!important}
      }
    `;
    document.head.appendChild(style);
  }

  function wireControls() {
    const updateButton = document.getElementById('radarAutoUpdateBtn');
    if (updateButton) updateButton.textContent = '✦ 重新生成 20 部';

    document.addEventListener('click', event => {
      const radarTrigger = event.target.closest?.('[data-view="radar"],[data-view-link="radar"]');
      if (radarTrigger) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        generateRadar20();
        return;
      }
      const button = event.target.closest?.('#radarAutoUpdateBtn');
      if (button) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        generateRadar20();
      }
    }, true);
  }

  injectStyles();
  wireControls();
})();