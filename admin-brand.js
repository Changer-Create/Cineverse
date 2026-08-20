(() => {
  'use strict';
  const Brand=window.MovieCollectionBrand;
  if(!Brand||!/(?:^|\/)admin-console\.html$/i.test(location.pathname))return;

  const nav=document.querySelector('.side .nav');
  const main=document.querySelector('.main');
  if(!nav||!main||document.querySelector('#view-brand'))return;

  const navBtn=document.createElement('button');
  navBtn.type='button';
  navBtn.dataset.tab='brand';
  navBtn.innerHTML='◎ 站点品牌';
  const overviewBtn=nav.querySelector('[data-tab="overview"]');
  overviewBtn?.insertAdjacentElement('afterend',navBtn);

  const view=document.createElement('section');
  view.className='view';
  view.id='view-brand';
  view.innerHTML=`
    <section class="panel">
      <div class="panel-head"><h2>站点品牌</h2><span class="note">管理前台左侧栏的 Logo、网页名称与副文案</span></div>
      <div class="panel-body brand-admin-grid">
        <div class="brand-admin-preview">
          <div class="brand-preview-card">
            <img id="brandAdminPreviewLogo" alt="Logo 预览">
            <b id="brandAdminPreviewTitle">光影宇宙</b>
            <span id="brandAdminPreviewSubtitle">定制化影视收藏夹</span>
          </div>
          <div class="note">这里是左侧栏品牌区域的近似预览。实际前台会根据屏幕宽度自动缩放 Logo。</div>
        </div>
        <div class="brand-admin-form">
          <div class="field"><label for="brandAdminTitle">网页名称</label><input id="brandAdminTitle" maxlength="32" placeholder="例如：光影宇宙"></div>
          <div class="field"><label for="brandAdminSubtitle">副文案</label><input id="brandAdminSubtitle" maxlength="60" placeholder="例如：定制化影视收藏夹"></div>
          <div class="field"><label>Logo</label><div class="brand-file-actions"><label class="btn">上传 / 替换 Logo<input id="brandAdminLogoFile" type="file" accept="image/*" hidden></label><button class="btn" id="brandAdminResetLogo" type="button">恢复默认 Logo</button></div><div class="note">上传图片会自动压缩到适合网页使用的尺寸，原图不会被写入仓库。</div></div>
          <div class="brand-save-actions"><button class="btn primary" id="brandAdminSave" type="button">保存品牌设置</button><button class="btn" id="brandAdminResetAll" type="button">全部恢复默认</button></div>
          <div class="brand-admin-status" id="brandAdminStatus"></div>
        </div>
      </div>
    </section>`;
  main.appendChild(view);

  const style=document.createElement('style');
  style.id='adminBrandStyle';
  style.textContent=`
    .brand-admin-grid{display:grid;grid-template-columns:minmax(220px,.7fr) minmax(320px,1.3fr);gap:22px;align-items:start}
    .brand-admin-preview{display:grid;gap:12px}.brand-preview-card{min-height:330px;border:1px solid rgba(166,182,255,.14);border-radius:18px;background:linear-gradient(180deg,rgba(7,14,32,.94),rgba(8,17,38,.82));display:flex;flex-direction:column;align-items:center;justify-content:center;padding:28px;text-align:center}
    .brand-preview-card img{width:138px;height:138px;object-fit:cover;border-radius:50%;border:1px solid rgba(245,198,108,.28);box-shadow:0 16px 40px rgba(0,0,0,.32);background:#030714;margin-bottom:18px}
    .brand-preview-card b{font-size:20px;letter-spacing:.06em}.brand-preview-card span{color:#7f8aaa;font-size:12px;margin-top:5px}
    .brand-admin-form{display:grid;gap:14px}.brand-admin-form .field input{width:100%}.brand-file-actions,.brand-save-actions{display:flex;gap:9px;flex-wrap:wrap}.brand-file-actions .btn{display:inline-flex;align-items:center}
    .brand-admin-status{min-height:18px;color:#8edbb6;font-size:10px}.brand-admin-status.error{color:#ff9bae}
    @media(max-width:850px){.brand-admin-grid{grid-template-columns:1fr}.brand-preview-card{min-height:260px}}
  `;
  document.head.appendChild(style);

  const $=s=>document.querySelector(s);
  const title=$('#brandAdminTitle');
  const subtitle=$('#brandAdminSubtitle');
  const previewLogo=$('#brandAdminPreviewLogo');
  const previewTitle=$('#brandAdminPreviewTitle');
  const previewSubtitle=$('#brandAdminPreviewSubtitle');
  const status=$('#brandAdminStatus');
  let pendingLogoDataUrl=null;

  function setStatus(message,error=false){
    status.textContent=message||'';
    status.classList.toggle('error',!!error);
  }

  function refreshFromState(){
    const state=Brand.load();
    title.value=state.title;
    subtitle.value=state.subtitle;
    pendingLogoDataUrl=null;
    previewLogo.src=Brand.logo();
    previewTitle.textContent=state.title;
    previewSubtitle.textContent=state.subtitle;
  }

  function refreshPreview(){
    previewTitle.textContent=title.value.trim()||Brand.defaults.title;
    previewSubtitle.textContent=subtitle.value;
    if(pendingLogoDataUrl!==null)previewLogo.src=pendingLogoDataUrl||Brand.defaults.logo;
  }

  async function compressLogo(file){
    if(!file?.type?.startsWith('image/'))throw new Error('请选择图片文件');
    if(file.size>12*1024*1024)throw new Error('图片过大，请选择 12MB 以内的图片');
    const url=URL.createObjectURL(file);
    try{
      const img=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('图片读取失败'));im.src=url});
      const size=512,canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;
      const ctx=canvas.getContext('2d');
      ctx.clearRect(0,0,size,size);
      const scale=Math.min(size/img.naturalWidth,size/img.naturalHeight);
      const w=img.naturalWidth*scale,h=img.naturalHeight*scale;
      ctx.drawImage(img,(size-w)/2,(size-h)/2,w,h);
      return canvas.toDataURL('image/webp',.9);
    }finally{URL.revokeObjectURL(url)}
  }

  title.addEventListener('input',refreshPreview);
  subtitle.addEventListener('input',refreshPreview);

  $('#brandAdminLogoFile').addEventListener('change',async e=>{
    const file=e.target.files?.[0];
    if(!file)return;
    setStatus('正在处理 Logo…');
    try{
      pendingLogoDataUrl=await compressLogo(file);
      refreshPreview();
      setStatus('Logo 已准备好，点击“保存品牌设置”后生效。');
    }catch(err){setStatus(err?.message||'Logo 处理失败',true)}
    e.target.value='';
  });

  $('#brandAdminResetLogo').addEventListener('click',()=>{
    pendingLogoDataUrl='';
    refreshPreview();
    setStatus('已切换为默认 Logo，点击保存后生效。');
  });

  $('#brandAdminSave').addEventListener('click',()=>{
    const nextTitle=title.value.trim();
    if(!nextTitle){setStatus('网页名称不能为空。',true);title.focus();return}
    const current=Brand.load();
    Brand.save({
      title:nextTitle,
      subtitle:subtitle.value,
      logoDataUrl:pendingLogoDataUrl===null?current.logoDataUrl:pendingLogoDataUrl
    });
    refreshFromState();
    setStatus('品牌设置已保存。返回前台即可看到最新效果。');
  });

  $('#brandAdminResetAll').addEventListener('click',()=>{
    if(!confirm('确认将 Logo、网页名称和副文案全部恢复默认？'))return;
    Brand.reset();
    refreshFromState();
    setStatus('站点品牌已全部恢复默认。');
  });

  refreshFromState();
})();