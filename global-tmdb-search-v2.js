(() => {
  'use strict';
  if (/(?:^|\/)(?:admin|admin-console)\.html$/i.test(location.pathname)) return;

  const APP_KEY = 'movie-collection-v2';
  const PROXY_URL = window.CineverseConfig.endpoints.tmdbProxy;
  const LIMIT = 6;
  const PLACEHOLDER = '搜索电影、剧集，点击Enter确认';
  const bundleCache = new Map();

  let requestSeq = 0;
  let lastResults = [];
  let activeIndex = -1;
  let previewState = null;
  let busyAction = false;

  const $ = id => document.getElementById(id);
  const safeParse = raw => { try { return JSON.parse(raw); } catch { return null; } };
  const readState = () => safeParse(localStorage.getItem(APP_KEY)) || { movies: [], settings: {} };
  const normalize = value => String(value || '')
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[\s·・:：,，.。!！?？'"“”‘’()（）\[\]【】_-]+/g, '');
  const mediaTypeOf = item => item?.media_type === 'tv' || item?.mediaType === 'tv' ? 'tv' : 'movie';
  const titleOf = item => mediaTypeOf(item) === 'tv' ? (item?.name || item?.title || item?.info?.title || '') : (item?.title || item?.name || item?.info?.title || '');
  const originalTitleOf = item => mediaTypeOf(item) === 'tv' ? (item?.original_name || item?.original_title || item?.info?.originalTitle || '') : (item?.original_title || item?.original_name || item?.info?.originalTitle || '');
  const dateOf = item => String(item?.release_date || item?.first_air_date || item?.info?.releaseDate || item?.info?.firstAirDate || '');
  const yearOf = item => String(item?.info?.year || dateOf(item)).slice(0,4);

  function toast(message, duration = 3600) {
    const el = $('toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove('show'), duration);
  }

  function injectStyle() {
    if ($('globalTmdbSearchStyleV2')) return;
    const style = document.createElement('style');
    style.id = 'globalTmdbSearchStyleV2';
    style.textContent = `
      #quickAdd{display:none!important}
      .topbar{grid-template-columns:minmax(0,1fr) auto!important;gap:14px!important}
      .topbar>.cv-global-search-wrap{min-width:0;width:100%;grid-column:1}
      .topbar>.cv-global-search-wrap+div:not(.top-actions){display:none!important}
      .topbar>.top-actions{grid-column:2;justify-self:end}
      .cv-global-search-wrap{position:relative;min-width:0;width:100%}
      .cv-global-search-wrap>.search{width:100%}
      .cv-global-search-drop{position:absolute;left:0;right:0;top:calc(100% + 8px);z-index:120;border:1px solid rgba(161,179,255,.2);border-radius:16px;background:linear-gradient(160deg,rgba(10,21,48,.99),rgba(5,13,31,.997));box-shadow:0 24px 60px rgba(0,0,0,.44);padding:6px;max-height:min(72vh,560px);overflow:auto}
      .cv-global-search-drop.hidden{display:none!important}
      .cv-global-search-status{padding:12px 13px;color:#8e9ab7;font-size:11px;line-height:1.6}
      .cv-global-search-status.bad{color:#ff9aae}
      .cv-global-search-result{display:grid;grid-template-columns:46px minmax(0,1fr) auto;gap:11px;align-items:center;padding:9px;border-radius:12px;transition:.16s ease;cursor:pointer}
      .cv-global-search-result:hover,.cv-global-search-result.active{background:rgba(126,105,238,.12)}
      .cv-global-search-poster{width:46px;height:64px;border-radius:8px;overflow:hidden;background:linear-gradient(150deg,rgba(94,111,174,.28),rgba(26,40,77,.42));display:grid;place-items:center;color:#66738f;font-size:9px;border:1px solid rgba(161,179,255,.1)}
      .cv-global-search-poster img{width:100%;height:100%;object-fit:cover;display:block}
      .cv-global-search-main{min-width:0}
      .cv-global-search-title{display:flex;align-items:center;gap:7px;min-width:0;color:#eef1fb;font-size:12px;font-weight:600}
      .cv-global-search-title-text{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .cv-global-search-kind{flex:0 0 auto;border:1px solid rgba(161,179,255,.16);border-radius:999px;padding:2px 6px;color:#9da9c8;font-size:9px;font-weight:500}
      .cv-global-search-kind.tv{color:#86d4ff;border-color:rgba(100,167,255,.22)}
      .cv-global-search-meta{margin-top:4px;color:#7f8aaa;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .cv-global-search-local{margin-top:3px;color:#7fd9ad;font-size:9px}
      .cv-global-search-actions{display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end;max-width:235px}
      .cv-global-search-action{height:30px;padding:0 9px;border-radius:9px;border:1px solid rgba(161,179,255,.16);background:rgba(18,31,67,.74);color:#dce2f5;font-size:10px;white-space:nowrap}
      .cv-global-search-action:hover{border-color:rgba(159,124,255,.42);background:rgba(111,97,244,.18)}
      .cv-global-search-action.active{color:#d9fff0;border-color:rgba(98,210,162,.34);background:rgba(98,210,162,.12)}
      .cv-global-search-action.watch{color:#ffe5ec;border-color:rgba(255,127,154,.25)}
      .cv-global-search-action:disabled{opacity:.5;cursor:wait}
      .cv-global-search-footer{padding:7px 10px 6px;border-top:1px solid rgba(161,179,255,.08);color:#66738f;font-size:9px;text-align:right}
      @media(max-width:780px){
        .topbar{grid-template-columns:minmax(0,1fr) auto!important;gap:9px!important}
        .topbar .profile .name,.topbar .profile .role{display:none}
        .cv-global-search-drop{position:fixed;left:12px;right:12px;top:64px;max-height:72vh}
        .cv-global-search-result{grid-template-columns:40px minmax(0,1fr);align-items:start}
        .cv-global-search-poster{width:40px;height:56px}
        .cv-global-search-actions{grid-column:1/-1;justify-content:flex-start;padding-left:51px;max-width:none}
      }
    `;
    document.head.appendChild(style);
  }

  function removeQuickAdd() {
    const btn = $('quickAdd');
    if (btn?.isConnected) btn.remove();
  }

  function ensureUi() {
    const input = $('globalSearch');
    const search = input?.closest('.search');
    if (!input || !search) return null;
    input.placeholder = PLACEHOLDER;
    input.autocomplete = 'off';
    input.setAttribute('aria-autocomplete','list');
    input.setAttribute('aria-expanded','false');

    let wrap = search.parentElement?.classList.contains('cv-global-search-wrap') ? search.parentElement : null;
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'cv-global-search-wrap';
      search.parentNode.insertBefore(wrap, search);
      wrap.appendChild(search);
    }

    let drop = $('globalTmdbSearchDrop');
    if (!drop) {
      drop = document.createElement('div');
      drop.id = 'globalTmdbSearchDrop';
      drop.className = 'cv-global-search-drop hidden';
      drop.setAttribute('role','listbox');
      wrap.appendChild(drop);
    }
    input.setAttribute('aria-controls',drop.id);
    return { input, search, wrap, drop };
  }

  async function tmdbFetch(path, params = {}) {
    const response = await fetch(PROXY_URL, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ path, params })
    });
    const res = await window.MovieTmdbAliasMatch?.enrich(response,path,params) || response;
    let body = null;
    try { body = await res.json(); } catch {}
    if (!res.ok) throw new Error(body?.message || body?.error || `TMDb 请求失败（${res.status}）`);
    return body || {};
  }

  function localMatch(result, state = readState()) {
    const movies = Array.isArray(state.movies) ? state.movies : [];
    const type = mediaTypeOf(result);
    const tmdbId = Number(result?.id ?? result?.info?.tmdbId);
    if (tmdbId) {
      const exact = movies.find(movie => mediaTypeOf(movie) === type && Number(movie?.info?.tmdbId) === tmdbId);
      if (exact) return exact;
    }
    const rt = normalize(titleOf(result));
    const ro = normalize(originalTitleOf(result));
    const ry = yearOf(result);
    return movies.find(movie => {
      if (mediaTypeOf(movie) !== type) return false;
      const mt = normalize(movie?.info?.title);
      const mo = normalize(movie?.info?.originalTitle);
      const titleMatch = (rt && [mt,mo].includes(rt)) || (ro && [mt,mo].includes(ro));
      if (!titleMatch) return false;
      const my = yearOf(movie);
      return !ry || !my || ry === my;
    }) || null;
  }

  function localStatus(movie) {
    const status = movie?.personal?.status;
    if (status === 'watched') return '看过';
    if (status === 'watching') return '在看';
    return '想看';
  }

  function setExpanded(value) {
    $('globalSearch')?.setAttribute('aria-expanded', value ? 'true' : 'false');
  }

  function closeDrop() {
    const drop = $('globalTmdbSearchDrop');
    if (drop) drop.classList.add('hidden');
    activeIndex = -1;
    setExpanded(false);
  }

  function showStatus(text, bad = false) {
    const ui = ensureUi();
    if (!ui) return;
    ui.drop.innerHTML = `<div class="cv-global-search-status${bad?' bad':''}"></div>`;
    ui.drop.firstElementChild.textContent = text;
    ui.drop.classList.remove('hidden');
    activeIndex = -1;
    setExpanded(true);
  }

  function makePoster(result) {
    const poster = document.createElement('div');
    poster.className = 'cv-global-search-poster';
    if (result?.poster_path) {
      const img = document.createElement('img');
      img.src = `https://image.tmdb.org/t/p/w92${result.poster_path}`;
      img.alt = '';
      img.loading = 'lazy';
      poster.appendChild(img);
    } else poster.textContent = '无海报';
    return poster;
  }

  function actionButton(label, result, status, active = false) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `cv-global-search-action${active?' active':''}${status==='watched'?' watch':''}`;
    btn.textContent = label;
    btn.dataset.tmdbSearchStatus = status;
    btn.dataset.tmdbSearchId = String(result.id);
    btn.dataset.tmdbSearchType = mediaTypeOf(result);
    return btn;
  }

  function renderResults(results = lastResults) {
    const ui = ensureUi();
    if (!ui) return;
    ui.drop.innerHTML = '';
    const state = readState();
    if (!results.length) {
      showStatus('没有找到匹配的电影或剧集，可以尝试中文名、原名或其他关键词。', true);
      return;
    }

    results.forEach((result,index) => {
      const local = localMatch(result,state);
      const row = document.createElement('div');
      row.className = 'cv-global-search-result';
      row.dataset.searchResultIndex = String(index);
      row.setAttribute('role','option');
      row.setAttribute('aria-selected','false');
      row.appendChild(makePoster(result));

      const main = document.createElement('div');
      main.className = 'cv-global-search-main';
      const title = document.createElement('div');
      title.className = 'cv-global-search-title';
      const kind = document.createElement('span');
      kind.className = `cv-global-search-kind ${mediaTypeOf(result)}`;
      kind.textContent = mediaTypeOf(result)==='tv'?'剧集':'电影';
      const titleText = document.createElement('span');
      titleText.className = 'cv-global-search-title-text';
      titleText.textContent = titleOf(result) || '未命名作品';
      title.append(kind,titleText);

      const meta = document.createElement('div');
      meta.className = 'cv-global-search-meta';
      const original = originalTitleOf(result);
      meta.textContent = [original && normalize(original)!==normalize(titleOf(result)) ? original : '', yearOf(result)||'年份未知', `TMDb ${result.id}`].filter(Boolean).join(' · ');
      main.append(title,meta);
      if (local) {
        const note = document.createElement('div');
        note.className = 'cv-global-search-local';
        note.textContent = `已在影视库 · ${localStatus(local)}`;
        main.appendChild(note);
      }
      row.appendChild(main);

      const actions = document.createElement('div');
      actions.className = 'cv-global-search-actions';
      const current = local?.personal?.status || '';
      actions.appendChild(actionButton('想看', result, 'want', current==='want'));
      if (mediaTypeOf(result)==='tv') actions.appendChild(actionButton('在看', result, 'watching', current==='watching'));
      actions.appendChild(actionButton('看过', result, 'watched', current==='watched'));
      row.appendChild(actions);
      ui.drop.appendChild(row);
    });

    const footer = document.createElement('div');
    footer.className = 'cv-global-search-footer';
    footer.textContent = `点击作品查看详情 · 显示前 ${results.length} 条 · 数据来自 TMDb`;
    ui.drop.appendChild(footer);
    ui.drop.classList.remove('hidden');
    activeIndex = -1;
    setExpanded(true);
  }

  function resultForAction(button) {
    const id = Number(button?.dataset?.tmdbSearchId);
    const type = button?.dataset?.tmdbSearchType;
    return lastResults.find(item => Number(item?.id)===id && mediaTypeOf(item)===type) || null;
  }

  function updateActive(delta) {
    const rows = [...document.querySelectorAll('#globalTmdbSearchDrop .cv-global-search-result')];
    if (!rows.length) return;
    activeIndex = (activeIndex + delta + rows.length) % rows.length;
    rows.forEach((row,index) => {
      const active = index===activeIndex;
      row.classList.toggle('active',active);
      row.setAttribute('aria-selected',active?'true':'false');
    });
    rows[activeIndex]?.scrollIntoView({block:'nearest'});
  }

  async function runSearch() {
    const ui = ensureUi();
    if (!ui) return;
    const query = ui.input.value.trim();
    if (!query) { closeDrop(); return; }
    const seq = ++requestSeq;
    showStatus('正在搜索 TMDb…');
    try {
      const state = readState();
      const language = state?.settings?.tmdbLanguage || 'zh-CN';
      const data = await tmdbFetch('/search/multi',{ query, include_adult:false, language, page:1 });
      if (seq !== requestSeq) return;
      lastResults = (data.results || []).filter(item => ['movie','tv'].includes(item?.media_type)).slice(0,LIMIT);
      renderResults();
    } catch (error) {
      if (seq !== requestSeq) return;
      showStatus(String(error?.message || error || 'TMDb 搜索失败，请稍后重试。'), true);
    }
  }

  function countryNames(detail) {
    const codes = (detail?.production_countries || []).map(x => x?.iso_3166_1).filter(Boolean);
    if (!codes.length && Array.isArray(detail?.origin_country)) codes.push(...detail.origin_country);
    if (!codes.length) return (detail?.production_countries || []).map(x => x?.name).filter(Boolean);
    try {
      const dn = new Intl.DisplayNames(['zh-CN'],{type:'region'});
      return codes.map(code => dn.of(code) || code);
    } catch { return codes; }
  }

  async function fetchBundle(result) {
    const type = mediaTypeOf(result);
    const key = `${type}:${result.id}`;
    if (bundleCache.has(key)) return bundleCache.get(key);
    const language = readState()?.settings?.tmdbLanguage || 'zh-CN';
    const detailPath = `/${type}/${result.id}`;
    const creditsPath = type==='tv' ? `/tv/${result.id}/aggregate_credits` : `/movie/${result.id}/credits`;
    const promise = Promise.all([
      tmdbFetch(detailPath,{language}),
      tmdbFetch(creditsPath,{language})
    ]).then(([detail,credits]) => ({ type, detail, credits, result }));
    bundleCache.set(key,promise);
    try { return await promise; }
    catch (err) { bundleCache.delete(key); throw err; }
  }

  function bundleCreators(bundle) {
    if (bundle.type==='tv') {
      const creators = (bundle.detail?.created_by || []).map(x => x?.name).filter(Boolean);
      if (creators.length) return creators;
      return (bundle.credits?.crew || []).filter(x => (x?.jobs || []).some(j => ['Director','Executive Producer'].includes(j?.job))).map(x => x?.name).filter(Boolean).slice(0,6);
    }
    return (bundle.credits?.crew || []).filter(x => x?.job==='Director').map(x => x?.name).filter(Boolean);
  }

  function bundleRuntime(bundle) {
    if (bundle.type==='tv') return Number(bundle.detail?.episode_run_time?.[0]) || null;
    return Number(bundle.detail?.runtime) || null;
  }

  function bundleData(bundle) {
    const { type, detail, result } = bundle;
    const releaseDate = type==='tv' ? (detail.first_air_date || dateOf(result)) : (detail.release_date || dateOf(result));
    return {
      mediaType:type,
      tmdbId:Number(detail.id || result.id) || null,
      title:type==='tv' ? (detail.name || titleOf(result)) : (detail.title || titleOf(result)),
      originalTitle:type==='tv' ? (detail.original_name || originalTitleOf(result)) : (detail.original_title || originalTitleOf(result)),
      year:Number(String(releaseDate || '').slice(0,4)) || null,
      releaseDate,
      firstAirDate:type==='tv' ? releaseDate : '',
      lastAirDate:type==='tv' ? (detail.last_air_date || '') : '',
      numberOfSeasons:type==='tv' ? (detail.number_of_seasons ?? null) : null,
      numberOfEpisodes:type==='tv' ? (detail.number_of_episodes ?? null) : null,
      tvStatus:type==='tv' ? (detail.status || '') : '',
      runtime:bundleRuntime(bundle),
      directors:bundleCreators(bundle),
      countries:countryNames(detail),
      genres:(detail.genres || []).map(item => item?.name).filter(Boolean),
      overview:detail.overview || '',
      posterUrl:detail.poster_path ? `https://image.tmdb.org/t/p/w500${detail.poster_path}` : (result.poster_path ? `https://image.tmdb.org/t/p/w500${result.poster_path}` : ''),
      publicScore:Number.isFinite(Number(detail.vote_average ?? result.vote_average)) ? Number(detail.vote_average ?? result.vote_average) : null
    };
  }

  function resultData(result) {
    const type = mediaTypeOf(result);
    const releaseDate = dateOf(result);
    return {
      mediaType:type,
      tmdbId:Number(result?.id) || null,
      title:titleOf(result),
      originalTitle:originalTitleOf(result),
      year:Number(String(releaseDate || '').slice(0,4)) || null,
      releaseDate,
      firstAirDate:type==='tv' ? releaseDate : '',
      lastAirDate:'',
      numberOfSeasons:null,
      numberOfEpisodes:null,
      tvStatus:'',
      runtime:null,
      directors:[],
      countries:[],
      genres:[],
      overview:'',
      posterUrl:result?.poster_path ? `https://image.tmdb.org/t/p/w500${result.poster_path}` : '',
      publicScore:Number.isFinite(Number(result?.vote_average)) ? Number(result.vote_average) : null
    };
  }

  function detailApi() {
    const api = window.CineverseLibraryDetail;
    if (!api) throw new Error('统一详情数据层不可用');
    return api;
  }

  async function applyStatus(result,status,sourceButton) {
    if (!result || busyAction) return;
    busyAction = true;
    if (sourceButton) { sourceButton.disabled = true; sourceButton.textContent = status==='watched'?'载入…':'保存中…'; }
    try {
      const bundle = await fetchBundle(result);
      const data = bundleData(bundle);
      const api = detailApi();
      if (status==='watched') {
        closeDrop();
        api.openWatchRecord(data);
        return;
      }
      const local = api.findLibraryMovie(data);
      const movie = local ? api.setLibraryStatus(local.id,status) : api.addTmdbMovieToLibrary(data,{status,favorite:false});
      if (previewState) upgradePreview(movie);
      toast(`《${titleOf(result)}》已设为「${status==='watching'?'在看':'想看'}」`);
      renderResults();
      return movie;
    } catch (err) {
      toast(`保存失败：${err?.message || err}`);
    } finally {
      busyAction = false;
      if (sourceButton?.isConnected) sourceButton.disabled = false;
    }
  }

  function visiblePageId() {
    return [...document.querySelectorAll('.page-view')].find(el => !el.classList.contains('hidden'))?.id || 'homeView';
  }

  async function openPreview(result) {
    const local = localMatch(result);
    previewState = { result, previousViewId:visiblePageId(), libraryMovieId:local?.id || null };
    document.documentElement.dataset.detailReturnSource='search';
    closeDrop();
    if (local) {
      detailApi().openLibraryDetail(local.id);
      if ($('detailBack')) $('detailBack').textContent='‹ 返回搜索结果';
      return;
    }
    detailApi().openExternalDetail(resultData(result));
    if ($('detailBack')) $('detailBack').textContent='‹ 返回搜索结果';
    try {
      const bundle = await fetchBundle(result);
      if (previewState?.result?.id===result.id && mediaTypeOf(previewState.result)===mediaTypeOf(result)) {
        previewState.bundle=bundle;
        detailApi().openExternalDetail(bundleData(bundle));
        if ($('detailBack')) $('detailBack').textContent='‹ 返回搜索结果';
      }
    } catch (err) {
      if (previewState?.result?.id===result.id && mediaTypeOf(previewState.result)===mediaTypeOf(result)) {
        detailApi().openExternalDetail({...resultData(result),overview:`TMDb 详情读取失败：${err?.message || err}`});
        if ($('detailBack')) $('detailBack').textContent='‹ 返回搜索结果';
      }
    }
  }

  function upgradePreview(movie) {
    if (!movie) return;
    if (previewState) previewState.libraryMovieId = movie.id;
    detailApi().openLibraryDetail(movie.id);
    if ($('detailBack')) $('detailBack').textContent='‹ 返回搜索结果';
  }

  function closePreview() {
    if (!previewState) return false;
    const prev = previewState;
    previewState = null;
    delete document.documentElement.dataset.detailReturnSource;
    const back = $('detailBack');
    if (back) back.textContent = '‹ 返回影视库';
    document.querySelectorAll('.page-view').forEach(view => view.classList.add('hidden'));
    const target = $(prev.previousViewId) || $('homeView');
    target?.classList.remove('hidden');
    const map = {homeView:'home',libraryView:'library',matchView:'match',radarView:'radar',planView:'plan',watchedView:'watched',statsView:'stats',settingsView:'settings'};
    const viewKey = map[prev.previousViewId] || 'library';
    history.replaceState(null,'',`#${viewKey}`);
    document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('active',a.dataset.view===viewKey));
    if (lastResults.length) renderResults();
    return true;
  }

  function handleRowClick(event,row) {
    if (event.target.closest('.cv-global-search-action')) return;
    const index = Number(row.dataset.searchResultIndex);
    const result = lastResults[index];
    if (result) openPreview(result);
  }

  function boot() {
    injectStyle();
    removeQuickAdd();
    ensureUi();

    const input = $('globalSearch');
    input?.addEventListener('keydown', event => {
      if (event.key==='ArrowDown' && !$('globalTmdbSearchDrop')?.classList.contains('hidden')) {
        event.preventDefault(); event.stopImmediatePropagation(); updateActive(1); return;
      }
      if (event.key==='ArrowUp' && !$('globalTmdbSearchDrop')?.classList.contains('hidden')) {
        event.preventDefault(); event.stopImmediatePropagation(); updateActive(-1); return;
      }
      if (event.key==='Escape') {
        closeDrop(); return;
      }
      if (event.key!=='Enter') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (activeIndex>=0 && lastResults[activeIndex]) openPreview(lastResults[activeIndex]);
      else runSearch();
    }, true);
    input?.addEventListener('input',() => { requestSeq++; activeIndex=-1; closeDrop(); }, true);
  }

  document.addEventListener('click', event => {
    if (previewState && event.target.closest?.('#detailFavorite')) {
      event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
      busyAction=true;
      fetchBundle(previewState.result).then(bundle=>{
        const movie=detailApi().addTmdbMovieToLibrary(bundleData(bundle),{status:'want',favorite:true});
        upgradePreview(movie);toast(`《${titleOf(previewState?.result || bundle.result)}》已加入想看并点亮星标`);
      }).catch(err=>toast(`保存失败：${err?.message || err}`)).finally(()=>{busyAction=false});
      return;
    }
    const detailStatus = previewState ? event.target.closest?.('#detailStatusActions [data-detail-status]') : null;
    if (detailStatus) {
      event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
      applyStatus(previewState.result,detailStatus.dataset.detailStatus,detailStatus);
      return;
    }
    const action = event.target.closest?.('[data-tmdb-search-status]');
    if (action) {
      event.preventDefault();
      event.stopPropagation();
      const result = resultForAction(action);
      if (result) applyStatus(result,action.dataset.tmdbSearchStatus,action);
      return;
    }

    const row = event.target.closest?.('#globalTmdbSearchDrop .cv-global-search-result');
    if (row) {
      event.preventDefault();
      event.stopPropagation();
      handleRowClick(event,row);
      return;
    }

    if (previewState && event.target.closest?.('#detailBack')) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      closePreview();
      return;
    }

    const drop = $('globalTmdbSearchDrop');
    if (drop && !drop.classList.contains('hidden') && !event.target.closest('.cv-global-search-wrap')) closeDrop();
  }, true);

  window.addEventListener('cineverse:detail-library-opened',event=>{
    if (!previewState) return;
    previewState.libraryMovieId=event.detail?.libraryMovieId||null;
    if ($('detailBack')) $('detailBack').textContent='‹ 返回搜索结果';
  });



  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
