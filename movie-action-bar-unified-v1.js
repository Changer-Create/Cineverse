(() => {
  'use strict';
  if (window.__CINEVERSE_MOVIE_ACTION_BAR_UNIFIED_V1__) return;
  window.__CINEVERSE_MOVIE_ACTION_BAR_UNIFIED_V1__ = true;

  const style = document.createElement('style');
  style.id = 'movieActionBarUnifiedStyleV1';
  style.textContent = `
    .movie-action-unified-v1 { display:flex!important; gap:8px!important; width:100%; }
    .movie-action-unified-v1 > * { flex:1!important; height:36px!important; display:flex!important; align-items:center!important; justify-content:center!important; white-space:nowrap!important; }
    #libraryGrid .movie-action-unified-v1 > * { height:29px!important; font-size:9px!important; }
  `;
  document.head.appendChild(style);

  const createButton = (text, cls, handler) => {
    const b = document.createElement('button');
    b.className = cls;
    b.type = 'button';
    b.textContent = text;
    b.addEventListener('click', e => { e.stopPropagation(); handler?.(); });
    return b;
  };

  function syncLibraryCards() {
    document.querySelectorAll('#libraryGrid .lib-card').forEach(card => {
      const actions = card.querySelector('.lib-actions.library-actions-system-v1');
      if (!actions || actions.dataset.unified === '1') return;
      actions.dataset.unified = '1';
      actions.classList.add('movie-action-unified-v1');

      if (!actions.querySelector('.library-edit-btn')) {
        const id = card.dataset.id || card.querySelector('[data-open-detail]')?.dataset.openDetail || '';
        actions.appendChild(createButton('编辑资料', 'library-edit-btn', () => {
          if (id) location.hash = `#detail/${id}`;
          setTimeout(() => document.querySelector('[data-edit-movie]')?.click(), 120);
        }));
      }
    });
  }

  function syncDetailButtons() {
    const root = document.getElementById('detailView');
    if (!root) return;
    const candidates = [...root.querySelectorAll('button')].filter(b => /想看|加入本月计划|计划|编辑资料|记录一次观看|添加观看记录/.test(b.textContent || ''));
    if (candidates.length < 3) return;
    const bar = candidates[0].parentElement;
    if (!bar || bar.dataset.actionUnified === '1') return;
    bar.dataset.actionUnified = '1';
    bar.classList.add('movie-action-unified-v1');
    const texts = ['想看', '添加观看记录', '计划', '编辑资料'];
    candidates.slice(0,4).forEach((b,i)=>{ if(texts[i]) b.textContent = texts[i]; });
  }

  function run(){ syncLibraryCards(); syncDetailButtons(); }
  run();
  const observer = new MutationObserver(run);
  observer.observe(document.body, {childList:true, subtree:true});
})();
