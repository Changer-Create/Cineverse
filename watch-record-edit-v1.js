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

  function ensureNoteTextarea() {
    const current = document.getElementById('watchNoteInput');
    if (!current) return null;
    if (current.tagName === 'TEXTAREA') return current;

    const textarea = document.createElement('textarea');
    textarea.id = 'watchNoteInput';
    textarea.className = current.className || '';
    textarea.value = current.value || '';
    textarea.placeholder = '记录你的感受';
    textarea.rows = 10;
    textarea.setAttribute('aria-label', '记录你的感受');

    current.id = 'watchNoteInputLegacy';
    current.tabIndex = -1;
    current.setAttribute('aria-hidden', 'true');
    current.style.display = 'none';
    current.insertAdjacentElement('beforebegin', textarea);

    const syncLegacy = () => { current.value = textarea.value; };
    textarea.addEventListener('input', syncLegacy);
    textarea.addEventListener('change', syncLegacy);
    return textarea;
  }

  function syncNoteToLegacy() {
    const note = document.getElementById('watchNoteInput');
    const legacy = document.getElementById('watchNoteInputLegacy');
    if (note && legacy) legacy.value = note.value;
  }

  function syncNoteFromLegacy() {
    const note = document.getElementById('watchNoteInput');
    const legacy = document.getElementById('watchNoteInputLegacy');
    if (note && legacy) note.value = legacy.value || '';
  }

  function replaceFieldLabel(input, text) {
    if (!input) return;
    const labels = input.labels ? [...input.labels] : [];
    const label = labels[0] || input.closest('label');
    if (!label) return;

    const walker = document.createTreeWalker(label, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const raw = node.nodeValue || '';
      if (/观影场景\s*\/\s*影院|观看场景/.test(raw)) {
        node.nodeValue = raw.replace(/观影场景\s*\/\s*影院|观看场景/g, text);
        return;
      }
    }
  }

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
      note: ensureNoteTextarea()
    };
  }

  function tuneWatchModal() {
    const { modal, venue, note } = modalParts();
    if (modal) modal.classList.add('watch-record-expanded');
    if (venue) {
      replaceFieldLabel(venue, '观看场景');
      venue.placeholder = '影院 / 家中 / 聚会';
      venue.setAttribute('aria-label', '观看场景');
    }
    if (note) {
      note.placeholder = '记录你的感受';
      note.setAttribute('aria-label', '记录你的感受');
      note.removeAttribute('maxlength');
      note.rows = Math.max(Number(note.rows) || 0, 10);
    }
  }

  function resetModalCopy() {
    const { title, submit } = modalParts();
    if (title && title.textContent !== '记录一次观看') title.textContent = '记录一次观看';
    if (submit && submit.textContent !== '保存观看记录') submit.textContent = '保存观看记录';
    tuneWatchModal();
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
      const existingGroup = deleteButton.closest('.watch-record-actions');
      if (existingGroup?.querySelector(`[data-edit-watch="${CSS.escape(displayIndex)}"]`)) return;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'watch-record-edit-btn';
      button.dataset.editWatch = displayIndex;
      button.textContent = '编辑';
      button.title = '编辑观影记录';
      button.setAttribute('aria-label', '编辑观影记录');

      const actions = document.createElement('div');
      actions.className = 'watch-record-actions';
      deleteButton.insertAdjacentElement('beforebegin', actions);
      actions.append(button, deleteButton);
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

    tuneWatchModal();
    editing = { movieId, originalIndex };
    date.value = String(target.date || '').slice(0, 10) || today();
    const score = normalizedRating(target.rating);
    rating.value = score == null ? '' : String(score);
    venue.value = String(target.venue || '');
    note.value = String(target.note || '');
    syncNoteToLegacy();
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
      #detailWatchList{
        align-content:start;
        align-self:start;
      }
      #detailWatchList .watch-entry{
        align-items:start;
        min-height:0;
        height:auto;
        overflow:hidden;
      }
      #detailWatchList .watch-entry > *{
        min-width:0;
      }
      #detailWatchList .watch-copy{
        overflow-wrap:anywhere;
        word-break:break-word;
      }
      #detailWatchList .watch-record-actions{
        display:flex;align-items:center;justify-content:flex-end;gap:7px;
        width:max-content;min-width:max-content;justify-self:end;align-self:start;
      }
      #detailWatchList .watch-record-edit-btn{
        min-width:48px;height:30px;padding:0 10px;display:inline-grid;place-items:center;flex:0 0 auto;
        border:1px solid rgba(161,179,255,.18);border-radius:9px;
        background:rgba(15,29,63,.7);color:#b9c5df;font-size:11px;line-height:1;
        transition:.16s ease;margin:0;
      }
      #detailWatchList .watch-record-actions [data-delete-watch]{
        flex:0 0 auto;margin:0;
      }
      #detailWatchList .watch-record-edit-btn:hover{
        border-color:rgba(159,124,255,.48);background:rgba(111,97,244,.16);color:#fff;
      }

      #watchModal.watch-record-expanded{
        width:min(1120px,calc(100vw - 36px))!important;
        max-width:1120px!important;
        max-height:calc(100vh - 32px)!important;
      }
      #watchModal.watch-record-expanded .modal-body{
        max-height:calc(100vh - 190px);
        overflow-y:auto;
      }
      #watchModal #watchNoteInput{
        display:block;
        width:100%;
        min-height:260px!important;
        height:clamp(240px,34vh,420px);
        max-height:58vh;
        resize:vertical!important;
        box-sizing:border-box;
        text-align:left!important;
        vertical-align:top!important;
        white-space:pre-wrap;
        overflow:auto;
        line-height:1.8!important;
        padding:14px 16px!important;
      }
      #watchModal #watchNoteInput::placeholder{
        color:#7f8aa8;
      }
      @media(max-width:720px){
        #watchModal.watch-record-expanded{
          width:calc(100vw - 18px)!important;
          max-height:calc(100vh - 18px)!important;
        }
        #watchModal.watch-record-expanded .modal-body{max-height:calc(100vh - 165px)}
        #watchModal #watchNoteInput{min-height:180px!important;height:28vh;max-height:46vh}
      }
    `;
    document.head.appendChild(style);
  }

  function boot() {
    injectStyle();
    tuneWatchModal();
    decorateWatchRows();
    const list = document.getElementById('detailWatchList');
    if (list) {
      new window.MovieMutationObserver(() => decorateWatchRows()).observe(list, { childList:true, subtree:true });
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
    if (event.target.closest?.('#detailAddWatchBtn,#detailAddWatchBtn2')) {
      requestAnimationFrame(() => {
        tuneWatchModal();
        if (!editing) syncNoteFromLegacy();
      });
    }
  }, true);

  document.addEventListener('submit', event => {
    if (event.target?.id !== 'watchForm') return;
    syncNoteToLegacy();
    if (!editing) return;
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
