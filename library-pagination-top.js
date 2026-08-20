(() => {
  'use strict';
  if(/(?:^|\/)(?:admin|admin-console)\.html$/i.test(location.pathname))return;

  function injectStyle(){
    if(document.querySelector('#libraryPaginationTopStyle'))return;
    const style=document.createElement('style');
    style.id='libraryPaginationTopStyle';
    style.textContent='#libraryPagination.library-pagination-top{margin-top:0;margin-bottom:14px}';
    document.head.appendChild(style);
  }

  function movePaginationToTop(){
    const pagination=document.querySelector('#libraryPagination');
    const grid=document.querySelector('#libraryGrid');
    if(!pagination||!grid)return false;
    if(pagination.nextElementSibling!==grid)grid.parentElement?.insertBefore(pagination,grid);
    pagination.classList.add('library-pagination-top');
    return true;
  }

  function boot(){
    injectStyle();
    movePaginationToTop();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
