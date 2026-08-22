(() => {
  'use strict';
  if (window.__CINEVERSE_MANUAL_FILTER_PICKER_V1__) return;
  window.__CINEVERSE_MANUAL_FILTER_PICKER_V1__ = true;

  const state = { menu:null, input:null };
  const esc = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  function close() {
    state.menu?.classList.remove('open');
    state.input = null;
  }

  function valuesFor(input) {
    const list = document.getElementById(input?.dataset?.manualList || '');
    if (!list) return [];
    return [...new Set([...list.options].map(option => String(option.value || '').trim()).filter(Boolean))];
  }

  function ensureMenu() {
    if (state.menu) return state.menu;
    const menu = document.createElement('div');
    menu.className = 'manual-filter-menu';
    menu.setAttribute('role', 'listbox');
    menu.addEventListener('mousedown', event => event.preventDefault());
    menu.addEventListener('click', event => {
      const option = event.target.closest('[data-manual-filter-value]');
      if (!option || !state.input) return;
      const input = state.input;
      input.value = option.dataset.manualFilterValue;
      input.dispatchEvent(new Event('input', { bubbles:true }));
      input.dispatchEvent(new Event('change', { bubbles:true }));
      close();
      input.focus();
    });
    document.body.appendChild(menu);
    state.menu = menu;
    return menu;
  }

  function open(input) {
    if (!input || input.disabled) return;
    const menu = ensureMenu();
    if (menu.classList.contains('open') && state.input === input) {
      close();
      return;
    }
    const current = String(input.value || '').trim();
    const values = valuesFor(input);
    menu.innerHTML = values.length
      ? values.map(value => `<button type="button" class="manual-filter-option ${value === current ? 'active' : ''}" data-manual-filter-value="${esc(value)}" role="option">${esc(value)}</button>`).join('')
      : '<div class="manual-filter-empty">暂无可选项</div>';
    const rect = input.parentElement.getBoundingClientRect();
    const width = Math.max(rect.width, 180);
    menu.style.width = `${width}px`;
    menu.style.left = `${Math.min(Math.max(8, rect.left), window.innerWidth - width - 8)}px`;
    menu.style.top = `${Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - 294))}px`;
    menu.classList.add('open');
    state.input = input;
  }

  function setup() {
    document.querySelectorAll('input[data-manual-list]').forEach(input => {
      if (input.dataset.manualPickerReady) return;
      input.dataset.manualPickerReady = '1';
      const wrap = document.createElement('div');
      wrap.className = 'manual-filter-input-wrap';
      input.parentNode.insertBefore(wrap, input);
      wrap.appendChild(input);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'manual-filter-toggle';
      button.setAttribute('aria-label', '展开可选项');
      button.textContent = '▼';
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        open(input);
      });
      input.addEventListener('input', () => { if (state.input === input) close(); });
      input.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
      wrap.appendChild(button);
    });
  }

  document.addEventListener('click', event => {
    if (!event.target.closest('.manual-filter-menu,.manual-filter-toggle')) close();
  });
  window.addEventListener('resize', close);
  window.addEventListener('scroll', event => { if (event.target !== state.menu) close(); }, true);
  setup();
  window.MovieLibraryManualFilterPicker = { setup, close };
})();
