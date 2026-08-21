(() => {
  'use strict';
  if (/(?:^|\/)(?:admin|admin-console)\.html$/i.test(location.pathname)) return;

  const STORAGE_KEY = 'movie-collection-v2';
  const $ = id => document.getElementById(id);
  const safeParse = raw => { try { return JSON.parse(raw); } catch { return null; } };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[ch]));
  const escAttr = esc;
  const currentMonth = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  };
  const isSeasonSourceWatch = (movie, watch) => movie?.mediaType === 'tv'
    && Number(watch?.sourceSeason) > 0
    && Boolean(watch?.sourceDoubanId || String(watch?.venue || '').includes('豆瓣'));

  function monthRows(state) {
    const month = currentMonth();
    const rows = [];
    for (const movie of (state?.movies || [])) {
      for (const watch of (movie?.watchHistory || [])) {
        if (!String(watch?.date || '').startsWith(month)) continue;
        if (isSeasonSourceWatch(movie, watch)) continue;
        rows.push({ movie, watch });
      }
    }
    return rows;
  }

  function ratingOf(row) {
    const watchRating = Number(row?.watch?.rating);
    return Number.isFinite(watchRating) && watchRating > 0 ? watchRating : null;
  }

  function compute() {
    const state = safeParse(localStorage.getItem(STORAGE_KEY)) || {};
    const rows = monthRows(state);
    const watchedCount = new Set(rows.map(row => row.movie?.id).filter(Boolean)).size;
    const ratedRows = rows.map(row => ({ row, rating: ratingOf(row) })).filter(x => x.rating != null);
    const avg = ratedRows.length
      ? ratedRows.reduce((sum, x) => sum + x.rating, 0) / ratedRows.length
      : null;

    let top = null;
    if (ratedRows.length) {
      ratedRows.sort((a, b) => b.rating - a.rating
        || String(b.row.watch?.date || '').localeCompare(String(a.row.watch?.date || '')));
      top = {
        movie:ratedRows[0].row.movie,
        rating:ratedRows[0].rating
      };
    }

    return { watchedCount, avg, top };
  }

  function ensureLayout() {
    const panel = document.querySelector('#homeView .panel.insight');
    const body = panel?.querySelector('.insight-body');
    if (!panel || !body) return null;
    if (body.dataset.monthInsightV3 === '1') return body;

    body.dataset.monthInsightV3 = '1';
    body.classList.add('month-insight-body-v3');
    body.innerHTML = `
      <div class="month-insight-layout-v3">
        <div class="month-top-work-v3" id="monthTopWorkV3">
          <div class="month-top-poster-v3" id="monthTopPosterV3"></div>
          <div class="month-top-copy-v3">
            <div class="month-top-kicker-v3">本月最高分作品</div>
            <div class="month-top-title-v3" id="monthTopTitleV3">—</div>
            <div class="month-top-director-v3"><span>导演</span><strong id="monthTopDirectorV3">—</strong></div>
            <div class="month-top-score-v3"><span>评分</span><strong id="monthTopScoreV3">—</strong></div>
          </div>
        </div>
        <div class="month-insight-metrics-v3">
          <div class="month-insight-metric-v3">
            <strong id="monthWatchedCountV3">0</strong>
            <span>本月已观看</span>
          </div>
          <div class="month-insight-metric-v3">
            <strong id="monthAverageRatingV3">—</strong>
            <span>本月平均分</span>
          </div>
        </div>
      </div>`;
    return body;
  }

  function render() {
    if (!ensureLayout()) return;
    const { watchedCount, avg, top } = compute();
    const work = $('monthTopWorkV3');
    const poster = $('monthTopPosterV3');
    const title = $('monthTopTitleV3');
    const director = $('monthTopDirectorV3');
    const score = $('monthTopScoreV3');
    const count = $('monthWatchedCountV3');
    const average = $('monthAverageRatingV3');
    if (!work || !poster || !title || !director || !score || !count || !average) return;

    count.textContent = String(watchedCount);
    average.textContent = avg == null ? '—' : avg.toFixed(1);

    if (!top?.movie) {
      work.removeAttribute('data-open-detail');
      work.classList.add('is-empty');
      poster.innerHTML = '<div class="month-top-poster-empty-v3">✦</div>';
      title.textContent = '本月还没有评分作品';
      director.textContent = '—';
      score.textContent = '—';
      return;
    }

    const movie = top.movie;
    const posterUrl = String(movie?.info?.posterUrl || '').trim();
    const directors = Array.isArray(movie?.info?.directors)
      ? movie.info.directors.filter(Boolean).join(' / ')
      : String(movie?.info?.directors || '').trim();

    work.classList.remove('is-empty');
    if (movie?.id) work.dataset.openDetail = String(movie.id);
    else work.removeAttribute('data-open-detail');
    poster.innerHTML = posterUrl
      ? `<img src="${escAttr(posterUrl)}" alt="${escAttr(movie?.info?.title || '本月最高分作品')} 海报" loading="lazy">`
      : '<div class="month-top-poster-empty-v3">暂无海报</div>';
    title.textContent = movie?.info?.title || '未命名作品';
    director.textContent = directors || '导演信息待补全';
    score.textContent = `★ ${top.rating.toFixed(1)}`;
  }

  function injectStyle() {
    if ($('homeMonthInsightV3Style')) return;
    const style = document.createElement('style');
    style.id = 'homeMonthInsightV3Style';
    style.textContent = `
      #homeView .insight .month-insight-body-v3{
        padding:8px 18px 18px!important;
        display:flex!important;
        flex-direction:column!important;
        flex:1!important;
        min-height:0!important;
      }
      #homeView .month-insight-layout-v3{
        display:grid;
        grid-template-rows:minmax(0,3fr) minmax(78px,1fr);
        gap:12px;
        flex:1;
        min-height:260px;
      }
      #homeView .month-top-work-v3{
        min-height:0;
        display:grid;
        grid-template-columns:minmax(105px,42%) minmax(0,1fr);
        gap:16px;
        align-items:stretch;
        padding:14px;
        border:1px solid rgba(161,179,255,.12);
        border-radius:17px;
        background:linear-gradient(145deg,rgba(20,34,70,.56),rgba(9,22,50,.4));
        overflow:hidden;
      }
      #homeView .month-top-work-v3[data-open-detail]{cursor:pointer}
      #homeView .month-top-work-v3[data-open-detail]:hover{
        border-color:rgba(159,124,255,.3);
        background:linear-gradient(145deg,rgba(28,42,83,.64),rgba(12,25,57,.48));
      }
      #homeView .month-top-poster-v3{
        min-width:0;
        min-height:0;
        height:100%;
        border-radius:13px;
        border:1px solid rgba(161,179,255,.12);
        background:rgba(4,10,24,.5);
        overflow:hidden;
        display:grid;
        place-items:center;
      }
      #homeView .month-top-poster-v3 img{
        display:block;
        width:100%;
        height:100%;
        object-fit:contain;
        background:#070d1c;
      }
      #homeView .month-top-poster-empty-v3{
        display:grid;
        place-items:center;
        width:100%;
        height:100%;
        min-height:150px;
        padding:12px;
        color:#7783a1;
        font-size:12px;
        text-align:center;
        background:radial-gradient(circle at 50% 38%,rgba(159,124,255,.12),transparent 44%);
      }
      #homeView .month-top-copy-v3{
        min-width:0;
        display:flex;
        flex-direction:column;
        justify-content:center;
        align-items:flex-start;
        padding:4px 0;
      }
      #homeView .month-top-kicker-v3{
        color:#8995b4;
        font-size:10px;
        letter-spacing:.06em;
        margin-bottom:8px;
      }
      #homeView .month-top-title-v3{
        width:100%;
        color:#f7f3ff;
        font-family:"Songti SC","STSong","SimSun",serif;
        font-size:clamp(20px,2vw,30px);
        line-height:1.25;
        font-weight:650;
        word-break:break-word;
        overflow:visible;
        white-space:normal;
      }
      #homeView .month-top-director-v3,
      #homeView .month-top-score-v3{
        display:grid;
        gap:3px;
        margin-top:14px;
        width:100%;
      }
      #homeView .month-top-director-v3 span,
      #homeView .month-top-score-v3 span{
        color:#74809d;
        font-size:9px;
      }
      #homeView .month-top-director-v3 strong{
        color:#b8c1d9;
        font-size:11px;
        line-height:1.55;
        font-weight:500;
        white-space:normal;
        word-break:break-word;
      }
      #homeView .month-top-score-v3 strong{
        color:#f5c66c;
        font:600 22px Georgia,"Times New Roman",serif;
      }
      #homeView .month-insight-metrics-v3{
        min-height:78px;
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        border:1px solid rgba(161,179,255,.12);
        border-radius:17px;
        background:rgba(12,27,58,.42);
        overflow:hidden;
      }
      #homeView .month-insight-metric-v3{
        min-width:0;
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        gap:4px;
        padding:10px;
      }
      #homeView .month-insight-metric-v3 + .month-insight-metric-v3{
        border-left:1px solid rgba(161,179,255,.12);
      }
      #homeView .month-insight-metric-v3 strong{
        color:#f3f1fb;
        font:600 24px Georgia,"Times New Roman",serif;
        line-height:1;
      }
      #homeView .month-insight-metric-v3 span{
        color:#8792ad;
        font-size:10px;
      }
      @media(max-width:520px){
        #homeView .month-top-work-v3{grid-template-columns:minmax(92px,38%) minmax(0,1fr);gap:12px;padding:11px}
        #homeView .month-top-title-v3{font-size:19px}
        #homeView .month-top-director-v3,#homeView .month-top-score-v3{margin-top:10px}
      }
    `;
    document.head.appendChild(style);
  }

  let queued = false;
  function queueRender() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      render();
    });
  }

  const originalSetItem = Storage.prototype.setItem;
  if (!Storage.prototype.__movieInsightPatchedV3) {
    Object.defineProperty(Storage.prototype, '__movieInsightPatchedV3', { value:true, configurable:true });
    Storage.prototype.setItem = function(key, value) {
      const result = originalSetItem.call(this, key, value);
      if (this === localStorage && key === STORAGE_KEY) queueRender();
      return result;
    };
  }

  window.addEventListener('storage', event => {
    if (event.key === STORAGE_KEY) queueRender();
  });

  function boot() {
    injectStyle();
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
