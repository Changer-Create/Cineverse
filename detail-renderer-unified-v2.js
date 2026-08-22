(() => {
  'use strict';
  if (/(?:^|\/)(?:admin|admin-console)\.html$/i.test(location.pathname)) return;
  if (window.__CINEVERSE_DETAIL_RENDERER_UNIFIED_V2__) return;
  window.__CINEVERSE_DETAIL_RENDERER_UNIFIED_V2__ = true;

  const STORAGE_KEY = 'movie-collection-v2';
  const $ = id => document.getElementById(id);
  const safeParse = raw => { try { return JSON.parse(raw); } catch { return null; } };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const escAttr = esc;
  const formatDate = value => {
    if (!value) return '—';
    const text = String(value);
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : (text.slice(0, 10) || '—');
  };
  const currentMonth = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };
  const state = () => safeParse(localStorage.getItem(STORAGE_KEY)) || { movies: [] };
  const mediaTypeLabel = movie => movie?.mediaType === 'tv' ? '剧集' : '电影';
  const isSeasonSourceWatch = (movie, watch) => movie?.mediaType === 'tv' && Number(watch?.sourceSeason) > 0 && Boolean(watch?.sourceDoubanId || String(watch?.venue || '').includes('豆瓣'));

  let tmdbSnapshot = null;
  let renderQueued = false;

  function movieById(id) {
    if (!id) return null;
    return (state().movies || []).find(movie => String(movie?.id || '') === String(id)) || null;
  }

  function externalMovie(data = {}) {
    const tv = data.mediaType === 'tv';
    return {
      id:null,
      mediaType:tv ? 'tv' : 'movie',
      info:{
        title:data.title || '',
        originalTitle:data.originalTitle || '',
        year:data.year || null,
        releaseDate:data.releaseDate || data.firstAirDate || '',
        firstAirDate:tv ? (data.firstAirDate || data.releaseDate || '') : '',
        lastAirDate:tv ? (data.lastAirDate || '') : '',
        numberOfSeasons:tv ? (data.numberOfSeasons ?? null) : null,
        numberOfEpisodes:tv ? (data.numberOfEpisodes ?? null) : null,
        tvStatus:tv ? (data.tvStatus || '') : '',
        runtime:data.runtime || null,
        tmdbId:data.tmdbId || null,
        directors:Array.isArray(data.directors) ? data.directors : [],
        countries:Array.isArray(data.countries) ? data.countries : [],
        genres:Array.isArray(data.genres) ? data.genres : [],
        overview:data.overview || '',
        posterUrl:data.posterUrl || '',
      },
      personal:{status:null,rating:null,tags:[],shortReview:'',favorite:false},
      watchHistory:[],
      plans:[],
      radar:{
        discovered:false,
        publicReputation:Number.isFinite(Number(data.publicScore)) ? Number(data.publicScore) : null,
        matchScore:null,
        reason:'这部作品来自顶部 TMDb 搜索；加入影视库后会在同一详情页原地解锁个人数据。',
      },
    };
  }

  function currentModel() {
    const context = window.CineverseDetailContext || {};
    if (context.source === 'tmdb' && !context.libraryMovieId) {
      return { collected:false, movie:externalMovie(tmdbSnapshot || context.data || {}) };
    }
    const hashId = (() => {
      const raw = String(location.hash || '').replace(/^#detail\//, '');
      if (!raw || raw === location.hash) return '';
      try { return decodeURIComponent(raw); } catch { return raw; }
    })();
    const movie = movieById(context.libraryMovieId || hashId);
    return movie ? { collected:true, movie } : null;
  }

  function renderStatusActions(movie, collected) {
    const host = $('detailStatusActions');
    if (!host) return;
    const options = movie.mediaType === 'tv'
      ? [['want','想看'],['watching','在看'],['watched','看过']]
      : [['want','想看'],['watched','看过']];
    host.innerHTML = options.map(([value,label]) => `<button type="button" data-detail-status="${value}" class="${collected && movie.personal?.status === value ? 'active' : ''}">${label}</button>`).join('');
  }

  function renderWatchHistory(movie, history, collected) {
    const list = $('detailWatchList');
    if (!list) return;
    list.innerHTML = '';
    if (!collected) {
      list.innerHTML = '<div class="watch-empty">尚未加入影视库。选择「看过」后记录一次真实观看，就会在这里生成第一条记录。</div>';
    } else if (!history.length) {
      list.innerHTML = '<div class="watch-empty">还没有观影记录。看完之后，把这一晚留在这里。</div>';
    } else {
      history.forEach((watch, index) => {
        const seasonMark = isSeasonSourceWatch(movie, watch);
        const row = document.createElement('div');
        row.className = 'watch-entry';
        row.innerHTML = `<div class="watch-date">${esc(formatDate(watch.date))}</div><div><div class="watch-rating">${watch.rating != null ? '★ ' + Number(watch.rating).toFixed(1) : '未评分'}${seasonMark ? ` · 第 ${watch.sourceSeason} 季` : ''}</div><div class="watch-copy">${seasonMark ? '豆瓣分季标记' : esc(watch.venue || '未记录观影场景')}${watch.note ? `<br>${esc(watch.note)}` : ''}</div></div><button title="删除这条记录" data-delete-watch="${index}">×</button>`;
        list.appendChild(row);
      });
    }

    const sessions = history.filter(watch => !isSeasonSourceWatch(movie, watch));
    const seasonMarks = history.filter(watch => isSeasonSourceWatch(movie, watch));
    if ($('detailWatchCount')) $('detailWatchCount').textContent = collected ? String(sessions.length) + (seasonMarks.length ? ` + ${seasonMarks.length}季标记` : '') : '0';
    const asc = [...history].filter(watch => watch.date).sort((a,b) => String(a.date || '9999').localeCompare(String(b.date || '9999')));
    if ($('detailFirstWatch')) $('detailFirstWatch').textContent = collected && asc[0]?.date ? String(asc[0].date).slice(0,7) : '—';
    if ($('detailTotalMinutes')) $('detailTotalMinutes').textContent = !collected || movie.mediaType === 'tv' ? '—' : String((Number(movie.info?.runtime) || 0) * sessions.length);
    const ratings = sessions.slice().reverse().map(item => item.rating).filter(value => value != null);
    if ($('detailTrend')) $('detailTrend').innerHTML = collected && ratings.length
      ? ratings.map(value => `<div class="trend-bar" style="height:${Math.max(12, Number(value) * 9)}%"><span>${Number(value).toFixed(1)}</span></div>`).join('')
      : `<div class="watch-empty" style="width:100%">${collected ? '暂无实际观看评分趋势' : '加入影视库后显示个人评分趋势'}</div>`;
  }

  function renderRelated(movie, collected) {
    const host = $('detailRelated');
    if (!host) return;
    const tags = new Set(movie.personal?.tags || []);
    const directors = new Set(movie.info?.directors || []);
    const related = (state().movies || [])
      .filter(item => !collected || String(item.id) !== String(movie.id))
      .map(item => ({
        movie:item,
        score:(item.personal?.tags || []).filter(tag => tags.has(tag)).length * 2 + (item.info?.directors || []).filter(name => directors.has(name)).length * 3,
      }))
      .filter(item => item.score > 0)
      .sort((a,b) => b.score - a.score || (Number(b.movie.personal?.rating) || 0) - (Number(a.movie.personal?.rating) || 0))
      .slice(0,4);
    host.innerHTML = related.length
      ? related.map(({movie:item}) => `<article class="related-card" data-related-id="${escAttr(item.id)}"><div class="related-poster">${item.info?.posterUrl ? `<img src="${escAttr(item.info.posterUrl)}" alt="${escAttr(item.info.title)} 海报" loading="lazy">` : ''}</div><div class="related-body"><div class="related-title">${esc(item.info?.title)}</div><div class="related-meta">${item.info?.year || '年份未知'} · ${esc((item.info?.directors || [])[0] || (item.mediaType === 'tv' ? '主创未知' : '导演未知'))}</div><div class="related-score">${item.personal?.rating != null ? '★ ' + Number(item.personal.rating).toFixed(1) : '未评分'}</div></div></article>`).join('')
      : `<div class="watch-empty" style="grid-column:1/-1">${collected ? '暂无足够的关联收藏' : '加入影视库后，这里会继续使用同一套关联推荐区域'}</div>`;
  }

  function setPersonalControls(collected, currentPlan) {
    const plan = $('detailPlanBtn');
    const edit = $('detailEditBtn');
    const addWatch = $('detailAddWatchBtn');
    const addWatch2 = $('detailAddWatchBtn2');
    const review = $('detailReview');
    const saveReview = $('detailSaveReview');

    if (plan) {
      plan.disabled = !collected;
      plan.textContent = collected
        ? (currentPlan ? `本月计划 · ${currentPlan.status === 'completed' ? '已完成' : currentPlan.status === 'deferred' ? '已延期' : '计划中'}` : '＋ 加入本月计划')
        : '加入影视库后可加入计划';
    }
    if (edit) {
      edit.disabled = !collected;
      edit.textContent = collected ? '✎ 编辑资料' : '加入影视库后可编辑';
    }
    for (const button of [addWatch, addWatch2]) {
      if (!button) continue;
      button.disabled = !collected;
      if (!collected) button.title = '请使用上方「看过」按钮记录第一次观看';
      else button.removeAttribute('title');
    }
    if (review) {
      review.disabled = !collected;
      review.placeholder = collected ? '' : '加入影视库后可记录个人影评';
    }
    if (saveReview) saveReview.disabled = !collected;
  }

  function render(model) {
    if (!model?.movie || !$('detailView')) return;
    const { collected, movie } = model;
    const info = movie.info || {};
    const personal = movie.personal || {};
    const tv = movie.mediaType === 'tv';
    const history = [...(movie.watchHistory || [])].sort((a,b) => String(b.date || '').localeCompare(String(a.date || '')));
    const plans = movie.plans || [];
    const currentPlan = collected ? plans.find(plan => plan.month === currentMonth()) : null;
    const radar = movie.radar || {};

    document.documentElement.classList.remove('cv-search-detail-preview');
    $('globalSearchPreviewNote')?.remove();
    const view = $('detailView');
    view.dataset.detailRenderer = 'unified-v2';
    view.dataset.detailMode = collected ? 'library' : 'tmdb';

    if ($('detailTitle')) $('detailTitle').textContent = info.title || (tv ? '未命名剧集' : '未命名电影');
    if ($('detailOriginal')) $('detailOriginal').textContent = [info.originalTitle, info.year].filter(Boolean).join(' · ') || String(info.year || '');
    if ($('detailCreatorLabel')) $('detailCreatorLabel').textContent = tv ? '主创' : '导演';
    if ($('detailDirectors')) $('detailDirectors').textContent = (info.directors || []).join(' / ') || (collected ? '未知' : '待载入');
    if ($('detailCountries')) $('detailCountries').textContent = (info.countries || []).join(' / ') || (collected ? '未知' : '待载入');
    if ($('detailGenres')) $('detailGenres').textContent = (info.genres || []).join(' / ') || (collected ? '待补全' : '待载入');
    if ($('detailRuntimeLabel')) $('detailRuntimeLabel').textContent = tv ? '单集时长' : '片长';
    if ($('detailRuntime')) $('detailRuntime').textContent = info.runtime ? `${info.runtime} 分钟` : '未知';
    if ($('detailReleaseLabel')) $('detailReleaseLabel').textContent = tv ? '首播' : '上映';
    if ($('detailRelease')) $('detailRelease').textContent = (tv ? (info.firstAirDate || info.releaseDate) : info.releaseDate) || info.year || '未知';
    if ($('detailMediaType')) $('detailMediaType').textContent = mediaTypeLabel(movie);
    $('detailSeriesFact')?.classList.toggle('hidden', !tv);
    if ($('detailSeriesMeta')) $('detailSeriesMeta').textContent = tv
      ? [info.numberOfSeasons != null ? `${info.numberOfSeasons}季` : null, info.numberOfEpisodes != null ? `${info.numberOfEpisodes}集` : null, info.lastAirDate ? `${String(info.lastAirDate).slice(0,4)} ${info.tvStatus || ''}`.trim() : info.tvStatus].filter(Boolean).join(' · ') || (collected ? '待补全' : '待载入')
      : '—';
    if ($('detailTmdb')) $('detailTmdb').textContent = info.tmdbId || '未关联';
    if ($('detailOverview')) $('detailOverview').textContent = info.overview || (collected ? `暂无简介。可在编辑${tv ? '剧集' : '电影'}时通过 TMDb 搜索补全资料。` : '正在读取 TMDb 详情…');

    const poster = $('detailPoster');
    if (poster) {
      poster.classList.toggle('has-image', Boolean(info.posterUrl));
      poster.innerHTML = info.posterUrl
        ? `<img src="${escAttr(info.posterUrl)}" alt="${escAttr(info.title)} 海报">`
        : `<div class="poster-title">${esc(info.title || mediaTypeLabel(movie))}</div>`;
    }

    $('detailFavorite')?.classList.toggle('on', collected && Boolean(personal.favorite));
    renderStatusActions(movie, collected);
    setPersonalControls(collected, currentPlan);

    if ($('detailTags')) $('detailTags').innerHTML = collected
      ? ((personal.tags || []).length ? (personal.tags || []).map(tag => `<span>${esc(tag)}</span>`).join('') : '<span>尚未添加个人标签</span>')
      : '<span>加入影视库后可添加个人标签</span>';
    if ($('detailRating')) $('detailRating').textContent = collected && personal.rating != null ? Number(personal.rating).toFixed(1) : '—';
    if ($('detailStars')) {
      const count = collected && personal.rating != null ? Math.max(1, Math.round(Number(personal.rating) / 2)) : 0;
      $('detailStars').textContent = count ? '★★★★★'.slice(0,count) + '☆☆☆☆☆'.slice(count) : '☆☆☆☆☆';
    }
    if ($('detailLastWatch')) $('detailLastWatch').textContent = collected && history[0]?.date ? `最近观看：${formatDate(history[0].date)}` : (collected ? '尚未记录观看日期' : '尚未加入影视库');
    if ($('detailPlanMeta')) $('detailPlanMeta').textContent = collected && currentPlan ? `${currentMonth()} · ${currentPlan.status === 'completed' ? '已完成' : currentPlan.status === 'deferred' ? '延期' : '计划中'}` : (collected ? '未加入本月计划' : '加入影视库后可创建计划');

    if ($('detailRadarBadge')) $('detailRadarBadge').textContent = collected ? (radar.discovered ? '✦ 雷达发现' : '电影雷达') : 'TMDb 浏览';
    if ($('detailRadarDate')) $('detailRadarDate').textContent = collected ? (radar.discoveredAt || (radar.discovered ? '已记录' : '—')) : '—';
    if ($('detailPublicScore')) $('detailPublicScore').textContent = radar.publicReputation != null ? Number(radar.publicReputation).toFixed(1) : '—';
    if ($('detailMatchScore')) $('detailMatchScore').textContent = collected && radar.matchScore != null ? `${radar.matchScore}%` : '—';
    if ($('detailRadarReason')) $('detailRadarReason').textContent = collected ? (radar.discovered ? (radar.reason || '这部作品曾通过你的电影雷达进入收藏。') : '尚未通过电影雷达发现这部作品。') : radar.reason;

    if ($('detailReview')) $('detailReview').value = collected ? (personal.shortReview || '') : '';
    renderWatchHistory(movie, history, collected);
    renderRelated(movie, collected);
  }

  function renderCurrent() {
    renderQueued = false;
    const view = $('detailView');
    if (!view || view.classList.contains('hidden')) return;
    render(currentModel());
  }

  function queueRender() {
    if (renderQueued) return;
    renderQueued = true;
    queueMicrotask(renderCurrent);
  }

  function wrapDetailApi() {
    const original = window.CineverseLibraryDetail;
    if (!original || original.__unifiedRendererV2) return Boolean(original);
    const wrapped = {
      ...original,
      setDetailContext(next) {
        const result = original.setDetailContext(next);
        if (next?.source === 'tmdb' && !next?.libraryMovieId) {
          const publicScore = Number($('detailPublicScore')?.textContent);
          tmdbSnapshot = {
            ...(next.data || {}),
            ...(Number.isFinite(publicScore) ? { publicScore } : {}),
          };
        } else {
          tmdbSnapshot = null;
        }
        queueRender();
        return result;
      },
      openLibraryDetail(id) {
        tmdbSnapshot = null;
        return original.openLibraryDetail(id);
      },
    };
    Object.defineProperty(wrapped, '__unifiedRendererV2', { value:true });
    window.CineverseLibraryDetail = Object.freeze(wrapped);
    return true;
  }

  function boot() {
    wrapDetailApi();
    window.addEventListener('cineverse:detail-library-opened', () => {
      tmdbSnapshot = null;
      queueRender();
    });
    window.addEventListener('movie-collection:data-saved', () => {
      const context = window.CineverseDetailContext || {};
      if (context.source !== 'tmdb' || context.libraryMovieId) queueRender();
    });
    window.addEventListener('hashchange', queueRender);
    queueRender();
    window.CineverseUnifiedDetailRenderer = Object.freeze({ renderCurrent, version:2 });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();