(() => {
  'use strict';
  if (/(?:^|\/)(?:admin|admin-console)\.html$/i.test(location.pathname)) return;

  const STORAGE_KEY = 'movie-collection-v2';
  let rendering = false;

  const safeParse = raw => { try { return JSON.parse(raw); } catch { return null; } };
  const currentMonth = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  };
  const normalizeStatus = value => value === 'done' ? 'completed' : value === 'wait' ? 'planned' : (value || 'planned');
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  function entriesForCurrentMonth() {
    const state = safeParse(localStorage.getItem(STORAGE_KEY));
    const month = currentMonth();
    return (state?.movies || [])
      .flatMap(movie => (movie?.plans || []).map(plan => ({ movie, plan: typeof plan === 'string' ? { month:plan, status:'planned', plannedDate:null } : plan })))
      .filter(({ plan }) => plan?.month === month && normalizeStatus(plan?.status) !== 'deferred')
      .sort((a,b) => String(a.plan?.plannedDate || '9999').localeCompare(String(b.plan?.plannedDate || '9999')));
  }

  function signature(entries) {
    return entries.map(({ movie, plan }) => [
      movie?.id || '',
      movie?.info?.title || '',
      plan?.plannedDate || '',
      normalizeStatus(plan?.status)
    ].join('|')).join('||');
  }

  function renderFullPlanList() {
    if (rendering) return;
    const list = document.getElementById('planList');
    if (!list) return;
    const entries = entriesForCurrentMonth();
    const sig = signature(entries);
    const currentRows = list.querySelectorAll('.plan-row').length;
    if (list.dataset.fullPlanSignature === sig && currentRows === Math.max(entries.length, 1)) return;

    rendering = true;
    try {
      list.dataset.fullPlanSignature = sig;
      if (!entries.length) {
        list.innerHTML = '<div class="plan-row"><span>本月还没有观影计划</span><span class="date">—</span><span class="status wait">待安排</span></div>';
        return;
      }

      list.innerHTML = entries.map(({ movie, plan }) => {
        const status = normalizeStatus(plan?.status);
        const date = plan?.plannedDate ? String(plan.plannedDate).slice(5) : '待定';
        const label = status === 'completed' ? '已看' : '待看';
        const cls = status === 'completed' ? 'done' : 'wait';
        return `<div class="plan-row" data-open-detail="${esc(movie?.id || '')}" style="cursor:pointer"><span>${esc(movie?.info?.title || '未命名作品')}</span><span class="date">${esc(date)}</span><span class="status ${cls}">${label}</span></div>`;
      }).join('');
    } finally {
      rendering = false;
    }
  }

  function boot() {
    renderFullPlanList();
    const list = document.getElementById('planList');
    if (!list) return;
    const observer = new window.MovieMutationObserver(() => queueMicrotask(renderFullPlanList));
    observer.observe(list, { childList:true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
