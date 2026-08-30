(() => {
  'use strict';
  if (window.CineverseAppConstants) return;
  const DEFAULT_SETTINGS = {profileName:'电影爱好者',profileRole:'',profileAvatarDataUrl:'',themePreset:'nebula',accentColor:'#9f7cff',panelOpacity:72,starDensity:'normal',motion:true,wallpaperDataUrl:'',tmdbLanguage:'zh-CN',doubanMode:'auto',doubanAutoTmdb:true,doubanSyncWatchDate:true,doubanLastImport:'',doubanLastCount:0};
  const THEME_PRESETS = {
    nebula:{bg0:'#040817',bg1:'#08122a',bg2:'#0e1a38',purple:'#9f7cff',purple2:'#6f61f4',blue:'#64a7ff',cyan:'#6ee7f7',gold:'#f5c66c',panelRgb:'11,23,52'},
    midnight:{bg0:'#020713',bg1:'#061229',bg2:'#0a1834',purple:'#75a8ff',purple2:'#4b74c9',blue:'#5db3ff',cyan:'#77d7ff',gold:'#e8c987',panelRgb:'7,19,45'},
    aurora:{bg0:'#031014',bg1:'#07202b',bg2:'#0b2a3b',purple:'#6bc7c5',purple2:'#4a9daf',blue:'#6ea9ff',cyan:'#54e4bd',gold:'#e8d28f',panelRgb:'7,30,42'},
    dusk:{bg0:'#120713',bg1:'#24102d',bg2:'#321b3d',purple:'#c08cff',purple2:'#9156c7',blue:'#8d94ff',cyan:'#79d1e6',gold:'#f4b86e',panelRgb:'35,15,43'}
  };
  const EMPTY_HOME = { radar:[], recent:[], plan:[], random:[] };
  window.CineverseAppConstants = Object.freeze({
    DEFAULT_SETTINGS:Object.freeze(DEFAULT_SETTINGS),
    THEME_PRESETS:Object.freeze(THEME_PRESETS),
    EMPTY_HOME:Object.freeze(EMPTY_HOME)
  });
})();
