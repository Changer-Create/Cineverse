(() => {
  'use strict';
  if(/(?:^|\/)(?:admin|admin-console)\.html$/i.test(location.pathname))return;

  const THEME_KEY='movie-collection-ui-theme-v1';
  const APP_KEY='movie-collection-v2';
  const THEMES={
    star:{
      id:'star',name:'星夜宇宙',description:'默认 · 深蓝紫与暖金',accent:'#9f7cff',
      bg0:'#040817',bg1:'#08122a',bg2:'#0e1a38',panelRgb:'11,23,52',
      text:'#f7f3ff',muted:'#aab3cf',muted2:'#7f8aaa',line:'rgba(161,179,255,.16)',lineBright:'rgba(173,140,255,.34)',
      blue:'#64a7ff',cyan:'#6ee7f7',gold:'#f5c66c',gold2:'#ffdd98',green:'#62d2a2',shadow:'0 28px 70px rgba(0,0,0,.28)'
    },
    ocean:{
      id:'ocean',name:'深海微光',description:'深海蓝 · 青绿与珍珠光',accent:'#2d9cb5',
      bg0:'#03131d',bg1:'#052b3a',bg2:'#063445',panelRgb:'6,35,46',
      text:'#e7f4f5',muted:'#a4c4c7',muted2:'#83a7ae',line:'rgba(104,190,200,.18)',lineBright:'rgba(103,214,211,.38)',
      blue:'#4aafc2',cyan:'#6fdacd',gold:'#d9f1ef',gold2:'#f0fcfa',green:'#55c6b7',shadow:'0 28px 72px rgba(0,8,13,.34)'
    }
  };

  const state={selected:'star',applied:'star',guard:false};
  const q=s=>document.querySelector(s);
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
  function safeJson(raw){try{return JSON.parse(raw)}catch{return null}}
  function safeImageDataUrl(value){const data=String(value||'');return /^data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/]+=*$/i.test(data)?data:''}
  function loadTheme(){const raw=safeJson(localStorage.getItem(THEME_KEY)||'{}');return THEMES[raw?.theme]?raw.theme:'star'}
  function saveTheme(theme){const id=THEMES[theme]?theme:'star';localStorage.setItem(THEME_KEY,JSON.stringify({version:1,theme:id,updatedAt:new Date().toISOString()}));return id}
  function appSettings(){const app=safeJson(localStorage.getItem(APP_KEY)||'{}');return app?.settings&&typeof app.settings==='object'?app.settings:{}}
  function shadeHex(hex,amount){const v=String(hex||'').replace('#','');if(!/^[0-9a-fA-F]{6}$/.test(v))return hex;const cl=x=>clamp(x,0,255),rgb=[0,2,4].map(i=>parseInt(v.slice(i,i+2),16));return '#'+rgb.map(x=>Math.round(cl(x+amount)).toString(16).padStart(2,'0')).join('')}
  function currentAccent(theme){const input=q('#settingsAccent'),raw=input?.value||appSettings().accentColor||THEMES[theme].accent;return /^#[0-9a-fA-F]{6}$/.test(raw)?raw:THEMES[theme].accent}
  function panelOpacity(){const el=q('#settingsPanelOpacity'),raw=el?.value||appSettings().panelOpacity||72;return clamp(Number(raw)||72,45,94)/100}
  function environmentLevel(){const el=q('#settingsStarDensity');return ['low','normal','high'].includes(el?.value)?el.value:(appSettings().starDensity||'normal')}
  function wallpaper(){return safeImageDataUrl(appSettings().wallpaperDataUrl)}

  function setRootTokens(themeId){
    const t=THEMES[themeId]||THEMES.star,root=document.documentElement,accent=currentAccent(themeId),op=panelOpacity();
    root.style.setProperty('--bg-0',t.bg0);root.style.setProperty('--bg-1',t.bg1);root.style.setProperty('--bg-2',t.bg2);
    root.style.setProperty('--text',t.text);root.style.setProperty('--muted',t.muted);root.style.setProperty('--muted-2',t.muted2);
    root.style.setProperty('--line',t.line);root.style.setProperty('--line-bright',t.lineBright);
    root.style.setProperty('--purple',accent);root.style.setProperty('--purple-2',shadeHex(accent,-30));
    root.style.setProperty('--blue',t.blue);root.style.setProperty('--cyan',t.cyan);root.style.setProperty('--gold',t.gold);root.style.setProperty('--gold-2',t.gold2);root.style.setProperty('--green',t.green);
    root.style.setProperty('--panel',`rgba(${t.panelRgb},${op})`);root.style.setProperty('--panel-strong',`rgba(${t.panelRgb},${Math.min(.97,op+.18)})`);root.style.setProperty('--panel-soft',`rgba(${t.panelRgb},${Math.max(.35,op-.14)})`);root.style.setProperty('--shadow',t.shadow);
  }

  function setBackground(themeId){
    const body=document.body;if(!body)return;const custom=wallpaper();
    if(custom){
      const tint=themeId==='ocean'?'linear-gradient(180deg,rgba(3,19,29,.54),rgba(3,19,29,.76) 48%,rgba(2,14,21,.88))':'linear-gradient(145deg,rgba(4,8,23,.72),rgba(8,18,42,.78))';
      const glow=themeId==='ocean'?'radial-gradient(ellipse at 50% -8%,rgba(142,232,225,.16),transparent 36%)':'radial-gradient(circle at 78% 10%,rgba(130,82,255,.18),transparent 25%)';
      body.style.backgroundImage=`${tint},${glow},url(${JSON.stringify(custom)})`;body.style.backgroundSize='cover,auto,cover';body.style.backgroundPosition='center,center,center';body.style.backgroundAttachment='fixed';return;
    }
    body.style.backgroundImage=themeId==='ocean'
      ?'radial-gradient(ellipse at 50% -8%,rgba(159,236,229,.17),transparent 34%),radial-gradient(circle at 15% 22%,rgba(68,177,197,.13),transparent 31%),radial-gradient(circle at 84% 54%,rgba(61,155,177,.08),transparent 30%),linear-gradient(180deg,#0b3a49 0%,#062f3e 22%,#052735 48%,#041d29 70%,#03131d 100%)'
      :'radial-gradient(circle at 78% 10%,rgba(130,82,255,.18),transparent 25%),radial-gradient(circle at 22% 82%,rgba(64,126,255,.13),transparent 32%),linear-gradient(145deg,var(--bg-0),var(--bg-1) 44%,var(--bg-2) 78%,var(--bg-0))';
    body.style.backgroundSize='auto';body.style.backgroundPosition='center';body.style.backgroundAttachment='fixed';
  }

  function syncEnvironmentClass(){const level=environmentLevel();document.body?.classList.toggle('stars-low',level==='low');document.body?.classList.toggle('stars-high',level==='high')}
  function apply(themeId=state.selected){
    if(state.guard||!THEMES[themeId]||!document.body)return;state.guard=true;
    try{state.applied=themeId;document.body.dataset.uiTheme=themeId;document.documentElement.dataset.uiTheme=themeId;setRootTokens(themeId);setBackground(themeId);syncEnvironmentClass();syncCards()}finally{state.guard=false}
  }

  function schemaValues(){try{return window.MovieCollectionContentCenter?.load?.()?.values||{}}catch{return {}}}
  function hasCopy(key){return Object.prototype.hasOwnProperty.call(schemaValues(),key)}
  function updateCopySchema(){const CC=window.MovieCollectionContentCenter;if(!Array.isArray(CC?.schema))return;const item=CC.schema.find(x=>x?.key==='settings.appearance.title');if(item){item.defaultValue='外观 · UI 主题';item.label='外观卡标题'}}

  function injectStyles(){
    if(q('#movieCollectionThemeSystemStyle'))return;
    const style=document.createElement('style');style.id='movieCollectionThemeSystemStyle';style.textContent=`
      #settingsView .theme-presets{grid-template-columns:repeat(2,minmax(0,1fr))}
      #settingsView .theme-preset{min-height:116px;position:relative;overflow:hidden}
      #settingsView .theme-preset.active{border-color:var(--line-bright);box-shadow:0 0 0 2px color-mix(in srgb,var(--purple) 18%,transparent),0 15px 35px rgba(0,0,0,.16)}
      #settingsView .theme-preset b{font-size:12px}#settingsView .theme-preset small{line-height:1.45}
      .swatch-star{background:radial-gradient(circle at 68% 28%,rgba(245,198,108,.95) 0 2px,transparent 3px),radial-gradient(circle at 32% 68%,rgba(122,153,255,.85) 0 1px,transparent 2px),radial-gradient(circle at 52% 45%,rgba(148,103,255,.42),transparent 30%),linear-gradient(145deg,#050817,#0d1838 58%,#17103a)}
      .swatch-star::after{content:'✦';color:#f5c66c;text-shadow:0 0 12px rgba(245,198,108,.7)}
      .swatch-ocean{background:radial-gradient(ellipse at 50% -12%,rgba(201,247,242,.34),transparent 38%),radial-gradient(circle at 28% 68%,rgba(116,219,211,.20),transparent 24%),linear-gradient(180deg,#0b4857,#083140 46%,#031821)}
      .swatch-ocean::before{content:'';position:absolute;inset:0;background:repeating-radial-gradient(ellipse at 55% -20%,transparent 0 11px,rgba(198,246,240,.10) 12px 14px,transparent 15px 26px);transform:rotate(-8deg);opacity:.75}
      .swatch-ocean::after{content:'◌';color:#d9f1ef;text-shadow:0 0 14px rgba(111,218,205,.75)}
      @keyframes oceanBubbleRise{0%{transform:translate3d(0,42px,0);opacity:.44}50%{opacity:.72}100%{transform:translate3d(15px,-82px,0);opacity:.28}}
      @keyframes oceanCaustic{0%{transform:translate3d(-1.5%,-1%,0) scale(1);opacity:.42}100%{transform:translate3d(1.5%,1.2%,0) scale(1.04);opacity:.68}}
      @keyframes oceanGlow{0%,100%{opacity:.38;transform:scale(.96) rotate(-5deg)}50%{opacity:.62;transform:scale(1.04) rotate(2deg)}}
      @keyframes oceanFloat{0%,100%{transform:translateY(2px)}50%{transform:translateY(-8px)}}
      body[data-ui-theme="ocean"]::before{background-image:radial-gradient(circle at 9% 92%,rgba(221,249,246,.26) 0 2px,transparent 3px),radial-gradient(circle at 23% 70%,rgba(169,232,229,.19) 0 3px,transparent 4px),radial-gradient(circle at 39% 88%,rgba(213,246,243,.16) 0 1px,transparent 2px),radial-gradient(circle at 58% 67%,rgba(166,230,225,.18) 0 2px,transparent 3px),radial-gradient(circle at 76% 84%,rgba(218,248,244,.22) 0 3px,transparent 4px),radial-gradient(circle at 91% 62%,rgba(165,226,223,.14) 0 2px,transparent 3px);background-size:260px 330px,330px 390px,210px 280px,360px 430px,300px 370px,230px 310px;opacity:.58;filter:blur(.15px);animation:oceanBubbleRise 30s linear infinite;will-change:transform,opacity}
      body[data-ui-theme="ocean"]::after{inset:-8% -5% auto -5%;width:auto;height:62vh;border:0;border-radius:0;background:repeating-radial-gradient(ellipse at 50% -15%,transparent 0 26px,rgba(197,243,239,.055) 28px 31px,transparent 33px 55px),radial-gradient(ellipse at 50% -8%,rgba(184,239,233,.14),transparent 44%);filter:blur(1.2px);opacity:.55;animation:oceanCaustic 17s ease-in-out infinite alternate;pointer-events:none}
      body[data-ui-theme="ocean"].stars-low::before{opacity:.24}body[data-ui-theme="ocean"].stars-high::before{opacity:.86}
      body[data-ui-theme="ocean"].motion-off::before,body[data-ui-theme="ocean"].motion-off::after,body[data-ui-theme="ocean"].motion-off .hero::before,body[data-ui-theme="ocean"].motion-off .constellation i{animation:none!important}
      body[data-ui-theme="ocean"] .sidebar{background:linear-gradient(180deg,rgba(3,23,31,.94),rgba(3,18,27,.91));border-right-color:rgba(104,190,200,.16);box-shadow:14px 0 45px rgba(0,10,15,.22)}
      body[data-ui-theme="ocean"] .nav a.active{background:linear-gradient(90deg,rgba(45,156,181,.24),rgba(85,198,183,.08));border-color:rgba(103,214,211,.28);box-shadow:inset 0 0 24px rgba(76,185,190,.06)}
      body[data-ui-theme="ocean"] .nav a.active .ico{color:#9be4dd;text-shadow:0 0 12px rgba(85,198,183,.42)}
      body[data-ui-theme="ocean"] .sidebar-quote .moon{background:radial-gradient(circle at 35% 28%,#f6fffe 0 8%,#bceae5 10% 30%,rgba(83,190,184,.38) 34% 57%,transparent 61%);filter:drop-shadow(0 0 16px rgba(90,205,197,.28))}
      body[data-ui-theme="ocean"] .hero,body[data-ui-theme="ocean"] .library-hero,body[data-ui-theme="ocean"] .match-hero,body[data-ui-theme="ocean"] .radar-hero,body[data-ui-theme="ocean"] .plan-hero,body[data-ui-theme="ocean"] .stats-hero,body[data-ui-theme="ocean"] .settings-hero,body[data-ui-theme="ocean"] .detail-hero{background:radial-gradient(ellipse at 78% 8%,rgba(117,220,211,.11),transparent 32%),linear-gradient(135deg,rgba(7,45,58,.82),rgba(4,29,40,.76));border-color:rgba(104,190,200,.18);box-shadow:0 26px 65px rgba(0,9,14,.22)}
      body[data-ui-theme="ocean"] .hero::before{width:270px;height:150px;border-radius:50%;background:radial-gradient(ellipse at 50% 40%,rgba(220,250,246,.31),rgba(86,199,195,.14) 34%,transparent 70%);border:0;box-shadow:none;filter:blur(5px);animation:oceanGlow 8s ease-in-out infinite}
      body[data-ui-theme="ocean"] .hero::after{border:0;background:repeating-radial-gradient(ellipse at 50% -20%,transparent 0 17px,rgba(201,244,239,.08) 19px 21px,transparent 23px 39px);opacity:.38;filter:blur(.8px)}
      body[data-ui-theme="ocean"] .panel,body[data-ui-theme="ocean"] .library-tools,body[data-ui-theme="ocean"] .settings-card,body[data-ui-theme="ocean"] .stats-card,body[data-ui-theme="ocean"] .match-panel,body[data-ui-theme="ocean"] .radar-main-panel,body[data-ui-theme="ocean"] .radar-side-card,body[data-ui-theme="ocean"] .plan-calendar-panel,body[data-ui-theme="ocean"] .plan-side-card,body[data-ui-theme="ocean"] .plan-list-panel,body[data-ui-theme="ocean"] .detail-section,body[data-ui-theme="ocean"] .detail-subcard{background:linear-gradient(145deg,rgba(7,42,53,.72),rgba(4,27,38,.68));border-color:rgba(104,190,200,.16);box-shadow:0 20px 48px rgba(0,10,15,.16)}
      body[data-ui-theme="ocean"] .primary,body[data-ui-theme="ocean"] .modal-foot .save,body[data-ui-theme="ocean"] .settings-actions .primary,body[data-ui-theme="ocean"] .detail-actions .primary,body[data-ui-theme="ocean"] .radar-hero-actions .primary{background:linear-gradient(90deg,#277f98,#48b4aa);border-color:rgba(141,229,220,.36);color:#f3fffd;box-shadow:0 10px 26px rgba(24,127,143,.18)}
      body[data-ui-theme="ocean"] .tool-btn.active,body[data-ui-theme="ocean"] .radar-tab.active,body[data-ui-theme="ocean"] .plan-view-switch button.active,body[data-ui-theme="ocean"] .match-tab.active{background:rgba(45,156,181,.16);border-color:rgba(103,214,211,.30);color:#dff8f5}
      body[data-ui-theme="ocean"] .switch.on{background:linear-gradient(90deg,#277f98,#48b4aa);border-color:rgba(103,214,211,.32)}
      body[data-ui-theme="ocean"] .progress i,body[data-ui-theme="ocean"] .rank-track i,body[data-ui-theme="ocean"] .stats-month-bars i,body[data-ui-theme="ocean"] .plan-status-track i{background:linear-gradient(90deg,#2d9cb5,#55c6b7)}
      body[data-ui-theme="ocean"] .spark,body[data-ui-theme="ocean"] .star{color:#bfece7;text-shadow:0 0 12px rgba(85,198,183,.35)}
      body[data-ui-theme="ocean"] .constellation svg{display:none}body[data-ui-theme="ocean"] .constellation i{width:8px;height:8px;border:1px solid rgba(202,245,240,.36);background:rgba(133,218,211,.10);box-shadow:inset 1px 1px 3px rgba(255,255,255,.16),0 0 11px rgba(85,198,183,.15);animation:oceanFloat 7s ease-in-out infinite}
      body[data-ui-theme="ocean"] .constellation i:nth-of-type(2){animation-delay:-1.8s}body[data-ui-theme="ocean"] .constellation i:nth-of-type(3){animation-delay:-3.2s}body[data-ui-theme="ocean"] .constellation i:nth-of-type(4){animation-delay:-4.6s}
      body[data-ui-theme="ocean"] input:focus,body[data-ui-theme="ocean"] select:focus,body[data-ui-theme="ocean"] textarea:focus{border-color:rgba(103,214,211,.40);box-shadow:0 0 0 3px rgba(45,156,181,.08)}
      @media(max-width:720px){#settingsView .theme-presets{grid-template-columns:1fr 1fr}.swatch-ocean::before{opacity:.5}}
    `;document.head.appendChild(style);
  }

  function transformSettings(){
    const presets=q('#themePresets');if(!presets)return false;
    if(!presets.dataset.uiThemeSystem){
      presets.dataset.uiThemeSystem='1';
      presets.innerHTML='<button class="theme-preset" type="button" data-ui-theme-choice="star"><div class="theme-swatch swatch-star"></div><b>星夜宇宙</b><small>默认 · 深蓝紫与暖金</small></button><button class="theme-preset" type="button" data-ui-theme-choice="ocean"><div class="theme-swatch swatch-ocean"></div><b>深海微光</b><small>深海蓝 · 青绿与珍珠光</small></button>';
      presets.addEventListener('click',e=>{const btn=e.target.closest('[data-ui-theme-choice]');if(!btn)return;const id=btn.dataset.uiThemeChoice;if(!THEMES[id])return;state.selected=id;saveTheme(id);const accent=q('#settingsAccent');if(accent){accent.value=THEMES[id].accent;accent.dispatchEvent(new Event('input',{bubbles:true}))}apply(id)});
    }
    const heading=q('#settingsView .settings-stack:first-child .settings-card:nth-child(2) .settings-card-head h3');if(heading&&!hasCopy('settings.appearance.title'))heading.textContent='外观 · UI 主题';
    const density=q('#settingsStarDensity');if(density){const copy=density.closest('.setting-row')?.querySelector('.setting-copy');if(copy&&!copy.dataset.uiThemeCopy){copy.dataset.uiThemeCopy='1';copy.innerHTML='<b>环境效果</b><span>控制星点、气泡与主题环境装饰的强度。</span>'}const labels={low:'简洁',normal:'标准',high:'丰富'};[...density.options].forEach(o=>{if(labels[o.value])o.textContent=labels[o.value]})}
    syncCards();return true;
  }
  function syncCards(){document.querySelectorAll('[data-ui-theme-choice]').forEach(btn=>btn.classList.toggle('active',btn.dataset.uiThemeChoice===state.selected))}

  function bindControls(){
    const after=()=>queueMicrotask(()=>apply(state.selected));
    q('#settingsAccent')?.addEventListener('input',after);q('#settingsPanelOpacity')?.addEventListener('input',after);q('#settingsStarDensity')?.addEventListener('change',after);q('#settingsMotion')?.addEventListener('click',after);
    q('#settingsSaveAppearance')?.addEventListener('click',()=>{saveTheme(state.selected);queueMicrotask(()=>apply(state.selected))});
    q('#settingsResetAppearance')?.addEventListener('click',()=>{state.selected='star';saveTheme('star');queueMicrotask(()=>{transformSettings();apply('star')})});
    q('#settingsWallpaperClear')?.addEventListener('click',()=>setTimeout(()=>apply(state.selected),0));
    q('#settingsWallpaperFile')?.addEventListener('change',()=>{[120,500,1200,2500].forEach(ms=>setTimeout(()=>apply(state.selected),ms))});
  }

  function boot(){
    if(!q('#settingsView'))return;state.selected=loadTheme();injectStyles();updateCopySchema();transformSettings();bindControls();apply(state.selected);
    window.addEventListener('movie-collection:content-updated',()=>setTimeout(()=>{transformSettings();apply(state.selected)},0));
    window.addEventListener('storage',e=>{if(e.key===THEME_KEY){state.selected=loadTheme();apply(state.selected)}if(e.key===APP_KEY)apply(state.selected)});
  }

  window.MovieCollectionThemeSystem={key:THEME_KEY,themes:Object.fromEntries(Object.entries(THEMES).map(([k,v])=>[k,{...v}])),load:loadTheme,save:saveTheme,apply,select(theme,{persist=false}={}){if(!THEMES[theme])return false;state.selected=theme;if(persist)saveTheme(theme);apply(theme);return true},current:()=>state.selected};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
