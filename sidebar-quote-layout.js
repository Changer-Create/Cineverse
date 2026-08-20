(() => {
  'use strict';
  if(/(?:^|\/)(?:admin|admin-console)\.html$/i.test(location.pathname))return;

  function applyQuoteLayoutFix(){
    const card=document.querySelector('#sidebarQuoteCard');
    if(!card)return;
    card.querySelector('.moon')?.remove();

    if(!document.querySelector('#sidebarQuoteLayoutFixStyle')){
      const style=document.createElement('style');
      style.id='sidebarQuoteLayoutFixStyle';
      style.textContent=`
        #sidebarQuoteCard{
          min-height:0!important;
          overflow-y:auto!important;
          overflow-x:hidden!important;
          padding:16px 16px 14px!important;
          flex:0 1 auto;
          scrollbar-width:thin;
          scrollbar-color:rgba(151,164,203,.26) transparent;
        }
        #sidebarQuoteCard .moon{display:none!important}
        #sidebarQuoteCard .quote-text{
          margin:0!important;
          min-height:0!important;
          line-height:1.8;
          overflow-wrap:anywhere;
          word-break:break-word;
        }
        #sidebarQuoteCard .quote-credit{margin-top:8px!important}
        #sidebarQuoteCard .quote-actions{margin-top:10px!important;flex-wrap:wrap}
        #sidebarQuoteCard .quote-source-hint{margin-top:6px!important}
        #sidebarQuoteCard::-webkit-scrollbar{width:5px}
        #sidebarQuoteCard::-webkit-scrollbar-thumb{background:rgba(151,164,203,.22);border-radius:999px}
        #sidebarQuoteCard::-webkit-scrollbar-track{background:transparent}
        @media (min-width:981px) and (max-height:760px){
          #sidebarQuoteCard{padding:13px 14px 12px!important}
          #sidebarQuoteCard .quote-text{font-size:12px!important;line-height:1.7!important}
          #sidebarQuoteCard .quote-credit{margin-top:6px!important}
          #sidebarQuoteCard .quote-actions{margin-top:7px!important}
        }
      `;
      document.head.appendChild(style);
    }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',applyQuoteLayoutFix,{once:true});
  else applyQuoteLayoutFix();
})();