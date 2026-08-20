(() => {
  'use strict';
  if (/(?:^|\/)(?:admin|admin-console)\.html$/i.test(location.pathname)) return;

  const STORAGE_KEY = 'movie-collection-v2';
  let activeMovieId = '';
  let migrationScheduled = false;

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

  function migrateFollowStatuses({ reload = false } = {}) {
    const state = getState();
    if (!state || !Array.isArray(state.movies)) return false;
    let changed = false;
    for (const movie of state.movies) {
      if (movie?.personal?.status === 'follow') {
        movie.personal.status = 'want';
        movie.updatedAt = new Date().toISOString();
        changed = true;
      }
    }
    if (!changed) return false;
    saveState(state);
    if (reload) {
      const hash = location.hash || '#library';
      location.replace(`${location.pathname}${location.search}${hash}`);
      location.reload();
    }
    return true;
  }

  function scheduleMigrationCheck() {
    if (migrationScheduled) return;
    migrationScheduled = true;
    queueMicrotask(() => {
      migrationScheduled = false;
      migrateFollowStatuses({ reload: true });
    });
  }

  function injectStyles() {
    if (document.getElementById('libraryCardActionsV2Style')) return;
    const style = document.createElement('style');
    style.id = 'libraryCardActionsV2Style';
    style.textContent = `
      #libraryGrid .lib-poster[data-open-detail]{cursor:pointer}
      #libraryGrid .lib-poster[data-open-detail]:focus-visible{outline:2px solid rgba(159,124,255,.8);outline-offset:-2px}
      #libraryGrid .lib-actions{grid-template-columns:1fr 1fr}
      #libraryGrid .lib-actions button{min-width:0}
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

    document.querySelectorAll('.status-pill.follow').forEach(pill => {
      pill.classList.remove('follow');
      pill.classList.add('want');
      pill.textContent = '想看';
    });
  }

  function rebuildCardActions(card) {
    const edit = card.querySelector('[data-edit-id]');
    const cycle = card.querySelector('[data-cycle-status]');
    const id = edit?.dataset.editId || cycle?.dataset.cycleStatus || card.querySelector('[data-select-id]')?.dataset.selectId || '';
    if (!id) return;

    const poster = card.querySelector('.lib-poster');
    if (poster) {
      poster.dataset.openDetail = id;
      poster.setAttribute('role', 'button');
      poster.setAttribute('tabindex', '0');
      poster.setAttribute('aria-label', '打开作品详情');
    }

    const actions = card.querySelector('.lib-actions');
    if (!actions) return;
    if (actions.dataset.libraryActionsV2 === id) return;
    actions.dataset.libraryActionsV2 = id;
    actions.innerHTML = `
      <button type="button" data-edit-id="${String(id).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}">编辑</button>
      <button type="button" data-library-plan="${String(id).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}">计划</button>`;
  }

  function decorateLibraryCards() {
    document.querySelectorAll('#libraryGrid .lib-card').forEach(rebuildCardActions);
    cleanFollowControls();
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

  function savePlan() {
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
    location.hash = 'library';
    location.reload();
  }

  document.addEventListener('click', event => {
    const planButton = event.target.closest?.('[data-library-plan],[data-cycle-status]');
    if (planButton && planButton.closest('#libraryGrid')) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      openPlan(planButton.dataset.libraryPlan || planButton.dataset.cycleStatus);
      return;
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

  document.addEventListener('keydown', event => {
    const poster = event.target.closest?.('#libraryGrid .lib-poster[data-open-detail]');
    if (!poster || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    poster.click();
  });

  const observer = new MutationObserver(() => {
    decorateLibraryCards();
    scheduleMigrationCheck();
  });

  function boot() {
    injectStyles();
    ensureDialog();
    if (migrateFollowStatuses({ reload: true })) return;
    decorateLibraryCards();
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
