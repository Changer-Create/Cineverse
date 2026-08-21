(() => {
  'use strict';
  if (/(?:^|\/)(?:admin|admin-console)\.html$/i.test(location.pathname)) return;

  const APP_KEY = 'movie-collection-v2';
  let editing = null;

  const safeParse = raw => { try { return JSON.parse(raw); } catch { return null; } };
  const readState = () => safeParse(localStorage.getItem(APP_KEY));
  const currentMovieId = () => {
    const raw = location.hash.replace(/^#/, '');
    if (!raw.startsWith('detail/')) return '';
    try { return decodeURIComponent(raw.slice(7)); } catch { return raw.slice(7); }
  };
  const normalizedRating = value => {
    if (value === '' || value === null || value === undefined) return null;
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? Math.min(10, n) : null;
  };
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  function modalParts() {
    const modal = document.getElementById('watchModal');
    const form = document.getElementById('watchForm');
    return {
      modal,
      form,
      title: modal?.querySelector('.modal-head h3') || null,
      submit: form?.querySelector('button[type="submit"]') || null,
      date: document.getElementById('watchDateInput'),
      rating: document.getElementById('watchRatingInput'),
      venue: document.getElementById('watchVenueInput'),
      note: document.getElementById('watchNoteInput')
    };
  }

  function resetModalCopy() {
    const { title, submit } = modalParts();
    if (title && title.textContent !== '记录一次观看') title.textContent = '记录一次观看';
    if (submit && submit.textContent !== '保存观看记录') submit.textContent = '保存观看记录';
  }

  function clearEditing() {
    editing = null;
    resetModalCopy();
  }

  function sortedHistory(movie) {
    return [...(movie?.watchHistory || [])].sort((a, b) => String(b?.date || '').localeCompare(String(a?.date || '')));
  }

  function decorateWatchRows() {
    const list = document.getElementById('detailWatchList');
    if (!list) return;
    list.querySelectorAll('[data-delete-watch]').forEach(deleteButton => {
      const displayIndex = String(deleteButton.dataset.deleteWatch || '');
      if (deleteButton.parentElement?.querySelector(`[data-edit-watch="${CSS.escape(displayIndex)}"]`)) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'watch-record-edit-btn';
      button.dataset.editWatch = displayIndex;
      button.textContent = '✎';
      button.title = '编辑观影记录';
      button.setAttribute('aria-label', '编辑观影记录');
      deleteButton.insertAdjacentElement('beforebegin', button);
    });
  }

  function openEditor(displayIndex) {
    const state = readState();
    const movieId = currentMovieId();
    const movie = state?.movies?.find(item => String(item?.id || '') === movieId);
    if (!movie) return;

    const sorted = sortedHistory(movie);
    const target = sorted[Number(displayIndex)];
    if (!target) return;
    const originalIndex = (movie.watchHistory || []).indexOf(target);
    if (originalIndex < 0) return;

    const { modal, title, submit, date, rating, venue, note } = modalParts();
    if (!modal || !date || !rating || !venue || !note) return;

    editing = { movieId, originalIndex };
    date.value = String(target.date || '').slice(0, 10) || today();
    const score = normalizedRating(target.rating);
    rating.value = score == null ? '' : String(score);
    venue.value = String(target.venue || '');
    note.value = String(target.note || '');
    if (title) title.textContent = '编辑观影记录';
    if (submit) submit.textContent = '保存修改';
    modal.showModal();
  }

  async function saveEdit() {
    if (!editing) return false;
    const state = readState();
    const movie = state?.movies?.find(item => String(item?.id || '') === editing.movieId);
    const record = movie?.watchHistory?.[editing.originalIndex];
    if (!movie || !record) {
      clearEditing();
      return false;
    }

    const { modal, date, rating, venue, note } = modalParts();
    if (!date || !rating || !venue || !note) return false;

    record.date = date.value || today();
    record.rating = normalizedRating(rating.value);
    record.venue = venue.value.trim();
    record.note = note.value.trim();

    const month = String(record.date || '').slice(0, 7);
    const plan = (movie.plans || []).find(item => item?.month === month);
    if (plan) plan.status = 'completed';
    movie.updatedAt = new Date().toISOString();

    localStorage.setItem(APP_KEY, JSON.stringify(state));
    modal?.close();
    clearEditing();

    try {
      if (typeof window.MovieCloudAccount?.syncBeforeReload === 'function') {
        await Promise.race([
          window.MovieCloudAccount.syncBeforeReload(),
          new Promise(resolve => setTimeout(() => resolve(false), 2800))
        ]);
      }
    } catch {}
    location.reload();
    return true;
  }

  function injectStyle() {
    if (document.getElementById('watchRecordEditV1Style')) return;
    const style = document.createElement('style');
    style.id = 'watchRecordEditV1Style';
    style.textContent = `
      #detailWatchList .watch-record-edit-btn{
        width:38px;height:38px;display:inline-grid;place-items:center;flex:0 0 auto;
        border:1px solid rgba(161,179,255,.18);border-radius:11px;
        background:rgba(15,29,63,.7);color:#b9c5df;font-size:16px;line-height:1;
        transition:.16s ease;
      }
      #detailWatchList .watch-record-edit-btn:hover{
        border-color:rgba(159,124,255,.48);background:rgba(111,97,244,.16);color:#fff;
      }
      #detailWatchList [data-delete-watch] + .watch-record-edit-btn{margin-left:7px}
    `;
    document.head.appendChild(style);
  }

  function boot() {
    injectStyle();
    decorateWatchRows();
    const list = document.getElementById('detailWatchList');
    if (list) {
      new MutationObserver(() => decorateWatchRows()).observe(list, { childList:true, subtree:true });
    }
    const modal = document.getElementById('watchModal');
    modal?.addEventListener('close', () => {
      if (editing) clearEditing();
    });
  }

  document.addEventListener('click', event => {
    const editButton = event.target.closest?.('[data-edit-watch]');
    if (editButton) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      openEditor(editButton.dataset.editWatch);
    }
  }, true);

  document.addEventListener('submit', event => {
    if (event.target?.id !== 'watchForm' || !editing) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    saveEdit().catch(() => {
      const submit = modalParts().submit;
      if (submit) submit.disabled = false;
    });
  }, true);

  window.addEventListener('hashchange', () => {
    clearEditing();
    requestAnimationFrame(decorateWatchRows);
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
