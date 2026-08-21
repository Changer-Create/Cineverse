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
  let pendingExternalWatch = null;
  let replayingNativeWatch = false;
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
  const localToday = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

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
      html.cv-search-silent-add #movieModal{visibility:hidden!important;pointer-events:none!important}
      html.cv-search-detail-preview #detailFavorite,
      html.cv-search-detail-preview #detailView .detail-actions,
      html.cv-search-detail-preview #detailView .detail-section,
      html.cv-search-detail-preview #detailView .detail-bottom{display:none!important}
      .cv-search-preview-note{margin:10px 0 0;padding:10px 12px;border:1px solid rgba(159,124,255,.2);border-radius:12px;background:rgba(117,86,220,.08);color:#aeb9d6;font-size:11px;line-height:1.7}
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

  function setValue(id,value) {
    const el = $(id);
    if (el) el.value = value == null ? '' : String(value);
  }

  function fillMovieModal(bundle,status) {
    const { type, detail, result } = bundle;
    const title = type==='tv' ? (detail.name || titleOf(result)) : (detail.title || titleOf(result));
    const original = type==='tv' ? (detail.original_name || originalTitleOf(result)) : (detail.original_title || originalTitleOf(result));
    const release = type==='tv' ? (detail.first_air_date || dateOf(result)) : (detail.release_date || dateOf(result));
    const poster = detail.poster_path ? `https://image.tmdb.org/t/p/w500${detail.poster_path}` : (result.poster_path ? `https://image.tmdb.org/t/p/w500${result.poster_path}` : '');

    const typeInput = $('movieMediaTypeInput');
    if (typeInput) {
      typeInput.value = type;
      typeInput.dispatchEvent(new Event('change',{bubbles:true}));
    }
    setValue('movieTitleInput',title);
    setValue('movieOriginalTitleInput',original);
    setValue('movieYearInput',String(release || '').slice(0,4));
    setValue('movieReleaseDateInput',release || '');
    setValue('movieLastAirDateInput',type==='tv' ? (detail.last_air_date || '') : '');
    setValue('movieRuntimeInput',bundleRuntime(bundle) || '');
    setValue('movieSeasonsInput',type==='tv' ? (detail.number_of_seasons ?? '') : '');
    setValue('movieEpisodesInput',type==='tv' ? (detail.number_of_episodes ?? '') : '');
    setValue('movieTvStatusInput',type==='tv' ? (detail.status || '') : '');
    setValue('movieTmdbIdInput',detail.id || result.id);
    setValue('movieDirectorInput',bundleCreators(bundle).join(' / '));
    setValue('movieCountryInput',countryNames(detail).join(' / '));
    setValue('movieGenresInput',(detail.genres || []).map(x => x?.name).filter(Boolean).join(' / '));
    setValue('movieOverviewInput',detail.overview || '');
    setValue('moviePosterInput',poster);
    setValue('movieRatingInput','');
    setValue('movieTagsInput','');
    setValue('tmdbMovieQuery',title);
    const statusInput = $('movieStatusInput');
    if (statusInput) statusInput.value = status;
  }

  function triggerCoreEdit(movieId) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.editId = movieId;
    btn.style.display = 'none';
    document.body.appendChild(btn);
    btn.click();
    btn.remove();
  }

  function triggerCoreDetail(movieId) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.openDetail = movieId;
    btn.style.display = 'none';
    document.body.appendChild(btn);
    btn.click();
    btn.remove();
  }

  async function waitForModal(open, timeout = 2500) {
    const started = Date.now();
    while (Date.now()-started < timeout) {
      if (Boolean($('movieModal')?.open) === open) return true;
      await wait(20);
    }
    return false;
  }

  async function createOrUpdateViaCore(result,status,bundle = null) {
    let local = localMatch(result);
    document.documentElement.classList.add('cv-search-silent-add');
    try {
      if (local) {
        if (local.personal?.status === status) return local;
        triggerCoreEdit(local.id);
        await waitForModal(true);
        const statusInput = $('movieStatusInput');
        if (statusInput) statusInput.value = status;
      } else {
        const add = $('addMovieBtn');
        if (!add) throw new Error('添加影片入口不可用');
        const resolved = bundle || await fetchBundle(result);
        add.click();
        await waitForModal(true);
        fillMovieModal(resolved,status);
      }
      const form = $('movieForm');
      if (!form) throw new Error('添加影片表单不可用');
      form.requestSubmit();
      await waitForModal(false);
      await wait(30);
      local = localMatch(result);
      if (!local) throw new Error('影片保存后未能在影视库中找到');
      return local;
    } finally {
      document.documentElement.classList.remove('cv-search-silent-add');
    }
  }

  async function applyStatus(result,status,sourceButton) {
    if (!result || busyAction) return;
    if (status==='watched') {
      const local = localMatch(result);
      if (local) {
        closeDrop();
        triggerCoreDetail(local.id);
        await wait(20);
        $('detailAddWatchBtn')?.click();
      } else {
        busyAction = true;
        if (sourceButton) { sourceButton.disabled = true; sourceButton.textContent = '载入…'; }
        try {
          const bundle = await fetchBundle(result);
          pendingExternalWatch = { result, bundle };
          closeDrop();
          openExternalWatch(result);
        } catch (err) {
          toast(`无法打开观看记录：${err?.message || err}`);
        } finally {
          busyAction = false;
          if (sourceButton?.isConnected) { sourceButton.disabled = false; sourceButton.textContent = '看过'; }
        }
      }
      return;
    }

    busyAction = true;
    if (sourceButton) { sourceButton.disabled = true; sourceButton.textContent = '保存中…'; }
    try {
      const local = await createOrUpdateViaCore(result,status);
      toast(`《${titleOf(result)}》已设为「${status==='watching'?'在看':'想看'}」`);
      renderResults();
      return local;
    } catch (err) {
      toast(`保存失败：${err?.message || err}`);
    } finally {
      busyAction = false;
    }
  }

  function watchTitleEl() {
    return $('watchModal')?.querySelector('.modal-head h3') || null;
  }

  function restoreWatchTitle() {
    const title = watchTitleEl();
    if (title) title.textContent = '记录一次观看';
  }

  function openExternalWatch(result, values = null) {
    const modal = $('watchModal');
    if (!modal) { toast('观看记录模块不可用'); pendingExternalWatch = null; return; }
    const title = watchTitleEl();
    if (title) title.textContent = `记录一次观看 · 《${titleOf(result)}》`;
    setValue('watchDateInput', values?.date || localToday());
    setValue('watchRatingInput', values?.rating ?? '');
    setValue('watchVenueInput', values?.venue || '');
    setValue('watchNoteInput', values?.note || '');
    if (!modal.open) modal.showModal();
  }

  async function commitExternalWatch(event) {
    if (!pendingExternalWatch || replayingNativeWatch) return false;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const record = {
      date: $('watchDateInput')?.value || localToday(),
      rating: $('watchRatingInput')?.value ?? '',
      venue: $('watchVenueInput')?.value || '',
      note: $('watchNoteInput')?.value || ''
    };
    const pending = pendingExternalWatch;
    pendingExternalWatch = null;
    $('watchModal')?.close();
    restoreWatchTitle();
    busyAction = true;
    try {
      const local = await createOrUpdateViaCore(pending.result,'want',pending.bundle);
      triggerCoreDetail(local.id);
      await wait(30);
      setValue('watchDateInput',record.date);
      setValue('watchRatingInput',record.rating);
      setValue('watchVenueInput',record.venue);
      setValue('watchNoteInput',record.note);
      replayingNativeWatch = true;
      try { $('watchForm')?.requestSubmit(); }
      finally { replayingNativeWatch = false; }
    } catch (err) {
      toast(`保存观看记录失败：${err?.message || err}`);
      pendingExternalWatch = pending;
      openExternalWatch(pending.result,record);
    } finally {
      busyAction = false;
    }
    return true;
  }

  function clearExternalWatch() {
    if (replayingNativeWatch) return;
    pendingExternalWatch = null;
    restoreWatchTitle();
  }

  function visiblePageId() {
    return [...document.querySelectorAll('.page-view')].find(el => !el.classList.contains('hidden'))?.id || 'homeView';
  }

  function setText(id,value) {
    const el = $(id);
    if (el) el.textContent = value == null || value === '' ? '—' : String(value);
  }

  function setPreviewPoster(url,title) {
    const poster = $('detailPoster');
    if (!poster) return;
    poster.innerHTML = '';
    poster.classList.toggle('has-image',Boolean(url));
    if (url) {
      const img = document.createElement('img');
      img.src = url;
      img.alt = `${title} 海报`;
      poster.appendChild(img);
    } else {
      const text = document.createElement('div');
      text.className = 'poster-title';
      text.textContent = title || '影片';
      poster.appendChild(text);
    }
  }

  function setPreviewTags(genres) {
    const el = $('detailTags');
    if (!el) return;
    el.innerHTML = '';
    for (const genre of genres || []) {
      const span = document.createElement('span');
      span.textContent = genre;
      el.appendChild(span);
    }
  }

  function ensurePreviewNote() {
    let note = $('globalSearchPreviewNote');
    if (note) return note;
    const overview = document.querySelector('#detailView .detail-overview');
    if (!overview) return null;
    note = document.createElement('div');
    note.id = 'globalSearchPreviewNote';
    note.className = 'cv-search-preview-note';
    overview.insertAdjacentElement('beforebegin',note);
    return note;
  }

  function fillPreview(result,bundle = null) {
    const type = mediaTypeOf(result);
    const detail = bundle?.detail || {};
    const title = type==='tv' ? (detail.name || titleOf(result)) : (detail.title || titleOf(result));
    const original = type==='tv' ? (detail.original_name || originalTitleOf(result)) : (detail.original_title || originalTitleOf(result));
    const release = type==='tv' ? (detail.first_air_date || dateOf(result)) : (detail.release_date || dateOf(result));
    const creators = bundle ? bundleCreators(bundle) : [];
    const countries = bundle ? countryNames(detail) : [];
    const genres = (detail.genres || []).map(x => x?.name).filter(Boolean);
    const posterUrl = detail.poster_path ? `https://image.tmdb.org/t/p/w500${detail.poster_path}` : (result.poster_path ? `https://image.tmdb.org/t/p/w500${result.poster_path}` : '');
    const runtime = bundle ? bundleRuntime(bundle) : null;

    setText('detailTitle',title || '未命名作品');
    setText('detailOriginal',[original && normalize(original)!==normalize(title) ? original : '', String(release||'').slice(0,4)].filter(Boolean).join(' · '));
    setText('detailCreatorLabel',type==='tv'?'主创':'导演');
    setText('detailDirectors',creators.join(' / ') || '待载入');
    setText('detailCountries',countries.join(' / ') || '待载入');
    setText('detailGenres',genres.join(' / ') || '待载入');
    setText('detailRuntimeLabel',type==='tv'?'单集时长':'片长');
    setText('detailRuntime',runtime ? `${runtime} 分钟` : '未知');
    setText('detailReleaseLabel',type==='tv'?'首播':'上映');
    setText('detailRelease',release || '未知');
    setText('detailMediaType',type==='tv'?'剧集':'电影');
    setText('detailTmdb',detail.id || result.id);
    setText('detailOverview',detail.overview || '正在读取 TMDb 详情…');
    setText('detailRating','—');
    setText('detailStars','☆☆☆☆☆');
    setText('detailLastWatch','尚未加入影视库');
    setText('detailPlanMeta','未加入月度计划');
    setText('detailRadarBadge','TMDb 搜索');
    setText('detailRadarDate','—');
    setText('detailPublicScore',detail.vote_average ? Number(detail.vote_average).toFixed(1) : (result.vote_average ? Number(result.vote_average).toFixed(1) : '—'));
    setText('detailMatchScore','—');
    setText('detailRadarReason','来自顶部 TMDb 全库搜索。');
    if (type==='tv') {
      $('detailSeriesFact')?.classList.remove('hidden');
      setText('detailSeriesMeta',[detail.number_of_seasons!=null?`${detail.number_of_seasons} 季`:null,detail.number_of_episodes!=null?`${detail.number_of_episodes} 集`:null].filter(Boolean).join(' · ') || '剧集资料待载入');
    } else $('detailSeriesFact')?.classList.add('hidden');
    setPreviewTags(genres);
    setPreviewPoster(posterUrl,title);
    const note = ensurePreviewNote();
    if (note) note.textContent = `TMDb 搜索详情预览 · 《${title || '该作品'}》尚未加入影视库。可返回搜索结果后选择“想看 / 在看 / 看过”。`;
    const back = $('detailBack');
    if (back) back.textContent = '‹ 返回搜索结果';
  }

  async function openPreview(result) {
    const local = localMatch(result);
    if (local) {
      closeDrop();
      triggerCoreDetail(local.id);
      return;
    }
    previewState = { result, previousViewId:visiblePageId() };
    document.documentElement.classList.add('cv-search-detail-preview');
    closeDrop();
    document.querySelectorAll('.page-view').forEach(view => view.classList.add('hidden'));
    $('detailView')?.classList.remove('hidden');
    document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('active',a.dataset.view==='library'));
    fillPreview(result);
    try {
      const bundle = await fetchBundle(result);
      if (previewState?.result?.id===result.id && mediaTypeOf(previewState.result)===mediaTypeOf(result)) fillPreview(result,bundle);
    } catch (err) {
      const overview = $('detailOverview');
      if (overview && /正在读取/.test(overview.textContent || '')) overview.textContent = `TMDb 详情读取失败：${err?.message || err}`;
    }
  }

  function closePreview() {
    if (!previewState) return false;
    const prev = previewState;
    previewState = null;
    document.documentElement.classList.remove('cv-search-detail-preview');
    $('globalSearchPreviewNote')?.remove();
    const back = $('detailBack');
    if (back) back.textContent = '‹ 返回影视库';
    document.querySelectorAll('.page-view').forEach(view => view.classList.add('hidden'));
    const target = $(prev.previousViewId) || $('homeView');
    target?.classList.remove('hidden');
    const map = {homeView:'home',libraryView:'library',matchView:'match',radarView:'radar',planView:'plan',watchedView:'watched',statsView:'stats',settingsView:'settings'};
    const viewKey = map[prev.previousViewId] || 'library';
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

  document.addEventListener('submit', event => {
    if (event.target?.id==='watchForm' && pendingExternalWatch && !replayingNativeWatch) commitExternalWatch(event);
  }, true);

  document.addEventListener('click', event => {
    if (!pendingExternalWatch || replayingNativeWatch) return;
    if (event.target.closest?.('#watchModalClose,#watchCancelBtn')) clearExternalWatch();
  }, true);

  document.addEventListener('cancel', event => {
    if (event.target?.id==='watchModal' && pendingExternalWatch && !replayingNativeWatch) clearExternalWatch();
  }, true);

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
