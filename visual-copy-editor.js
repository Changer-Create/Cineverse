(() => {
  'use strict';
  const ENDPOINT=window.CineverseConfig.endpoints.adminAuth;
  const TOKEN_KEY='movie-collection-admin-session-v1';
  const EDIT_KEY='movie-collection-content-visual-edit-v1';
  const isAdminConsole=/(?:^|\/)admin-console\.html$/i.test(location.pathname);
  if(isAdminConsole)return;

  let requested=false;
  try{
    const url=new URL(location.href);
    requested=url.searchParams.get('contentEdit')==='1';
    if(requested){
      // Treat visual edit as a one-shot entry. Keep a short handoff flag only
      // long enough for visual-copy-editor-core.js to initialize, then remove
      // the query parameter so a normal refresh returns to browsing mode.
      sessionStorage.setItem(EDIT_KEY,'1');
      url.searchParams.delete('contentEdit');
      history.replaceState(history.state,'',`${url.pathname}${url.search}${url.hash}`);
    }else{
      // Clean up edit state left behind by older versions.
      sessionStorage.removeItem(EDIT_KEY);
    }
  }catch{}
  if(!requested)return;

  let token='';
  try{token=sessionStorage.getItem(TOKEN_KEY)||''}catch{}
  if(!token){
    try{sessionStorage.removeItem(EDIT_KEY)}catch{}
    location.replace('admin.html?next=visual');
    return;
  }

  fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({action:'verify'}),cache:'no-store'})
    .then(async res=>({ok:res.ok,data:await res.json().catch(()=>({}))}))
    .then(({ok,data})=>{
      if(!ok||!data?.valid)throw new Error('invalid');
      const script=document.createElement('script');
      script.src='visual-copy-editor-core.js';
      script.dataset.visualCopyEditorCore='1';
      document.head.appendChild(script);
    })
    .catch(()=>{
      try{sessionStorage.removeItem(TOKEN_KEY);sessionStorage.removeItem(EDIT_KEY)}catch{}
      location.replace('admin.html?next=visual');
    });
})();