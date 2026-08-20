(() => {
  'use strict';
  const isAdminConsole=/(?:^|\/)admin-console\.html$/i.test(location.pathname);
  document.write('<script src="site-brand.js"></script><script src="nav-order.js"></script><script src="library-pagination-top.js"></script>');
  if(isAdminConsole){
    document.documentElement.style.visibility='hidden';
    let token='';
    try{token=sessionStorage.getItem('movie-collection-admin-session-v1')||''}catch{}
    if(!token){location.replace('admin.html');return}
    document.write('<script src="admin-auth.js"></script>');
  }
  document.write('<script src="content-observer-shield.js"></script><script src="content-center-core.js"></script><script src="content-compat.js"></script><script src="content-schema-extra.js"></script><script src="content-schema-guard.js"></script><script src="stats-watch-integration.js"></script><script src="ui-theme-system.js"></script><script src="ui-theme-seasonal.js"></script><script src="ui-theme-seasonal-compat.js"></script><script src="ui-theme-forest-bright.js"></script><script src="ui-theme-default-backgrounds.js"></script><script src="sidebar-quote-layout.js"></script><script src="radar-20.js"></script><script src="library-card-actions-v2.js"></script><script src="home-month-insight-v2.js?v=20260821-0254"></script><script src="tmdb-alias-match.js?v=20260821-0125"></script><script src="rating-sync-v2.js?v=20260821-0302"></script><script src="cloud-auth.js?v=20260821-0315"></script>');
  if(isAdminConsole)document.write('<script src="admin-brand.js"></script><script src="admin-nav.js"></script>');
})();