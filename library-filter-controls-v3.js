(() => {
  'use strict';
  if (/(?:^|\/)(?:admin|admin-console)\.html$/i.test(location.pathname)) return;

  const statusInput = document.getElementById('libStatus');
  const sortInput = document.getElementById('libSort');
  const statusList = document.getElementById('libStatusOptions');
  const sortList = document.getElementById('libSortOptions');
  if (!statusInput || !sortInput || !statusList || !sortList) return;

  const STATUS_OPTIONS = ['全部', '想看', '看过', '在看'];
  const SORT_OPTIONS = [
    '标记时间 · 升序', '标记时间 · 降序',
    '片名（拼音）· 升序', '片名（拼音）· 降序',
    '评分 · 升序', '评分 · 降序',
    '时长 · 升序', '时长 · 降序',
    '年份 · 升序', '年份 · 降序'
  ];
  const DEFAULT_SORT = '标记时间 · 降序';
  const inputValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  const nativeGet = input => inputValue.get.call(input);
  const nativeSet = (input, value) => inputValue.set.call(input, value);

  const titleCollator = (() => {
    try {
      return new Intl.Collator('zh-Hans-CN-u-co-pinyin', { usage:'sort', sensitivity:'base', numeric:true });
    } catch {
      return new Intl.Collator('zh-Hans-CN', { usage:'sort', sensitivity:'base', numeric:true });
    }
  })();

  function titleCompare(a, b) {
    return titleCollator.compare(String(a?.info?.title || ''), String(b?.info?.title || ''));
  }

  function numberCompare(a, b, direction='asc') {
    const av = a == null || a === '' ? null : Number(a);
    const bv = b == null || b === '' ? null : Number(b);
    const aOk = Number.isFinite(av), bOk = Number.isFinite(bv);
    if (!aOk && !bOk) return 0;
    if (!aOk) return 1;
    if (!bOk) return -1;
    return direction === 'desc' ? bv - av : av - bv;
  }

  function markedTime(movie) {
    const value = Date.parse(movie?.createdAt || movie?.updatedAt || '');
    return Number.isFinite(value) ? value : null;
  }

  function currentStatus() {
    return nativeGet(statusInput).trim();
  }

  function currentSort() {
    const value = nativeGet(sortInput).trim();
    return SORT_OPTIONS.includes(value) ? value : DEFAULT_SORT;
  }

  function statusMatches(movie, selected) {
    if (!selected || selected === '全部') return true;
    const status = movie?.personal?.status === 'follow' ? 'want' : (movie?.personal?.status || 'want');
    if (selected === '想看') return status === 'want';
    if (selected === '看过') return status === 'watched';
    if (selected === '在看') return movie?.mediaType === 'tv' && status === 'watching';
    return true;
  }

  function comparatorFor(label) {
    if (label === '标记时间 · 升序') return (a,b) => numberCompare(markedTime(a), markedTime(b), 'asc');
    if (label === '标记时间 · 降序') return (a,b) => numberCompare(markedTime(a), markedTime(b), 'desc');
    if (label === '片名（拼音）· 升序') return titleCompare;
    if (label === '片名（拼音）· 降序') return (a,b) => titleCompare(b,a);
    if (label === '评分 · 升序') return (a,b) => numberCompare(a?.personal?.rating, b?.personal?.rating, 'asc');
    if (label === '评分 · 降序') return (a,b) => numberCompare(a?.personal?.rating, b?.personal?.rating, 'desc');
    if (label === '时长 · 升序') return (a,b) => numberCompare(a?.info?.runtime, b?.info?.runtime, 'asc');
    if (label === '时长 · 降序') return (a,b) => numberCompare(a?.info?.runtime, b?.info?.runtime, 'desc');
    if (label === '年份 · 升序') return (a,b) => numberCompare(a?.info?.year, b?.info?.year, 'asc');
    if (label === '年份 · 降序') return (a,b) => numberCompare(a?.info?.year, b?.info?.year, 'desc');
    return (a,b) => numberCompare(markedTime(a), markedTime(b), 'desc');
  }

  try {
    Object.defineProperty(statusInput, 'value', {
      configurable:true,
      get() {
        const visual = nativeGet(this).trim();
        return STATUS_OPTIONS.includes(visual) && visual !== '全部' ? '' : visual;
      },
      set(value) { nativeSet(this, value); }
    });
  } catch {}

  function isCoreLibrarySort(compareFn) {
    if (typeof compareFn !== 'function') return false;
    const source = Function.prototype.toString.call(compareFn);
    return source.includes("sort==='ratingDesc'") && source.includes("runtimeDesc") && source.includes('updatedAt');
  }

  if (!Array.prototype.__movieLibraryFilterSortV3) {
    const previousSort = Array.prototype.sort;
    Object.defineProperty(Array.prototype, '__movieLibraryFilterSortV3', { value:true, configurable:true });
    Array.prototype.sort = function(compareFn) {
      if (isCoreLibrarySort(compareFn)) {
        const selectedStatus = currentStatus();
        if (selectedStatus && selectedStatus !== '全部') {
          let write = 0;
          for (let read = 0; read < this.length; read += 1) {
            const movie = this[read];
            if (statusMatches(movie, selectedStatus)) this[write++] = movie;
          }
          this.length = write;
        }
        const selectedSort = currentSort();
        const compare = comparatorFor(selectedSort);
        return previousSort.call(this, (a,b) => compare(a,b) || titleCompare(a,b));
      }
      return previousSort.call(this, compareFn);
    };
  }

  function fillList(list, values) {
    list.innerHTML = values.map(value => `<option value="${String(value).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}"></option>`).join('');
  }

  fillList(statusList, STATUS_OPTIONS);
  fillList(sortList, SORT_OPTIONS);
  const sortLabel = sortInput.closest('.filter-cell')?.querySelector('label');
  if (sortLabel) sortLabel.textContent = '排序依据';
  if (!SORT_OPTIONS.includes(nativeGet(sortInput).trim())) nativeSet(sortInput, DEFAULT_SORT);

  let menu = null;
  let activeInput = null;

  function valuesFor(input) {
    const id = input?.dataset?.manualList;
    const list = id ? document.getElementById(id) : null;
    return list ? [...list.querySelectorAll('option')].map(o => String(o.value || '').trim()).filter((v,i,a) => v && a.indexOf(v) === i) : [];
  }

  function closeMenu() {
    if (menu) menu.classList.remove('open');
    activeInput = null;
  }

  function positionMenu() {
    if (!menu || !activeInput || !menu.classList.contains('open')) return;
    const rect = activeInput.closest('.manual-filter-input-wrap')?.getBoundingClientRect() || activeInput.getBoundingClientRect();
    const width = Math.max(rect.width, 180);
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
    const top = Math.min(rect.bottom + 6, window.innerHeight - 294);
    menu.style.width = `${width}px`;
    menu.style.left = `${left}px`;
    menu.style.top = `${Math.max(8, top)}px`;
  }

  function ensureMenu() {
    if (menu) return menu;
    menu = document.createElement('div');
    menu.className = 'manual-filter-menu library-filter-menu-v3';
    menu.setAttribute('role', 'listbox');
    document.body.appendChild(menu);
    menu.addEventListener('mousedown', event => event.preventDefault());
    menu.addEventListener('click', event => {
      const option = event.target.closest('[data-library-filter-value]');
      if (!option || !activeInput) return;
      const target = activeInput;
      nativeSet(target, option.dataset.libraryFilterValue || '');
      target.dispatchEvent(new Event('input', { bubbles:true }));
      target.dispatchEvent(new Event('change', { bubbles:true }));
      closeMenu();
      target.focus();
    });
    return menu;
  }

  function openMenu(input) {
    if (!input || input.disabled) return;
    const picker = ensureMenu();
    if (picker.classList.contains('open') && activeInput === input) {
      closeMenu();
      return;
    }
    activeInput = input;
    const current = nativeGet(input).trim();
    const values = valuesFor(input);
    picker.innerHTML = values.length
      ? values.map(value => `<button type="button" class="manual-filter-option ${value===current?'active':''}" data-library-filter-value="${String(value).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}" role="option">${String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</button>`).join('')
      : '<div class="manual-filter-empty">暂无可选项</div>';
    picker.classList.add('open');
    positionMenu();
  }

  document.querySelectorAll('input[data-manual-list]').forEach(input => {
    const wrap = input.closest('.manual-filter-input-wrap');
    if (!wrap) return;
    wrap.querySelectorAll('.manual-filter-toggle').forEach(button => button.remove());
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'manual-filter-toggle library-filter-toggle-v3';
    button.setAttribute('aria-label', '展开可选项');
    button.textContent = '▼';
    button.disabled = input.disabled;
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      openMenu(input);
    });
    wrap.appendChild(button);
    input.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });
  });

  document.getElementById('libRatingOp')?.addEventListener('change', () => queueMicrotask(() => {
    const score = document.getElementById('libRatingScore');
    const button = score?.closest('.manual-filter-input-wrap')?.querySelector('.library-filter-toggle-v3');
    if (button) button.disabled = Boolean(score.disabled);
  }));

  document.addEventListener('click', event => {
    if (!event.target.closest('.library-filter-menu-v3') && !event.target.closest('.library-filter-toggle-v3')) closeMenu();
  });
  window.addEventListener('resize', positionMenu);
  window.addEventListener('scroll', positionMenu, true);

  sortInput.dispatchEvent(new Event('input', { bubbles:true }));
})();
