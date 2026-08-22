(() => {
  'use strict';
  if (/(?:^|\/)(?:admin|admin-console)\.html$/i.test(location.pathname)) return;

  const APP_KEY = 'movie-collection-v2';

  const safeParse = raw => { try { return JSON.parse(raw); } catch { return null; } };
  const currentMovieId = () => {
    const raw = location.hash.replace(/^#/, '');
    if (!raw.startsWith('detail/')) return '';
    try { return decodeURIComponent(raw.slice(7)); } catch { return raw.slice(7); }
  };

  function syncFirstWatchDate() {
    const target = document.getElementById('detailFirstWatch');
    if (!target) return;
    const id = currentMovieId();
    if (!id) return;
    const state = safeParse(localStorage.getItem(APP_KEY));
    const movie = state?.movies?.find(item => String(item?.id || '') === id);
    const first = (movie?.watchHistory || [])
      .filter(item => item?.date)
      .slice()
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))[0];
    const value = first?.date ? String(first.date).slice(0, 10) : '—';
    if (target.textContent !== value) target.textContent = value;
  }

  function applyStructure() {
    const shell = document.querySelector('#detailView .detail-shell');
    if (!shell) return;

    const hero = shell.querySelector('.detail-hero');
    hero?.classList.add('detail-unified-hero');

    const watchList = document.getElementById('detailWatchList');
    const section = watchList?.closest('.detail-section');
    const grid = section?.querySelector('.detail-watch-grid');
    if (section && grid) {
      section.classList.add('detail-unified-lower');
      watchList.classList.add('detail-watch-primary');
    }

    const totalMinutes = document.getElementById('detailTotalMinutes');
    totalMinutes?.closest('.watch-stat')?.classList.add('watch-stat-total-minutes');

    const bottom = shell.querySelector('.detail-bottom');
    const review = document.getElementById('detailReview')?.closest('.detail-subcard');
    const related = document.getElementById('detailRelated')?.closest('.detail-subcard');

    if (review) {
      review.hidden = true;
      review.setAttribute('aria-hidden', 'true');
    }

    if (grid && related) {
      related.classList.add('detail-related-block');
      const title = related.querySelector('h3');
      if (title && title.textContent !== '该作品相关') title.textContent = '该作品相关';
      if (related.parentElement !== grid) grid.appendChild(related);
    }

    if (bottom) {
      bottom.hidden = true;
      bottom.setAttribute('aria-hidden', 'true');
    }

    syncFirstWatchDate();
  }

  function injectStyle() {
    if (document.getElementById('detailLayoutUnifiedV1Style')) return;
    const style = document.createElement('style');
    style.id = 'detailLayoutUnifiedV1Style';
    style.textContent = `
      #detailView .detail-hero{
        align-items:stretch;
      }
      #detailView .detail-poster{
        align-self:end;
      }

      #detailView .detail-unified-lower .detail-watch-grid{
        grid-template-columns:minmax(0,1.72fr) minmax(360px,.72fr);
        grid-template-rows:auto auto;
        align-items:start;
        gap:14px;
      }
      #detailView .detail-unified-lower #detailWatchList{
        grid-column:1;
        grid-row:1 / span 2;
        align-self:start;
        align-content:start;
      }
      #detailView .detail-unified-lower .watch-side{
        grid-column:2;
        grid-row:1;
        align-self:start;
        min-width:0;
      }
      #detailView .detail-unified-lower .watch-stats{
        grid-template-columns:repeat(2,minmax(0,1fr));
      }
      #detailView .detail-unified-lower .watch-stat-total-minutes{
        display:none!important;
      }
      #detailView .detail-related-block{
        grid-column:2;
        grid-row:2;
        min-width:0;
        margin:0;
        padding:14px;
        align-self:start;
        border-radius:16px;
      }
      #detailView .detail-related-block h3{
        margin-bottom:10px;
      }
      #detailView .detail-related-block .related-grid{
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:7px;
      }
      #detailView .detail-related-block .related-poster{
        height:94px;
      }
      #detailView .detail-related-block .related-body{
        padding:7px;
      }

      @media(min-width:1181px){
        #detailView .detail-side{
          grid-template-columns:1fr;
          grid-template-rows:repeat(2,minmax(0,1fr));
          align-content:stretch;
          align-self:stretch;
          height:100%;
        }
        #detailView .detail-side-card{
          height:100%;
          min-height:0;
          display:flex;
          flex-direction:column;
        }
      }

      @media(max-width:1180px){
        #detailView .detail-side{
          grid-template-columns:1fr 1fr;
          grid-template-rows:1fr;
          height:auto;
        }
        #detailView .detail-side-card{
          height:auto;
        }
        #detailView .detail-unified-lower .detail-watch-grid{
          grid-template-columns:1fr;
          grid-template-rows:auto;
        }
        #detailView .detail-unified-lower #detailWatchList,
        #detailView .detail-unified-lower .watch-side,
        #detailView .detail-related-block{
          grid-column:1;
          grid-row:auto;
        }
        #detailView .detail-related-block .related-grid{
          grid-template-columns:repeat(4,minmax(0,1fr));
        }
      }

      @media(max-width:760px){
        #detailView .detail-side{
          grid-template-columns:1fr;
          grid-template-rows:auto auto;
        }
        #detailView .detail-poster{
          align-self:center;
        }
        #detailView .detail-related-block .related-grid{
          grid-template-columns:repeat(2,minmax(0,1fr));
        }
      }
    `;
    document.head.appendChild(style);
  }

  function boot() {
    injectStyle();
    applyStructure();

    const firstWatch = document.getElementById('detailFirstWatch');
    if (firstWatch) {
      new window.MovieMutationObserver(() => syncFirstWatchDate()).observe(firstWatch, {
        childList: true,
        characterData: true,
        subtree: true
      });
    }

    window.addEventListener('hashchange', () => {
      requestAnimationFrame(() => {
        applyStructure();
        syncFirstWatchDate();
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
