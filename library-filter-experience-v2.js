(() => {
  'use strict';
  if (/(?:^|\/)(?:admin|admin-console)\.html$/i.test(location.pathname)) return;

  const STORAGE_KEY = 'movie-collection-v2';
  const SCHEME_KEY = 'movie-library-filter-schemes-v1';
  const $ = id => document.getElementById(id);
  const grid = document.querySelector('#libraryView .filter-grid');
  const tools = document.querySelector('#libraryView .library-tools');
  const toolbarLeft = document.querySelector('#libraryView .toolbar-left');
  const searchCell = grid?.querySelector('.filter-search');
  const statusInput = $('libStatus');
  const statusList = $('libStatusOptions');
  const ratingOp = $('libRatingOp');
  const ratingScore = $('libRatingScore');
  const planInput = $('libPlan');
  const sortInput = $('libSort');
  const clearButton = $('clearLibFilters');
  const keywordInput = $('libKeyword');
  if (!grid || !tools || !toolbarLeft || !searchCell || !statusInput || !ratingOp || !ratingScore || !planInput || !sortInput || !clearButton || !keywordInput) return;

  const inputValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  const nativeGet = input => inputValue.get.call(input);
  const nativeSet = (input, value) => inputValue.set.call(input, value);
  const now = new Date();
  const CURRENT_MONTH = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const STATUS_OPTIONS = ['全部','想看','已计划','在看','已看'];
  const MODE_KEYS = ['year','director','country','status','tag','plan'];
  const FILTER_INPUT_IDS = {
    mediaType:'libMediaType',
    year:'libYear',
    director:'libDirector',
    country:'libCountry',
    status:'libStatus',
    tag:'libTag',
    plan:'libPlan',
    sort:'libSort'
  };
  let selectedSchemeIndex = -1;
  let favoriteOnly = false;

  const safeParse = raw => {
    try { return JSON.parse(raw); } catch { return null; }
  };
  const toast = text => {
    const node = $('toast');
    if (!node) return;
    node.textContent = text;
    node.classList.add('show');
    clearTimeout(node._libraryFilterTimer);
    node._libraryFilterTimer = setTimeout(() => node.classList.remove('show'), 1800);
  };
  const dispatchInput = input => input?.dispatchEvent(new Event('input', { bubbles:true }));

  const style = document.createElement('style');
  style.id = 'libraryFilterExperienceStyleV2';
  style.textContent = `
    #libraryView .library-filter-top{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px;margin-bottom:10px;align-items:start}
    #libraryView .library-filter-top .filter-cell{min-width:0}
    #libraryView .filter-operation-row{display:grid;grid-template-columns:repeat(3,minmax(62px,.72fr)) minmax(84px,1fr) minmax(54px,.62fr) minmax(76px,.82fr);gap:6px}
    #libraryView .filter-operation-row button{height:38px;min-width:0;border-radius:11px;border:1px solid rgba(156,169,218,.14);background:rgba(11,22,50,.72);color:#aeb8d1;font-size:10px;padding:0 7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:.18s ease}
    #libraryView .filter-operation-row button:hover{border-color:rgba(159,124,255,.34);color:#f0edff;background:rgba(159,124,255,.07)}
    #libraryView .filter-scheme-slot.saved{color:#cfc6ff;border-color:rgba(159,124,255,.28);background:rgba(112,83,217,.1)}
    #libraryView .filter-scheme-slot.selected{box-shadow:0 0 0 2px rgba(159,124,255,.12) inset;border-color:rgba(159,124,255,.55);color:#fff}
    #libraryView .filter-scheme-save{color:#bfe8d5!important;border-color:rgba(98,210,162,.24)!important;background:rgba(98,210,162,.065)!important}
    #libraryView .filter-scheme-delete{color:#c99aa5!important;border-color:rgba(255,127,154,.18)!important;background:rgba(255,127,154,.045)!important}
    #libraryView .filter-clear-v2{border-style:dashed!important;color:#d9b589!important;border-color:rgba(255,184,112,.34)!important;background:rgba(255,184,112,.055)!important}
    #libraryView .filter-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:9px;align-items:start}
    #libraryView .filter-grid .filter-cell{display:grid;grid-template-rows:auto 38px 25px;align-content:start;min-width:0}
    #libraryView .filter-grid .filter-cell>label{align-self:end}
    #libraryView .filter-grid .manual-filter-input-wrap,#libraryView .filter-grid .rating-filter-row{min-width:0;height:38px}
    #libraryView .filter-grid .manual-filter-input-wrap>input,#libraryView .filter-grid .filter-cell>input,#libraryView .filter-grid .rating-filter-row input{height:38px!important}
    #libraryView .filter-mode-row{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:5px;height:25px}
    #libraryView .filter-mode-btn{height:25px;border-radius:8px;border:1px solid rgba(156,169,218,.14);background:rgba(255,255,255,.025);color:#8791ac;font-size:10px;padding:0 6px;transition:.18s ease}
    #libraryView .filter-mode-btn:hover{border-color:rgba(159,124,255,.27);color:#c9c3df;background:rgba(159,124,255,.055)}
    #libraryView .filter-mode-btn.include.active,#libraryView .filter-mode-btn.rating-gte.active,#libraryView .filter-mode-btn.sort-desc.active{border-color:rgba(98,210,162,.36);background:rgba(98,210,162,.1);color:#a7e8ca}
    #libraryView .filter-mode-btn.exclude.active,#libraryView .filter-mode-btn.rating-lt.active,#libraryView .filter-mode-btn.sort-asc.active{border-color:rgba(255,127,154,.32);background:rgba(255,127,154,.09);color:#d98d9e}
    #libraryView .filter-mode-spacer{height:25px;margin-top:5px}
    #libraryView .filter-core-toggle{display:none!important}
    #libraryView #libRatingOp{display:none!important}
    #libraryView .rating-filter-row{display:block!important}
    #libraryView .rating-filter-row .manual-filter-input-wrap{width:100%}
    #libraryView .sort-direction-toggle-v4{display:none!important}
    #libraryView #libPlan[readonly]{cursor:pointer;padding-right:32px}
    #libraryView .plan-filter-calendar-v2{position:fixed;z-index:10020;width:min(344px,calc(100vw - 20px));padding:12px;border:1px solid rgba(133,151,205,.32);border-radius:15px;background:#0b1734;color:#eef2ff;box-shadow:0 22px 60px rgba(0,0,0,.48);display:none}
    #libraryView .plan-filter-calendar-v2.open{display:block}
    .plan-filter-calendar-v2{position:fixed;z-index:10020;width:min(344px,calc(100vw - 20px));padding:12px;border:1px solid rgba(133,151,205,.32);border-radius:15px;background:#0b1734;color:#eef2ff;box-shadow:0 22px 60px rgba(0,0,0,.48);display:none}
    .plan-filter-calendar-v2.open{display:block}
    .plan-filter-calendar-head{display:grid;grid-template-columns:32px minmax(0,1fr) 32px;gap:7px;align-items:center}
    .plan-filter-calendar-head button,.plan-filter-calendar-actions button{height:32px;border-radius:9px;border:1px solid rgba(156,169,218,.16);background:rgba(255,255,255,.035);color:#cfd6ea}
    .plan-filter-year{width:100%;height:32px;border-radius:9px;border:1px solid rgba(156,169,218,.18);background:rgba(7,16,38,.9);color:#eef2ff;text-align:center;outline:0}
    .plan-filter-calendar-actions{display:grid;grid-template-columns:1fr auto;gap:7px;margin-top:8px}
    .plan-filter-calendar-actions .year-only{border-color:rgba(98,210,162,.24);color:#a9e6ca;background:rgba(98,210,162,.07)}
    .plan-filter-calendar-actions .clear{padding:0 12px;color:#c4a6ae}
    .plan-filter-months{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:10px}
    .plan-filter-month{height:30px;border-radius:8px;border:1px solid rgba(156,169,218,.12);background:rgba(255,255,255,.025);color:#aeb8d2;font-size:11px}
    .plan-filter-month:hover,.plan-filter-month.active{border-color:rgba(159,124,255,.34);background:rgba(159,124,255,.1);color:#efeaff}
    .plan-filter-weekdays,.plan-filter-days{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}
    .plan-filter-weekdays{margin-top:11px;color:#65728f;font-size:9px;text-align:center}
    .plan-filter-days{margin-top:5px}
    .plan-filter-day{height:29px;border-radius:8px;border:1px solid transparent;background:transparent;color:#b7c0d8;font-size:10px}
    .plan-filter-day:hover{background:rgba(159,124,255,.08);color:#fff}
    .plan-filter-day.active{border-color:rgba(98,210,162,.32);background:rgba(98,210,162,.1);color:#bcebd5}
    .plan-filter-day.placeholder{pointer-events:none;opacity:0}
    #favoriteFilterBtn.active{color:#f2ce80;border-color:rgba(245,198,108,.42);background:rgba(245,198,108,.1);box-shadow:0 0 18px rgba(245,198,108,.06)}
    @media(max-width:1180px){
      #libraryView .library-filter-top{grid-template-columns:1fr}
      #libraryView .filter-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
    }
    @media(max-width:760px){
      #libraryView .filter-operation-row{grid-template-columns:repeat(3,1fr)}
      #libraryView .filter-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
    }
  `;
  document.head.appendChild(style);

  const placeholders = {
    libMediaType:'输入电影/剧集',
    libYear:'输入年份',
    libDirector:'输入导演',
    libCountry:'输入国家或地区',
    libStatus:'输入状态',
    libRatingScore:'输入评分0.0-10.0',
    libTag:'输入标签',
    libPlan:'选择观影计划日期'
  };
  for (const [id, text] of Object.entries(placeholders)) {
    const input = $(id);
    if (input) input.placeholder = text;
  }

  const top = document.createElement('div');
  top.className = 'library-filter-top';
  tools.insertBefore(top, grid);
  top.appendChild(searchCell);

  const operationCell = document.createElement('div');
  operationCell.className = 'filter-cell filter-operation-cell';
  operationCell.innerHTML = `
    <label>筛选操作</label>
    <div class="filter-operation-row">
      <button type="button" class="filter-scheme-slot" data-filter-scheme-slot="0">方案 1 · 空</button>
      <button type="button" class="filter-scheme-slot" data-filter-scheme-slot="1">方案 2 · 空</button>
      <button type="button" class="filter-scheme-slot" data-filter-scheme-slot="2">方案 3 · 空</button>
      <button type="button" class="filter-scheme-save" data-filter-scheme-save>保存筛选方案</button>
      <button type="button" class="filter-scheme-delete" data-filter-scheme-delete>删除</button>
    </div>`;
  const operationRow = operationCell.querySelector('.filter-operation-row');
  clearButton.classList.add('filter-clear-v2');
  clearButton.textContent = '清除筛选';
  operationRow.appendChild(clearButton);
  top.appendChild(operationCell);

  if (statusList) {
    statusList.innerHTML = STATUS_OPTIONS.map(value => `<option value="${value}"></option>`).join('');
  }

  try {
    Object.defineProperty(statusInput, 'value', {
      configurable:true,
      get() { return ''; },
      set(value) { nativeSet(this, value); }
    });
  } catch {}

  const modeState = {};
  function coreToggleFor(key) {
    let toggle = grid.querySelector(`.exclude-toggle[data-exclude="${key}"]`);
    if (!toggle && key === 'status') {
      const cell = statusInput.closest('.filter-cell');
      toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'exclude-toggle';
      toggle.dataset.exclude = 'status';
      toggle.textContent = '包含';
      cell?.appendChild(toggle);
    }
    if (toggle) toggle.classList.add('filter-core-toggle');
    return toggle;
  }

  function syncModeVisual(key) {
    const toggle = coreToggleFor(key);
    const excluded = Boolean(toggle?.classList.contains('active'));
    modeState[key] = excluded ? 'exclude' : 'include';
    const cell = grid.querySelector(`[data-filter-mode-key="${key}"]`)?.closest('.filter-cell');
    cell?.querySelectorAll('.filter-mode-btn[data-mode]').forEach(button => {
      button.classList.toggle('active', button.dataset.mode === modeState[key]);
    });
  }

  function setMode(key, mode) {
    const toggle = coreToggleFor(key);
    if (!toggle) return;
    const wantsExclude = mode === 'exclude';
    const isExclude = toggle.classList.contains('active');
    if (wantsExclude !== isExclude) toggle.click();
    queueMicrotask(() => syncModeVisual(key));
  }

  function buildModeRow(key, input) {
    const cell = input?.closest('.filter-cell');
    if (!cell) return;
    const toggle = coreToggleFor(key);
    const existing = cell.querySelector(`[data-filter-mode-key="${key}"]`);
    if (existing) return;
    const row = document.createElement('div');
    row.className = 'filter-mode-row';
    row.dataset.filterModeKey = key;
    row.innerHTML = `
      <button type="button" class="filter-mode-btn include" data-mode="include">包含</button>
      <button type="button" class="filter-mode-btn exclude" data-mode="exclude">排除</button>`;
    cell.appendChild(row);
    row.addEventListener('click', event => {
      const button = event.target.closest('[data-mode]');
      if (!button) return;
      event.preventDefault();
      setMode(key, button.dataset.mode);
    });
    if (toggle) syncModeVisual(key);
  }

  buildModeRow('year', $('libYear'));
  buildModeRow('director', $('libDirector'));
  buildModeRow('country', $('libCountry'));
  buildModeRow('status', statusInput);
  buildModeRow('tag', $('libTag'));
  buildModeRow('plan', planInput);

  const typeCell = $('libMediaType')?.closest('.filter-cell');
  if (typeCell && !typeCell.querySelector('.filter-mode-spacer')) {
    const spacer = document.createElement('div');
    spacer.className = 'filter-mode-spacer';
    typeCell.appendChild(spacer);
  }

  let ratingRow = ratingScore.closest('.filter-cell')?.querySelector('.rating-range-toggle-row,.filter-mode-row[data-rating-row]');
  if (ratingRow) ratingRow.remove();
  ratingRow = document.createElement('div');
  ratingRow.className = 'filter-mode-row';
  ratingRow.dataset.ratingRow = '1';
  ratingRow.innerHTML = `
    <button type="button" class="filter-mode-btn rating-gte" data-rating-range="gte">大于等于</button>
    <button type="button" class="filter-mode-btn rating-lt" data-rating-range="lt">小于</button>`;
  ratingScore.closest('.filter-cell')?.appendChild(ratingRow);

  function ratingMode() {
    return ratingOp.value === 'lt' ? 'lt' : 'gte';
  }
  function syncRatingButtons() {
    const mode = ratingMode();
    ratingRow.querySelectorAll('[data-rating-range]').forEach(button => {
      button.classList.toggle('active', button.dataset.ratingRange === mode);
    });
    ratingScore.disabled = false;
    const arrow = ratingScore.closest('.manual-filter-input-wrap')?.querySelector('.library-filter-toggle-v3,.manual-filter-toggle');
    if (arrow) arrow.disabled = false;
  }
  function setRatingMode(mode, render=true) {
    ratingOp.value = mode === 'lt' ? 'lt' : 'gte';
    ratingScore.disabled = false;
    ratingOp.dispatchEvent(new Event('change', { bubbles:true }));
    syncRatingButtons();
    if (render && ratingScore.value) dispatchInput(ratingScore);
  }
  ratingRow.addEventListener('click', event => {
    const button = event.target.closest('[data-rating-range]');
    if (!button) return;
    event.preventDefault();
    setRatingMode(button.dataset.ratingRange);
  });
  setRatingMode(['gte','lt'].includes(ratingOp.value) ? ratingOp.value : 'gte', false);

  const sortCell = sortInput.closest('.filter-cell');
  const nativeDirectionButton = sortCell?.querySelector('.sort-direction-toggle-v4');
  const sortRow = document.createElement('div');
  sortRow.className = 'filter-mode-row';
  sortRow.dataset.sortDirectionRow = '1';
  sortRow.innerHTML = `
    <button type="button" class="filter-mode-btn sort-desc" data-sort-direction="desc">降序</button>
    <button type="button" class="filter-mode-btn sort-asc" data-sort-direction="asc">升序</button>`;
  sortCell?.appendChild(sortRow);

  function currentSortDirection() {
    return /升序/.test(nativeDirectionButton?.textContent || '') ? 'asc' : 'desc';
  }
  function syncSortButtons() {
    const direction = currentSortDirection();
    sortRow.querySelectorAll('[data-sort-direction]').forEach(button => {
      button.classList.toggle('active', button.dataset.sortDirection === direction);
    });
  }
  function setSortDirection(direction) {
    const desired = direction === 'asc' ? 'asc' : 'desc';
    if (currentSortDirection() !== desired) nativeDirectionButton?.click();
    queueMicrotask(syncSortButtons);
  }
  sortRow.addEventListener('click', event => {
    const button = event.target.closest('[data-sort-direction]');
    if (!button) return;
    event.preventDefault();
    setSortDirection(button.dataset.sortDirection);
  });
  syncSortButtons();

  const planCell = planInput.closest('.filter-cell');
  const planLabel = planCell?.querySelector('label');
  if (planLabel) planLabel.textContent = '观影计划';
  planInput.readOnly = true;
  planInput.removeAttribute('data-manual-list');
  planInput.closest('.manual-filter-input-wrap')?.querySelectorAll('.library-filter-toggle-v3,.manual-filter-toggle').forEach(button => button.remove());

  try {
    Object.defineProperty(planInput, 'value', {
      configurable:true,
      get() {
        const visual = nativeGet(this).trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(visual)) {
          const excluded = coreToggleFor('plan')?.classList.contains('active');
          return excluded ? '' : visual.slice(0,7);
        }
        return visual;
      },
      set(value) { nativeSet(this, value); }
    });
  } catch {}

  const picker = document.createElement('div');
  picker.className = 'plan-filter-calendar-v2';
  picker.setAttribute('role','dialog');
  picker.setAttribute('aria-label','选择观影计划日期');
  picker.innerHTML = `
    <div class="plan-filter-calendar-head">
      <button type="button" data-plan-year-step="-1" aria-label="上一年">‹</button>
      <input class="plan-filter-year" type="number" min="1900" max="2100" step="1" aria-label="年份">
      <button type="button" data-plan-year-step="1" aria-label="下一年">›</button>
    </div>
    <div class="plan-filter-calendar-actions">
      <button type="button" class="year-only" data-plan-year-only>仅按年份筛选</button>
      <button type="button" class="clear" data-plan-date-clear>清除</button>
    </div>
    <div class="plan-filter-months"></div>
    <div class="plan-filter-weekdays"><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span></div>
    <div class="plan-filter-days"></div>`;
  document.body.appendChild(picker);

  const yearInput = picker.querySelector('.plan-filter-year');
  const monthsWrap = picker.querySelector('.plan-filter-months');
  const daysWrap = picker.querySelector('.plan-filter-days');
  let selectedYear = now.getFullYear();
  let selectedMonth = null;
  let selectedDay = null;

  function parsePlanVisual() {
    const raw = nativeGet(planInput).trim();
    const match = raw.match(/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/);
    selectedYear = match ? Number(match[1]) : now.getFullYear();
    selectedMonth = match?.[2] ? Number(match[2]) : null;
    selectedDay = match?.[3] ? Number(match[3]) : null;
  }
  function commitPlanValue(value) {
    nativeSet(planInput, value);
    dispatchInput(planInput);
  }
  function renderMonths() {
    monthsWrap.innerHTML = Array.from({ length:12 }, (_, index) => {
      const month = index + 1;
      return `<button type="button" class="plan-filter-month ${month===selectedMonth?'active':''}" data-plan-month="${month}">${month}月</button>`;
    }).join('');
  }
  function renderDays() {
    if (!selectedMonth) {
      daysWrap.innerHTML = '';
      return;
    }
    const first = new Date(selectedYear, selectedMonth-1, 1);
    const offset = (first.getDay() + 6) % 7;
    const count = new Date(selectedYear, selectedMonth, 0).getDate();
    const cells = [];
    for (let i=0; i<offset; i+=1) cells.push('<span class="plan-filter-day placeholder"></span>');
    for (let day=1; day<=count; day+=1) {
      cells.push(`<button type="button" class="plan-filter-day ${day===selectedDay?'active':''}" data-plan-day="${day}">${day}</button>`);
    }
    daysWrap.innerHTML = cells.join('');
  }
  function renderPicker() {
    yearInput.value = String(selectedYear);
    picker.querySelector('[data-plan-year-only]').textContent = `仅按 ${selectedYear} 年筛选`;
    renderMonths();
    renderDays();
  }
  function positionPicker() {
    if (!picker.classList.contains('open')) return;
    const rect = planInput.getBoundingClientRect();
    const width = Math.min(344, window.innerWidth - 20);
    const left = Math.min(Math.max(10, rect.left), window.innerWidth - width - 10);
    let topPos = rect.bottom + 7;
    if (topPos + 390 > window.innerHeight) topPos = Math.max(10, rect.top - 397);
    picker.style.left = `${left}px`;
    picker.style.top = `${topPos}px`;
  }
  function openPicker() {
    parsePlanVisual();
    renderPicker();
    picker.classList.add('open');
    positionPicker();
  }
  function closePicker() {
    picker.classList.remove('open');
  }

  planInput.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    openPicker();
  });
  planInput.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openPicker();
    } else if (event.key === 'Escape') {
      closePicker();
    }
  });
  picker.addEventListener('click', event => {
    const step = event.target.closest('[data-plan-year-step]');
    if (step) {
      selectedYear = Math.min(2100, Math.max(1900, selectedYear + Number(step.dataset.planYearStep || 0)));
      selectedMonth = null;
      selectedDay = null;
      commitPlanValue(String(selectedYear));
      renderPicker();
      return;
    }
    if (event.target.closest('[data-plan-year-only]')) {
      selectedMonth = null;
      selectedDay = null;
      commitPlanValue(String(selectedYear));
      renderPicker();
      return;
    }
    const monthButton = event.target.closest('[data-plan-month]');
    if (monthButton) {
      selectedMonth = Number(monthButton.dataset.planMonth);
      selectedDay = null;
      commitPlanValue(`${selectedYear}-${String(selectedMonth).padStart(2,'0')}`);
      renderPicker();
      return;
    }
    const dayButton = event.target.closest('[data-plan-day]');
    if (dayButton && selectedMonth) {
      selectedDay = Number(dayButton.dataset.planDay);
      commitPlanValue(`${selectedYear}-${String(selectedMonth).padStart(2,'0')}-${String(selectedDay).padStart(2,'0')}`);
      renderPicker();
      closePicker();
      planInput.focus();
      return;
    }
    if (event.target.closest('[data-plan-date-clear]')) {
      selectedMonth = null;
      selectedDay = null;
      commitPlanValue('');
      closePicker();
      planInput.focus();
    }
  });
  yearInput.addEventListener('change', () => {
    selectedYear = Math.min(2100, Math.max(1900, Number(yearInput.value) || now.getFullYear()));
    selectedMonth = null;
    selectedDay = null;
    commitPlanValue(String(selectedYear));
    renderPicker();
  });

  let favoriteButton = $('favoriteFilterBtn');
  if (!favoriteButton) {
    favoriteButton = document.createElement('button');
    favoriteButton.type = 'button';
    favoriteButton.className = 'tool-btn';
    favoriteButton.id = 'favoriteFilterBtn';
    favoriteButton.textContent = '★ 星标收藏';
    const multiButton = $('multiBtn');
    toolbarLeft.insertBefore(favoriteButton, multiButton || null);
  }
  function syncFavoriteButton() {
    favoriteButton.classList.toggle('active', favoriteOnly);
    favoriteButton.setAttribute('aria-pressed', favoriteOnly ? 'true' : 'false');
  }
  favoriteButton.addEventListener('click', () => {
    favoriteOnly = !favoriteOnly;
    syncFavoriteButton();
    dispatchInput(keywordInput);
  });
  syncFavoriteButton();

  function normalizeStatusQuery(raw) {
    const query = String(raw || '').trim();
    if (!query || query === '全部') return '';
    if (STATUS_OPTIONS.includes(query)) return query;
    const matches = STATUS_OPTIONS.filter(value => value !== '全部' && value.includes(query));
    return matches.length === 1 ? matches[0] : '__nomatch__';
  }
  function hasCurrentPlan(movie) {
    return (movie?.plans || []).some(plan => plan?.month === CURRENT_MONTH);
  }
  function statusLabel(movie) {
    const status = movie?.personal?.status || 'want';
    if (status === 'watched') return '已看';
    if (movie?.mediaType === 'tv' && status === 'watching') return '在看';
    if (hasCurrentPlan(movie)) return '已计划';
    return '想看';
  }
  function isCoreLibrarySort(compareFn) {
    if (typeof compareFn !== 'function') return false;
    const source = Function.prototype.toString.call(compareFn);
    return source.includes("sort==='ratingDesc'") && source.includes('runtimeDesc') && source.includes('updatedAt');
  }

  if (!Array.prototype.__movieLibraryFilterExperienceV2) {
    const previousSort = Array.prototype.sort;
    Object.defineProperty(Array.prototype, '__movieLibraryFilterExperienceV2', { value:true, configurable:true });
    Array.prototype.sort = function(compareFn) {
      if (!isCoreLibrarySort(compareFn)) return previousSort.call(this, compareFn);

      if (favoriteOnly) {
        let write = 0;
        for (let read=0; read<this.length; read+=1) {
          if (this[read]?.personal?.favorite) this[write++] = this[read];
        }
        this.length = write;
      }

      const selectedStatusRaw = nativeGet(statusInput).trim();
      const selectedStatus = normalizeStatusQuery(selectedStatusRaw);
      if (selectedStatus) {
        const excluded = coreToggleFor('status')?.classList.contains('active');
        let write = 0;
        for (let read=0; read<this.length; read+=1) {
          const movie = this[read];
          const match = selectedStatus !== '__nomatch__' && statusLabel(movie) === selectedStatus;
          if (excluded ? !match : match) this[write++] = movie;
        }
        this.length = write;
      }

      const planVisual = nativeGet(planInput).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(planVisual)) {
        const excluded = coreToggleFor('plan')?.classList.contains('active');
        let write = 0;
        for (let read=0; read<this.length; read+=1) {
          const movie = this[read];
          const match = (movie?.plans || []).some(plan => String(plan?.plannedDate || '') === planVisual);
          if (excluded ? !match : match) this[write++] = movie;
        }
        this.length = write;
      }

      const visualStatus = nativeGet(statusInput);
      if (visualStatus) nativeSet(statusInput, '');
      try { return previousSort.call(this, compareFn); }
      finally { if (visualStatus) nativeSet(statusInput, visualStatus); }
    };
  }

  function loadSchemes() {
    const parsed = safeParse(localStorage.getItem(SCHEME_KEY));
    const list = Array.isArray(parsed) ? parsed.slice(0,3) : [];
    while (list.length < 3) list.push(null);
    return list;
  }
  function saveSchemes(list) {
    localStorage.setItem(SCHEME_KEY, JSON.stringify(list.slice(0,3)));
  }
  function schemeSnapshot() {
    const values = {};
    for (const [key, id] of Object.entries(FILTER_INPUT_IDS)) {
      const input = $(id);
      values[key] = input ? (input === statusInput || input === planInput ? nativeGet(input) : input.value) : '';
    }
    return {
      keyword: keywordInput.value,
      values,
      modes:Object.fromEntries(MODE_KEYS.map(key => [key, coreToggleFor(key)?.classList.contains('active') ? 'exclude' : 'include'])),
      rating:{ mode:ratingMode(), score:ratingScore.value },
      sortDirection:currentSortDirection(),
      favoriteOnly,
      savedAt:new Date().toISOString()
    };
  }
  function renderSchemeSlots() {
    const schemes = loadSchemes();
    operationCell.querySelectorAll('[data-filter-scheme-slot]').forEach(button => {
      const index = Number(button.dataset.filterSchemeSlot);
      const saved = Boolean(schemes[index]);
      button.textContent = saved ? `方案 ${index+1}` : `方案 ${index+1} · 空`;
      button.classList.toggle('saved', saved);
      button.classList.toggle('selected', index === selectedSchemeIndex);
      button.title = saved ? '点击应用该筛选方案' : '点击选择该空方案位';
    });
  }

  function setInputVisual(input, value) {
    if (!input) return;
    if (input === statusInput || input === planInput) nativeSet(input, value || '');
    else input.value = value || '';
  }

  function applyScheme(index) {
    const schemes = loadSchemes();
    const scheme = schemes[index];
    selectedSchemeIndex = index;
    renderSchemeSlots();
    if (!scheme) {
      toast(`已选择方案 ${index+1}，点击“保存筛选方案”写入当前条件`);
      return;
    }

    keywordInput.value = scheme.keyword || '';
    for (const [key, id] of Object.entries(FILTER_INPUT_IDS)) {
      setInputVisual($(id), scheme.values?.[key] || '');
    }
    for (const key of MODE_KEYS) setMode(key, scheme.modes?.[key] === 'exclude' ? 'exclude' : 'include');
    ratingScore.value = scheme.rating?.score ?? '';
    setRatingMode(scheme.rating?.mode === 'lt' ? 'lt' : 'gte', false);
    setSortDirection(scheme.sortDirection === 'asc' ? 'asc' : 'desc');
    favoriteOnly = Boolean(scheme.favoriteOnly);
    syncFavoriteButton();
    closePicker();
    dispatchInput(keywordInput);
    toast(`已应用筛选方案 ${index+1}`);
  }

  operationCell.addEventListener('click', event => {
    const slot = event.target.closest('[data-filter-scheme-slot]');
    if (slot) {
      applyScheme(Number(slot.dataset.filterSchemeSlot));
      return;
    }
    if (event.target.closest('[data-filter-scheme-save]')) {
      const schemes = loadSchemes();
      let index = selectedSchemeIndex;
      if (index < 0) index = schemes.findIndex(item => !item);
      if (index < 0) index = 0;
      if (schemes[index] && !confirm(`方案 ${index+1} 已保存筛选条件，确认覆盖吗？`)) return;
      schemes[index] = schemeSnapshot();
      saveSchemes(schemes);
      selectedSchemeIndex = index;
      renderSchemeSlots();
      toast(`筛选方案 ${index+1} 已保存`);
      return;
    }
    if (event.target.closest('[data-filter-scheme-delete]')) {
      if (selectedSchemeIndex < 0) {
        toast('请先选择要删除的筛选方案');
        return;
      }
      const schemes = loadSchemes();
      if (!schemes[selectedSchemeIndex]) {
        toast(`方案 ${selectedSchemeIndex+1} 还是空的`);
        return;
      }
      if (!confirm(`确认删除筛选方案 ${selectedSchemeIndex+1}？`)) return;
      schemes[selectedSchemeIndex] = null;
      saveSchemes(schemes);
      renderSchemeSlots();
      toast(`筛选方案 ${selectedSchemeIndex+1} 已删除`);
    }
  });
  renderSchemeSlots();

  document.addEventListener('click', event => {
    if (!event.target.closest('.plan-filter-calendar-v2') && event.target !== planInput) closePicker();
    if (event.target.closest('#clearLibFilters')) {
      queueMicrotask(() => {
        nativeSet(statusInput, '');
        nativeSet(planInput, '');
        favoriteOnly = false;
        syncFavoriteButton();
        setRatingMode('gte', false);
        setSortDirection('desc');
        for (const key of MODE_KEYS) syncModeVisual(key);
        closePicker();
      });
    }
  });
  window.addEventListener('resize', positionPicker);
  window.addEventListener('scroll', positionPicker, true);

  const modeObserver = new MutationObserver(records => {
    const touched = new Set();
    for (const record of records) {
      const node = record.target;
      if (node instanceof HTMLElement && node.matches('.exclude-toggle[data-exclude]')) touched.add(node.dataset.exclude);
    }
    for (const key of touched) syncModeVisual(key);
  });
  grid.querySelectorAll('.exclude-toggle[data-exclude]').forEach(toggle => {
    modeObserver.observe(toggle, { attributes:true, attributeFilter:['class'] });
  });

  syncRatingButtons();
  syncSortButtons();
  for (const key of MODE_KEYS) syncModeVisual(key);
})();