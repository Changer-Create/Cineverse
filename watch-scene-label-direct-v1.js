(() => {
  'use strict';
  if (/(?:^|\/)(?:admin|admin-console)\.html$/i.test(location.pathname)) return;

  function applyWatchSceneCopy() {
    const venue = document.getElementById('watchVenueInput');
    if (!venue) return;
    const field = venue.closest('.modal-field');
    const label = field?.querySelector('label');
    if (label && label.textContent !== '观看场景') label.textContent = '观看场景';
    if (venue.placeholder !== '影院 / 家中 / 聚会') venue.placeholder = '影院 / 家中 / 聚会';
    venue.setAttribute('aria-label', '观看场景');
  }

  function boot() {
    applyWatchSceneCopy();
    document.addEventListener('click', event => {
      if (event.target.closest?.('#detailAddWatchBtn,#detailAddWatchBtn2,[data-edit-watch]')) {
        requestAnimationFrame(applyWatchSceneCopy);
      }
    }, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
