(() => {
  'use strict';

  const BUTTON_ID = 'libraryDoubanImportBtn';
  const DIALOG_ID = 'libraryDoubanImportDialog';
  let placeholder = null;
  let doubanCard = null;

  function injectStyles() {
    if (document.getElementById('libraryDoubanImportDialogStyle')) return;
    const style = document.createElement('style');
    style.id = 'libraryDoubanImportDialogStyle';
    style.textContent = `
      #${DIALOG_ID}{
        width:min(920px,calc(100vw - 32px));
        max-height:calc(100vh - 36px);
        padding:0;
        border:0;
        background:transparent;
        color:inherit;
        overflow:auto;
      }
      #${DIALOG_ID}::backdrop{background:rgba(2,6,17,.74);backdrop-filter:blur(7px)}
      #${DIALOG_ID} .library-douban-modal-shell{position:relative}
      #${DIALOG_ID} .settings-card-douban{margin:0!important;min-height:0}
      #${DIALOG_ID} .library-douban-modal-close{
        position:absolute;right:18px;top:16px;z-index:5;
        width:34px;height:34px;border-radius:10px;
        border:1px solid rgba(161,179,255,.18);
        background:rgba(9,19,44,.92);color:#cfd6e9;
        display:grid;place-items:center;font-size:20px;line-height:1;
      }
      #${DIALOG_ID} .library-douban-modal-close:hover{border-color:rgba(173,140,255,.42);color:#fff}
      @media(max-width:700px){
        #${DIALOG_ID}{width:calc(100vw - 18px);max-height:calc(100vh - 18px)}
        #${DIALOG_ID} .library-douban-modal-close{right:12px;top:12px}
      }
    `;
    document.head.appendChild(style);
  }

  function ensureDialog() {
    let dialog = document.getElementById(DIALOG_ID);
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = DIALOG_ID;
    dialog.innerHTML = '<div class="library-douban-modal-shell"><button class="library-douban-modal-close" type="button" aria-label="关闭">×</button><div data-library-douban-mount></div></div>';
    document.body.appendChild(dialog);
    dialog.querySelector('.library-douban-modal-close')?.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener('close', restoreCard);
    return dialog;
  }

  function restoreCard() {
    if (!doubanCard || !placeholder?.parentNode) return;
    placeholder.parentNode.replaceChild(doubanCard, placeholder);
    placeholder = null;
    doubanCard = null;
  }

  function openImportDialog() {
    const card = document.querySelector('.settings-card-douban');
    if (!card) return;
    const dialog = ensureDialog();
    if (dialog.open) return;

    placeholder = document.createComment('douban-import-card-placeholder');
    card.parentNode?.replaceChild(placeholder, card);
    doubanCard = card;
    dialog.querySelector('[data-library-douban-mount]')?.appendChild(card);
    dialog.showModal();
  }

  function installButton() {
    const matchButton = document.getElementById('batchTmdbBtn');
    if (!matchButton || document.getElementById(BUTTON_ID)) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tool-btn';
    button.id = BUTTON_ID;
    button.textContent = '☑ 导入豆瓣片单';
    button.addEventListener('click', openImportDialog);
    matchButton.parentNode?.insertBefore(button, matchButton);
  }

  function boot() {
    injectStyles();
    installButton();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
