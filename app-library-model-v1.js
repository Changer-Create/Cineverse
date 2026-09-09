(() => {
  'use strict';
  if (window.CineverseLibrary) return;

  const MEDIA_FILTER = Object.freeze({ 电影:'movie', 剧集:'tv', 待识别:'unknown' });
  const STATUS_FILTER = Object.freeze({ 想看:'want', 看过:'watched', 已计划:'planned' });
  const SORT_FILTER = Object.freeze({
    最近更新:'updatedDesc', 评分从高到低:'ratingDesc', 年份降序:'yearDesc', 年份升序:'yearAsc',
    '片名 A-Z':'titleAsc', 时长从长到短:'runtimeDesc'
  });

  function resolveMappedFilter(raw, map, defaultValue = '') {
    const query = String(raw || '').trim();
    if (!query || query === '全部') return defaultValue;
    if (map[query]) return map[query];
    if (Object.values(map).includes(query)) return query;
    const keys = Object.keys(map).filter(key => key.toLowerCase().includes(query.toLowerCase()));
    return keys.length === 1 ? map[keys[0]] : '__nomatch__';
  }

  function passes(value, selected, exclude = false) {
    const query = String(selected || '').trim().toLowerCase();
    if (!query || query === '全部') return true;
    const values = Array.isArray(value) ? value : [value];
    const found = values.some(item => String(item ?? '').toLowerCase().includes(query));
    return exclude ? !found : found;
  }

  function ratingPass(score, operator, target) {
    if (operator === 'all') return true;
    if (operator === 'unrated') return score == null || score === '';
    if (score == null || score === '') return false;
    const value = Number(score), expected = Number(target);
    if (!Number.isFinite(expected)) return true;
    if (operator === 'gte') return value >= expected;
    if (operator === 'lte') return value <= expected;
    if (operator === 'eq') return Math.abs(value - expected) < 1e-9;
    if (operator === 'gt') return value > expected;
    if (operator === 'lt') return value < expected;
    return true;
  }

  function filterMovies(movies, criteria, { displayStatus, mediaTypeLabel }) {
    const c = { exclude:{}, ...criteria };
    const mediaType = resolveMappedFilter(c.mediaType, MEDIA_FILTER);
    const status = resolveMappedFilter(c.status, STATUS_FILTER);
    const keyword = String(c.keyword || '').trim().toLowerCase();
    const rows = (movies || []).filter(movie => {
      if (mediaType === '__nomatch__' || status === '__nomatch__') return false;
      if (mediaType && movie.mediaType !== mediaType) return false;
      const haystack = [movie.info.title, movie.info.originalTitle, ...(movie.info.directors || []),
        ...(movie.info.countries || []), ...(movie.personal?.tags || []), movie.info.year, mediaTypeLabel(movie)]
        .join(' ').toLowerCase();
      if (keyword && !haystack.includes(keyword)) return false;
      if (!passes(String(movie.info.year || ''), c.year, c.exclude.year)) return false;
      if (!passes(movie.info.directors || [], c.director, c.exclude.director)) return false;
      if (!passes(movie.info.countries || [], c.country, c.exclude.country)) return false;
      if (!passes(movie.personal?.tags || [], c.tag, c.exclude.tag)) return false;
      if (c.favoriteOnly && !movie.personal?.favorite) return false;
      if (c.plan && c.plan !== '全部') {
        const found = (movie.plans || []).some(plan => String(plan.month || '').toLowerCase().includes(String(c.plan).toLowerCase()));
        if (c.exclude.plan ? found : !found) return false;
      }
      if (c.planDate && /^\d{4}-\d{2}-\d{2}$/.test(String(c.planDate))) {
        const found = (movie.plans || []).some(plan => String(plan?.plannedDate || '') === String(c.planDate));
        if (c.exclude.plan ? found : !found) return false;
      }
      if (status) {
        const match = displayStatus(movie)[0] === status;
        if (c.exclude.status ? match : !match) return false;
      }
      return ratingPass(movie.personal?.rating, c.ratingOp || 'all', c.ratingTarget);
    });
    const sort = resolveMappedFilter(c.sort, SORT_FILTER, 'updatedDesc');
    const direction = c.sortDirection === 'asc' ? 'asc' : 'desc';
    const sign = direction === 'asc' ? 1 : -1;
    const titleCompare = (a, b) => String(a?.info?.title || '').localeCompare(String(b?.info?.title || ''), 'zh-Hans-CN');
    const numberCompare = (a, b, emptyValue) => {
      const av = Number.isFinite(Number(a)) ? Number(a) : emptyValue;
      const bv = Number.isFinite(Number(b)) ? Number(b) : emptyValue;
      return (av - bv) * sign;
    };
    return rows.sort((a, b) => {
      let result = 0;
      if (sort === 'ratingDesc') result = numberCompare(a.personal?.rating, b.personal?.rating, -1);
      else if (sort === 'yearDesc') result = numberCompare(a.info?.year, b.info?.year, 0);
      else if (sort === 'yearAsc') result = numberCompare(a.info?.year, b.info?.year, 9999);
      else if (sort === 'titleAsc') result = titleCompare(a, b) * sign;
      else if (sort === 'runtimeDesc') result = numberCompare(a.info?.runtime, b.info?.runtime, 0);
      else result = String(a.updatedAt || '').localeCompare(String(b.updatedAt || '')) * sign;
      return result || titleCompare(a, b);
    });
  }

  function paginate(rows, page = 1, pageSize = 36) {
    const totalPages = Math.max(1, Math.ceil((rows || []).length / pageSize));
    const currentPage = Math.min(Math.max(1, Number(page) || 1), totalPages);
    const start = (currentPage - 1) * pageSize;
    return { page:currentPage, totalPages, start, pageMovies:(rows || []).slice(start, start + pageSize) };
  }

  function extend(runtimeApi = {}) {
    return Object.freeze({ ...window.CineverseLibrary, ...runtimeApi });
  }

  window.CineverseLibrary = Object.freeze({ MEDIA_FILTER, STATUS_FILTER, SORT_FILTER, resolveMappedFilter, passes, ratingPass, filterMovies, paginate, extend });
})();
