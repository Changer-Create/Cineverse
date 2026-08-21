(() => {
  'use strict';
  if (/(?:^|\/)(?:admin|admin-console)\.html$/i.test(location.pathname)) return;

  const PAGE_SIZE = 3;
  let currentPage = 1;
  let lastMovieId = '';

  const currentMovieId = () => {
    const raw = location.hash.replace(/^#/, '');
    if (!raw.startsWith('detail/')) return '';
    try { return decodeURIComponent(raw.slice(7)); } catch { return raw.slice(7); }
  };

  function ensurePagedShell() {
    const list = document.getElementById('detailWatchList');
    if (!list) return null;

    const existing = list.closest('.watch-history-paged');
    if (existing) {
      return {
        shell: existing,
        list,
        prev: existing.querySelector('[data-watch-history-prev]'),
        next: existing.querySelector('[data-watch-history-next]'),
        page: existing.querySelector('[data-watch-history-page]')
      };
    }

    const shell = document.createElement('div');
    shell.className = 'watch-history-paged';
    list.insertAdjacentElement('beforebegin', shell);
    shell.appendChild(list);

    const pager = document.createElement('div');
    pager.className = 'watch-history-pager';
    pager.innerHTML = `
      <button type="button" data-watch-history-prev aria-label="上一页">‹ 上一页</button>
      <span data-watch-history-page>第 1 / 1 页</span>
      <button type="button" data-watch-history-next aria-label="下一页">下一页 ›</button>
    `;
    shell.appendChild(pager);

    return {
      shell,
      list,
      prev: pager.querySelector('[data-watch-history-prev]'),
      next: pager.querySelector('[data-watch-history-next]'),
      page: pager.querySelector('[data-watch-history-page]')
    };
  }

  function renderPage({ reset = false } = {}) {
    const parts = ensurePagedShell();
    if (!parts) return;

    const movieId = currentMovieId();
    if (reset || movieId !== lastMovieId) {
      currentPage = 1;
      lastMovieId = movieId;
    }

    const rows = Array.from(parts.list.children).filter(node => node.classList?.contains('watch-entry'));
    const empty = parts.list.querySelector('.watch-empty');
    parts.shell.classList.toggle('is-empty', !rows.length && !!empty);

    if (!rows.length) {
      currentPage = 1;
      if (parts.page) parts.page.textContent = '第 1 / 1 页';
      if (parts.prev) parts.prev.disabled = true;
      if (parts.next) parts.next.disabled = true;
      parts.shell.classList.add('single-page');
      return;
    }

    const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    currentPage = Math.min(Math.max(1, currentPage), totalPages);
    const start = (currentPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;

    rows.forEach((row, index) => {
      row.classList.toggle('watch-page-hidden', index < start || index >= end);
      row.dataset.watchPageSlot = String((index - start + PAGE_SIZE) % PAGE_SIZE + 1);
    });

    if (parts.page) parts.page.textContent = `第 ${currentPage} / ${totalPages} 页`;
    if (parts.prev) parts.prev.disabled = currentPage <= 1;
    if (parts.next) parts.next.disabled = currentPage >= totalPages;
    parts.shell.classList.toggle('single-page', totalPages <= 1);
  }

  function injectStyle() {
    if (document.getElementById('watchHistoryPaginationV1Style')) return;
    const style = document.createElement('style');
    style.id = 'watchHistoryPaginationV1Style';
    style.textContent = `
      #detailView .detail-unified-lower .watch-history-paged{
        grid-column:1;
        grid-row:1 / span 2;
        min-width:0;
        min-height:0;
        align-self:start;
        display:grid;
        grid-template-rows:auto 38px;
        gap:10px;
      }
      #detailView .detail-unified-lower .watch-history-paged #detailWatchList{
        grid-column:auto!important;
        grid-row:auto!important;
        width:100%;
        height:clamp(420px,48vh,510px);
        min-height:420px;
        max-height:510px;
        display:grid;
        grid-template-rows:repeat(3,minmax(0,1fr));
        grid-auto-rows:0;
        gap:10px;
        align-content:stretch!important;
        align-self:start!important;
        overflow:hidden;
      }
      #detailView .detail-unified-lower .watch-history-paged.is-empty #detailWatchList{
        height:auto;
        min-height:150px;
        grid-template-rows:1fr;
      }
      #detailView #detailWatchList .watch-entry{
        min-height:0!important;
        height:100%!important;
        max-height:none!important;
        overflow:hidden!important;
        align-items:start;
      }
      #detailView #detailWatchList .watch-entry.watch-page-hidden{
        display:none!important;
      }
      #detailView #detailWatchList .watch-copy{
        display:-webkit-box;
        -webkit-box-orient:vertical;
        -webkit-line-clamp:4;
        line-clamp:4;
        overflow:hidden!important;
        text-overflow:ellipsis;
        max-height:6.4em;
        overflow-wrap:anywhere;
        word-break:break-word;
      }
      #detailView .watch-history-pager{
        min-height:38px;
        display:flex;
        align-items:center;
        justify-content:flex-end;
        gap:9px;
        padding:0 2px;
      }
      #detailView .watch-history-paged.single-page .watch-history-pager{
        visibility:hidden;
      }
      #detailView .watch-history-pager span{
        min-width:76px;
        text-align:center;
        color:#8792af;
        font-size:10px;
      }
      #detailView .watch-history-pager button{
        height:32px;
        border-radius:9px;
        border:1px solid var(--line);
        background:rgba(14,27,59,.7);
        color:#b9c4dd;
        padding:0 10px;
        font-size:10px;
        cursor:pointer;
      }
      #detailView .watch-history-pager button:hover:not(:disabled){
        border-color:rgba(159,124,255,.42);
        color:#fff;
        background:rgba(69,54,130,.28);
      }
      #detailView .watch-history-pager button:disabled{
        opacity:.35;
        cursor:default;
      }

      @media(max-width:1180px){
        #detailView .detail-unified-lower .watch-history-paged{
          grid-column:1;
          grid-row:auto;
        }
      }
      @media(max-width:760px){
        #detailView .detail-unified-lower .watch-history-paged #detailWatchList{
          height:520px;
          min-height:520px;
          max-height:520px;
        }
        #detailView #detailWatchList .watch-copy{
          -webkit-line-clamp:3;
          line-clamp:3;
          max-height:4.8em;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function boot() {
    injectStyle();
    const parts = ensurePagedShell();
    if (!parts) return;

    renderPage({ reset: true });

    new MutationObserver(() => {
      requestAnimationFrame(() => renderPage());
    }).observe(parts.list, { childList: true });
  }

  document.addEventListener('click', event => {
    const prev = event.target.closest?.('[data-watch-history-prev]');
    const next = event.target.closest?.('[data-watch-history-next]');
    if (!prev && !next) return;
    event.preventDefault();

    if (prev && !prev.disabled) currentPage -= 1;
    if (next && !next.disabled) currentPage += 1;
    renderPage();
  });

  window.addEventListener('hashchange', () => {
    currentPage = 1;
    lastMovieId = '';
    requestAnimationFrame(() => renderPage({ reset: true }));
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
