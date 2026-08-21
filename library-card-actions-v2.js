(() => {
  'use strict';

  const IS_ADMIN = /(?:^|\/)(?:admin|admin-console)\.html$/i.test(location.pathname);
  const STORAGE_KEY = 'movie-collection-v2';
  const CLOUD_DIRTY_KEY = 'movie-cloud-dirty-v1';
  let activeMovieId = '';
  let decorateFrame = 0;

  const safeParse = raw => {
    try { return JSON.parse(raw); } catch { return null; }
  };
  const today = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const getState = () => safeParse(localStorage.getItem(STORAGE_KEY));
  const saveState = state => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  const esc = value => String(value || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  async function waitForCloudAccount(timeout=2200) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      if (window.MovieCloudAccount?.syncBeforeReload) return window.MovieCloudAccount;
      await sleep(50);
    }
    return window.MovieCloudAccount || null;
  }

  async function reloadAfterCloudSync(hash) {
    if (hash) location.hash = hash;
    const account = await waitForCloudAccount();
    if (account?.syncBeforeReload) {
      try { await Promise.race([account.syncBeforeReload(), sleep(2600)]); } catch {}
    }
    location.reload();
  }

  function normalizeLegacyStatuses() {
    const state = getState();
    if (!state || !Array.isArray(state.movies)) return false;
    let changed = false;
    for (const movie of state.movies) {
      movie.personal = movie?.personal && typeof movie.personal === 'object' ? movie.personal : {};
      const current = movie.personal.status || 'want';
      let next = current;
      if (current === 'follow') next = 'want';
      if (movie?.mediaType === 'tv') {
        if (!['want','watching','watched','paused','dropped'].includes(next)) next = 'want';
      } else if (!['want','watched'].includes(next)) {
        next = Array.isArray(movie?.watchHistory) && movie.watchHistory.length ? 'watched' : 'want';
      }
      if (next !== current) {
        movie.personal.status = next;
        movie.updatedAt = new Date().toISOString();
        changed = true;
      }
    }
    if (changed) {
      saveState(state);
      localStorage.setItem(CLOUD_DIRTY_KEY, '1');
    }
    return changed;
  }

  function setSelectOptions(select, options, current) {
    if (!select) return;
    const fallback = options.some(([value]) => value === current) ? current : 'want';
    select.innerHTML = options.map(([value,label]) => `<option value="${esc(value)}" ${value===fallback?'selected':''}>${esc(label)}</option>`).join('');
    select.value = fallback;
  }

  function cleanAdminStatusControls() {
    for (const id of ['movieAdminStatus','meStatus']) {
      const select = document.getElementById(id);
      if (!select) continue;
      select.querySelectorAll('option').forEach(option => {
        if (option.value === 'follow' || option.textContent.trim() === '关注') option.remove();
      });
      if (select.value === 'follow') select.value = id === 'movieAdminStatus' ? '' : 'want';
    }
  }

  function syncAdminEditorStatusOptions() {
    const type = document.getElementById('meType');
    const status = document.getElementById('meStatus');
    if (!status) return;
    let current = status.value === 'follow' ? 'want' : (status.value || 'want');
    const options = type?.value === 'tv'
      ? [['want','想看'],['watching','在看'],['watched','已看完'],['paused','暂停'],['dropped','弃剧']]
      : [['want','想看'],['watched','已看']];
    if (!options.some(([value]) => value === current) && type?.value !== 'tv') {
      const id = document.getElementById('meId')?.value || '';
      const movie = getState()?.movies?.find(item => String(item?.id || '') === String(id));
      current = Array.isArray(movie?.watchHistory) && movie.watchHistory.length ? 'watched' : 'want';
    }
    setSelectOptions(status, options, current);
  }

  if (IS_ADMIN) {
    normalizeLegacyStatuses();
    const bootAdmin = () => {
      cleanAdminStatusControls();
      document.addEventListener('change', event => {
        if (event.target?.id === 'meType') syncAdminEditorStatusOptions();
      });
      document.addEventListener('click', event => {
        if (event.target.closest?.('[data-edit-movie],#movieAdd')) queueMicrotask(syncAdminEditorStatusOptions);
      });
      document.addEventListener('focusin', event => {
        if (event.target?.id === 'meTitle') syncAdminEditorStatusOptions();
      });
      document.addEventListener('submit', event => {
        if (event.target?.id !== 'movieEditor') return;
        syncAdminEditorStatusOptions();
        const status = document.getElementById('meStatus');
        if (status?.value === 'follow') status.value = 'want';
      }, true);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootAdmin, { once: true });
    else bootAdmin();
    return;
  }

  function injectStyles() {
    if (document.getElementById('libraryCardActionsV2Style')) return;
    const style = document.createElement('style');
    style.id = 'libraryCardActionsV2Style';
    style.textContent = `
      #libraryGrid .lib-poster[data-open-detail]{cursor:pointer}
      #libraryGrid .lib-poster[data-open-detail]:focus-visible{outline:2px solid rgba(159,124,255,.8);outline-offset:-2px}
      #libraryGrid .status-pill{display:none!important;visibility:hidden!important;pointer-events:none!important}
      #libraryGrid .lib-actions{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:6px!important;align-items:stretch!important;width:100%!important}
      #libraryGrid .lib-actions button{width:100%!important;min-width:0!important;height:30px!important;margin:0!important;padding:0 6px!important;display:flex!important;align-items:center!important;justify-content:center!important;white-space:nowrap!important;position:static!important;transform:none!important}
      #libraryGrid .lib-actions button.library-status-btn.want{color:#d8cfff;border-color:rgba(159,124,255,.28);background:rgba(107,74,200,.18)}
      #libraryGrid .lib-actions button.library-status-btn.watched{color:#8ce7bb;border-color:rgba(98,210,162,.24);background:rgba(37,128,91,.16)}
      #libraryGrid .lib-actions button.library-status-btn.watching{color:#9fd4ff;border-color:rgba(100,167,255,.25);background:rgba(46,93,160,.18)}
      #libraryGrid .lib-actions button.library-status-btn.paused,
      #libraryGrid .lib-actions button.library-status-btn.dropped{color:#b3bbcf}
      #libraryPlanDialog{width:min(420px,calc(100vw - 28px));border:1px solid rgba(161,179,255,.22);border-radius:20px;background:linear-gradient(160deg,rgba(11,23,52,.98),rgba(7,16,38,.98));color:#f7f3ff;padding:0;box-shadow:0 28px 80px rgba(0,0,0,.5)}
      #libraryPlanDialog::backdrop{background:rgba(2,6,17,.7);backdrop-filter:blur(6px)}
      .library-plan-head{padding:20px 22px 8px}
      .library-plan-head small{display:block;color:#8d98b6;font-size:11px;letter-spacing:.05em}
      .library-plan-head h3{margin:7px 0 0;font-size:20px;font-weight:650}
      .library-plan-body{padding:10px 22px 22px}
      .library-plan-movie{margin-bottom:14px;color:#cdd4e8;font-size:13px;line-height:1.6}
      .library-plan-body label{display:block;color:#9ca7c4;font-size:11px;margin-bottom:7px}
      .library-plan-date{width:100%;height:44px;border:1px solid rgba(161,179,255,.2);border-radius:12px;background:rgba(6,16,39,.8);color:#eef1fb;padding:0 12px;outline:none;color-scheme:dark}
      .library-plan-date:focus{border-color:rgba(159,124,255,.56);box-shadow:0 0 0 3px rgba(159,124,255,.09)}
      .library-plan-note{margin-top:8px;color:#7884a3;font-size:10px}
      .library-plan-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}
      .library-plan-actions button{height:36px;padding:0 14px;border-radius:10px;border:1px solid rgba(161,179,255,.18);background:rgba(18,30,64,.72);color:#dce2f5}
      .library-plan-actions button.primary{border-color:rgba(159,124,255,.35);background:linear-gradient(135deg,rgba(111,97,244,.78),rgba(91,75,204,.82));color:#fff}
    `;
    document.head.appendChild(style);
  }

  function ensureDialog() {
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

  function cleanFollowControls() {
    const statusList = document.getElementById('libStatusOptions');
    statusList?.querySelectorAll('option').forEach(option => {
      if (option.value === '关注' || option.value === 'follow') option.remove();
    });
    const statusInput = document.getElementById('libStatus');
    if (statusInput && (statusInput.value === '关注' || statusInput.value === 'follow')) statusInput.value = '';

    const movieStatus = document.getElementById('movieStatusInput');
    if (movieStatus) {
      movieStatus.querySelectorAll('option').forEach(option => {
        if (option.value === 'follow' || option.textContent.trim() === '关注') option.remove();
      });
      if (movieStatus.value === 'follow' || !movieStatus.value) movieStatus.value = 'want';
    }
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

  function rebuildCardActions(card, movieMap) {
    const edit = card.querySelector('[data-edit-id]');
    const cycle = card.querySelector('[data-cycle-status]');
    const existingStatus = card.querySelector('[data-library-status]');
    const id = edit?.dataset.editId || cycle?.dataset.cycleStatus || existingStatus?.dataset.libraryStatus || card.querySelector('[data-select-id]')?.dataset.selectId || '';
    if (!id) return;

    const poster = card.querySelector('.lib-poster');
    if (poster && poster.dataset.openDetail !== id) {
      poster.dataset.openDetail = id;
      poster.setAttribute('role', 'button');
      poster.setAttribute('tabindex', '0');
      poster.setAttribute('aria-label', '打开作品详情');
    }

    const movie = movieMap.get(String(id));
    const [statusClass, statusLabel] = statusInfo(movie);
    const actions = card.querySelector('.lib-actions');
    if (!actions) return;

    const signature = `${id}|${statusClass}`;
    if (actions.dataset.libraryActionsV2 === signature && actions.children.length === 3) return;

    actions.dataset.libraryActionsV2 = signature;
    actions.innerHTML = `
      <button type="button" class="library-status-btn ${esc(statusClass)}" data-library-status="${esc(id)}">${esc(statusLabel)}</button>
      <button type="button" data-edit-id="${esc(id)}">编辑</button>
      <button type="button" data-library-plan="${esc(id)}">计划</button>`;
  }

  function decorateLibraryCards() {
    const grid = document.getElementById('libraryGrid');
    if (!grid) return;
    const cards = grid.querySelectorAll('.lib-card');
    if (!cards.length) {
      cleanFollowControls();
      return;
    }

    const state = getState();
    const movieMap = new Map((state?.movies || []).map(movie => [String(movie.id), movie]));
    cards.forEach(card => rebuildCardActions(card, movieMap));
    cleanFollowControls();
  }

  function scheduleDecorate() {
    if (decorateFrame) return;
    decorateFrame = requestAnimationFrame(() => {
      decorateFrame = 0;
      decorateLibraryCards();
    });
  }

  function openPlan(movieId) {
    const state = getState();
    const movie = state?.movies?.find(m => String(m.id) === String(movieId));
    if (!movie) return;
    activeMovieId = String(movieId);
    const dialog = ensureDialog();
    const name = document.getElementById('libraryPlanMovieName');
    const date = document.getElementById('libraryPlanDate');
    if (name) name.textContent = `《${movie?.info?.title || '未命名作品'}》`;
    if (date) date.value = today();
    dialog.showModal();
    try { date?.showPicker?.(); } catch {}
  }

  async function savePlan() {
    if (!activeMovieId) return;
    const dateInput = document.getElementById('libraryPlanDate');
    const plannedDate = dateInput?.value || today();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(plannedDate)) return;

    const state = getState();
    const movie = state?.movies?.find(m => String(m.id) === String(activeMovieId));
    if (!movie) return;
    const month = plannedDate.slice(0, 7);
    movie.plans = Array.isArray(movie.plans) ? movie.plans : [];
    let plan = movie.plans.find(p => p?.month === month);
    if (!plan) {
      plan = { month, status: 'planned', plannedDate, movedTo: null };
      movie.plans.push(plan);
    } else {
      plan.status = 'planned';
      plan.plannedDate = plannedDate;
      plan.movedTo = null;
    }
    movie.updatedAt = new Date().toISOString();
    saveState(state);
    document.getElementById('libraryPlanDialog')?.close();
    await reloadAfterCloudSync('library');
  }

  async function toggleStatus(movieId) {
    const state = getState();
    const movie = state?.movies?.find(m => String(m.id) === String(movieId));
    if (!movie) return;
    movie.personal = movie.personal || {};

    if (movie.mediaType === 'tv') {
      const order = ['want', 'watching', 'watched', 'paused', 'dropped'];
      const current = movie.personal.status === 'follow' ? 'want' : (movie.personal.status || 'want');
      const idx = Math.max(0, order.indexOf(current));
      movie.personal.status = order[(idx + 1) % order.length];
    } else {
      const current = movie.personal.status === 'watched' ? 'watched' : 'want';
      movie.personal.status = current === 'watched' ? 'want' : 'watched';
      if (movie.personal.status === 'watched') {
        movie.watchHistory = Array.isArray(movie.watchHistory) ? movie.watchHistory : [];
        if (!movie.watchHistory.some(w => w?.date === today())) {
          movie.watchHistory.push({ date: today(), rating: movie.personal.rating ?? null, note: '', venue: '' });
        }
      }
    }

    movie.updatedAt = new Date().toISOString();
    saveState(state);
    const nextHash = location.hash.startsWith('#detail/') ? location.hash.slice(1) : 'library';
    await reloadAfterCloudSync(nextHash);
  }

  function currentDetailMovieId() {
    const raw = location.hash.replace(/^#/, '');
    if (!raw.startsWith('detail/')) return '';
    try { return decodeURIComponent(raw.slice(7)); } catch { return raw.slice(7); }
  }

  document.addEventListener('click', event => {
    const detailStatus = event.target.closest?.('#detailStatusBtn');
    if (detailStatus) {
      const id = currentDetailMovieId();
      if (id) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        toggleStatus(id);
      }
      return;
    }

    const statusButton = event.target.closest?.('[data-library-status]');
    if (statusButton && statusButton.closest('#libraryGrid')) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      toggleStatus(statusButton.dataset.libraryStatus);
      return;
    }

    const planButton = event.target.closest?.('[data-library-plan],[data-cycle-status]');
    if (planButton && planButton.closest('#libraryGrid')) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      openPlan(planButton.dataset.libraryPlan || planButton.dataset.cycleStatus);
      return;
    }

    if (event.target.closest?.('[data-edit-id],#detailEditBtn,[data-match-edit],#addMovieBtn')) {
      queueMicrotask(cleanFollowControls);
    }

    if (event.target.closest?.('[data-library-plan-cancel]')) {
      event.preventDefault();
      document.getElementById('libraryPlanDialog')?.close();
      return;
    }

    if (event.target.closest?.('[data-library-plan-save]')) {
      event.preventDefault();
      savePlan();
    }
  }, true);

  document.addEventListener('change', event => {
    if (event.target?.id === 'movieMediaTypeInput') queueMicrotask(cleanFollowControls);
  }, true);

  document.addEventListener('submit', event => {
    if (event.target?.id !== 'movieForm') return;
    const status = document.getElementById('movieStatusInput');
    if (status?.value === 'follow') status.value = 'want';
  }, true);

  document.addEventListener('input', event => {
    if (event.target?.id !== 'libStatus') return;
    if (event.target.value === '关注' || event.target.value === 'follow') event.target.value = '';
  }, true);

  document.addEventListener('keydown', event => {
    const poster = event.target.closest?.('#libraryGrid .lib-poster[data-open-detail]');
    if (!poster || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    poster.click();
  });

  function boot() {
    injectStyles();
    ensureDialog();
    const migrated = normalizeLegacyStatuses();
    if (migrated) {
      location.reload();
      return;
    }
    decorateLibraryCards();

    const grid = document.getElementById('libraryGrid');
    if (grid) {
      const observer = new window.MovieMutationObserver(scheduleDecorate);
      observer.observe(grid, { childList: true });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();