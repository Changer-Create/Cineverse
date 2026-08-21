(() => {
  'use strict';
  if (/(?:^|\/)(?:admin|admin-console)\.html$/i.test(location.pathname)) return;

  const statusInput = document.getElementById('libStatus');
  const sortInput = document.getElementById('libSort');
  const statusList = document.getElementById('libStatusOptions');
  const sortList = document.getElementById('libSortOptions');
  if (!statusInput || !sortInput || !statusList || !sortList) return;

  const STATUS_OPTIONS = ['全部', '想看', '看过', '在看'];
  const SORT_OPTIONS = ['标记时间', '片名（拼音）', '评分', '时长', '年份'];
  const DEFAULT_SORT = '标记时间';
  const inputValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  const nativeGet = input => inputValue.get.call(input);
  const nativeSet = (input, value) => inputValue.set.call(input, value);
  const initialSortRaw = nativeGet(sortInput).trim();
  let sortDirection = /升序/.test(initialSortRaw) ? 'asc' : 'desc';
  let directionButton = null;

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

  function isSeasonSourceWatch(movie, watch) {
    return movie?.mediaType === 'tv'
      && Number(watch?.sourceSeason) > 0
      && Boolean(watch?.sourceDoubanId || String(watch?.venue || '').includes('豆瓣'));
  }

  function firstWatchTime(movie) {
    let earliest = null;
    for (const watch of Array.isArray(movie?.watchHistory) ? movie.watchHistory : []) {
      if (!watch?.date || isSeasonSourceWatch(movie, watch)) continue;
      const value = Date.parse(watch.date);
      if (!Number.isFinite(value)) continue;
      if (earliest == null || value < earliest) earliest = value;
    }
    return earliest;
  }

  function libraryAddedTime(movie) {
    const value = Date.parse(movie?.createdAt || '');
    return Number.isFinite(value) ? value : null;
  }

  function markedTime(movie) {
    const status = movie?.personal?.status === 'follow' ? 'want' : (movie?.personal?.status || 'want');
    if (status === 'watched' || status === 'watching') return firstWatchTime(movie);
    return libraryAddedTime(movie);
  }

  function normalizeSortLabel(value) {
    const raw = String(value || '').trim();
    if (/^标记时间/.test(raw) || raw === '最近更新') return '标记时间';
    if (/^片名（拼音）/.test(raw) || raw === '片名 A-Z') return '片名（拼音）';
    if (/^评分/.test(raw)) return '评分';
    if (/^时长/.test(raw)) return '时长';
    if (/^年份/.test(raw)) return '年份';
    return DEFAULT_SORT;
  }

  function currentStatus() {
    return nativeGet(statusInput).trim();
  }

  function currentSort() {
    return normalizeSortLabel(nativeGet(sortInput));
  }

  function currentDirection() {
    return sortDirection === 'asc' ? 'asc' : 'desc';
  }

  function statusMatches(movie, selected) {
    if (!selected || selected === '全部') return true;
    const status = movie?.personal?.status === 'follow' ? 'want' : (movie?.personal?.status || 'want');
    if (selected === '想看') return status === 'want';
    if (selected === '看过') return status === 'watched';
    if (selected === '在看') return movie?.mediaType === 'tv' && status === 'watching';
    return true;
  }

  function comparatorFor(label, direction=currentDirection()) {
    if (label === '标记时间') return (a,b) => numberCompare(markedTime(a), markedTime(b), direction);
    if (label === '片名（拼音）') return direction === 'desc' ? (a,b) => titleCompare(b,a) : titleCompare;
    if (label === '评分') return (a,b) => numberCompare(a?.personal?.rating, b?.personal?.rating, direction);
    if (label === '时长') return (a,b) => numberCompare(a?.info?.runtime, b?.info?.runtime, direction);
    if (label === '年份') return (a,b) => numberCompare(a?.info?.year, b?.info?.year, direction);
    return (a,b) => numberCompare(markedTime(a), markedTime(b), direction);
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

  if (!Array.prototype.__movieLibraryFilterSortV4) {
    const previousSort = Array.prototype.sort;
    Object.defineProperty(Array.prototype, '__movieLibraryFilterSortV4', { value:true, configurable:true });
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
        const compare = comparatorFor(currentSort(), currentDirection());
        return previousSort.call(this, (a,b) => compare(a,b) || titleCompare(a,b));
      }
      return previousSort.call(this, compareFn);
    };
  }

  function fillList(list, values) {
    list.innerHTML = values.map(value => `<option value="${String(value).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}"></option>`).join('');
  }

  function ensureDirectionStyle() {
    if (document.getElementById('librarySortDirectionStyleV4')) return;
    const style = document.createElement('style');
    style.id = 'librarySortDirectionStyleV4';
    style.textContent = `
      .sort-direction-toggle-v4{margin-top:5px;width:100%;height:25px;border-radius:8px;border:1px solid rgba(156,169,218,.14);background:rgba(255,255,255,.025);color:#8791ac;font-size:10px;transition:.18s ease}
      .sort-direction-toggle-v4:hover{border-color:rgba(159,124,255,.28);color:#c9c3df;background:rgba(159,124,255,.06)}
    `;
    document.head.appendChild(style);
  }

  function updateDirectionButton() {
    if (!directionButton) return;
    const descending = currentDirection() === 'desc';
    directionButton.textContent = descending ? '降序' : '升序';
    directionButton.setAttribute('aria-label', `当前${descending ? '降序' : '升序'}，点击切换为${descending ? '升序' : '降序'}`);
    directionButton.title = descending ? '点击切换为升序' : '点击切换为降序';
  }

  function ensureDirectionButton() {
    const cell = sortInput.closest('.filter-cell');
    if (!cell) return;
    directionButton = cell.querySelector('.sort-direction-toggle-v4');
    if (!directionButton) {
      directionButton = document.createElement('button');
      directionButton.type = 'button';
      directionButton.className = 'sort-direction-toggle-v4';
      directionButton.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        sortDirection = currentDirection() === 'desc' ? 'asc' : 'desc';
        updateDirectionButton();
        sortInput.dispatchEvent(new Event('input', { bubbles:true }));
      });
      cell.appendChild(directionButton);
    }
    updateDirectionButton();
  }

  fillList(statusList, STATUS_OPTIONS);
  fillList(sortList, SORT_OPTIONS);
  const sortLabel = sortInput.closest('.filter-cell')?.querySelector('label');
  if (sortLabel) sortLabel.textContent = '排序依据';
  nativeSet(sortInput, normalizeSortLabel(initialSortRaw));
  ensureDirectionStyle();
  ensureDirectionButton();

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
    if (event.target.closest('#clearLibFilters')) {
      queueMicrotask(() => {
        sortDirection = 'desc';
        nativeSet(sortInput, DEFAULT_SORT);
        updateDirectionButton();
        sortInput.dispatchEvent(new Event('input', { bubbles:true }));
      });
    }
    if (!event.target.closest('.library-filter-menu-v3') && !event.target.closest('.library-filter-toggle-v3')) closeMenu();
  });
  window.addEventListener('resize', positionMenu);
  window.addEventListener('scroll', positionMenu, true);

  sortInput.dispatchEvent(new Event('input', { bubbles:true }));
})();
