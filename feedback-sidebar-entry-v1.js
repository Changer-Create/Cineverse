(() => {
  'use strict';
  if (/(?:^|\/)(?:admin|admin-console)\.html$/i.test(location.pathname)) return;

  const ENTRY_ID = 'sidebarFeedbackEntry';
  let observer = null;
  let repositionTimer = 0;

  function injectStyle() {
    if (document.getElementById('sidebarFeedbackEntryStyle')) return;
    const style = document.createElement('style');
    style.id = 'sidebarFeedbackEntryStyle';
    style.textContent = `
      #${ENTRY_ID}{margin-top:5px}
      #${ENTRY_ID}::before{content:'';position:absolute;left:12px;right:12px;top:-3px;height:1px;background:rgba(161,179,255,.08)}
      #${ENTRY_ID} .ico{font-size:15px}
      @media(max-width:680px){#${ENTRY_ID}{display:none!important}}
    `;
    document.head.appendChild(style);
  }

  function ensureEntry() {
    const nav = document.querySelector('.sidebar .nav');
    if (!nav) return null;
    let entry = document.getElementById(ENTRY_ID);
    if (!entry) {
      entry = document.createElement('a');
      entry.id = ENTRY_ID;
      entry.href = '#feedback';
      entry.dataset.feedbackOpen = '1';
      entry.title = '问题反馈';
      entry.setAttribute('aria-label', '问题反馈');
      entry.innerHTML = '<span class="ico">🐞</span><span>问题反馈</span>';
      nav.appendChild(entry);
    } else if (entry.parentElement !== nav) {
      nav.appendChild(entry);
    }
    if (nav.lastElementChild !== entry) nav.appendChild(entry);
    return entry;
  }

  function scheduleEnsure() {
    clearTimeout(repositionTimer);
    repositionTimer = setTimeout(ensureEntry, 35);
  }

  function openFeedback() {
    if (window.CineverseFeedback?.open) {
      window.CineverseFeedback.open();
      return;
    }
    document.getElementById('bugFeedbackBtn')?.click();
  }

  function boot() {
    injectStyle();
    const nav = document.querySelector('.sidebar .nav');
    if (!nav) return;
    ensureEntry();
    if (!observer) {
      observer = new window.MovieMutationObserver(() => {
        const entry = document.getElementById(ENTRY_ID);
        if (!entry || nav.lastElementChild !== entry) scheduleEnsure();
      });
      observer.observe(nav, { childList: true });
    }
  }

  document.addEventListener('click', event => {
    const entry = event.target.closest?.(`#${ENTRY_ID},[data-feedback-open]`);
    if (!entry) return;
    event.preventDefault();
    event.stopPropagation();
    openFeedback();
  }, true);

  window.addEventListener('movie-collection:nav-order-updated', scheduleEnsure);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();