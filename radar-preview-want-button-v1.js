(() => {
  'use strict';
  if (/(?:^|\/)(?:admin|admin-console)\.html$/i.test(location.pathname)) return;

  const HOST_ID = 'radarPreviewWantHost';
  const BUTTON_ID = 'detailStatusBtn';
  let originalParent = null;
  let originalNextSibling = null;

  function isPreview() {
    return location.hash.startsWith('#radar-preview/');
  }

  function ensureStyle() {
    if (document.getElementById('radarPreviewWantButtonStyle')) return;
    const style = document.createElement('style');
    style.id = 'radarPreviewWantButtonStyle';
    style.textContent = `
      #${HOST_ID}{display:none;margin:14px 0 18px}
      html.radar-detail-preview #${HOST_ID}{display:flex}
      #${HOST_ID} #${BUTTON_ID}{
        display:inline-flex!important;
        align-items:center;
        justify-content:center;
        min-width:132px;
        height:42px;
        padding:0 20px;
        border-radius:12px;
        border:1px solid rgba(159,124,255,.45);
        background:linear-gradient(90deg,#7657e8,#596fdc);
        color:#fff;
        font-weight:700;
        box-shadow:0 10px 28px rgba(89,111,220,.18);
      }
      #${HOST_ID} #${BUTTON_ID}:hover{filter:brightness(1.06);transform:translateY(-1px)}
      #${HOST_ID} #${BUTTON_ID}:disabled{opacity:.65;cursor:wait;transform:none}
    `;
    document.head.appendChild(style);
  }

  function ensureHost() {
    let host = document.getElementById(HOST_ID);
    if (host) return host;
    const note = document.getElementById('radarPreviewNote');
    if (!note) return null;
    host = document.createElement('div');
    host.id = HOST_ID;
    host.setAttribute('aria-label', '电影雷达详情操作');
    note.insertAdjacentElement('afterend', host);
    return host;
  }

  function moveButtonIntoPreview() {
    const button = document.getElementById(BUTTON_ID);
    const host = ensureHost();
    if (!button || !host) return;

    if (!originalParent) {
      originalParent = button.parentNode;
      originalNextSibling = button.nextSibling;
    }

    if (button.parentNode !== host) host.appendChild(button);
    if (button.textContent !== '＋ 想看') button.textContent = '＋ 想看';
    button.disabled = false;
    button.title = '加入影视库并标记为想看';
  }

  function restoreButton() {
    const button = document.getElementById(BUTTON_ID);
    if (!button || !originalParent || button.parentNode === originalParent) return;
    if (originalNextSibling && originalNextSibling.parentNode === originalParent) {
      originalParent.insertBefore(button, originalNextSibling);
    } else {
      originalParent.prepend(button);
    }
  }

  function sync() {
    ensureStyle();
    if (isPreview()) moveButtonIntoPreview();
    else restoreButton();
  }

  function syncSoon() {
    requestAnimationFrame(() => requestAnimationFrame(sync));
  }

  window.addEventListener('hashchange', syncSoon);
  window.addEventListener('pageshow', syncSoon);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncSoon, { once: true });
  } else {
    syncSoon();
  }
})();
