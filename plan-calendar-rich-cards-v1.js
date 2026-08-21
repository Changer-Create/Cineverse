(() => {
  'use strict';

  const STORAGE_KEY = 'movie-collection-v2';
  let cachedRaw = null;
  let cachedMovies = new Map();

  function readMovies(){
    let raw = '';
    try{ raw = localStorage.getItem(STORAGE_KEY) || ''; }catch{}
    if(raw === cachedRaw) return cachedMovies;
    cachedRaw = raw;
    cachedMovies = new Map();
    try{
      const data = JSON.parse(raw || '{}');
      for(const movie of Array.isArray(data?.movies) ? data.movies : []){
        if(movie?.id != null) cachedMovies.set(String(movie.id), movie);
      }
    }catch{}
    return cachedMovies;
  }

  function injectStyles(){
    if(document.getElementById('planCalendarRichCardsStyle')) return;
    const style = document.createElement('style');
    style.id = 'planCalendarRichCardsStyle';
    style.textContent = `
      .plan-day-chip.plan-rich-card{
        display:grid;
        grid-template-columns:34px minmax(0,1fr);
        gap:7px;
        align-items:center;
        min-height:54px;
        padding:5px;
        white-space:normal;
        overflow:hidden;
        text-overflow:clip;
      }
      .plan-rich-poster{
        width:34px;
        height:48px;
        border-radius:6px;
        overflow:hidden;
        background:linear-gradient(155deg,#24335f,#0b132b 62%,#4b355d);
        border:1px solid rgba(255,255,255,.08);
        display:grid;
        place-items:center;
        color:#9385d9;
        font-size:11px;
        flex:0 0 auto;
      }
      .plan-rich-poster img{
        width:100%;
        height:100%;
        object-fit:cover;
        display:block;
      }
      .plan-rich-copy{
        min-width:0;
        display:grid;
        gap:2px;
        align-content:center;
      }
      .plan-rich-title{
        min-width:0;
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
        color:#eef1fb;
        font-size:9.5px;
        font-weight:650;
        line-height:1.25;
      }
      .plan-rich-director,
      .plan-rich-runtime{
        min-width:0;
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
        color:#8f9bb8;
        font-size:7.5px;
        line-height:1.3;
      }
      .plan-day-chip.completed .plan-rich-title{color:#bcebd4}
      .plan-day-chip.deferred .plan-rich-title{color:#efd39c}
      .plan-day-chip.completed .plan-rich-director,
      .plan-day-chip.completed .plan-rich-runtime{color:#82bca6}
      .plan-day-chip.deferred .plan-rich-director,
      .plan-day-chip.deferred .plan-rich-runtime{color:#b89e73}
      @media (min-width:1800px){
        .plan-day{min-height:148px}
        .plan-day-chip.plan-rich-card{
          grid-template-columns:40px minmax(0,1fr);
          gap:8px;
          min-height:64px;
          padding:6px;
        }
        .plan-rich-poster{width:40px;height:56px}
        .plan-rich-title{font-size:10px}
        .plan-rich-director,.plan-rich-runtime{font-size:8px}
      }
      @media (max-width:980px){
        .plan-day-chip.plan-rich-card{grid-template-columns:28px minmax(0,1fr);gap:5px;min-height:46px;padding:4px}
        .plan-rich-poster{width:28px;height:40px}
        .plan-rich-title{font-size:8.5px}
        .plan-rich-director,.plan-rich-runtime{font-size:7px}
      }
    `;
    document.head.appendChild(style);
  }

  function makePoster(movie){
    const wrap = document.createElement('span');
    wrap.className = 'plan-rich-poster';
    const url = String(movie?.info?.posterUrl || '').trim();
    if(url){
      const img = document.createElement('img');
      img.src = url;
      img.alt = '';
      img.loading = 'lazy';
      img.referrerPolicy = 'no-referrer';
      img.addEventListener('error', () => { wrap.textContent = '✦'; }, {once:true});
      wrap.appendChild(img);
    }else{
      wrap.textContent = '✦';
    }
    return wrap;
  }

  function makeLine(className, text){
    const el = document.createElement('span');
    el.className = className;
    el.textContent = text;
    return el;
  }

  function decorateChip(chip, movies){
    if(!(chip instanceof HTMLElement) || chip.dataset.planRichCard === '1') return;
    const id = String(chip.dataset.openDetail || '');
    const movie = movies.get(id);
    if(!movie) return;

    const info = movie.info || {};
    const title = String(info.title || chip.textContent || '未命名影片').trim();
    const directors = Array.isArray(info.directors) ? info.directors.filter(Boolean) : [];
    const director = directors.length ? directors.join(' / ') : '导演未知';
    const runtimeNum = Number(info.runtime);
    const runtime = Number.isFinite(runtimeNum) && runtimeNum > 0 ? `${Math.round(runtimeNum)} 分钟` : '时长未知';

    chip.classList.add('plan-rich-card');
    chip.dataset.planRichCard = '1';
    chip.title = `${title} · ${director} · ${runtime}`;
    chip.replaceChildren();

    const copy = document.createElement('span');
    copy.className = 'plan-rich-copy';
    copy.append(
      makeLine('plan-rich-title', title),
      makeLine('plan-rich-director', director),
      makeLine('plan-rich-runtime', runtime)
    );
    chip.append(makePoster(movie), copy);
  }

  function decorateAll(root = document){
    const calendar = root === document ? document.getElementById('planCalendar') : root;
    if(!calendar) return;
    const movies = readMovies();
    calendar.querySelectorAll('.plan-day-chip[data-open-detail]').forEach(chip => decorateChip(chip, movies));
  }

  function boot(){
    injectStyles();
    const calendar = document.getElementById('planCalendar');
    if(!calendar) return;
    decorateAll(calendar);
    const observer = new window.MovieMutationObserver(mutations => {
      let needsDecorate = false;
      for(const mutation of mutations){
        if(mutation.type === 'childList' && mutation.addedNodes.length){ needsDecorate = true; break; }
      }
      if(needsDecorate) queueMicrotask(() => decorateAll(calendar));
    });
    observer.observe(calendar, {childList:true, subtree:true});
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();
