(() => {
  'use strict';

  const STORAGE_KEY = 'movie-collection-v2';
  const CLOUD_DIRTY_KEY = 'movie-cloud-dirty-v1';
  const IS_ADMIN = /(?:^|\/)(?:admin|admin-console)\.html$/i.test(location.pathname);

  const safeParse = raw => {
    try { return JSON.parse(raw); } catch { return null; }
  };
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  const getState = () => safeParse(localStorage.getItem(STORAGE_KEY));
  const saveState = state => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    localStorage.setItem(CLOUD_DIRTY_KEY, '1');
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
  async function reloadAfterCloudSync(hash) {
    if (hash) location.hash = hash;
    const account = await waitForCloudAccount();
    if (account?.syncBeforeReload) {
      try { await Promise.race([account.syncBeforeReload(), sleep(2600)]); } catch {}
    }
    location.reload();
  }

  function normalizedStatus(movie, rawStatus) {
    const raw = String(rawStatus || 'want');
    if (movie?.mediaType === 'tv') {
      if (raw === 'watched') return 'watched';
      if (raw === 'watching' || raw === 'paused' || raw === 'dropped') return 'watching';
      return 'want';
    }
    if (raw === 'watched') return 'watched';
    if (raw === 'want' || raw === 'follow' || raw === 'planned') return 'want';
    return Array.isArray(movie?.watchHistory) && movie.watchHistory.length ? 'watched' : 'want';
  }

  function normalizeStoredState() {
    const state = getState();
    if (!state || !Array.isArray(state.movies)) return 0;
    let changed = 0;
    for (const movie of state.movies) {
      movie.personal = movie?.personal && typeof movie.personal === 'object' ? movie.personal : {};
      const current = String(movie.personal.status || 'want');
      const next = normalizedStatus(movie, current);
      if (next !== current) {
        movie.personal.status = next;
        movie.updatedAt = new Date().toISOString();
        changed += 1;
      }
    }
    if (changed) saveState(state);
    return changed;
  }

  function optionsFor(type) {
    return type === 'tv'
      ? [['want','想看'],['watching','在看'],['watched','已看']]
      : [['want','想看'],['watched','已看']];
  }

  function applyOptions(select, type, movie) {
    if (!select) return;
    const current = normalizedStatus(movie || { mediaType:type }, select.value || movie?.personal?.status || 'want');
    const options = optionsFor(type);
    select.innerHTML = options.map(([value,label]) => `<option value="${value}">${label}</option>`).join('');
    select.value = options.some(([value]) => value === current) ? current : 'want';
  }

  function currentMovieFromForm() {
    const id = document.getElementById('movieId')?.value || document.getElementById('movieFormId')?.value || '';
    return getState()?.movies?.find(movie => String(movie?.id || '') === String(id));
  }

  function enforceFrontEditor() {
    const type = document.getElementById('movieMediaTypeInput')?.value || currentMovieFromForm()?.mediaType || 'movie';
    applyOptions(document.getElementById('movieStatusInput'), type, currentMovieFromForm());
  }

  function currentAdminMovie() {
    const id = document.getElementById('meId')?.value || '';
    return getState()?.movies?.find(movie => String(movie?.id || '') === String(id));
  }

  function enforceAdminEditor() {
    const type = document.getElementById('meType')?.value || currentAdminMovie()?.mediaType || 'movie';
    applyOptions(document.getElementById('meStatus'), type, currentAdminMovie());

    const filter = document.getElementById('movieAdminStatus');
    if (filter) {
      const current = String(filter.value || '');
      filter.innerHTML = '<option value="">全部状态</option><option value="want">想看</option><option value="watching">在看</option><option value="watched">已看</option>';
      filter.value = ['want','watching','watched'].includes(current) ? current : '';
    }
  }

  function currentDetailMovieId() {
    const raw = location.hash.replace(/^#/, '');
    if (!raw.startsWith('detail/')) return '';
    try { return decodeURIComponent(raw.slice(7)); } catch { return raw.slice(7); }
  }

  async function toggleStatus(movieId) {
    const state = getState();
    const movie = state?.movies?.find(item => String(item?.id || '') === String(movieId));
    if (!movie) return;
    movie.personal = movie.personal || {};
    const current = normalizedStatus(movie, movie.personal.status);
    const order = movie.mediaType === 'tv' ? ['want','watching','watched'] : ['want','watched'];
    const index = Math.max(0, order.indexOf(current));
    movie.personal.status = order[(index + 1) % order.length];

    if (movie.mediaType !== 'tv' && movie.personal.status === 'watched') {
      movie.watchHistory = Array.isArray(movie.watchHistory) ? movie.watchHistory : [];
      if (!movie.watchHistory.some(watch => watch?.date === today())) {
        movie.watchHistory.push({ date:today(), rating:movie.personal.rating ?? null, note:'', venue:'' });
      }
    }

    movie.updatedAt = new Date().toISOString();
    saveState(state);
    const nextHash = location.hash.startsWith('#detail/') ? location.hash.slice(1) : 'library';
    await reloadAfterCloudSync(nextHash);
  }

  function normalizeVisibleLabels() {
    document.querySelectorAll('#libraryGrid [data-library-status].watched').forEach(button => {
      if (button.textContent.trim() === '已看完') button.textContent = '已看';
    });
    const detail = document.getElementById('detailStatusBtn');
    const detailId = currentDetailMovieId();
    const movie = detailId ? getState()?.movies?.find(item => String(item?.id || '') === String(detailId)) : null;
    if (detail && movie) {
      const wants = movie?.personal?.want == null ? movie?.personal?.status === 'want' : Boolean(movie.personal.want);
      detail.textContent = wants ? '已想看' : '想看';
      detail.dataset.statusClass = wants ? 'want' : '';
    }
  }

  const migrated = normalizeStoredState();
  if (migrated) {
    location.reload();
    return;
  }

  window.addEventListener('click', event => {
    const cardStatus = event.target.closest?.('[data-library-status]');
    if (cardStatus?.closest('#libraryGrid')) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      toggleStatus(cardStatus.dataset.libraryStatus);
      return;
    }

    if (event.target.closest?.('[data-edit-id],#detailEditBtn,[data-match-edit],#addMovieBtn')) {
      queueMicrotask(enforceFrontEditor);
    }
    if (IS_ADMIN && event.target.closest?.('[data-edit-movie],#movieAdd')) {
      queueMicrotask(enforceAdminEditor);
    }
  }, true);

  window.addEventListener('change', event => {
    if (event.target?.id === 'movieMediaTypeInput') queueMicrotask(enforceFrontEditor);
    if (IS_ADMIN && event.target?.id === 'meType') queueMicrotask(enforceAdminEditor);
  }, true);

  window.addEventListener('focusin', event => {
    if (IS_ADMIN && event.target?.id === 'meTitle') queueMicrotask(enforceAdminEditor);
  }, true);

  window.addEventListener('submit', event => {
    if (event.target?.id === 'movieForm') enforceFrontEditor();
    if (IS_ADMIN && event.target?.id === 'movieEditor') enforceAdminEditor();
  }, true);

  const boot = () => {
    enforceFrontEditor();
    if (IS_ADMIN) enforceAdminEditor();
    normalizeVisibleLabels();
    const grid = document.getElementById('libraryGrid');
    if (grid) {
      new MutationObserver(() => {
        const changed = normalizeStoredState();
        if (changed) {
          location.reload();
          return;
        }
        normalizeVisibleLabels();
      }).observe(grid, { childList:true, subtree:true });
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
