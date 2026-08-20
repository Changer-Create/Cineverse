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
  document.write('<script src="content-observer-shield.js"></script><script src="content-center-core.js"></script><script src="content-compat.js"></script><script src="content-schema-extra.js"></script><script src="content-schema-guard.js"></script>');
  if(isAdminConsole)document.write('<script src="admin-brand.js"></script><script src="admin-nav.js"></script>');
})();