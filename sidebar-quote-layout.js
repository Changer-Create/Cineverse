(() => {
  'use strict';
  if(/(?:^|\/)(?:admin|admin-console)\.html$/i.test(location.pathname))return;

  function removeSourceEntry(card){
    card.querySelector('.moon')?.remove();
    card.querySelector('#quoteSourceBtn')?.remove();
    card.querySelectorAll('.quote-action').forEach(btn=>{
      if(/查看来源/.test(btn.textContent||''))btn.remove();
    });
    card.querySelectorAll('.quote-source-hint').forEach(el=>el.remove());
  }

  function applyQuoteLayoutFix(){
    const card=document.querySelector('#sidebarQuoteCard');
    if(!card)return;
    removeSourceEntry(card);

    if(!document.querySelector('#sidebarQuoteLayoutFixStyle')){
      const style=document.createElement('style');
      style.id='sidebarQuoteLayoutFixStyle';
      style.textContent=`
        @media (min-width:981px){
          .sidebar{
            overflow-y:auto;
            overflow-x:hidden;
            padding-top:20px!important;
            padding-bottom:14px!important;
            scrollbar-width:thin;
            scrollbar-color:rgba(151,164,203,.18) transparent;
          }
          .sidebar .brand{padding-bottom:16px!important}
          .sidebar .nav{gap:4px!important}
          .sidebar .nav a{
            font-size:13px!important;
            line-height:1.2!important;
            gap:9px!important;
            padding:8px 11px!important;
            border-radius:12px!important;
          }
          .sidebar .nav .ico{
            width:18px!important;
            height:18px!important;
            font-size:14px!important;
          }
          .sidebar::-webkit-scrollbar{width:5px}
          .sidebar::-webkit-scrollbar-thumb{background:rgba(151,164,203,.16);border-radius:999px}
          .sidebar::-webkit-scrollbar-track{background:transparent}
        }
        #sidebarQuoteCard{
          min-height:0!important;
          max-height:none!important;
          overflow:visible!important;
          padding:14px 14px 12px!important;
          flex:0 0 auto!important;
        }
        #sidebarQuoteCard .moon,
        #sidebarQuoteCard #quoteSourceBtn,
        #sidebarQuoteCard .quote-source-hint{display:none!important}
        #sidebarQuoteCard .quote-text{
          margin:0!important;
          min-height:0!important;
          line-height:1.72!important;
          overflow-wrap:anywhere;
          word-break:break-word;
        }
        #sidebarQuoteCard .quote-credit{margin-top:7px!important}
        #sidebarQuoteCard .quote-actions{margin-top:8px!important;flex-wrap:wrap}
        #sidebarQuoteCard .quote-action{font-size:9px!important;padding:4px 7px!important}
        @media (min-width:981px) and (max-height:800px){
          .sidebar .brand{padding-bottom:12px!important}
          .sidebar .nav{gap:3px!important}
          .sidebar .nav a{font-size:12px!important;padding:7px 10px!important}
          .sidebar .nav .ico{font-size:13px!important}
          #sidebarQuoteCard{padding:12px 13px 11px!important}
          #sidebarQuoteCard .quote-text{font-size:12px!important;line-height:1.65!important}
          #sidebarQuoteCard .quote-credit{font-size:10px!important;margin-top:5px!important}
          #sidebarQuoteCard .quote-actions{margin-top:6px!important}
        }
      `;
      document.head.appendChild(style);
    }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',applyQuoteLayoutFix,{once:true});
  else applyQuoteLayoutFix();
})();