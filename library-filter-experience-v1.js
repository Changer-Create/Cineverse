(() => {
  'use strict';
  if (/(?:^|\/)(?:admin|admin-console)\.html$/i.test(location.pathname)) return;

  const $ = id => document.getElementById(id);
  const grid = document.querySelector('#libraryView .filter-grid') || document.querySelector('.library-tools .filter-grid');
  const statusInput = $('libStatus');
  const statusList = $('libStatusOptions');
  const ratingOp = $('libRatingOp');
  const ratingScore = $('libRatingScore');
  const planInput = $('libPlan');
  const clearButton = $('clearLibFilters');
  if (!grid || !statusInput || !ratingOp || !ratingScore || !planInput || !clearButton) return;

  const inputValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  const nativeGet = input => inputValue.get.call(input);
  const nativeSet = (input, value) => inputValue.set.call(input, value);
  const STATUS_OPTIONS = ['全部','关注','想看','已计划','在看','已看','已看完','暂停','弃剧'];
  const now = new Date();
  const CURRENT_MONTH = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

  function dispatchInput(input) {
    input.dispatchEvent(new Event('input', { bubbles:true }));
  }

  function setPlaceholder(id, text) {
    const input = $(id);
    if (input) input.placeholder = text;
  }

  setPlaceholder('libMediaType','输入搜索');
  setPlaceholder('libYear','输入年份');
  setPlaceholder('libDirector','输入导演');
  setPlaceholder('libCountry','输入国家或地区');
  setPlaceholder('libStatus','输入状态');
  setPlaceholder('libTag','输入标签');
  setPlaceholder('libPlan','选择观影计划日期');

  const style = document.createElement('style');
  style.id = 'libraryFilterExperienceStyleV1';
  style.textContent = `
    .filter-grid .exclude-toggle:not(.active){border-color:rgba(98,210,162,.32)!important;background:rgba(98,210,162,.09)!important;color:#9be3c2!important}
    .filter-grid .exclude-toggle:not(.active):hover{border-color:rgba(98,210,162,.52)!important;background:rgba(98,210,162,.14)!important;color:#c4f1dc!important}
    #libRatingOp{display:none!important}
    .rating-filter-row{display:block!important}
    .rating-filter-row .manual-filter-input-wrap{width:100%}
    .rating-range-toggle-row{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:5px}
    .rating-range-toggle{height:25px;border-radius:8px;border:1px solid rgba(156,169,218,.14);background:rgba(255,255,255,.025);color:#8791ac;font-size:10px;transition:.18s ease}
    .rating-range-toggle:hover{border-color:rgba(159,124,255,.28);color:#c9c3df;background:rgba(159,124,255,.06)}
    .rating-range-toggle.active{border-color:rgba(98,210,162,.34);background:rgba(98,210,162,.1);color:#a7e8ca}
    .filter-reset-cell #clearLibFilters{width:100%;height:38px;margin:0;border-radius:11px;border:1px dashed rgba(255,184,112,.34);background:rgba(255,184,112,.055);color:#d9b589;box-shadow:none}
    .filter-reset-cell #clearLibFilters:hover{border-color:rgba(255,184,112,.55);background:rgba(255,184,112,.1);color:#f1cfaa}
    #libPlan[readonly]{cursor:pointer;padding-right:32px}
    .plan-filter-calendar-v1{position:fixed;z-index:10020;width:min(344px,calc(100vw - 20px));padding:12px;border:1px solid rgba(133,151,205,.32);border-radius:15px;background:#0b1734;color:#eef2ff;box-shadow:0 22px 60px rgba(0,0,0,.48);display:none}
    .plan-filter-calendar-v1.open{display:block}
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
    @media(max-width:560px){.plan-filter-calendar-v1{width:calc(100vw - 18px)}}
  `;
  document.head.appendChild(style);

  // 状态由本模块统一处理，避免核心层先行做“包含”筛选，才能正确支持排除。
  try {
    Object.defineProperty(statusInput, 'value', {
      configurable:true,
      get() { return ''; },
      set(value) { nativeSet(this, value); }
    });
  } catch {}

  if (statusList) {
    statusList.innerHTML = STATUS_OPTIONS.map(value => `<option value="${value}"></option>`).join('');
  }

  const statusCell = statusInput.closest('.filter-cell');
  let statusToggle = statusCell?.querySelector('[data-exclude="status"]');
  if (statusCell && !statusToggle) {
    statusToggle = document.createElement('button');
    statusToggle.type = 'button';
    statusToggle.className = 'exclude-toggle';
    statusToggle.dataset.exclude = 'status';
    statusToggle.textContent = '包含';
    statusCell.appendChild(statusToggle);
  }

  const ratingCell = ratingScore.closest('.filter-cell');
  let ratingToggleRow = ratingCell?.querySelector('.rating-range-toggle-row');
  if (ratingCell && !ratingToggleRow) {
    ratingToggleRow = document.createElement('div');
    ratingToggleRow.className = 'rating-range-toggle-row';
    ratingToggleRow.innerHTML = '<button type="button" class="rating-range-toggle" data-rating-range="gte">大于等于</button><button type="button" class="rating-range-toggle" data-rating-range="lt">小于</button>';
    ratingCell.appendChild(ratingToggleRow);
  }

  function currentRatingMode() {
    return ratingOp.value === 'lt' ? 'lt' : 'gte';
  }

  function syncRatingButtons() {
    const mode = currentRatingMode();
    ratingToggleRow?.querySelectorAll('[data-rating-range]').forEach(button => {
      button.classList.toggle('active', button.dataset.ratingRange === mode);
    });
    ratingScore.disabled = false;
    const arrow = ratingScore.closest('.manual-filter-input-wrap')?.querySelector('.library-filter-toggle-v3,.manual-filter-toggle');
    if (arrow) arrow.disabled = false;
  }

  function setRatingMode(mode, { render=true }={}) {
    ratingOp.value = mode === 'lt' ? 'lt' : 'gte';
    ratingScore.disabled = false;
    ratingOp.dispatchEvent(new Event('change', { bubbles:true }));
    syncRatingButtons();
    if (render && ratingScore.value) dispatchInput(ratingScore);
  }

  ratingToggleRow?.addEventListener('click', event => {
    const button = event.target.closest('[data-rating-range]');
    if (!button) return;
    event.preventDefault();
    setRatingMode(button.dataset.ratingRange);
  });
  setRatingMode(['gte','lt'].includes(ratingOp.value) ? ratingOp.value : 'gte', { render:false });

  const planCell = planInput.closest('.filter-cell');
  const planLabel = planCell?.querySelector('label');
  if (planLabel) planLabel.textContent = '观影计划';
  planInput.readOnly = true;
  planInput.removeAttribute('data-manual-list');
  planInput.closest('.manual-filter-input-wrap')?.querySelectorAll('.library-filter-toggle-v3,.manual-filter-toggle').forEach(button => button.remove());

  // 完整日期的“包含”先让核心层按月份缩小范围，再在排序入口精确到日；
  // “排除”则让核心层跳过月份过滤，避免误排除整个月。
  try {
    Object.defineProperty(planInput, 'value', {
      configurable:true,
      get() {
        const visual = nativeGet(this).trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(visual)) {
          const exclude = Boolean(planCell?.querySelector('[data-exclude="plan"]')?.classList.contains('active'));
          return exclude ? '' : visual.slice(0,7);
        }
        return visual;
      },
      set(value) { nativeSet(this, value); }
    });
  } catch {}

  const picker = document.createElement('div');
  picker.className = 'plan-filter-calendar-v1';
  picker.setAttribute('role','dialog');
  picker.setAttribute('aria-label','选择观影计划日期');
  picker.innerHTML = `
    <div class="plan-filter-calendar-head">
      <button type="button" data-plan-year-step="-1" aria-label="上一年">‹</button>
      <input class="plan-filter-year" type="number" min="1900" max="2100" step="1" aria-label="年份">
      <button type="button" data-plan-year-step="1" aria-label="下一年">›</button>
    </div>
    <div class="plan-filter-calendar-actions"><button type="button" class="year-only" data-plan-year-only>仅按年份筛选</button><button type="button" class="clear" data-plan-date-clear>清除</button></div>
    <div class="plan-filter-months"></div>
    <div class="plan-filter-weekdays"><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span></div>
    <div class="plan-filter-days"></div>
  `;
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
    monthsWrap.innerHTML = Array.from({ length:12 }, (_,index) => {
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
    for (let i=0;i<offset;i+=1) cells.push('<span class="plan-filter-day placeholder"></span>');
    for (let day=1;day<=count;day+=1) {
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
    let left = Math.min(Math.max(10, rect.left), window.innerWidth - width - 10);
    let top = rect.bottom + 7;
    if (top + 390 > window.innerHeight) top = Math.max(10, rect.top - 397);
    picker.style.left = `${left}px`;
    picker.style.top = `${top}px`;
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
      selectedYear = Math.min(2100,Math.max(1900,selectedYear + Number(step.dataset.planYearStep||0)));
      selectedMonth = null;
      selectedDay = null;
      commitPlanValue(String(selectedYear));
      renderPicker();
      return;
    }
    const yearOnly = event.target.closest('[data-plan-year-only]');
    if (yearOnly) {
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
    const value = Math.min(2100,Math.max(1900,Number(yearInput.value)||now.getFullYear()));
    selectedYear = value;
    selectedMonth = null;
    selectedDay = null;
    commitPlanValue(String(selectedYear));
    renderPicker();
  });

  document.addEventListener('click', event => {
    if (!event.target.closest('.plan-filter-calendar-v1') && event.target !== planInput) closePicker();
    if (event.target.closest('#clearLibFilters')) {
      queueMicrotask(() => {
        nativeSet(statusInput,'');
        nativeSet(planInput,'');
        setRatingMode('gte',{ render:false });
        syncRatingButtons();
        closePicker();
      });
    }
  });
  window.addEventListener('resize', positionPicker);
  window.addEventListener('scroll', positionPicker, true);

  // 把清除筛选从底部操作区移入筛选网格。
  if (!grid.querySelector('.filter-reset-cell')) {
    const cell = document.createElement('div');
    cell.className = 'filter-cell filter-reset-cell';
    cell.innerHTML = '<label>筛选操作</label>';
    cell.appendChild(clearButton);
    grid.appendChild(cell);
  }

  function normalizeStatusQuery(raw) {
    const query = String(raw||'').trim();
    if (!query || query === '全部') return '';
    if (STATUS_OPTIONS.includes(query)) return query;
    const matches = STATUS_OPTIONS.filter(value => value !== '全部' && value.includes(query));
    return matches.length === 1 ? matches[0] : '__nomatch__';
  }

  function hasCurrentPlan(movie) {
    return (movie?.plans||[]).some(plan => plan?.month === CURRENT_MONTH);
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

  if (!Array.prototype.__movieLibraryFilterExperienceV1) {
    const previousSort = Array.prototype.sort;
    Object.defineProperty(Array.prototype,'__movieLibraryFilterExperienceV1',{ value:true, configurable:true });
    Array.prototype.sort = function(compareFn) {
      if (!isCoreLibrarySort(compareFn)) return previousSort.call(this, compareFn);

      const selectedStatusRaw = nativeGet(statusInput).trim();
      const selectedStatus = normalizeStatusQuery(selectedStatusRaw);
      if (selectedStatus) {
        const exclude = Boolean(statusToggle?.classList.contains('active'));
        let write = 0;
        for (let read=0;read<this.length;read+=1) {
          const movie = this[read];
          const match = selectedStatus !== '__nomatch__' && statusLabel(movie) === selectedStatus;
          if (exclude ? !match : match) this[write++] = movie;
        }
        this.length = write;
      }

      const planVisual = nativeGet(planInput).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(planVisual)) {
        const exclude = Boolean(planCell?.querySelector('[data-exclude="plan"]')?.classList.contains('active'));
        let write = 0;
        for (let read=0;read<this.length;read+=1) {
          const movie = this[read];
          const match = (movie?.plans||[]).some(plan => String(plan?.plannedDate||'') === planVisual);
          if (exclude ? !match : match) this[write++] = movie;
        }
        this.length = write;
      }

      // v3 仍会从原生输入值读取状态；本模块已完成状态过滤，所以调用时临时清空，避免二次包含筛选。
      const visualStatus = nativeGet(statusInput);
      if (visualStatus) nativeSet(statusInput,'');
      try { return previousSort.call(this, compareFn); }
      finally { if (visualStatus) nativeSet(statusInput,visualStatus); }
    };
  }

  syncRatingButtons();
})();
