(() => {
  'use strict';
  const ENDPOINT='https://bjjralybdcuczwllxbvo.supabase.co/functions/v1/admin-auth';
  const TOKEN_KEY='movie-collection-admin-session-v1';
  const META_KEY='movie-collection-admin-session-meta-v1';
  const EDIT_KEY='movie-collection-content-visual-edit-v1';
  document.documentElement.style.visibility='hidden';

  const getToken=()=>{try{return sessionStorage.getItem(TOKEN_KEY)||''}catch{return ''}};
  const clear=()=>{try{sessionStorage.removeItem(TOKEN_KEY);sessionStorage.removeItem(META_KEY);sessionStorage.removeItem(EDIT_KEY)}catch{}};

  async function call(action){
    const token=getToken();
    const res=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json',...(token?{'Authorization':`Bearer ${token}`}:{})},body:JSON.stringify({action}),cache:'no-store'});
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data.message||'管理员认证失败');
    return data;
  }

  function injectControls(username='changer'){
    const side=document.querySelector('.side');
    const back=side?.querySelector('.back');
    if(!side)return;
    if(back&&!document.querySelector('#contentCenterVisualEditEntry')){
      const a=document.createElement('a');
      a.id='contentCenterVisualEditEntry';a.className='back';a.href='index.html?contentEdit=1';a.textContent='✎ 前台可视化编辑';a.title='在真实前台页面旁边直接修改文案';a.style.marginTop='10px';
      a.addEventListener('click',()=>{try{sessionStorage.setItem(EDIT_KEY,'1')}catch{}});
      side.insertBefore(a,back);
    }
    if(!document.querySelector('#adminLogoutBtn')){
      const btn=document.createElement('button');
      btn.id='adminLogoutBtn';btn.type='button';btn.textContent=`退出管理员 · ${username}`;
      btn.style.cssText='display:block;width:100%;margin-top:10px;border:1px solid rgba(255,135,159,.22);background:rgba(106,33,52,.10);color:#ff9fb2;text-align:left;padding:10px 12px;border-radius:11px;cursor:pointer;font:11px "PingFang SC","Microsoft YaHei",system-ui,sans-serif';
      btn.addEventListener('click',async()=>{try{await call('logout')}catch{}clear();location.replace('admin.html')});
      side.appendChild(btn);
    }
  }

  (async()=>{
    const token=getToken();if(!token){clear();location.replace('admin.html');return}
    try{
      const data=await call('verify');
      if(!data?.valid)throw new Error('invalid');
      try{sessionStorage.setItem(META_KEY,JSON.stringify({username:data.username||'changer',expiresAt:data.expiresAt||''}))}catch{}
      document.documentElement.style.visibility='';
      if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>injectControls(data.username||'changer'),{once:true});else injectControls(data.username||'changer');
    }catch{clear();location.replace('admin.html')}
  })();
})();