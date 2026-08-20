(() => {
  'use strict';

  const CC=window.MovieCollectionContentCenter;
  if(!CC) return;
  const schema=Array.isArray(CC.schema)?CC.schema:[];
  const SESSION_KEY='movie-collection-content-visual-edit-v1';
  let runtime=null;

  function requested(){
    try{
      const p=new URLSearchParams(location.search);
      if(p.get('contentEdit')==='1') sessionStorage.setItem(SESSION_KEY,'1');
      return sessionStorage.getItem(SESSION_KEY)==='1';
    }catch{return false}
  }

  function ownTextNode(el){
    return [...el.childNodes].find(n=>n.nodeType===Node.TEXT_NODE&&n.nodeValue.trim())||null;
  }

  function applyItem(item,value){
    const el=document.querySelector(item.selector);
    if(!el) return false;
    const finalValue=value??item.defaultValue;
    if(item.prop==='placeholder') el.setAttribute('placeholder',finalValue);
    else if(item.prop==='ownText'){
      const node=ownTextNode(el);
      if(node) node.nodeValue=` ${finalValue} `;
    }else if(item.prop==='textIfEmpty') el.textContent=finalValue;
    else el.textContent=finalValue;
    return true;
  }

  function injectAdminEntry(){
    if(document.querySelector('#contentCenterVisualEditEntry')) return;
    const side=document.querySelector('.side');
    const back=side?.querySelector('.back');
    if(!side||!back) return;
    const a=document.createElement('a');
    a.id='contentCenterVisualEditEntry';
    a.className='back';
    a.href='index.html?contentEdit=1';
    a.textContent='✎ 前台可视化编辑';
    a.title='在真实前台页面旁边直接修改文案';
    a.style.marginTop='10px';
    a.addEventListener('click',()=>{try{sessionStorage.setItem(SESSION_KEY,'1')}catch{}});
    side.insertBefore(a,back);
  }

  function injectStyle(){
    if(document.querySelector('#ccVisualStyle')) return;
    const style=document.createElement('style');
    style.id='ccVisualStyle';
    style.textContent=`
      body.cc-visual-editing .cc-visual-target{outline:1px dashed rgba(245,198,108,.64)!important;outline-offset:4px}
      #ccVisualMarkerLayer{position:fixed;inset:0;z-index:99970;pointer-events:none}
      .cc-visual-marker{position:fixed;width:24px;height:24px;border:1px solid rgba(245,198,108,.68);border-radius:8px;background:#19172a;color:#ffe3a3;box-shadow:0 7px 22px rgba(0,0,0,.34);display:grid;place-items:center;padding:0;font-size:12px;line-height:1;pointer-events:auto;cursor:pointer;transform:translate(-50%,-50%);transition:.15s}
      .cc-visual-marker:hover{transform:translate(-50%,-50%) scale(1.08);background:#2a2140;border-color:#ffe0a0}
      #ccVisualToolbar{position:fixed;right:18px;top:18px;z-index:99990;display:flex;align-items:center;gap:8px;padding:9px 10px;border:1px solid rgba(159,124,255,.42);border-radius:14px;background:rgba(8,14,31,.94);backdrop-filter:blur(18px);box-shadow:0 16px 45px rgba(0,0,0,.38);color:#e9e5f7;font:12px "PingFang SC","Microsoft YaHei",system-ui,sans-serif}
      #ccVisualToolbar b{color:#f7d993;font-weight:600}#ccVisualToolbar span{color:#929dbc;font-size:10px}
      #ccVisualToolbar button{border:1px solid rgba(166,182,255,.18);border-radius:9px;background:rgba(24,36,72,.86);color:#e7ebf6;padding:7px 9px;cursor:pointer}
      #ccVisualToolbar button:hover{border-color:rgba(159,124,255,.45)}#ccVisualToolbar .cc-exit{color:#ffabbc;border-color:rgba(255,135,159,.28)}
      #ccVisualDialog{width:min(560px,calc(100vw - 32px));border:1px solid rgba(159,124,255,.34);border-radius:18px;background:#09142d;color:#f5f2ff;padding:0;box-shadow:0 28px 80px rgba(0,0,0,.56)}
      #ccVisualDialog::backdrop{background:rgba(2,5,13,.66);backdrop-filter:blur(5px)}
      .cc-ve-head{padding:18px 20px 14px;border-bottom:1px solid rgba(166,182,255,.14)}.cc-ve-head small{display:block;color:#8e9ab8;font-size:10px;margin-bottom:5px}.cc-ve-head b{font-size:15px}
      .cc-ve-body{padding:18px 20px}.cc-ve-body textarea{width:100%;min-height:112px;resize:vertical;border:1px solid rgba(166,182,255,.18);border-radius:12px;background:#071128;color:#f4f1fb;padding:12px 13px;outline:none;font:13px/1.7 "PingFang SC","Microsoft YaHei",system-ui,sans-serif}
      .cc-ve-body textarea:focus{border-color:rgba(159,124,255,.5);box-shadow:0 0 0 3px rgba(159,124,255,.08)}.cc-ve-default{margin-top:10px;color:#7f8aa8;font-size:10px;line-height:1.6;word-break:break-word}
      .cc-ve-actions{display:flex;justify-content:flex-end;gap:8px;padding:0 20px 18px}.cc-ve-actions button{border:1px solid rgba(166,182,255,.18);border-radius:10px;background:#12234a;color:#e7ebf6;padding:8px 12px;cursor:pointer}.cc-ve-actions .primary{background:linear-gradient(135deg,rgba(119,83,224,.72),rgba(67,98,204,.62));border-color:rgba(159,124,255,.42)}.cc-ve-actions .reset{margin-right:auto;color:#f2cf87;border-color:rgba(245,198,108,.25);background:rgba(97,70,24,.12)}
      @media(max-width:700px){#ccVisualToolbar{left:10px;right:10px;top:10px;flex-wrap:wrap}.cc-visual-marker{width:22px;height:22px}}
    `;
    document.head.appendChild(style);
  }

  function openEditor(item){
    if(!runtime) return;
    runtime.item=item;
    const state=CC.load();
    const value=Object.prototype.hasOwnProperty.call(state.values||{},item.key)?state.values[item.key]:item.defaultValue;
    runtime.dialog.querySelector('#ccVeGroup').textContent=`${item.group} · ${item.key}`;
    runtime.dialog.querySelector('#ccVeLabel').textContent=item.label;
    runtime.dialog.querySelector('#ccVeInput').value=value;
    runtime.dialog.querySelector('#ccVeDefault').textContent=`默认：${item.defaultValue}`;
    runtime.dialog.showModal();
    setTimeout(()=>runtime?.dialog.querySelector('#ccVeInput')?.focus(),0);
  }

  function refreshMarkers(){
    if(!runtime) return;
    const seen=new Set();
    let count=0;
    for(const item of schema){
      const el=document.querySelector(item.selector);
      let btn=runtime.markerMap.get(item.key);
      if(!el){
        if(btn){btn._ccTarget?.classList.remove('cc-visual-target');btn.remove();runtime.markerMap.delete(item.key)}
        continue;
      }
      const r=el.getBoundingClientRect();
      const css=getComputedStyle(el);
      const visible=!(r.width<2||r.height<2||css.display==='none'||css.visibility==='hidden'||r.bottom<0||r.top>innerHeight||r.right<0||r.left>innerWidth);
      if(!visible){
        if(btn){btn._ccTarget?.classList.remove('cc-visual-target');btn.remove();runtime.markerMap.delete(item.key)}
        continue;
      }
      seen.add(item.key);count++;
      el.classList.add('cc-visual-target');
      if(!btn){
        btn=document.createElement('button');
        btn.type='button';btn.className='cc-visual-marker';btn.textContent='✎';
        btn.addEventListener('pointerdown',e=>e.stopPropagation());
        btn.addEventListener('click',e=>{
          e.preventDefault();e.stopPropagation();
          const current=schema.find(x=>x.key===btn.dataset.copyKey);
          if(current)openEditor(current);
        });
        runtime.layer.appendChild(btn);
        runtime.markerMap.set(item.key,btn);
      }
      if(btn._ccTarget&&btn._ccTarget!==el)btn._ccTarget.classList.remove('cc-visual-target');
      btn._ccTarget=el;
      btn.dataset.copyKey=item.key;
      btn.title=`修改：${item.label}`;
      btn.style.left=`${Math.max(14,Math.min(innerWidth-14,r.right-2))}px`;
      btn.style.top=`${Math.max(14,Math.min(innerHeight-14,r.top+2))}px`;
    }
    for(const [key,btn] of [...runtime.markerMap]){
      if(seen.has(key)) continue;
      btn._ccTarget?.classList.remove('cc-visual-target');
      btn.remove();
      runtime.markerMap.delete(key);
    }
    const custom=Object.keys(CC.load().values||{}).length;
    const label=runtime.toolbar.querySelector('#ccVisualCount');
    if(label) label.textContent=`当前页 ${count} 项 · 已改 ${custom} 项`;
  }

  function destroy(){
    if(!runtime) return;
    runtime.observer?.disconnect();
    document.querySelectorAll('.cc-visual-target').forEach(el=>el.classList.remove('cc-visual-target'));
    runtime.layer?.remove();runtime.toolbar?.remove();runtime.dialog?.remove();
    document.querySelector('#ccVisualStyle')?.remove();document.body.classList.remove('cc-visual-editing');runtime=null;
  }

  function initEditor(){
    if(!requested()||runtime) return;
    injectStyle();document.body.classList.add('cc-visual-editing');
    const layer=document.createElement('div');layer.id='ccVisualMarkerLayer';document.body.appendChild(layer);
    const toolbar=document.createElement('div');toolbar.id='ccVisualToolbar';toolbar.innerHTML='<b>✎ 文案编辑模式</b><span id="ccVisualCount">0 项可编辑</span><button type="button" id="ccVisualBackAdmin">返回后台</button><button type="button" class="cc-exit" id="ccVisualExit">退出编辑</button>';document.body.appendChild(toolbar);
    const dialog=document.createElement('dialog');dialog.id='ccVisualDialog';dialog.innerHTML='<div class="cc-ve-head"><small id="ccVeGroup">—</small><b id="ccVeLabel">修改文案</b></div><div class="cc-ve-body"><textarea id="ccVeInput"></textarea><div class="cc-ve-default" id="ccVeDefault"></div></div><div class="cc-ve-actions"><button type="button" class="reset" id="ccVeReset">恢复默认</button><button type="button" id="ccVeCancel">取消</button><button type="button" class="primary" id="ccVeSave">保存修改</button></div>';document.body.appendChild(dialog);
    runtime={layer,toolbar,dialog,item:null,observer:null,timer:0,markerMap:new Map()};
    const schedule=()=>{if(!runtime)return;clearTimeout(runtime.timer);runtime.timer=setTimeout(refreshMarkers,70)};
    toolbar.querySelector('#ccVisualBackAdmin').addEventListener('click',()=>{location.href='admin.html'});
    toolbar.querySelector('#ccVisualExit').addEventListener('click',()=>{try{sessionStorage.removeItem(SESSION_KEY)}catch{}destroy()});
    dialog.querySelector('#ccVeCancel').addEventListener('click',()=>dialog.close());
    dialog.querySelector('#ccVeSave').addEventListener('click',()=>{const item=runtime?.item;if(!item)return;const input=dialog.querySelector('#ccVeInput');const value=input.value.trim();if(!value){input.focus();return}const state=CC.load();state.values=state.values||{};if(value===item.defaultValue)delete state.values[item.key];else state.values[item.key]=value;CC.save(state);applyItem(item,value);dialog.close();runtime.item=null;schedule()});
    dialog.querySelector('#ccVeReset').addEventListener('click',()=>{const item=runtime?.item;if(!item)return;const state=CC.load();state.values=state.values||{};delete state.values[item.key];CC.save(state);applyItem(item,item.defaultValue);dialog.close();runtime.item=null;schedule()});
    window.addEventListener('resize',schedule,{passive:true});window.addEventListener('scroll',schedule,{passive:true,capture:true});window.addEventListener('hashchange',schedule);document.addEventListener('click',schedule,true);
    const main=document.querySelector('.main');if(main){runtime.observer=new MutationObserver(schedule);runtime.observer.observe(main,{subtree:true,childList:true})}
    refreshMarkers();
  }

  function boot(){
    const isAdmin=/(?:^|\/)admin\.html$/i.test(location.pathname);
    if(isAdmin){injectAdminEntry();return}
    initEditor();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
