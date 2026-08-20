(() => {
  'use strict';
  if (/(?:^|\/)(?:admin|admin-console)\.html$/i.test(location.pathname)) return;

  const STORAGE_KEY = 'movie-collection-v2';
  const TRUNCATED_LENGTH = 76;
  const $ = id => document.getElementById(id);
  const safeParse = raw => { try { return JSON.parse(raw); } catch { return null; } };

  function findOverview(title, meta, prefix) {
    const state = safeParse(localStorage.getItem(STORAGE_KEY));
    const matches = (state?.movies || []).filter(movie => {
      const info = movie?.info || {};
      const overview = String(info.overview || '').trim();
      return String(info.title || '').trim() === title &&
        overview.length > TRUNCATED_LENGTH &&
        overview.startsWith(prefix);
    });
    if (!matches.length) return '';

    const withYear = matches.find(movie => {
      const year = movie?.info?.year;
      return year && String(meta || '').includes(String(year));
    });
    return String((withYear || matches[0])?.info?.overview || '').trim();
  }

  function restoreFullOverview() {
    const quote = $('randomQuote');
    const title = $('randomTitle');
    if (!quote || !title) return;

    const shown = String(quote.textContent || '');
    if (!shown.endsWith('…')) return;

    const prefix = shown.slice(0, -1);
    if (prefix.length !== TRUNCATED_LENGTH) return;

    const full = findOverview(
      String(title.textContent || '').trim(),
      String($('randomMeta')?.textContent || ''),
      prefix
    );
    if (full && full !== shown) quote.textContent = full;
  }

  function boot() {
    const quote = $('randomQuote');
    if (!quote) return;
    restoreFullOverview();
    new MutationObserver(restoreFullOverview).observe(quote, {
      childList: true,
      characterData: true,
      subtree: true
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
