(() => {
  'use strict';
  const ENDPOINT='https://bjjralybdcuczwllxbvo.supabase.co/functions/v1/admin-auth';
  const TOKEN_KEY='movie-collection-admin-session-v1';
  const EDIT_KEY='movie-collection-content-visual-edit-v1';
  const isAdminConsole=/(?:^|\/)admin-console\.html$/i.test(location.pathname);
  if(isAdminConsole)return;

  let requested=false;
  try{
    const p=new URLSearchParams(location.search);
    requested=p.get('contentEdit')==='1'||sessionStorage.getItem(EDIT_KEY)==='1';
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