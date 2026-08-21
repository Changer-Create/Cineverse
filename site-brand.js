(() => {
  'use strict';

  const KEY='movie-collection-site-brand-v1';
  const DEFAULTS={
    version:1,
    title:'光影宇宙',
    subtitle:'定制化影视收藏夹',
    logo:'assets/movie-collection-logo.webp'
  };

  const clone=v=>JSON.parse(JSON.stringify(v));
  const isAdmin=/(?:^|\/)(?:admin|admin-console)\.html$/i.test(location.pathname);
  let guardObserver=null;
  let guardTimer=0;

  function load(){
    try{
      const raw=JSON.parse(localStorage.getItem(KEY)||'{}');
      return {
        version:1,
        updatedAt:raw.updatedAt||'',
        title:typeof raw.title==='string'&&raw.title.trim()?raw.title.trim():DEFAULTS.title,
        subtitle:typeof raw.subtitle==='string'?raw.subtitle:DEFAULTS.subtitle,
        logoDataUrl:typeof raw.logoDataUrl==='string'?raw.logoDataUrl:''
      };
    }catch{
      return {version:1,updatedAt:'',title:DEFAULTS.title,subtitle:DEFAULTS.subtitle,logoDataUrl:''};
    }
  }

  function currentLogo(state=load()){
    return state.logoDataUrl||DEFAULTS.logo;
  }

  function ensureStyle(){
    if(document.querySelector('#siteBrandStyle'))return;
    const style=document.createElement('style');
    style.id='siteBrandStyle';
    style.textContent=`
      .sidebar .brand{text-align:center}
      .sidebar .brand .site-brand-logo{display:block;width:118px;height:118px;object-fit:cover;border-radius:50%;margin:0 auto 13px;border:1px solid rgba(245,198,108,.28);box-shadow:0 12px 34px rgba(0,0,0,.28),0 0 24px rgba(159,124,255,.08);background:#030714}
      .sidebar .brand>div{min-width:0}
      @media(max-width:1280px){.sidebar .brand .site-brand-logo{width:104px;height:104px}}
      @media(max-width:980px){.sidebar .brand .site-brand-logo{width:54px;height:54px;margin-bottom:0}.sidebar .brand{padding-bottom:14px}}
      @media(max-width:680px){.sidebar .brand .site-brand-logo{display:none}}
    `;
    document.head.appendChild(style);
  }

  function apply(){
    if(isAdmin)return false;
    const brand=document.querySelector('.sidebar .brand');
    const title=document.querySelector('#sidebarBrandTitle');
    const subtitle=document.querySelector('#sidebarBrandSubtitle');
    if(!brand||!title||!subtitle)return false;
    ensureStyle();
    let img=document.querySelector('#sidebarBrandLogo');
    if(!img){
      img=document.createElement('img');
      img.id='sidebarBrandLogo';
      img.className='site-brand-logo';
      img.alt='影视收藏夹 Logo';
      img.decoding='async';
      brand.insertBefore(img,brand.firstChild);
    }
    const state=load();
    const logo=currentLogo(state);
    if(img.getAttribute('src')!==logo)img.src=logo;
    if(title.textContent!==state.title)title.textContent=state.title;
    if(subtitle.textContent!==state.subtitle)subtitle.textContent=state.subtitle;
    if(document.title!==state.title)document.title=state.title;
    return true;
  }

  function save(next={}){
    const prev=load();
    const state={
      version:1,
      updatedAt:new Date().toISOString(),
      title:typeof next.title==='string'&&next.title.trim()?next.title.trim():prev.title,
      subtitle:typeof next.subtitle==='string'?next.subtitle:prev.subtitle,
      logoDataUrl:typeof next.logoDataUrl==='string'?next.logoDataUrl:prev.logoDataUrl
    };
    localStorage.setItem(KEY,JSON.stringify(state));
    window.MovieGlobalConfig?.localChanged(KEY, state);
    window.dispatchEvent(new CustomEvent('movie-collection:brand-updated',{detail:clone(state)}));
    apply();
    return state;
  }

  function reset(){
    localStorage.removeItem(KEY);
    window.MovieGlobalConfig?.localRemoved(KEY);
    apply();
    return load();
  }

  function resetLogo(){
    const state=load();
    state.logoDataUrl='';
    return save(state);
  }

  function ensureGuard(){
    if(isAdmin||guardObserver)return;
    const brand=document.querySelector('.sidebar .brand');
    if(!brand)return;
    guardObserver=new window.MovieMutationObserver(()=>{
      clearTimeout(guardTimer);
      guardTimer=setTimeout(()=>{
        const state=load();
        const title=document.querySelector('#sidebarBrandTitle');
        const subtitle=document.querySelector('#sidebarBrandSubtitle');
        const logo=document.querySelector('#sidebarBrandLogo');
        if(!logo||title?.textContent!==state.title||subtitle?.textContent!==state.subtitle||document.title!==state.title)apply();
      },0);
    });
    guardObserver.observe(brand,{subtree:true,childList:true,characterData:true});
  }

  function boot(){
    apply();
    ensureGuard();
  }

  window.MovieCollectionBrand={
    key:KEY,
    defaults:clone(DEFAULTS),
    load,
    save,
    reset,
    resetLogo,
    apply,
    logo:()=>currentLogo(load())
  };

  if(!isAdmin){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
    else boot();
    window.addEventListener('storage',e=>{if(e.key===KEY)apply()});
    window.addEventListener('movie-collection:brand-updated',apply);
  }
})();
