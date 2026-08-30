(() => {
  'use strict';
  if (window.CineverseAppConstants) return;
  const DEFAULT_SETTINGS = {profileName:'电影爱好者',profileRole:'',profileAvatarDataUrl:'',themePreset:'nebula',accentColor:'#9f7cff',panelOpacity:72,starDensity:'normal',motion:true,wallpaperDataUrl:'',tmdbLanguage:'zh-CN',doubanMode:'auto',doubanAutoTmdb:true,doubanSyncWatchDate:true,doubanLastImport:'',doubanLastCount:0};
  const THEME_PRESETS = {
    nebula:{bg0:'#040817',bg1:'#08122a',bg2:'#0e1a38',purple:'#9f7cff',purple2:'#6f61f4',blue:'#64a7ff',cyan:'#6ee7f7',gold:'#f5c66c',panelRgb:'11,23,52'},
    midnight:{bg0:'#020713',bg1:'#061229',bg2:'#0a1834',purple:'#75a8ff',purple2:'#4b74c9',blue:'#5db3ff',cyan:'#77d7ff',gold:'#e8c987',panelRgb:'7,19,45'},
    aurora:{bg0:'#031014',bg1:'#07202b',bg2:'#0b2a3b',purple:'#6bc7c5',purple2:'#4a9daf',blue:'#6ea9ff',cyan:'#54e4bd',gold:'#e8d28f',panelRgb:'7,30,42'},
    dusk:{bg0:'#120713',bg1:'#24102d',bg2:'#321b3d',purple:'#c08cff',purple2:'#9156c7',blue:'#8d94ff',cyan:'#79d1e6',gold:'#f4b86e',panelRgb:'35,15,43'},
    forest:{bg0:'#08130c',bg1:'#112419',bg2:'#1b3524',purple:'#8ea867',purple2:'#547647',blue:'#9eb879',cyan:'#b8c88a',gold:'#d7ad5c',panelRgb:'20,30,22',text:'#f8ead0',muted:'#c4b69d',muted2:'#8f8978',line:'rgba(207,173,102,.24)',lineBright:'rgba(229,191,111,.54)',shadow:'0 22px 54px rgba(3,8,4,.34)'},
    snow:{bg0:'#eaf5fc',bg1:'#d9ecf8',bg2:'#c7e2f2',purple:'#2f83d7',purple2:'#1764ad',blue:'#277fd4',cyan:'#4db8da',gold:'#d5a947',panelRgb:'244,250,255',text:'#102945',muted:'#4f6984',muted2:'#728aa0',line:'rgba(69,137,197,.28)',lineBright:'rgba(42,125,207,.58)',shadow:'0 20px 52px rgba(30,88,135,.16)'},
    ocean:{bg0:'#edfafa',bg1:'#d7f4f3',bg2:'#f8ead6',purple:'#14aebf',purple2:'#0b8398',blue:'#1baec5',cyan:'#30c7d0',gold:'#d9a13a',panelRgb:'255,252,246',text:'#123448',muted:'#54717c',muted2:'#789098',line:'rgba(23,155,177,.25)',lineBright:'rgba(12,178,199,.56)',shadow:'0 20px 52px rgba(24,105,120,.15)'}
  };
  const EMPTY_HOME = { radar:[], recent:[], plan:[], random:[] };
  window.CineverseAppConstants = Object.freeze({
    DEFAULT_SETTINGS:Object.freeze(DEFAULT_SETTINGS),
    THEME_PRESETS:Object.freeze(THEME_PRESETS),
    EMPTY_HOME:Object.freeze(EMPTY_HOME)
  });
})();
