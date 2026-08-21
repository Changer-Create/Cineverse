(() => {
  'use strict';
  if (window.__CINEVERSE_CONTENT_RUNTIME_V1__) return;
  window.__CINEVERSE_CONTENT_RUNTIME_V1__ = true;

  const sharedHead = [
    ['style', 'settings-responsive.css?v=20260821-1028'],
    ['style', 'large-screen-layout-v1.css?v=20260822-0208'],
    ['script', 'cineverse-config.js'],
    ['script', 'global-config-sync.js?v=20260821-1149'],
    ['script', 'site-brand.js'],
    ['script', 'nav-order.js'],
    ['script', 'library-pagination-top.js'],
  ];

  const applicationModules = [
    'content-observer-shield.js',
    'content-center-core.js',
    'content-compat.js',
    'content-schema-extra.js',
    'content-schema-guard.js',
    'stats-watch-integration.js',
    'ui-theme-system.js',
    'ui-theme-seasonal.js',
    'ui-theme-seasonal-compat.js',
    'ui-theme-forest-bright.js',
    'ui-theme-default-backgrounds.js?v=20260821-1020',
    'sidebar-quote-layout.js?v=20260821-0257',
    'quote-library-plus100.js?v=20260822-0112',
    'radar-20.js?v=20260821-2007',
    'home-radar-detail-navigation-v1.js?v=20260821-1245',
    'radar-experience-v3.js?v=20260821-1346',
    'radar-preview-want-button-v1.js?v=20260821-1352',
    'detail-return-context-v1.js?v=20260822-0023',
    'library-card-actions-v2.js?v=20260821-2006',
    'library-douban-import-dialog-v1.js?v=20260821-2358',
    'status-model-v3.js?v=20260821-2005',
    'library-filter-system-v1.js?v=20260822-0424',
    'home-month-insight-v2.js?v=20260821-1136',
    'home-plan-full-list-v1.js?v=20260821-2348',
    'plan-calendar-rich-cards-v1.js?v=20260822-0014',
    'home-random-overview-v2.js?v=20260821-0319',
    'tmdb-alias-match.js?v=20260821-0125',
    'rating-sync-v3.js?v=20260821-1403',
    'watch-record-edit-v1.js?v=20260822-0118',
    'watch-scene-label-direct-v1.js?v=20260822-0129',
    'detail-layout-unified-v1.js?v=20260822-0146',
    'watch-history-pagination-v1.js?v=20260822-0203',
    'cloud-pending-volatile-v1.js?v=20260821-2342',
    'cloud-auth-v5.js?v=20260822-0253',
    'bug-feedback-v1.js?v=20260822-0242',
    'feedback-sidebar-entry-v1.js?v=20260822-0302',
    'global-tmdb-search-v2.js?v=20260822-0322',
  ].map(src => ['script', src]);

  const adminModules = [
    ['script', 'admin-brand.js'],
    ['script', 'admin-nav.js'],
  ];

  const renderResources = resources => resources.map(([type, url]) => (
    type === 'style'
      ? `<link rel="stylesheet" href="${url}">`
      : `<script src="${url}"></script>`
  )).join('');

  const isAdminConsole = /(?:^|\/)(?:admin-console)\.html$/i.test(location.pathname);
  document.write(renderResources(sharedHead));

  if (isAdminConsole) {
    document.documentElement.style.visibility = 'hidden';
    let token = '';
    try {
      token = sessionStorage.getItem('movie-collection-admin-session-v1') || '';
    } catch {}
    if (!token) {
      location.replace('admin.html');
      return;
    }
    document.write(renderResources([['script', 'admin-auth.js']]));
  }

  document.write(renderResources(applicationModules));
  if (isAdminConsole) document.write(renderResources(adminModules));
})();
