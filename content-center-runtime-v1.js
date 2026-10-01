(() => {
  'use strict';
  if (window.__CINEVERSE_CONTENT_RUNTIME_V1__) return;
  window.__CINEVERSE_CONTENT_RUNTIME_V1__ = true;

  const isAdminConsole=/(?:^|\/)(?:admin-console)\.html$/i.test(location.pathname);
  document.write('<link rel="stylesheet" href="settings-responsive.css?v=20260821-1028"><link rel="stylesheet" href="large-screen-layout-v1.css?v=20261001-type"><link rel="stylesheet" href="approved-layout-v1.css?v=20261001-readability-r2"><script src="global-config-sync.js?v=20260909-a05"></script><script src="site-brand.js"></script><script src="nav-order.js"></script>');
  if(isAdminConsole){
    document.documentElement.style.visibility='hidden';
    let token='';
    try{token=sessionStorage.getItem('movie-collection-admin-session-v1')||''}catch{}
    if(!token){location.replace('admin.html');return}
    document.write('<script src="admin-auth.js?v=20261001-readability-r2"></script>');
  }
  if (!window.CineverseScoreCachePolicy) document.write('<script src="score-cache-policy-v1.js?v=20261001-score"></script>');
  if (!window.CineversePublicScoreService) document.write('<script src="public-score-service-v1.js?v=20261001-association"></script>');
  document.write('<script src="content-observer-shield.js"></script><script src="content-center-core.js"></script><script src="content-compat.js"></script><script src="content-schema-extra.js"></script><script src="content-schema-guard.js"></script><script src="stats-watch-integration.js"></script><script src="sidebar-quote-layout.js?v=20261001-readability-r2"></script><script src="quote-library-plus100.js?v=20260822-0112"></script><script src="radar-20.js?v=20261001-readability-r2"></script><script src="detail-page-unified-v1.js?v=20261001-type"></script><script src="home-radar-detail-navigation-v2.js?v=20260822-1217"></script><script src="radar-experience-v3.js?v=20261001-association"></script><link rel="stylesheet" href="library-card-system-v2.css?v=20261001-readability-r2"><script src="library-card-system-v1.js?v=20261001-scroll"></script><script src="library-douban-import-dialog-v1.js?v=20261001-type"></script><script src="status-model-v3.js?v=20260821-2005"></script><script src="library-manual-filter-picker-v1.js?v=20260822-1130"></script><script src="library-filter-system-v1.js?v=20261001-readability-r2"></script><script src="home-month-insight-v2.js?v=20261001-readability-r2"></script><script src="home-plan-full-list-v1.js?v=20260821-2348"></script><script src="home-random-overview-v2.js?v=20260821-0319"></script><script src="tmdb-alias-match.js?v=20260821-0125"></script><script src="rating-sync-v3.js?v=20260822-2300"></script><script src="watch-record-edit-v1.js?v=20261001-readability-r2"></script><script src="watch-scene-label-direct-v1.js?v=20260822-0129"></script><script src="watch-history-pagination-v1.js?v=20261001-readability-r2"></script><script src="cloud-pending-volatile-v1.js?v=20260821-2342"></script><script src="cloud-auth-v5.js?v=20261001-readability-r2"></script><script src="bug-feedback-v1.js?v=20261001-readability-r2"></script><script src="feedback-sidebar-entry-v1.js?v=20260822-0302"></script><script src="global-tmdb-search-v3.js?v=20261001-readability-r2"></script>'+'<script src="library-action-bar-v1.js?v=20261001-readability-r2"></script>');
  document.write('<link rel="stylesheet" href="typography-v1.css?v=20261001-readability-r2">');
  if(isAdminConsole)document.write('<script src="admin-brand.js?v=20261001-readability-r2"></script><script src="admin-nav.js?v=20261001-readability-r2"></script>');
})();
