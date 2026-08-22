(() => {
  'use strict';
  if (window.__CINEVERSE_CONTENT_RUNTIME_V1__) return;
  window.__CINEVERSE_CONTENT_RUNTIME_V1__ = true;

  const resource = (type, src, targets, dependsOn = []) => Object.freeze({
    id:src.split('?')[0].replace(/\.(?:js|css)$/i, ''),
    type,
    src,
    targets:Object.freeze([...targets]),
    dependsOn:Object.freeze([...dependsOn]),
  });
  const sharedTargets = ['app', 'admin'];
  const appOnlyModuleIds = new Set([
    'stats-watch-integration',
    'ui-theme-system',
    'ui-theme-seasonal',
    'ui-theme-seasonal-compat',
    'ui-theme-forest-bright',
    'ui-theme-default-backgrounds',
    'sidebar-quote-layout',
    'home-radar-detail-navigation-v1',
    'radar-experience-v3',
    'radar-preview-want-button-v1',
    'detail-return-context-v1',
    'library-card-system-v1',
    'status-model-v3',
    'library-filter-system-v1',
    'home-month-insight-v2',
    'home-plan-full-list-v1',
    'home-random-overview-v2',
    'rating-sync-v3',
    'watch-record-edit-v1',
    'watch-scene-label-direct-v1',
    'detail-layout-unified-v1',
    'watch-history-pagination-v1',
    'cloud-pending-volatile-v1',
    'cloud-auth-v5',
    'bug-feedback-v1',
    'feedback-sidebar-entry-v1',
    'global-tmdb-search-v2',
  ]);

  const sharedHead = [
    resource('style', 'settings-responsive.css?v=20260821-1028', sharedTargets),
    resource('style', 'large-screen-layout-v1.css?v=20260822-0208', sharedTargets),
    resource('script', 'cineverse-config.js', sharedTargets),
    resource('script', 'global-config-sync.js?v=20260821-1149', sharedTargets, ['cineverse-config']),
    resource('script', 'site-brand.js', sharedTargets, ['global-config-sync']),
    resource('script', 'nav-order.js', sharedTargets, ['global-config-sync']),
    resource('script', 'library-pagination-top.js', sharedTargets),
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
    'library-card-system-v1.js?v=20260822-0435',
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
  ].map(src => {
    const id = src.split('?')[0].replace(/\.js$/i, '');
    return resource('script', src, appOnlyModuleIds.has(id) ? ['app'] : sharedTargets);
  });

  const libraryCardIndex = applicationModules.findIndex(item => item.id === 'library-card-system-v1');
  if (libraryCardIndex >= 0) {
    applicationModules.splice(libraryCardIndex + 1, 0, resource('style', 'library-card-scale-v1.css?v=20260822-0444', ['app']));
  }

  const adminAuth = resource('script', 'admin-auth.js', ['admin'], ['cineverse-config']);
  const adminModules = [
    resource('script', 'admin-brand.js', ['admin'], ['site-brand']),
    resource('script', 'admin-nav.js', ['admin'], ['nav-order']),
  ];

  window.CineverseRuntimeManifest = Object.freeze([
    ...sharedHead,
    adminAuth,
    ...applicationModules,
    ...adminModules,
  ]);

  const renderResources = resources => resources.map(({ type, src }) => (
    type === 'style'
      ? `<link rel="stylesheet" href="${src}">`
      : `<script src="${src}"></script>`
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
    document.write(renderResources([adminAuth]));
  }

  const target = isAdminConsole ? 'admin' : 'app';
  document.write(renderResources(applicationModules.filter(item => item.targets.includes(target))));
  if (isAdminConsole) document.write(renderResources(adminModules));
})();