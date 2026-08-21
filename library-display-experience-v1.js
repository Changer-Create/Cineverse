(() => {
  'use strict';
  if (/(?:^|\/)(?:admin|admin-console)\.html$/i.test(location.pathname)) return;

  const STORAGE_KEY = 'movie-collection-v2';
  const CLOUD_DIRTY_KEY = 'movie-cloud-dirty-v1';
  const SCORE_CACHE_KEY = 'movie-tmdb-score-cache-v1';
  const SCORE_TTL = 7 * 24 * 60 * 60 * 1000;
  const TMDB_PROXY_URL = 'https://bjjralybdcuczwllxbvo.supabase.co/functions/v1/tmdb-proxy';
  const grid = document.getElementById('libraryGrid');
  const libraryView = document.getElementById('libraryView');
  if (!grid || !libraryView) return;

  const safeParse = raw => {
    try { return JSON.parse(raw); } catch { return null; }
  };
  const esc = value => String(value ?? '')
    .replace(/&/g,'&amp;')
    .replace(/"/g,'&quot;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;');
  const getState = () => safeParse(localStorage.getItem(STORAGE_KEY));
  const saveState = state => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    localStorage.setItem(CLOUD_DIRTY_KEY, '1');
  };
  const toast = text => {
    const node = document.getElementById('toast');
    if (!node) return;
    node.textContent = text;
    node.classList.add('show');
    clearTimeout(node._libraryDisplayTimer);
    node._libraryDisplayTimer = setTimeout(() => node.classList.remove('show'), 1800);
  };
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  async function waitForCloudAccount(timeout=2200) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      if (window.MovieCloudAccount?.syncBeforeReload) return window.MovieCloudAccount;
      await sleep(50);
    }
    return window.MovieCloudAccount || null;
  }
  async function reloadAfterCloudSync(hash='library') {
    location.hash = hash;
    const account = await waitForCloudAccount();
    if (account?.syncBeforeReload) {
      try { await Promise.race([account.syncBeforeReload(), sleep(2600)]); } catch {}
    }
    location.reload();
  }

  const style = document.createElement('style');
  style.id = 'libraryDisplayExperienceStyleV1';
  style.textContent = `
    @media (min-width:1181px) and (min-height:720px){
      html:has(body.library-fixed-workspace-v1),body.library-fixed-workspace-v1{height:100%;overflow:hidden!important}
      body.library-fixed-workspace-v1 .app{height:100vh;min-height:0}
      body.library-fixed-workspace-v1 .main{height:100vh;min-height:0;overflow:hidden;display:flex;flex-direction:column;padding-bottom:18px}
      body.library-fixed-workspace-v1 .topbar{flex:0 0 auto;margin-bottom:12px}
      body.library-fixed-workspace-v1 #libraryView:not(.hidden){display:flex;flex:1 1 auto;min-height:0;overflow:hidden}
      body.library-fixed-workspace-v1 #libraryView .library-shell{display:grid;grid-template-rows:auto auto minmax(0,1fr);gap:10px;flex:1 1 auto;min-height:0;width:100%}
      body.library-fixed-workspace-v1 #libraryView .library-hero{padding:13px 17px}
      body.library-fixed-workspace-v1 #libraryView .library-head{align-items:center}
      body.library-fixed-workspace-v1 #libraryView .library-head h2{font-size:28px}
      body.library-fixed-workspace-v1 #libraryView .library-head p{margin:5px 0 0;font-size:12px}
      body.library-fixed-workspace-v1 #libraryView .library-summary{min-width:min(520px,47vw);gap:8px}
      body.library-fixed-workspace-v1 #libraryView .lib-mini-stat{padding:8px 10px}
      body.library-fixed-workspace-v1 #libraryView .lib-mini-stat b{font-size:18px}
      body.library-fixed-workspace-v1 #libraryView .library-tools{padding:10px}
      body.library-fixed-workspace-v1 #libraryView .library-shell>section:last-child{min-height:0;overflow:hidden;display:flex;flex-direction:column}
      body.library-fixed-workspace-v1 #libraryGrid{flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;align-content:start;padding-right:6px;scrollbar-width:thin;scrollbar-color:rgba(141,154,196,.28) transparent}
      body.library-fixed-workspace-v1 #libraryGrid::-webkit-scrollbar{width:7px}
      body.library-fixed-workspace-v1 #libraryGrid::-webkit-scrollbar-track{background:transparent}
      body.library-fixed-workspace-v1 #libraryGrid::-webkit-scrollbar-thumb{background:rgba(141,154,196,.22);border-radius:999px}
      body.library-fixed-workspace-v1 #libraryGrid:hover::-webkit-scrollbar-thumb{background:rgba(159,124,255,.34)}
      body.library-fixed-workspace-v1 #libraryPagination{flex:0 0 auto;margin-top:9px;padding:8px 11px}
    }

    #libraryGrid:not(.list-view){grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
    #libraryGrid:not(.list-view) .lib-card{display:grid;grid-template-columns:120px minmax(0,1fr);height:184px;min-height:184px;overflow:hidden}
    #libraryGrid:not(.list-view) .lib-card:hover{transform:translateY(-1px)}
    #libraryGrid:not(.list-view) .lib-poster{width:112px;height:168px;aspect-ratio:2/3;margin:8px 0 8px 8px;border-radius:12px;padding:0;align-self:center;overflow:hidden}
    #libraryGrid:not(.list-view) .lib-poster img{width:100%;height:100%;object-fit:contain;background:#050a17}
    #libraryGrid:not(.list-view) .poster-title{padding:10px;font-size:15px}
    #libraryGrid:not(.list-view) .lib-body{padding:11px 11px 10px 8px;min-width:0;display:flex;flex-direction:column}
    #libraryGrid:not(.list-view) .lib-title-wrap{min-width:0;padding-right:64px}
    #libraryGrid:not(.list-view) .lib-title{font-size:16px;line-height:1.35;font-weight:700;white-space:normal;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;min-height:22px}
    #libraryGrid:not(.list-view) .media-type-pill{vertical-align:1px}
    #libraryGrid:not(.list-view) .lib-meta{font-size:11px;line-height:1.5;margin-top:5px;white-space:normal;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;min-height:16px}
    #libraryGrid .lib-rating.library-score-row{display:grid!important;grid-template-columns:1fr 1fr;gap:6px;margin-top:7px;font-size:inherit}
    #libraryGrid .library-score-box{border:1px solid rgba(255,255,255,.06);border-radius:9px;background:rgba(255,255,255,.025);padding:5px 7px;min-width:0}
    #libraryGrid .library-score-box span{display:block;color:#7f8aa7;font-size:8px;line-height:1.15}
    #libraryGrid .library-score-box b{display:block;margin-top:2px;font-size:12px;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #libraryGrid .library-score-box.mine b{color:var(--gold)}
    #libraryGrid .library-score-box.public b{color:#d8caff}
    #libraryGrid:not(.list-view) .lib-tags{margin-top:6px;min-height:19px;max-height:20px;overflow:hidden;flex-wrap:nowrap}
    #libraryGrid:not(.list-view) .lib-tag{font-size:9px;padding:2px 6px}
    #libraryGrid .lib-actions.library-actions-display-v1{display:grid!important;grid-template-columns:1fr 1.25fr 1fr!important;gap:6px!important;margin-top:auto!important;width:100%!important}
    #libraryGrid .lib-actions.library-actions-display-v1>*{height:29px!important;min-width:0;border-radius:8px;border:1px solid var(--line);font-size:9px;display:flex;align-items:center;justify-content:center;padding:0 6px;white-space:nowrap}
    #libraryGrid .library-status-display{cursor:default;background:rgba(255,255,255,.025);color:#aeb8cf}
    #libraryGrid .library-status-display.want{color:#d8cfff;border-color:rgba(159,124,255,.24);background:rgba(107,74,200,.14)}
    #libraryGrid .library-status-display.watching{color:#9fd4ff;border-color:rgba(100,167,255,.24);background:rgba(46,93,160,.15)}
    #libraryGrid .library-status-display.watched{color:#8ce7bb;border-color:rgba(98,210,162,.23);background:rgba(37,128,91,.14)}
    #libraryGrid .library-add-watch-btn,#libraryGrid .library-actions-display-v1 [data-library-plan]{background:rgba(13,25,55,.78);color:#c6cee2}
    #libraryGrid .library-add-watch-btn:hover,#libraryGrid .library-actions-display-v1 [data-library-plan]:hover{border-color:rgba(159,124,255,.42);color:#fff}
    #libraryGrid:not(.list-view) .fav-star{right:39px;top:8px;width:27px;height:27px;border-radius:9px}
    #libraryGrid .library-delete-btn{position:absolute;right:8px;top:8px;z-index:5;width:27px;height:27px;border-radius:9px;border:1px solid rgba(255,127,154,.15);background:rgba(27,9,18,.5);color:#a66e7b;display:grid;place-items:center;font-size:15px;line-height:1;backdrop-filter:blur(8px)}
    #libraryGrid .library-delete-btn:hover{border-color:rgba(255,127,154,.38);background:rgba(92,29,48,.24);color:#ef9daf}
    #libraryGrid:not(.list-view) .lib-select{left:15px;top:15px}

    #libraryGrid.list-view .lib-card{padding-right:76px}
    #libraryGrid.list-view .fav-star{left:auto;right:40px;top:8px;width:26px;height:26px}
    #libraryGrid.list-view .library-delete-btn{right:8px;top:8px;width:26px;height:26px}
    #libraryGrid.list-view .lib-rating.library-score-row{margin:0;padding:0 8px}
    #libraryGrid.list-view .library-score-box{padding:4px 6px}
    #libraryGrid.list-view .library-score-box span{font-size:7px}
    #libraryGrid.list-view .library-score-box b{font-size:10px}
    #libraryGrid.list-view .lib-actions.library-actions-display-v1{min-width:190px;margin:0!important}

    #libraryDeleteDialog{width:min(430px,calc(100vw - 28px));border:1px solid rgba(255,127,154,.2);border-radius:18px;background:linear-gradient(160deg,rgba(20,16,32,.99),rgba(10,16,35,.99));color:#f7f3ff;padding:0;box-shadow:0 28px 80px rgba(0,0,0,.52)}
    #libraryDeleteDialog::backdrop{background:rgba(2,5,14,.72);backdrop-filter:blur(7px)}
    .library-delete-head{padding:20px 22px 8px}
    .library-delete-head small{display:block;color:#a77782;font-size:10px;letter-spacing:.06em}
    .library-delete-head h3{margin:7px 0 0;font-size:19px}
    .library-delete-body{padding:10px 22px 22px}
    .library-delete-copy{color:#aeb6cc;font-size:12px;line-height:1.75}
    .library-delete-copy b{color:#f1dce2}
    .library-delete-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}
    .library-delete-actions button{height:36px;padding:0 14px;border-radius:10px;border:1px solid rgba(161,179,255,.16);background:rgba(18,30,64,.72);color:#dce2f5}
    .library-delete-actions .danger{border-color:rgba(255,127,154,.3);background:rgba(128,39,65,.22);color:#ffb1c0}

    @media(max-width:1320px){
      #libraryGrid:not(.list-view){grid-template-columns:repeat(2,minmax(0,1fr))}
    }
    @media(max-width:820px){
      #libraryGrid:not(.list-view){grid-template-columns:1fr}
      #libraryGrid:not(.list-view) .lib-card{grid-template-columns:108px minmax(0,1fr);height:176px;min-height:176px}
      #libraryGrid:not(.list-view) .lib-poster{width:100px;height:150px}
    }
  `;
  document.head.appendChild(style);

  function currentStateMovieMap() {
    const state = getState();
    return {
      state,
      movieMap:new Map((state?.movies || []).map(movie => [String(movie.id), movie]))
    };
  }

  function statusInfo(movie) {
    const status = movie?.personal?.status || 'want';
    if (status === 'watched') return ['watched','已看'];
    if (movie?.mediaType === 'tv' && status === 'watching') return ['watching','在看'];
    return ['want','想看'];
  }

  function cardMovieId(card) {
    return card.querySelector('[data-select-id]')?.dataset.selectId
      || card.querySelector('[data-edit-id]')?.dataset.editId
      || card.querySelector('[data-library-plan]')?.dataset.libraryPlan
      || card.querySelector('[data-open-detail]')?.dataset.openDetail
      || card.querySelector('[data-favorite-id]')?.dataset.favoriteId
      || '';
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
  function radarScore(movie) {
    const value = Number(movie?.radar?.publicReputation);
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  function freshCacheRow(movie) {
    const key = scoreKey(movie);
    if (!key) return null;
    const row = scoreCache()[key];
    return row && Number(row.expiresAt) >= Date.now() ? row : null;
  }
  function cachedScore(movie) {
    const direct = radarScore(movie);
    if (direct != null) return direct;
    const row = freshCacheRow(movie);
    if (!row || row.score == null) return null;
    const value = Number(row.score);
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  function writeCachedScore(key, score) {
    if (!key) return;
    const cache = scoreCache();
    cache[key] = { score:Number.isFinite(Number(score)) ? Number(score) : null, expiresAt:Date.now()+SCORE_TTL };
    const keys = Object.keys(cache);
    if (keys.length > 500) {
      keys.sort((a,b) => Number(cache[b]?.expiresAt || 0) - Number(cache[a]?.expiresAt || 0));
      for (const old of keys.slice(450)) delete cache[old];
    }
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

  const pendingScores = [];
  const runningScores = new Set();
  let scoreWorkers = 0;
  async function fetchPublicScore(movie) {
    const key = scoreKey(movie);
    if (!key) return;
    const known = cachedScore(movie);
    if (known != null || freshCacheRow(movie)) {
      updateScoreNodes(key, known);
      return;
    }
    if (runningScores.has(key) || pendingScores.some(item => item.key === key)) return;
    pendingScores.push({ key, movie });
    runScoreQueue();
  }
  function runScoreQueue() {
    while (scoreWorkers < 4 && pendingScores.length) {
      const job = pendingScores.shift();
      scoreWorkers += 1;
      runningScores.add(job.key);
      (async () => {
        try {
          const id = Number(job.movie?.info?.tmdbId);
          const type = job.movie?.mediaType === 'tv' ? 'tv' : 'movie';
          const response = await fetch(TMDB_PROXY_URL, {
            method:'POST',
            headers:{ 'Content-Type':'application/json' },
            body:JSON.stringify({ path:`/${type}/${id}`, params:{ language:'zh-CN' } })
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const data = await response.json();
          const score = Number(data?.vote_average);
          const value = Number.isFinite(score) && score > 0 ? score : null;
          writeCachedScore(job.key, value);
          updateScoreNodes(job.key, value);
        } catch {
          writeCachedScore(job.key, null);
          updateScoreNodes(job.key, null);
        } finally {
          runningScores.delete(job.key);
          scoreWorkers -= 1;
          runScoreQueue();
        }
      })();
    }
  }

  let scoreObserver = null;
  function ensureScoreObserver() {
    if (scoreObserver || !('IntersectionObserver' in window)) return scoreObserver;
    scoreObserver = new IntersectionObserver(entries => {
      const { movieMap } = currentStateMovieMap();
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const card = entry.target;
        scoreObserver.unobserve(card);
        const movie = movieMap.get(String(cardMovieId(card)));
        if (movie) fetchPublicScore(movie);
      }
    }, { root:grid, rootMargin:'160px 0px' });
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
        <b>${personalValue != null && Number.isFinite(Number(personalValue)) ? '★ '+Number(personalValue).toFixed(1) : '—'}</b>
      </div>
      <div class="library-score-box public">
        <span>公众口碑</span>
        <b ${key ? `data-tmdb-score-key="${esc(key)}"` : ''}>${scoreText(publicValue)}</b>
      </div>`;
    if (key && publicValue == null && !freshCacheRow(movie)) {
      const observer = ensureScoreObserver();
      if (observer) observer.observe(card);
      else fetchPublicScore(movie);
    }
  }

  function decorateActions(card, movie) {
    const actions = card.querySelector('.lib-actions');
    if (!actions) return;
    const id = String(movie.id);
    const [statusClass, statusLabel] = statusInfo(movie);
    const signature = `${id}|${statusClass}|display-v1`;
    if (actions.dataset.libraryDisplaySignature === signature
      && actions.children.length === 3
      && actions.querySelector('.library-status-display')
      && actions.querySelector('.library-add-watch-btn')
      && actions.querySelector('[data-library-plan]')) return;
    actions.dataset.libraryDisplaySignature = signature;
    actions.classList.add('library-actions-display-v1');
    actions.innerHTML = `
      <span class="library-status-display ${esc(statusClass)}" aria-label="当前状态：${esc(statusLabel)}">${esc(statusLabel)}</span>
      <button type="button" class="library-add-watch-btn" data-library-add-watch="${esc(id)}">＋ 添加观看记录</button>
      <button type="button" data-library-plan="${esc(id)}">计划</button>`;
  }

  function decorateDelete(card, movie) {
    let button = card.querySelector('.library-delete-btn');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'library-delete-btn';
      button.textContent = '×';
      button.title = '从影视库移除';
      button.setAttribute('aria-label', `从影视库移除《${movie?.info?.title || '这部作品'}》`);
      card.appendChild(button);
    }
    button.dataset.libraryDelete = String(movie.id);
  }

  function decorateLibraryCards() {
    const { movieMap } = currentStateMovieMap();
    grid.querySelectorAll('.lib-card').forEach(card => {
      const id = cardMovieId(card);
      const movie = movieMap.get(String(id));
      if (!movie) return;
      decorateActions(card, movie);
      decorateScore(card, movie);
      decorateDelete(card, movie);
    });
  }

  let decorateFrame = 0;
  function scheduleDecorate() {
    if (decorateFrame) return;
    decorateFrame = requestAnimationFrame(() => {
      decorateFrame = 0;
      decorateLibraryCards();
    });
  }

  function openWatchForMovie(movieId) {
    const list = document.getElementById('quickWatchList');
    const modal = document.getElementById('watchModal');
    if (!list || !modal) {
      toast('观看记录窗口暂不可用');
      return;
    }
    const proxy = document.createElement('button');
    proxy.type = 'button';
    proxy.hidden = true;
    proxy.dataset.quickWatchId = String(movieId);
    list.appendChild(proxy);
    proxy.click();
    queueMicrotask(() => proxy.remove());
  }

  let deleteMovieId = '';
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
    if (copy) copy.innerHTML = `确认将 <b>《${esc(movie?.info?.title || '未命名作品')}》</b> 从影视库移除吗？<br>影片资料与个人记录会从影视库中删除。`;
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
    saveState(state);
    ensureDeleteDialog().close();
    deleteMovieId = '';
    toast(`《${title}》已从影视库移除`);
    await reloadAfterCloudSync('library');
  }

  document.addEventListener('click', event => {
    const addWatch = event.target.closest('[data-library-add-watch]');
    if (addWatch?.closest('#libraryGrid')) {
      event.preventDefault();
      event.stopPropagation();
      openWatchForMovie(addWatch.dataset.libraryAddWatch);
      return;
    }
    const remove = event.target.closest('[data-library-delete]');
    if (remove?.closest('#libraryGrid')) {
      event.preventDefault();
      event.stopPropagation();
      openDelete(remove.dataset.libraryDelete);
      return;
    }
    if (event.target.closest('[data-library-delete-cancel]')) {
      event.preventDefault();
      ensureDeleteDialog().close();
      deleteMovieId = '';
      return;
    }
    if (event.target.closest('[data-library-delete-confirm]')) {
      event.preventDefault();
      confirmDelete();
    }
  });

  const fixedQuery = window.matchMedia('(min-width:1181px) and (min-height:720px)');
  function updateFixedWorkspace() {
    const active = !libraryView.classList.contains('hidden') && fixedQuery.matches;
    document.body.classList.toggle('library-fixed-workspace-v1', active);
  }
  if (fixedQuery.addEventListener) fixedQuery.addEventListener('change', updateFixedWorkspace);
  else fixedQuery.addListener?.(updateFixedWorkspace);
  window.addEventListener('hashchange', () => queueMicrotask(updateFixedWorkspace));
  new MutationObserver(updateFixedWorkspace).observe(libraryView, { attributes:true, attributeFilter:['class'] });

  const gridObserver = new MutationObserver(scheduleDecorate);
  gridObserver.observe(grid, { childList:true, subtree:true });

  updateFixedWorkspace();
  scheduleDecorate();
})();