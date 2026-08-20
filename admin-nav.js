(() => {
  'use strict';

  const Nav=window.MovieCollectionNavigation;
  if(!Nav||!/(?:^|\/)admin-console\.html$/i.test(location.pathname))return;

  const sideNav=document.querySelector('.side .nav');
  const main=document.querySelector('.main');
  if(!sideNav||!main||document.querySelector('#view-navigation'))return;

  const navBtn=document.createElement('button');
  navBtn.type='button';
  navBtn.dataset.tab='navigation';
  navBtn.innerHTML='↕ 导航管理';
  const brandBtn=sideNav.querySelector('[data-tab="brand"]');
  const overviewBtn=sideNav.querySelector('[data-tab="overview"]');
  (brandBtn||overviewBtn)?.insertAdjacentElement('afterend',navBtn);

  const view=document.createElement('section');
  view.className='view';
  view.id='view-navigation';
  view.innerHTML=`
    <section class="panel">
      <div class="panel-head">
        <h2>导航管理</h2>
        <span class="note">拖动项目调整前台左侧导航顺序</span>
      </div>
      <div class="panel-body">
        <div class="nav-admin-help">按住左侧拖拽手柄移动项目。调整完成后点击“保存导航顺序”，前台会按新顺序显示。</div>
        <div class="nav-sort-list" id="navSortList"></div>
        <div class="nav-admin-actions">
          <button class="btn primary" type="button" id="navOrderSave">保存导航顺序</button>
          <button class="btn" type="button" id="navOrderReset">恢复默认顺序</button>
          <span class="nav-admin-status" id="navOrderStatus"></span>
        </div>
      </div>
    </section>`;
  main.appendChild(view);

  const style=document.createElement('style');
  style.id='adminNavigationStyle';
  style.textContent=`
    .nav-admin-help{margin-bottom:14px;color:#8792af;font-size:11px;line-height:1.7}
    .nav-sort-list{display:grid;gap:9px;max-width:720px}
    .nav-sort-row{display:grid;grid-template-columns:38px 38px minmax(0,1fr) auto;align-items:center;gap:10px;padding:11px 12px;border:1px solid rgba(166,182,255,.14);border-radius:13px;background:rgba(255,255,255,.022);transition:.16s ease;user-select:none}
    .nav-sort-row:hover{border-color:rgba(159,124,255,.32);background:rgba(159,124,255,.045)}
    .nav-sort-row.dragging{opacity:.45;border-color:rgba(245,198,108,.46);background:rgba(245,198,108,.055)}
    .nav-sort-row.drag-over{border-color:rgba(159,124,255,.58);box-shadow:0 0 0 2px rgba(159,124,255,.09)}
    .nav-drag-handle{width:30px;height:30px;display:grid;place-items:center;border:1px solid rgba(166,182,255,.14);border-radius:9px;color:#9ca8c8;background:#08132d;cursor:grab;font-size:16px;line-height:1}
    .nav-sort-row.dragging .nav-drag-handle{cursor:grabbing}
    .nav-sort-index{font:600 16px Georgia,serif;color:#f2d28d;text-align:center}
    .nav-sort-main b{display:block;font-size:13px;color:#edf0fb}.nav-sort-main small{display:block;margin-top:3px;color:#73809f;font-size:9px}
    .nav-sort-move{display:flex;gap:5px}.nav-sort-move button{width:31px;height:31px;border:1px solid rgba(166,182,255,.14);border-radius:9px;background:#0a1733;color:#cbd3e9;cursor:pointer}.nav-sort-move button:hover{border-color:rgba(159,124,255,.4);color:#fff}
    .nav-admin-actions{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-top:16px}.nav-admin-status{font-size:10px;color:#8edbb6;min-height:16px}.nav-admin-status.dirty{color:#f0cd81}
    @media(max-width:650px){.nav-sort-row{grid-template-columns:34px 30px minmax(0,1fr)}.nav-sort-move{grid-column:3;justify-content:flex-start}}
  `;
  document.head.appendChild(style);

  const list=document.querySelector('#navSortList');
  const status=document.querySelector('#navOrderStatus');
  const copyState=()=>window.MovieCollectionContentCenter?.load?.()?.values||{};
  const copyKeys={home:'nav.home',library:'nav.library',match:'nav.match',radar:'nav.radar',plan:'nav.plan',watched:'nav.watched',stats:'nav.stats',settings:'nav.settings'};
  let dragKey='';

  function labelFor(key){
    const values=copyState();
    const copyKey=copyKeys[key];
    if(copyKey&&typeof values[copyKey]==='string'&&values[copyKey].trim())return values[copyKey].trim();
    return Nav.labels[key]||key;
  }

  function markDirty(message='顺序已调整，记得保存。'){
    status.textContent=message;
    status.classList.add('dirty');
  }

  function orderFromDom(){
    return [...list.querySelectorAll('.nav-sort-row')].map(row=>row.dataset.key).filter(Boolean);
  }

  function updateIndexes(){
    [...list.querySelectorAll('.nav-sort-row')].forEach((row,index)=>{
      const idx=row.querySelector('.nav-sort-index');
      if(idx)idx.textContent=String(index+1).padStart(2,'0');
      const up=row.querySelector('[data-move="up"]');
      const down=row.querySelector('[data-move="down"]');
      if(up)up.disabled=index===0;
      if(down)down.disabled=index===list.children.length-1;
    });
  }

  function makeRow(key){
    const row=document.createElement('div');
    row.className='nav-sort-row';
    row.draggable=true;
    row.dataset.key=key;
    row.innerHTML=`
      <div class="nav-drag-handle" title="拖拽排序">≡</div>
      <div class="nav-sort-index">00</div>
      <div class="nav-sort-main"><b></b><small></small></div>
      <div class="nav-sort-move"><button type="button" data-move="up" title="上移">↑</button><button type="button" data-move="down" title="下移">↓</button></div>`;
    row.querySelector('b').textContent=labelFor(key);
    row.querySelector('small').textContent=key==='admin'?'管理员入口':`页面标识 · ${key}`;

    row.addEventListener('dragstart',e=>{
      dragKey=key;
      row.classList.add('dragging');
      e.dataTransfer.effectAllowed='move';
      try{e.dataTransfer.setData('text/plain',key)}catch{}
    });
    row.addEventListener('dragend',()=>{
      dragKey='';
      row.classList.remove('dragging');
      list.querySelectorAll('.drag-over').forEach(el=>el.classList.remove('drag-over'));
      updateIndexes();
      markDirty();
    });
    row.addEventListener('dragover',e=>{
      e.preventDefault();
      if(!dragKey||dragKey===key)return;
      const dragging=list.querySelector(`.nav-sort-row[data-key="${CSS.escape(dragKey)}"]`);
      if(!dragging)return;
      const rect=row.getBoundingClientRect();
      const before=e.clientY<rect.top+rect.height/2;
      row.classList.add('drag-over');
      if(before)list.insertBefore(dragging,row);
      else list.insertBefore(dragging,row.nextSibling);
      updateIndexes();
    });
    row.addEventListener('dragleave',()=>row.classList.remove('drag-over'));
    row.addEventListener('drop',e=>{e.preventDefault();row.classList.remove('drag-over')});

    row.querySelector('[data-move="up"]').addEventListener('click',()=>{
      const prev=row.previousElementSibling;
      if(prev){list.insertBefore(row,prev);updateIndexes();markDirty()}
    });
    row.querySelector('[data-move="down"]').addEventListener('click',()=>{
      const next=row.nextElementSibling;
      if(next){list.insertBefore(next,row);updateIndexes();markDirty()}
    });
    return row;
  }

  function render(order=Nav.load().order){
    list.innerHTML='';
    for(const key of Nav.normalize(order))list.appendChild(makeRow(key));
    updateIndexes();
  }

  document.querySelector('#navOrderSave').addEventListener('click',()=>{
    const state=Nav.save(orderFromDom());
    render(state.order);
    status.textContent='导航顺序已保存。';
    status.classList.remove('dirty');
  });

  document.querySelector('#navOrderReset').addEventListener('click',()=>{
    const state=Nav.reset();
    render(state.order);
    status.textContent='已恢复默认顺序并保存。';
    status.classList.remove('dirty');
  });

  render();
})();