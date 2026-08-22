(() => {
  'use strict';
  if (/(?:^|\/)(?:admin|admin-console)\.html$/i.test(location.pathname)) return;
  if (window.__CINEVERSE_LIBRARY_FILTER_SYSTEM_V1__) return;
  window.__CINEVERSE_LIBRARY_FILTER_SYSTEM_V1__ = true;

  const SCHEME_KEY = 'movie-library-filter-schemes-v1';
  const $ = id => document.getElementById(id);
  const grid = document.querySelector('#libraryView .filter-grid');
  const tools = document.querySelector('#libraryView .library-tools');
  const toolbarLeft = document.querySelector('#libraryView .toolbar-left');
  const searchCell = grid?.querySelector('.filter-search');
  const keywordInput = $('libKeyword');
  const mediaTypeInput = $('libMediaType');
  const yearInputFilter = $('libYear');
  const directorInput = $('libDirector');
  const countryInput = $('libCountry');
  const statusInput = $('libStatus');
  const statusList = $('libStatusOptions');
  const ratingOp = $('libRatingOp');
  const ratingScore = $('libRatingScore');
  const tagInput = $('libTag');
  const planInput = $('libPlan');
  const sortInput = $('libSort');
  const sortList = $('libSortOptions');
  const clearButton = $('clearLibFilters');
  if (!grid || !tools || !toolbarLeft || !searchCell || !keywordInput || !mediaTypeInput || !yearInputFilter || !directorInput || !countryInput || !statusInput || !ratingOp || !ratingScore || !tagInput || !planInput || !sortInput || !clearButton) return;

  const inputDescriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  const nativeGet = input => inputDescriptor.get.call(input);
  const nativeSet = (input, value) => inputDescriptor.set.call(input, value);
  const now = new Date();
  const CURRENT_MONTH = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const STATUS_OPTIONS = ['全部', '关注', '想看', '已计划', '在看', '已看', '已看完', '暂停', '弃剧'];
  const SORT_OPTIONS = ['标记时间', '片名（拼音）', '评分', '时长', '年份'];
  const MODE_KEYS = ['year', 'director', 'country', 'status', 'tag', 'plan'];
  const FILTER_INPUTS = {
    mediaType: mediaTypeInput,
    year: yearInputFilter,
    director: directorInput,
    country: countryInput,
    status: statusInput,
    tag: tagInput,
    plan: planInput,
    sort: sortInput
  };

  let sortDirection = 'desc';
  let ratingModeState = ratingOp.value === 'lt' ? 'lt' : 'gte';
  let favoriteOnly = false;
  let selectedSchemeIndex = -1;

  const safeParse = raw => {
    try { return JSON.parse(raw); } catch { return null; }
  };
  const dispatchInput = input => input?.dispatchEvent(new Event('input', { bubbles: true }));
  const esc = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const toast = text => {
    const node = $('toast');
    if (!node) return;
    node.textContent = text;
    node.classList.add('show');
    clearTimeout(node._libraryFilterSystemTimer);
    node._libraryFilterSystemTimer = setTimeout(() => node.classList.remove('show'), 1800);
  };

  const placeholders = {
    libMediaType: '输入电影/剧集',
    libYear: '输入年份',
    libDirector: '输入导演',
    libCountry: '输入国家或地区',
    libStatus: '输入状态',
    libRatingScore: '输入评分0.0-10.0',
    libTag: '输入标签',
    libPlan: '选择观影计划日期'
  };
  Object.entries(placeholders).forEach(([id, text]) => {
    const input = $(id);
    if (input) input.placeholder = text;
  });

  if (!document.getElementById('libraryFilterSystemStyleV1')) {
    const style = document.createElement('style');
    style.id = 'libraryFilterSystemStyleV1';
    style.textContent = `
      #libraryView .library-filter-top{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px;margin-bottom:10px;align-items:start}
      #libraryView .library-tools{position:relative}
      #libraryView .library-filter-top{padding-right:108px}
      #libraryView .library-filter-toggle{position:absolute;right:10px;top:10px;height:38px;padding:0 13px;border-radius:11px;border:1px solid rgba(159,124,255,.28);background:rgba(91,67,170,.12);color:#d9d2f4;font-size:11px}
      #libraryView .library-filter-toggle:hover{border-color:rgba(159,124,255,.5);color:#fff}
      #libraryView .filter-grid.library-filter-collapsed{display:none}
      #libraryView .library-toolbar.library-action-strip{margin-top:10px;padding:10px 12px;border:1px solid rgba(161,179,255,.14);border-radius:15px;background:rgba(8,18,42,.62)}
      #libraryView .library-filter-top .filter-cell{min-width:0;margin:0}
      #libraryView .filter-operation-row{display:grid;grid-template-columns:repeat(3,minmax(62px,.72fr)) minmax(84px,1fr) minmax(54px,.62fr) minmax(76px,.82fr);gap:6px}
      #libraryView .filter-operation-row button{height:38px;min-width:0;border-radius:11px;border:1px solid rgba(156,169,218,.14);background:rgba(11,22,50,.72);color:#aeb8d1;font-size:10px;padding:0 7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:.18s ease}
      #libraryView .filter-operation-row button:hover{border-color:rgba(159,124,255,.34);color:#f0edff;background:rgba(159,124,255,.07)}
      #libraryView .filter-scheme-slot.saved{color:#cfc6ff;border-color:rgba(159,124,255,.28);background:rgba(112,83,217,.1)}
      #libraryView .filter-scheme-slot.selected{box-shadow:0 0 0 2px rgba(159,124,255,.12) inset;border-color:rgba(159,124,255,.55);color:#fff}
      #libraryView .filter-scheme-save{color:#bfe8d5!important;border-color:rgba(98,210,162,.24)!important;background:rgba(98,210,162,.065)!important}
      #libraryView .filter-scheme-delete{color:#c99aa5!important;border-color:rgba(255,127,154,.18)!important;background:rgba(255,127,154,.045)!important}
      #libraryView .filter-clear-system{border-style:dashed!important;color:#d9b589!important;border-color:rgba(255,184,112,.34)!important;background:rgba(255,184,112,.055)!important}
      #libraryView .filter-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:9px;align-items:start}
      #libraryView .filter-grid .filter-cell{display:grid;grid-template-rows:auto 38px 25px;align-content:start;min-width:0;margin:0}
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
      #libraryView #libPlan[readonly]{cursor:pointer;padding-right:32px}
      #favoriteFilterBtn.active{color:#f2ce80;border-color:rgba(245,198,108,.42);background:rgba(245,198,108,.1);box-shadow:0 0 18px rgba(245,198,108,.06)}
      #libraryFilterSchemeDialog{width:min(420px,calc(100vw - 28px));padding:0;border:1px solid rgba(159,124,255,.28);border-radius:18px;background:linear-gradient(160deg,#101b3b,#081126);color:#eef2ff;box-shadow:0 28px 80px rgba(0,0,0,.52)}
      #libraryFilterSchemeDialog::backdrop{background:rgba(2,6,17,.72);backdrop-filter:blur(6px)}
      .library-scheme-dialog-body{padding:22px}.library-scheme-dialog-body h3{margin:0 0 6px;font-size:19px}.library-scheme-dialog-body p{margin:0 0 16px;color:#8f9ab7;font-size:11px}.library-scheme-dialog-body label{display:block;margin-bottom:7px;color:#aeb8d1;font-size:11px}.library-scheme-dialog-body input{width:100%;height:42px;border:1px solid rgba(161,179,255,.2);border-radius:11px;background:rgba(5,14,34,.78);color:#fff;padding:0 12px;outline:none}.library-scheme-dialog-body input:focus{border-color:rgba(159,124,255,.55);box-shadow:0 0 0 3px rgba(159,124,255,.09)}.library-scheme-dialog-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}.library-scheme-dialog-actions button{height:36px;padding:0 14px;border-radius:10px;border:1px solid rgba(161,179,255,.18);background:rgba(18,30,64,.72);color:#dce2f5}.library-scheme-dialog-actions .primary{border-color:rgba(159,124,255,.4);background:rgba(101,76,211,.55);color:#fff}
      .plan-filter-calendar-system-v1{position:fixed;z-index:10020;width:min(344px,calc(100vw - 20px));padding:12px;border:1px solid rgba(133,151,205,.32);border-radius:15px;background:#0b1734;color:#eef2ff;box-shadow:0 22px 60px rgba(0,0,0,.48);display:none}
      .plan-filter-calendar-system-v1.open{display:block}
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
      @media(max-width:1180px){#libraryView .library-filter-top{grid-template-columns:1fr}#libraryView .filter-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
      @media(max-width:760px){#libraryView .filter-operation-row{grid-template-columns:repeat(3,1fr)}#libraryView .filter-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    `;
    document.head.appendChild(style);
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
      <button type="button" class="filter-scheme-delete" data-filter-scheme-delete>删除当前筛选方案</button>
    </div>`;
  const operationRow = operationCell.querySelector('.filter-operation-row');
  clearButton.classList.add('filter-clear-system');
  clearButton.textContent = '清除筛选';
  operationRow.appendChild(clearButton);
  top.appendChild(operationCell);

  const filterToggle = document.createElement('button');
  filterToggle.type = 'button';
  filterToggle.className = 'library-filter-toggle';
  filterToggle.setAttribute('aria-controls', 'libraryAdvancedFilters');
  grid.id = 'libraryAdvancedFilters';
  grid.classList.add('library-filter-collapsed');
  filterToggle.setAttribute('aria-expanded', 'false');
  filterToggle.textContent = '展开筛选 ▾';
  tools.appendChild(filterToggle);
  filterToggle.addEventListener('click', () => {
    const expanded = grid.classList.toggle('library-filter-collapsed') === false;
    filterToggle.setAttribute('aria-expanded', String(expanded));
    filterToggle.textContent = expanded ? '折叠筛选 ▴' : '展开筛选 ▾';
  });

  const toolbar = tools.querySelector('.library-toolbar');
  if (toolbar) {
    toolbar.classList.add('library-action-strip');
    tools.insertAdjacentElement('afterend', toolbar);
  }

  const schemeDialog = document.createElement('dialog');
  schemeDialog.id = 'libraryFilterSchemeDialog';
  schemeDialog.innerHTML = `<form method="dialog" class="library-scheme-dialog-body">
    <h3>保存筛选方案</h3><p>为当前筛选条件取一个容易辨认的名字。</p>
    <label for="libraryFilterSchemeName">方案名称</label>
    <input id="libraryFilterSchemeName" maxlength="24" autocomplete="off" required>
    <div class="library-scheme-dialog-actions"><button type="button" data-scheme-cancel>取消</button><button class="primary" type="submit">保存方案</button></div>
  </form>`;
  document.body.appendChild(schemeDialog);
  const schemeNameInput = schemeDialog.querySelector('input');
  schemeDialog.querySelector('[data-scheme-cancel]').addEventListener('click', () => schemeDialog.close());

  if (statusList) statusList.innerHTML = STATUS_OPTIONS.map(value => `<option value="${esc(value)}"></option>`).join('');
  if (sortList) sortList.innerHTML = SORT_OPTIONS.map(value => `<option value="${esc(value)}"></option>`).join('');
  const sortLabel = sortInput.closest('.filter-cell')?.querySelector('label');
  if (sortLabel) sortLabel.textContent = '排序依据';
  const initialSortRaw = nativeGet(sortInput).trim();
  const normalizeSortLabel = value => {
    const raw = String(value || '').trim();
    if (/^标记时间/.test(raw) || raw === '最近更新') return '标记时间';
    if (/^片名（拼音）/.test(raw) || raw === '片名 A-Z') return '片名（拼音）';
    if (/^评分/.test(raw)) return '评分';
    if (/^时长/.test(raw)) return '时长';
    if (/^年份/.test(raw)) return '年份';
    return '标记时间';
  };
  nativeSet(sortInput, normalizeSortLabel(initialSortRaw));

  try {
    Object.defineProperty(statusInput, 'value', {
      configurable: true,
      get() { return ''; },
      set(value) { nativeSet(this, value); }
    });
  } catch {}

  const planCell = planInput.closest('.filter-cell');
  const planLabel = planCell?.querySelector('label');
  if (planLabel) planLabel.textContent = '观影计划';
  planInput.readOnly = true;
  planInput.removeAttribute('data-manual-list');
  planInput.closest('.manual-filter-input-wrap')?.querySelectorAll('.manual-filter-toggle,.library-filter-toggle-v3').forEach(button => button.remove());
  try {
    Object.defineProperty(planInput, 'value', {
      configurable: true,
      get() {
        const visual = nativeGet(this).trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(visual)) {
          const excluded = coreToggleFor('plan')?.classList.contains('active');
          return excluded ? '' : visual.slice(0, 7);
        }
        return visual;
      },
      set(value) { nativeSet(this, value); }
    });
  } catch {}

  function coreToggleFor(key) {
    let toggle = grid.querySelector(`.exclude-toggle[data-exclude="${key}"]`);
    if (!toggle && key === 'status') {
      toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'exclude-toggle';
      toggle.dataset.exclude = 'status';
      toggle.textContent = '包含';
      statusInput.closest('.filter-cell')?.appendChild(toggle);
    }
    if (toggle) toggle.classList.add('filter-core-toggle');
    return toggle;
  }

  function modeFor(key) {
    return coreToggleFor(key)?.classList.contains('active') ? 'exclude' : 'include';
  }
  function syncModeVisual(key) {
    const mode = modeFor(key);
    const row = grid.querySelector(`[data-filter-mode-key="${key}"]`);
    row?.querySelectorAll('[data-mode]').forEach(button => button.classList.toggle('active', button.dataset.mode === mode));
  }
  function setMode(key, mode) {
    const toggle = coreToggleFor(key);
    if (!toggle) return;
    const wantsExclude = mode === 'exclude';
    if (toggle.classList.contains('active') !== wantsExclude) toggle.click();
    syncModeVisual(key);
  }
  function buildModeRow(key, input) {
    const cell = input?.closest('.filter-cell');
    if (!cell) return;
    coreToggleFor(key);
    const row = document.createElement('div');
    row.className = 'filter-mode-row';
    row.dataset.filterModeKey = key;
    row.innerHTML = '<button type="button" class="filter-mode-btn include" data-mode="include">包含</button><button type="button" class="filter-mode-btn exclude" data-mode="exclude">排除</button>';
    cell.appendChild(row);
    row.addEventListener('click', event => {
      const button = event.target.closest('[data-mode]');
      if (!button) return;
      event.preventDefault();
      setMode(key, button.dataset.mode);
    });
    syncModeVisual(key);
  }

  buildModeRow('year', yearInputFilter);
  buildModeRow('director', directorInput);
  buildModeRow('country', countryInput);
  buildModeRow('status', statusInput);
  buildModeRow('tag', tagInput);
  buildModeRow('plan', planInput);

  const mediaTypeCell = mediaTypeInput.closest('.filter-cell');
  if (mediaTypeCell) {
    const spacer = document.createElement('div');
    spacer.className = 'filter-mode-spacer';
    mediaTypeCell.appendChild(spacer);
  }

  const ratingCell = ratingScore.closest('.filter-cell');
  const ratingRow = document.createElement('div');
  ratingRow.className = 'filter-mode-row';
  ratingRow.innerHTML = '<button type="button" class="filter-mode-btn rating-gte" data-rating-range="gte">大于等于</button><button type="button" class="filter-mode-btn rating-lt" data-rating-range="lt">小于</button>';
  ratingCell?.appendChild(ratingRow);

  function enableRatingScore() {
    ratingScore.disabled = false;
    const arrow = ratingScore.closest('.manual-filter-input-wrap')?.querySelector('.manual-filter-toggle,.library-filter-toggle-v3');
    if (arrow) arrow.disabled = false;
  }
  function syncRatingButtons() {
    ratingRow.querySelectorAll('[data-rating-range]').forEach(button => button.classList.toggle('active', button.dataset.ratingRange === ratingModeState));
    enableRatingScore();
  }
  function syncRatingOpFromScore() {
    ratingOp.value = String(ratingScore.value || '').trim() ? ratingModeState : 'all';
    enableRatingScore();
  }
  ratingScore.addEventListener('input', syncRatingOpFromScore, true);
  ratingRow.addEventListener('click', event => {
    const button = event.target.closest('[data-rating-range]');
    if (!button) return;
    event.preventDefault();
    ratingModeState = button.dataset.ratingRange === 'lt' ? 'lt' : 'gte';
    syncRatingButtons();
    if (String(ratingScore.value || '').trim()) {
      ratingOp.value = ratingModeState;
      ratingOp.dispatchEvent(new Event('change', { bubbles: true }));
      enableRatingScore();
    } else {
      ratingOp.value = 'all';
    }
  });
  syncRatingOpFromScore();
  syncRatingButtons();

  const sortCell = sortInput.closest('.filter-cell');
  const sortRow = document.createElement('div');
  sortRow.className = 'filter-mode-row';
  sortRow.innerHTML = '<button type="button" class="filter-mode-btn sort-desc" data-sort-direction="desc">降序</button><button type="button" class="filter-mode-btn sort-asc" data-sort-direction="asc">升序</button>';
  sortCell?.appendChild(sortRow);
  function syncSortButtons() {
    sortRow.querySelectorAll('[data-sort-direction]').forEach(button => button.classList.toggle('active', button.dataset.sortDirection === sortDirection));
  }
  function setSortDirection(direction, render = true) {
    sortDirection = direction === 'asc' ? 'asc' : 'desc';
    syncSortButtons();
    if (render) dispatchInput(sortInput);
  }
  sortRow.addEventListener('click', event => {
    const button = event.target.closest('[data-sort-direction]');
    if (!button) return;
    event.preventDefault();
    setSortDirection(button.dataset.sortDirection);
  });
  syncSortButtons();

  const titleCollator = (() => {
    try { return new Intl.Collator('zh-Hans-CN-u-co-pinyin', { usage: 'sort', sensitivity: 'base', numeric: true }); }
    catch { return new Intl.Collator('zh-Hans-CN', { usage: 'sort', sensitivity: 'base', numeric: true }); }
  })();
  const titleCompare = (a, b) => titleCollator.compare(String(a?.info?.title || ''), String(b?.info?.title || ''));
  function numberCompare(a, b, direction = 'asc') {
    const av = a == null || a === '' ? null : Number(a);
    const bv = b == null || b === '' ? null : Number(b);
    const aOk = Number.isFinite(av), bOk = Number.isFinite(bv);
    if (!aOk && !bOk) return 0;
    if (!aOk) return 1;
    if (!bOk) return -1;
    return direction === 'desc' ? bv - av : av - bv;
  }
  function isSeasonSourceWatch(movie, watch) {
    return movie?.mediaType === 'tv' && Number(watch?.sourceSeason) > 0 && Boolean(watch?.sourceDoubanId || String(watch?.venue || '').includes('豆瓣'));
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
    return status === 'watched' || status === 'watching' ? firstWatchTime(movie) : libraryAddedTime(movie);
  }
  function comparatorFor(label) {
    const direction = sortDirection;
    if (label === '标记时间') return (a, b) => numberCompare(markedTime(a), markedTime(b), direction);
    if (label === '片名（拼音）') return direction === 'desc' ? (a, b) => titleCompare(b, a) : titleCompare;
    if (label === '评分') return (a, b) => numberCompare(a?.personal?.rating, b?.personal?.rating, direction);
    if (label === '时长') return (a, b) => numberCompare(a?.info?.runtime, b?.info?.runtime, direction);
    if (label === '年份') return (a, b) => numberCompare(a?.info?.year, b?.info?.year, direction);
    return (a, b) => numberCompare(markedTime(a), markedTime(b), direction);
  }
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
    if (movie?.mediaType === 'tv') {
      if (status === 'watching') return '在看';
      if (status === 'watched') return '已看完';
      if (status === 'paused') return '暂停';
      if (status === 'dropped') return '弃剧';
      if (hasCurrentPlan(movie)) return '已计划';
      return '想看';
    }
    if (status === 'watched') return '已看';
    if (hasCurrentPlan(movie)) return '已计划';
    if (status === 'follow') return '关注';
    return '想看';
  }
  function isCoreLibrarySort(compareFn) {
    if (typeof compareFn !== 'function') return false;
    const source = Function.prototype.toString.call(compareFn);
    return source.includes("sort==='ratingDesc'") && source.includes('runtimeDesc') && source.includes('updatedAt');
  }

  if (!Array.prototype.__movieLibraryFilterSystemV1) {
    const previousSort = Array.prototype.sort;
    Object.defineProperty(Array.prototype, '__movieLibraryFilterSystemV1', { value: true, configurable: true });
    Array.prototype.sort = function(compareFn) {
      if (!isCoreLibrarySort(compareFn)) return previousSort.call(this, compareFn);

      if (favoriteOnly) {
        let write = 0;
        for (let read = 0; read < this.length; read += 1) {
          if (this[read]?.personal?.favorite) this[write++] = this[read];
        }
        this.length = write;
      }

      const selectedStatus = normalizeStatusQuery(nativeGet(statusInput));
      if (selectedStatus) {
        const excluded = modeFor('status') === 'exclude';
        let write = 0;
        for (let read = 0; read < this.length; read += 1) {
          const match = selectedStatus !== '__nomatch__' && statusLabel(this[read]) === selectedStatus;
          if (excluded ? !match : match) this[write++] = this[read];
        }
        this.length = write;
      }

      const planVisual = nativeGet(planInput).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(planVisual)) {
        const excluded = modeFor('plan') === 'exclude';
        let write = 0;
        for (let read = 0; read < this.length; read += 1) {
          const match = (this[read]?.plans || []).some(plan => String(plan?.plannedDate || '') === planVisual);
          if (excluded ? !match : match) this[write++] = this[read];
        }
        this.length = write;
      }

      const compare = comparatorFor(normalizeSortLabel(nativeGet(sortInput)));
      return previousSort.call(this, (a, b) => compare(a, b) || titleCompare(a, b));
    };
  }

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

  const picker = document.createElement('div');
  picker.className = 'plan-filter-calendar-system-v1';
  picker.setAttribute('role', 'dialog');
  picker.setAttribute('aria-label', '选择观影计划日期');
  picker.innerHTML = `
    <div class="plan-filter-calendar-head">
      <button type="button" data-plan-year-step="-1" aria-label="上一年">‹</button>
      <input class="plan-filter-year" type="number" min="1900" max="2100" step="1" aria-label="年份">
      <button type="button" data-plan-year-step="1" aria-label="下一年">›</button>
    </div>
    <div class="plan-filter-calendar-actions"><button type="button" class="year-only" data-plan-year-only>仅按年份筛选</button><button type="button" class="clear" data-plan-date-clear>清除</button></div>
    <div class="plan-filter-months"></div>
    <div class="plan-filter-weekdays"><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span></div>
    <div class="plan-filter-days"></div>`;
  document.body.appendChild(picker);
  const pickerYearInput = picker.querySelector('.plan-filter-year');
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
  function renderPicker() {
    pickerYearInput.value = String(selectedYear);
    picker.querySelector('[data-plan-year-only]').textContent = `仅按 ${selectedYear} 年筛选`;
    monthsWrap.innerHTML = Array.from({ length: 12 }, (_, index) => {
      const month = index + 1;
      return `<button type="button" class="plan-filter-month ${month === selectedMonth ? 'active' : ''}" data-plan-month="${month}">${month}月</button>`;
    }).join('');
    if (!selectedMonth) {
      daysWrap.innerHTML = '';
      return;
    }
    const first = new Date(selectedYear, selectedMonth - 1, 1);
    const offset = (first.getDay() + 6) % 7;
    const count = new Date(selectedYear, selectedMonth, 0).getDate();
    const cells = [];
    for (let i = 0; i < offset; i += 1) cells.push('<span class="plan-filter-day placeholder"></span>');
    for (let day = 1; day <= count; day += 1) cells.push(`<button type="button" class="plan-filter-day ${day === selectedDay ? 'active' : ''}" data-plan-day="${day}">${day}</button>`);
    daysWrap.innerHTML = cells.join('');
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
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openPicker(); }
    if (event.key === 'Escape') closePicker();
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
      commitPlanValue(`${selectedYear}-${String(selectedMonth).padStart(2, '0')}`);
      renderPicker();
      return;
    }
    const dayButton = event.target.closest('[data-plan-day]');
    if (dayButton && selectedMonth) {
      selectedDay = Number(dayButton.dataset.planDay);
      commitPlanValue(`${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`);
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
  pickerYearInput.addEventListener('change', () => {
    selectedYear = Math.min(2100, Math.max(1900, Number(pickerYearInput.value) || now.getFullYear()));
    selectedMonth = null;
    selectedDay = null;
    commitPlanValue(String(selectedYear));
    renderPicker();
  });

  function loadSchemes() {
    const parsed = safeParse(localStorage.getItem(SCHEME_KEY));
    const list = Array.isArray(parsed) ? parsed.slice(0, 3) : [];
    while (list.length < 3) list.push(null);
    return list;
  }
  function saveSchemes(list) {
    localStorage.setItem(SCHEME_KEY, JSON.stringify(list.slice(0, 3)));
  }
  function schemeSnapshot() {
    const values = {};
    Object.entries(FILTER_INPUTS).forEach(([key, input]) => {
      values[key] = input === statusInput || input === planInput ? nativeGet(input) : input.value;
    });
    return {
      values,
      modes: Object.fromEntries(MODE_KEYS.map(key => [key, modeFor(key)])),
      rating: { mode: ratingModeState, score: ratingScore.value },
      sortDirection,
      favoriteOnly,
      savedAt: new Date().toISOString()
    };
  }
  function renderSchemeSlots() {
    const schemes = loadSchemes();
    operationCell.querySelectorAll('[data-filter-scheme-slot]').forEach(button => {
      const index = Number(button.dataset.filterSchemeSlot);
      const saved = Boolean(schemes[index]);
      button.textContent = saved ? (schemes[index].name || `方案 ${index + 1}`) : `方案 ${index + 1} · 空`;
      button.classList.toggle('saved', saved);
      button.classList.toggle('selected', index === selectedSchemeIndex);
      button.title = saved ? '点击应用该筛选方案' : '点击选择该空方案位';
    });
  }
  function setInputVisual(input, value) {
    if (input === statusInput || input === planInput) nativeSet(input, value || '');
    else input.value = value || '';
  }
  function applyScheme(index) {
    const schemes = loadSchemes();
    const scheme = schemes[index];
    selectedSchemeIndex = index;
    renderSchemeSlots();
    if (!scheme) {
      toast(`已选择方案 ${index + 1}，点击“保存筛选方案”写入当前条件`);
      return;
    }
    Object.entries(FILTER_INPUTS).forEach(([key, input]) => setInputVisual(input, scheme.values?.[key] || ''));
    ratingScore.value = scheme.rating?.score ?? '';
    ratingModeState = scheme.rating?.mode === 'lt' ? 'lt' : 'gte';
    syncRatingOpFromScore();
    syncRatingButtons();
    sortDirection = scheme.sortDirection === 'asc' ? 'asc' : 'desc';
    syncSortButtons();
    favoriteOnly = Boolean(scheme.favoriteOnly);
    syncFavoriteButton();
    MODE_KEYS.forEach(key => setMode(key, scheme.modes?.[key] === 'exclude' ? 'exclude' : 'include'));
    closePicker();
    dispatchInput(keywordInput);
    toast(`已应用筛选方案“${scheme.name || `方案 ${index + 1}`}”`);
  }
  function openSchemeSaveDialog() {
    const schemes = loadSchemes();
    let index = selectedSchemeIndex;
    if (index < 0) index = schemes.findIndex(item => !item);
    if (index < 0) index = 0;
    selectedSchemeIndex = index;
    renderSchemeSlots();
    schemeNameInput.value = schemes[index]?.name || `方案 ${index + 1}`;
    schemeDialog.showModal();
    requestAnimationFrame(() => { schemeNameInput.focus(); schemeNameInput.select(); });
  }
  schemeDialog.querySelector('form').addEventListener('submit', event => {
    event.preventDefault();
    const name = schemeNameInput.value.trim();
    if (!name) { schemeNameInput.focus(); return; }
    const schemes = loadSchemes();
    const index = selectedSchemeIndex;
    schemes[index] = { ...schemeSnapshot(), name };
    saveSchemes(schemes);
    renderSchemeSlots();
    schemeDialog.close();
    toast(`筛选方案“${name}”已保存`);
  });
  operationCell.addEventListener('click', event => {
    const slot = event.target.closest('[data-filter-scheme-slot]');
    if (slot) {
      applyScheme(Number(slot.dataset.filterSchemeSlot));
      return;
    }
    if (event.target.closest('[data-filter-scheme-save]')) {
      openSchemeSaveDialog();
      return;
    }
    if (event.target.closest('[data-filter-scheme-delete]')) {
      if (selectedSchemeIndex < 0) { toast('请先选择要删除的筛选方案'); return; }
      const schemes = loadSchemes();
      if (!schemes[selectedSchemeIndex]) { toast(`方案 ${selectedSchemeIndex + 1} 还是空的`); return; }
      if (!confirm(`确认删除筛选方案 ${selectedSchemeIndex + 1}？`)) return;
      schemes[selectedSchemeIndex] = null;
      saveSchemes(schemes);
      renderSchemeSlots();
      toast(`筛选方案 ${selectedSchemeIndex + 1} 已删除`);
    }
  });
  renderSchemeSlots();

  document.addEventListener('click', event => {
    if (!event.target.closest('.plan-filter-calendar-system-v1') && event.target !== planInput) closePicker();
    if (event.target.closest('#clearLibFilters')) {
      queueMicrotask(() => {
        nativeSet(statusInput, '');
        nativeSet(planInput, '');
        favoriteOnly = false;
        ratingModeState = 'gte';
        sortDirection = 'desc';
        syncFavoriteButton();
        syncRatingOpFromScore();
        syncRatingButtons();
        syncSortButtons();
        MODE_KEYS.forEach(syncModeVisual);
        closePicker();
      });
    }
  });
  window.addEventListener('resize', positionPicker);
  window.addEventListener('scroll', positionPicker, true);

  MODE_KEYS.forEach(syncModeVisual);
  dispatchInput(sortInput);
})();
