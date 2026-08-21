(() => {
  'use strict';
  if (/(?:^|\/)(?:admin|admin-console)\.html$/i.test(location.pathname)) return;

  const APP_KEY = 'movie-collection-v2';
  const PROXY_URL = 'https://bjjralybdcuczwllxbvo.supabase.co/functions/v1/tmdb-proxy';
  const LIMIT = 6;
  const PLACEHOLDER = '搜索电影、剧集，点击Enter确认';

  let requestSeq = 0;
  let lastResults = [];
  let activeIndex = -1;

  const $ = id => document.getElementById(id);
  const safeParse = raw => { try { return JSON.parse(raw); } catch { return null; } };
  const readState = () => safeParse(localStorage.getItem(APP_KEY)) || { movies: [], settings: {} };
  const normalize = value => String(value || '')
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[\s·・:：,，.。!！?？'"“”‘’()（）[\]【】_-]+/g, '');
  const yearOf = item => String(item?.release_date || item?.first_air_date || item?.info?.releaseDate || item?.info?.year || '').slice(0, 4);
  const mediaTypeOf = item => item?.media_type === 'tv' || item?.mediaType === 'tv' ? 'tv' : 'movie';
  const titleOf = item => mediaTypeOf(item) === 'tv' ? (item?.name || item?.title || '') : (item?.title || item?.name || '');
  const originalTitleOf = item => mediaTypeOf(item) === 'tv' ? (item?.original_name || item?.original_title || '') : (item?.original_title || item?.original_name || '');

  function injectStyle() {
    if ($('globalTmdbSearchStyle')) return;
    const style = document.createElement('style');
    style.id = 'globalTmdbSearchStyle';
    style.textContent = `
      .cv-global-search-wrap{position:relative;min-width:0}
      .cv-global-search-wrap>.search{width:100%}
      .cv-global-search-drop{position:absolute;left:0;right:0;top:calc(100% + 8px);z-index:120;border:1px solid rgba(161,179,255,.2);border-radius:15px;background:linear-gradient(160deg,rgba(10,21,48,.985),rgba(5,13,31,.995));box-shadow:0 24px 60px rgba(0,0,0,.42);padding:6px;max-height:min(68vh,520px);overflow:auto}
      .cv-global-search-drop.hidden{display:none!important}
      .cv-global-search-status{padding:12px 13px;color:#8e9ab7;font-size:11px;line-height:1.6}
      .cv-global-search-status.bad{color:#ff9aae}
      .cv-global-search-result{display:grid;grid-template-columns:42px minmax(0,1fr) auto;gap:10px;align-items:center;padding:8px;border-radius:11px;transition:.16s ease}
      .cv-global-search-result:hover,.cv-global-search-result.active{background:rgba(126,105,238,.12)}
      .cv-global-search-poster{width:42px;height:58px;border-radius:8px;overflow:hidden;background:linear-gradient(150deg,rgba(94,111,174,.28),rgba(26,40,77,.42));display:grid;place-items:center;color:#66738f;font-size:9px;border:1px solid rgba(161,179,255,.1)}
      .cv-global-search-poster img{width:100%;height:100%;object-fit:cover;display:block}
      .cv-global-search-main{min-width:0}
      .cv-global-search-title{display:flex;align-items:center;gap:7px;min-width:0;color:#eef1fb;font-size:12px;font-weight:600}
      .cv-global-search-title-text{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .cv-global-search-kind{flex:0 0 auto;border:1px solid rgba(161,179,255,.16);border-radius:999px;padding:2px 6px;color:#9da9c8;font-size:9px;font-weight:500}
      .cv-global-search-kind.tv{color:#86d4ff;border-color:rgba(100,167,255,.22)}
      .cv-global-search-meta{margin-top:4px;color:#7f8aaa;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .cv-global-search-local{margin-top:3px;color:#7fd9ad;font-size:9px}
      .cv-global-search-action{height:30px;min-width:48px;padding:0 10px;border-radius:9px;border:1px solid rgba(161,179,255,.16);background:rgba(18,31,67,.74);color:#dce2f5;font-size:10px}
      .cv-global-search-action:hover{border-color:rgba(159,124,255,.4);background:rgba(111,97,244,.18)}
      .cv-global-search-footer{padding:7px 10px 6px;border-top:1px solid rgba(161,179,255,.08);color:#66738f;font-size:9px;text-align:right}
      @media(max-width:680px){
        .cv-global-search-drop{position:fixed;left:12px;right:12px;top:64px;max-height:70vh}
        .cv-global-search-result{grid-template-columns:38px minmax(0,1fr) auto}
        .cv-global-search-poster{width:38px;height:53px}
      }
    `;
    document.head.appendChild(style);
  }

  function ensureUi() {
    const input = $('globalSearch');
    const search = input?.closest('.search');
    if (!input || !search) return null;

    input.placeholder = PLACEHOLDER;
    input.autocomplete = 'off';
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');

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
      drop.setAttribute('role', 'listbox');
      wrap.appendChild(drop);
      input.setAttribute('aria-controls', drop.id);
    }
    return { input, search, wrap, drop };
  }

  async function tmdbFetch(path, params = {}) {
    const res = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, params })
    });
    let body = null;
    try { body = await res.json(); } catch {}
    if (!res.ok) throw new Error(body?.message || body?.error || `TMDb 搜索失败（${res.status}）`);
    return body || {};
  }

  function localMatch(result, state = readState()) {
    const movies = Array.isArray(state.movies) ? state.movies : [];
    const type = mediaTypeOf(result);
    const tmdbId = Number(result?.id);
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
      const titleMatch = (Boolean(rt) && [mt, mo].includes(rt)) || (Boolean(ro) && [mt, mo].includes(ro));
      if (!titleMatch) return false;
      const my = yearOf(movie);
      return !ry || !my || ry === my;
    }) || null;
  }

  function localStatus(movie) {
    if (!movie) return '';
    const status = movie?.personal?.status;
    if (status === 'watched') return movie.mediaType === 'tv' ? '已看完' : '已看';
    if (status === 'watching') return '在看';
    return '想看';
  }

  function setExpanded(expanded) {
    const input = $('globalSearch');
    if (input) input.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  }

  function closeDrop() {
    const drop = $('globalTmdbSearchDrop');
    if (drop) {
      drop.classList.add('hidden');
      drop.innerHTML = '';
    }
    activeIndex = -1;
    setExpanded(false);
  }

  function showStatus(text, bad = false) {
    const ui = ensureUi();
    if (!ui) return;
    ui.drop.innerHTML = '';
    const status = document.createElement('div');
    status.className = `cv-global-search-status${bad ? ' bad' : ''}`;
    status.textContent = text;
    ui.drop.appendChild(status);
    ui.drop.classList.remove('hidden');
    setExpanded(true);
    activeIndex = -1;
  }

  function makePoster(result) {
    const poster = document.createElement('div');
    poster.className = 'cv-global-search-poster';
    if (result.poster_path) {
      const img = document.createElement('img');
      img.src = `https://image.tmdb.org/t/p/w92${result.poster_path}`;
      img.alt = '';
      img.loading = 'lazy';
      poster.appendChild(img);
    } else {
      poster.textContent = '无海报';
    }
    return poster;
  }

  function renderResults(results) {
    const ui = ensureUi();
    if (!ui) return;
    ui.drop.innerHTML = '';
    const state = readState();

    if (!results.length) {
      showStatus('没有找到匹配的电影或剧集，可以尝试中文名、原名或其他关键词。', true);
      return;
    }

    results.forEach((result, index) => {
      const local = localMatch(result, state);
      const row = document.createElement('div');
      row.className = 'cv-global-search-result';
      row.dataset.searchResultIndex = String(index);
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', 'false');

      row.appendChild(makePoster(result));

      const main = document.createElement('div');
      main.className = 'cv-global-search-main';

      const title = document.createElement('div');
      title.className = 'cv-global-search-title';

      const kind = document.createElement('span');
      kind.className = `cv-global-search-kind ${mediaTypeOf(result)}`;
      kind.textContent = mediaTypeOf(result) === 'tv' ? '剧集' : '电影';

      const titleText = document.createElement('span');
      titleText.className = 'cv-global-search-title-text';
      titleText.textContent = titleOf(result) || '未命名作品';

      title.append(kind, titleText);

      const meta = document.createElement('div');
      meta.className = 'cv-global-search-meta';
      const original = originalTitleOf(result);
      const year = yearOf(result) || '年份未知';
      meta.textContent = [original && normalize(original) !== normalize(titleOf(result)) ? original : '', year, `TMDb ${result.id}`].filter(Boolean).join(' · ');

      main.append(title, meta);
      if (local) {
        const localNote = document.createElement('div');
        localNote.className = 'cv-global-search-local';
        localNote.textContent = `已在影视库 · ${localStatus(local)}`;
        main.appendChild(localNote);
      }
      row.appendChild(main);

      const action = document.createElement('button');
      action.type = 'button';
      action.className = 'cv-global-search-action';
      action.textContent = local ? '查看' : '添加';
      if (local?.id) action.dataset.openDetail = local.id;
      else {
        action.dataset.tmdbSearchAdd = String(result.id);
        action.dataset.tmdbSearchType = mediaTypeOf(result);
      }
      row.appendChild(action);
      ui.drop.appendChild(row);
    });

    const footer = document.createElement('div');
    footer.className = 'cv-global-search-footer';
    footer.textContent = `显示前 ${results.length} 条 · 数据来自 TMDb`;
    ui.drop.appendChild(footer);
    ui.drop.classList.remove('hidden');
    setExpanded(true);
    activeIndex = -1;
  }

  function updateActive(delta) {
    const rows = [...document.querySelectorAll('#globalTmdbSearchDrop .cv-global-search-result')];
    if (!rows.length) return;
    activeIndex = (activeIndex + delta + rows.length) % rows.length;
    rows.forEach((row, index) => {
      const active = index === activeIndex;
      row.classList.toggle('active', active);
      row.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    rows[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }

  function triggerActive() {
    if (activeIndex < 0) return false;
    const row = document.querySelector(`#globalTmdbSearchDrop .cv-global-search-result[data-search-result-index="${activeIndex}"]`);
    const button = row?.querySelector('.cv-global-search-action');
    if (!button) return false;
    button.click();
    return true;
  }

  async function runSearch() {
    const ui = ensureUi();
    if (!ui) return;
    const query = ui.input.value.trim();
    if (!query) {
      closeDrop();
      return;
    }

    const seq = ++requestSeq;
    showStatus('正在搜索 TMDb…');
    try {
      const state = readState();
      const language = state?.settings?.tmdbLanguage || 'zh-CN';
      const data = await tmdbFetch('/search/multi', {
        query,
        include_adult: false,
        language,
        page: 1
      });
      if (seq !== requestSeq) return;
      lastResults = (data.results || [])
        .filter(item => item?.media_type === 'movie' || item?.media_type === 'tv')
        .slice(0, LIMIT);
      renderResults(lastResults);
    } catch (error) {
      if (seq !== requestSeq) return;
      showStatus(String(error?.message || error || 'TMDb 搜索失败，请稍后重试。'), true);
    }
  }

  function prepareAdd(result) {
    if (!result) return;
    closeDrop();

    const quickAdd = $('quickAdd') || $('addMovieBtn');
    if (!quickAdd) return;
    quickAdd.click();

    setTimeout(() => {
      const type = mediaTypeOf(result);
      const typeInput = $('movieMediaTypeInput');
      if (typeInput) {
        typeInput.value = type;
        typeInput.dispatchEvent(new Event('change', { bubbles: true }));
      }

      const title = titleOf(result);
      const query = $('tmdbMovieQuery');
      const titleInput = $('movieTitleInput');
      const originalInput = $('movieOriginalTitleInput');
      const yearInput = $('movieYearInput');

      if (query) query.value = title;
      if (titleInput) titleInput.value = title;
      if (originalInput) originalInput.value = originalTitleOf(result);
      if (yearInput) yearInput.value = yearOf(result);

      const results = $('tmdbMovieResults');
      const targetId = String(result.id);
      let finished = false;
      let observer = null;
      const tryPick = () => {
        if (finished) return;
        const use = results?.querySelector(`[data-tmdb-use="${CSS.escape(targetId)}"][data-tmdb-type="${CSS.escape(type)}"]`);
        if (!use) return;
        finished = true;
        observer?.disconnect();
        use.click();
      };
      if (results) {
        observer = new MutationObserver(tryPick);
        observer.observe(results, { childList: true, subtree: true });
      }
      $('tmdbMovieSearchBtn')?.click();
      setTimeout(() => {
        if (finished) return;
        observer?.disconnect();
      }, 10000);
    }, 60);
  }

  function resultByButton(button) {
    const id = Number(button?.dataset?.tmdbSearchAdd);
    const type = button?.dataset?.tmdbSearchType;
    return lastResults.find(item => Number(item?.id) === id && mediaTypeOf(item) === type) || null;
  }

  function boot() {
    injectStyle();
    ensureUi();
  }

  document.addEventListener('keydown', event => {
    if (event.target?.id !== 'globalSearch') return;

    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (!triggerActive()) runSearch();
      return;
    }

    if (event.key === 'ArrowDown' && !$('globalTmdbSearchDrop')?.classList.contains('hidden')) {
      event.preventDefault();
      updateActive(1);
      return;
    }

    if (event.key === 'ArrowUp' && !$('globalTmdbSearchDrop')?.classList.contains('hidden')) {
      event.preventDefault();
      updateActive(-1);
      return;
    }

    if (event.key === 'Escape') closeDrop();
  }, true);

  document.addEventListener('input', event => {
    if (event.target?.id !== 'globalSearch') return;
    requestSeq += 1;
    lastResults = [];
    closeDrop();
  }, true);

  document.addEventListener('click', event => {
    const add = event.target.closest?.('[data-tmdb-search-add]');
    if (add) {
      event.preventDefault();
      event.stopPropagation();
      prepareAdd(resultByButton(add));
      return;
    }

    const local = event.target.closest?.('#globalTmdbSearchDrop [data-open-detail]');
    if (local) closeDrop();

    const ui = ensureUi();
    if (!ui) return;
    if (!event.target.closest?.('.cv-global-search-wrap')) closeDrop();
  }, true);

  window.addEventListener('resize', closeDrop);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();