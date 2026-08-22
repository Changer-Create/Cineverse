(() => {
  'use strict';
  if (window.CineversePlan) return;

  function parseMonth(month) {
    const match = /^(\d{4})-(\d{2})$/.exec(String(month || ''));
    if (!match) return { y:0, m:0 };
    return { y:Number(match[1]), m:Number(match[2]) };
  }

  function monthLabel(month) {
    const { y, m } = parseMonth(month);
    return y && m ? `${y} 年 ${m} 月` : '';
  }

  function shiftMonth(month, delta) {
    const { y, m } = parseMonth(month);
    if (!y || !m) return '';
    const date = new Date(y, m - 1 + Number(delta || 0), 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  const statusText = status => status === 'completed' ? '已完成' : status === 'deferred' ? '已延期' : '计划中';
  const statusClass = status => status === 'completed' ? 'completed' : status === 'deferred' ? 'deferred' : 'planned';

  function normalizePlans(movies) {
    for (const movie of movies || []) movie.plans = (movie.plans || []).map(plan => {
      if (typeof plan === 'string') return { month:plan, status:'planned', plannedDate:null };
      return {
        ...plan,
        status:plan.status === 'done' ? 'completed' : plan.status === 'wait' ? 'planned' : plan.status || 'planned',
        plannedDate:plan.plannedDate || null
      };
    });
    return movies;
  }

  function summarize(entries) {
    const rows = entries || [];
    const done = rows.filter(({ plan }) => plan.status === 'completed').length;
    const deferred = rows.filter(({ plan }) => plan.status === 'deferred').length;
    const planned = rows.filter(({ plan }) => plan.status === 'planned').length;
    const total = rows.length;
    return {
      done, deferred, planned, total,
      percent:total ? Math.round(done / total * 100) : 0,
      minutes:rows.filter(({ movie }) => movie.mediaType !== 'tv').reduce((sum, { movie }) => sum + (Number(movie.info?.runtime) || 0), 0)
    };
  }

  window.CineversePlan = Object.freeze({
    parseMonth, monthLabel, shiftMonth, statusText, statusClass, normalizePlans, summarize
  });
})();
