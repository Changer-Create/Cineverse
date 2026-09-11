(() => {
  'use strict';
  if (/(?:^|\/)(?:admin|admin-console)\.html$/i.test(location.pathname)) return;
  if (window.__CINEVERSE_LIBRARY_CARD_SYSTEM_V1__) return;
  window.__CINEVERSE_LIBRARY_CARD_SYSTEM_V1__ = true;

  const STORAGE_KEY = 'movie-collection-v2';
  const CLOUD_DIRTY_KEY = 'movie-cloud-dirty-v1';
  const SCORE_CACHE_KEY = 'movie-tmdb-score-cache-v1';
  const SCORE_TTL = 7 * 24 * 60 * 60 * 1000;
  const TMDB_PROXY_URL = window.CineversePublicConfig?.tmdbProxyUrl || '';
  const SCORE_POLICY = window.CineverseScoreCachePolicy;
  const grid = document.getElementById('libraryGrid');
  const libraryView = document.getElementById('libraryView');
  if (!grid || !libraryView) return;

  let activePlanMovieId = '';
  let deleteMovieId = '';
  let decorateFrame = 0;

  const safeParse = raw => {
    try { return JSON.parse(raw); } catch { return null; }
  };
  const esc = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const stateGateway = () => window.CineverseStateGateway;
  const getState = () => stateGateway()?.snapshot?.() || safeParse(localStorage.getItem(STORAGE_KEY));
  const saveState = (state, reason = 'update') => {
    const gateway = stateGateway();
    if (gateway?.replace) gateway.replace(state, { source:'library-card-system', reason });
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    localStorage.setItem(CLOUD_DIRTY_KEY, '1');
    return Boolean(gateway?.replace);
  };
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const toast = text => {
    const node = document.getElementById('toast');
    if (!node) return;
    node.textContent = text;
    node.classList.add('show');
    clearTimeout(node._libraryCardSystemTimer);
    node._libraryCardSystemTimer = setTimeout(() => node.classList.remove('show'), 1800);
  };
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  async function waitForCloudAccount(timeout = 2200) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      if (window.MovieCloudAccount?.syncBeforeReload) return window.MovieCloudAccount;
      await sleep(50);
    }
    return window.MovieCloudAccount || null;
  }

  async function reloadAfterCloudSync(hash = 'library') {
    if (hash) location.hash = hash;
    const account = await waitForCloudAccount();
    if (account?.syncBeforeReload) {
      try { await Promise.race([account.syncBeforeReload(), sleep(2800)]); } catch {}
    }
    location.reload();
  }

  function currentStateMovieMap() {
    const state = getState();
    return {
      state,
      movieMap:new Map((state?.movies || []).map(movie => [String(movie.id), movie]))
    };
  }

  function statusInfo(movie) {
    const status = movie?.personal?.status === 'follow' ? 'want' : (movie?.personal?.status || 'want');
    if (movie?.mediaType === 'tv') {
      if (status === 'watching') return ['watching', '在看'];
      if (status === 'watched') return ['watched', '已看完'];
      if (status === 'paused') return ['paused', '暂停'];
      if (status === 'dropped') return ['dropped', '弃剧'];
      return ['want', '想看'];
    }
    return status === 'watched' ? ['watched', '已看'] : ['want', '想看'];
  }

  function cardMovieId(card) {
    return card.querySelector('[data-select-id]')?.dataset.selectId
      || card.querySelector('[data-edit-id]')?.dataset.editId
      || card.querySelector('[data-library-plan]')?.dataset.libraryPlan
      || card.querySelector('[data-open-detail]')?.dataset.openDetail
      || card.querySelector('[data-favorite-id]')?.dataset.favoriteId
      || card.querySelector('[data-library-delete]')?.dataset.libraryDelete
      || '';
  }

  function decoratePoster(card, movie) {
    const poster = card.querySelector('.lib-poster');
    if (!poster) return;
    const id = String(movie.id);
    if (poster.dataset.openDetail === id) return;
    poster.dataset.openDetail = id;
    poster.setAttribute('role', 'button');
    poster.setAttribute('tabindex', '0');
    poster.setAttribute('aria-label', `打开《${movie?.info?.title || '作品'}》详情`);
  }

  function scoreCache() {
    const parsed = safeParse(localStorage.getItem(SCORE_CACHE_KEY));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  }

  function scoreKey(movie) {
    const id = Number(movie?.info?.tmdbId);
    if (!Number.isFinite(id) || id <= 0) return '';
    return `${movie?.mediaType === 'tv' ? 'tv' : 'movie'}:${id}`;
  }

  function scoreCacheState(movie) {
    return scoreService()?.state?.(movie) || { kind:'miss', row:null };
  }

  function freshCacheRow(movie) {
    const state = scoreCacheState(movie);
    return state.kind === 'success' || state.kind === 'empty' ? state.row : null;
  }

  function cachedScore(movie) {
    return scoreService()?.read?.(movie) ?? window.CineverseDomain.publicScore(movie, scoreCache());
  }

  function writeCachedScore(key, score, kind = 'success') {
    if (!key || !SCORE_POLICY) return;
    const cache = scoreCache();
    if (kind === 'error') SCORE_POLICY.writeFailure(cache, key);
    else if (kind === 'empty') SCORE_POLICY.writeEmpty(cache, key);
    else SCORE_POLICY.writeSuccess(cache, key, score);
    SCORE_POLICY.prune(cache);
    localStorage.setItem(SCORE_CACHE_KEY, JSON.stringify(cache));
  }

  function scoreText(value) {
    return value == null ? '—' : `★ ${Number(value).toFixed(1)}`;
  }

  function updateScoreNodes(key, score) {
    if (!key) return;
    document.querySelectorAll(`[data-tmdb-score-key="${CSS.escape(key)}"]`).forEach(node => {
      node.textContent = scoreText(score);
      node.dataset.loaded = '1';
    });
  }

  const scoreService = () => window.CineversePublicScoreService;
  async function fetchPublicScore(movie) {
    const key = scoreService()?.scoreKey?.(movie);
    if (!key) return;
    const service = scoreService();
    if (!service) return;
    if (!service.shouldFetch(movie)) {
      updateScoreNodes(key, service.read(movie));
      return;
    }
    const value = await service.fetch(movie);
    updateScoreNodes(key, value);
  }

  let scoreObserver = null;
  function ensureScoreObserver() {
    if (scoreObserver || !('IntersectionObserver' in window)) return scoreObserver;
    scoreObserver = new IntersectionObserver(entries => {
      const { movieMap } = currentStateMovieMap();
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        scoreObserver.unobserve(entry.target);
        const movie = movieMap.get(String(cardMovieId(entry.target)));
        if (movie) fetchPublicScore(movie);
      }
    }, { root:null, rootMargin:'160px 0px' });
    return scoreObserver;
  }

  function decorateScore(card, movie) {
    const rating = card.querySelector('.lib-rating');
    if (!rating) return;
    const key = scoreKey(movie);
    const publicValue = cachedScore(movie);
    const personalValue = movie?.personal?.rating;
    const signature = `${personalValue ?? ''}|${key}|${publicValue ?? ''}`;
    if (rating.dataset.libraryScoreSignature === signature) return;
    rating.dataset.libraryScoreSignature = signature;
    rating.classList.add('library-score-row');
    rating.innerHTML = `
      <div class="library-score-box mine">
        <span>我的评分</span>
        <b>${personalValue != null && Number.isFinite(Number(personalValue)) ? '★ ' + Number(personalValue).toFixed(1) : '—'}</b>
      </div>
      <div class="library-score-box public" title="TMDb 公众评分">
        <span>公众口碑</span>
        <b ${key ? `data-tmdb-score-key="${esc(key)}"` : ''}>${scoreText(publicValue)}</b>
      </div>`;
    if (key && publicValue == null && !freshCacheRow(movie)) {
      const observer = ensureScoreObserver();
      if (observer) observer.observe(card);
      else fetchPublicScore(movie);
    }
  }
  function decorateLibraryCards() {
    const { movieMap } = currentStateMovieMap();
    grid.querySelectorAll(':scope > .lib-card[data-library-card="v1"]').forEach(card => {
      const movie = movieMap.get(String(cardMovieId(card)));
      if (!movie) return;
      decoratePoster(card, movie);
      decorateScore(card, movie);
    });
  }

  function scheduleDecorate() {
    if (decorateFrame) return;
    decorateFrame = requestAnimationFrame(() => {
      decorateFrame = 0;
      decorateLibraryCards();
    });
  }

  function openWatchForMovie(movieId) {
    const action = window.CineverseLibraryActions?.openWatch;
    if (typeof action === 'function') { action(movieId); return; }
    document.dispatchEvent(new CustomEvent('cineverse:open-watch', { detail:{ movieId:String(movieId) } }));
  }

  function ensurePlanDialog() {
    let dialog = document.getElementById('libraryPlanDialog');
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = 'libraryPlanDialog';
    dialog.innerHTML = `
      <div class="library-plan-head">
        <small>PLAN A CINEMATIC NIGHT</small>
        <h3>安排观看计划</h3>
      </div>
      <div class="library-plan-body">
        <div class="library-plan-movie" id="libraryPlanMovieName">—</div>
        <label for="libraryPlanDate">计划观看日期</label>
        <input class="library-plan-date" id="libraryPlanDate" type="date">
        <div class="library-plan-note">默认选择今天，也可以直接切换到其他日期。</div>
        <div class="library-plan-actions">
          <button type="button" data-library-plan-cancel>取消</button>
          <button type="button" class="primary" data-library-plan-save>加入计划</button>
        </div>
      </div>`;
    document.body.appendChild(dialog);
    return dialog;
  }

  function openPlan(movieId) {
    const state = getState();
    const movie = state?.movies?.find(item => String(item?.id) === String(movieId));
    if (!movie) return;
    activePlanMovieId = String(movieId);
    const dialog = ensurePlanDialog();
    const name = document.getElementById('libraryPlanMovieName');
    const date = document.getElementById('libraryPlanDate');
    if (name) name.textContent = `《${movie?.info?.title || '未命名作品'}》`;
    if (date) date.value = today();
    dialog.showModal();
  }

  async function savePlan() {
    if (!activePlanMovieId) return;
    const dateInput = document.getElementById('libraryPlanDate');
    const plannedDate = dateInput?.value || today();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(plannedDate)) return;
    const state = getState();
    const movie = state?.movies?.find(item => String(item?.id) === String(activePlanMovieId));
    if (!movie) return;
    const actions = window.CineverseStateActions;
    if (actions?.setPlan) actions.setPlan(activePlanMovieId, plannedDate, 'planned');
    else {
      const month = plannedDate.slice(0, 7);
      movie.plans = Array.isArray(movie.plans) ? movie.plans : [];
      let plan = movie.plans.find(item => item?.month === month);
      if (!plan) { plan = { month, status:'planned', plannedDate, movedTo:null }; movie.plans.push(plan); }
      else { plan.status = 'planned'; plan.plannedDate = plannedDate; plan.movedTo = null; }
      movie.updatedAt = new Date().toISOString();
      saveState(state, 'plan-update');
    }
    ensurePlanDialog().close();
    activePlanMovieId = '';
    toast(`《${movie?.info?.title || '作品'}》已加入观看计划`);
    await reloadAfterCloudSync('library');
  }

  function ensureDeleteDialog() {
    let dialog = document.getElementById('libraryDeleteDialog');
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = 'libraryDeleteDialog';
    dialog.innerHTML = `
      <div class="library-delete-head">
        <small>REMOVE FROM LIBRARY</small>
        <h3>从影视库移除？</h3>
      </div>
      <div class="library-delete-body">
        <div class="library-delete-copy" id="libraryDeleteCopy">确认移除这部作品？</div>
        <div class="library-delete-actions">
          <button type="button" data-library-delete-cancel>取消</button>
          <button type="button" class="danger" data-library-delete-confirm>确认移除</button>
        </div>
      </div>`;
    document.body.appendChild(dialog);
    return dialog;
  }

  function openDelete(movieId) {
    const state = getState();
    const movie = state?.movies?.find(item => String(item?.id) === String(movieId));
    if (!movie) return;
    deleteMovieId = String(movieId);
    const dialog = ensureDeleteDialog();
    const copy = document.getElementById('libraryDeleteCopy');
    if (copy) copy.innerHTML = `确认将 <b>《${esc(movie?.info?.title || '未命名作品')}》</b> 从影视库移除吗？<br>影片资料、观看记录与计划也会一并移除。`;
    dialog.showModal();
  }

  async function confirmDelete() {
    if (!deleteMovieId) return;
    const state = getState();
    if (!state || !Array.isArray(state.movies)) return;
    const movie = state.movies.find(item => String(item?.id) === String(deleteMovieId));
    if (!movie) {
      ensureDeleteDialog().close();
      deleteMovieId = '';
      return;
    }
    const title = movie?.info?.title || '作品';
    state.movies = state.movies.filter(item => String(item?.id) !== String(deleteMovieId));
    if (Array.isArray(state?.tmdbMatchCenter?.rows)) {
      state.tmdbMatchCenter.rows = state.tmdbMatchCenter.rows.filter(row => String(row?.movieId) !== String(deleteMovieId));
    }
    const notified = saveState(state, 'delete');
    ensureDeleteDialog().close();
    deleteMovieId = '';
    toast(`《${title}》已从影视库移除`);
    if (!notified) document.dispatchEvent(new CustomEvent('movie-library:state-updated', { detail:{ state, reason:'delete' } }));
  }

  document.addEventListener('click', event => {
    const addWatch = event.target.closest?.('[data-library-add-watch]');
    if (addWatch?.closest('#libraryGrid')) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      openWatchForMovie(addWatch.dataset.libraryAddWatch);
      return;
    }

    const planButton = event.target.closest?.('[data-library-plan]');
    if (planButton?.closest('#libraryGrid')) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      openPlan(planButton.dataset.libraryPlan);
      return;
    }

    const remove = event.target.closest?.('[data-library-delete]');
    if (remove?.closest('#libraryGrid')) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      openDelete(remove.dataset.libraryDelete);
      return;
    }

    if (event.target.closest?.('[data-library-plan-cancel]')) {
      event.preventDefault();
      ensurePlanDialog().close();
      activePlanMovieId = '';
      return;
    }

    if (event.target.closest?.('[data-library-plan-save]')) {
      event.preventDefault();
      savePlan();
      return;
    }

    if (event.target.closest?.('[data-library-delete-cancel]')) {
      event.preventDefault();
      ensureDeleteDialog().close();
      deleteMovieId = '';
      return;
    }

    if (event.target.closest?.('[data-library-delete-confirm]')) {
      event.preventDefault();
      confirmDelete();
    }
  }, true);

  document.addEventListener('keydown', event => {
    const poster = event.target.closest?.('#libraryGrid .lib-poster[data-open-detail]');
    if (!poster || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    poster.click();
  });

  const fixedQuery = window.matchMedia('(min-width:1181px) and (min-height:720px)');
  function updateFixedWorkspace() {
    const active = !libraryView.classList.contains('hidden') && fixedQuery.matches;
    document.documentElement.classList.toggle('library-fixed-workspace-v1', active);
    document.body.classList.toggle('library-fixed-workspace-v1', active);
  }

  if (fixedQuery.addEventListener) fixedQuery.addEventListener('change', updateFixedWorkspace);
  else fixedQuery.addListener?.(updateFixedWorkspace);
  window.addEventListener('hashchange', () => queueMicrotask(updateFixedWorkspace));

  // Only observe the library view's hidden/visible state. This observer never writes back to libraryView.
  const viewObserver = new MutationObserver(updateFixedWorkspace);
  viewObserver.observe(libraryView, { attributes:true, attributeFilter:['class'] });

  // Core renderLibrary replaces direct card children. Observe only direct childList changes;
  // decorating inside cards therefore cannot retrigger this observer and cannot self-loop.
  const gridObserver = new MutationObserver(scheduleDecorate);
  gridObserver.observe(grid, { childList:true, subtree:false });

  ensurePlanDialog();
  ensureDeleteDialog();
  updateFixedWorkspace();
  scheduleDecorate();
})();
