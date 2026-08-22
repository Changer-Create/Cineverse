from pathlib import Path
import re


def replace_required(text, old, new, label):
    if old not in text:
        raise SystemExit(f'missing anchor: {label}')
    return text.replace(old, new, 1)


index_path = Path('index.html')
index = index_path.read_text()
detail_block = r'''  function currentDetailMovie(){return appState.movies.find(m=>m.id===detailState.movieId)}
  function libraryMatchForData(data={}){const type=data.mediaType==='tv'?'tv':'movie',tmdbId=Number(data.tmdbId);if(tmdbId){const exact=appState.movies.find(m=>m.mediaType===type&&Number(m.info?.tmdbId)===tmdbId);if(exact)return exact}const norm=v=>String(v||'').toLowerCase().normalize('NFKC').replace(/[\s·・:：,，.。!！?？'"“”‘’()（）\[\]【】_-]+/g,''),title=norm(data.title),original=norm(data.originalTitle),year=Number(data.year)||null;return appState.movies.find(m=>{if(m.mediaType!==type)return false;const mt=norm(m.info?.title),mo=norm(m.info?.originalTitle),same=(title&&(title===mt||title===mo))||(original&&(original===mt||original===mo));return same&&(!year||!m.info?.year||Number(m.info.year)===year)})||null}
  function tmdbMovieFromData(data,status='want',favorite=false){return normalizeMovie({id:uid(),mediaType:data.mediaType==='tv'?'tv':'movie',info:{title:data.title||'',originalTitle:data.originalTitle||'',year:data.year||null,releaseDate:data.releaseDate||data.firstAirDate||'',firstAirDate:data.mediaType==='tv'?(data.firstAirDate||data.releaseDate||''):'',lastAirDate:data.mediaType==='tv'?(data.lastAirDate||''):'',numberOfSeasons:data.mediaType==='tv'?(data.numberOfSeasons??null):null,numberOfEpisodes:data.mediaType==='tv'?(data.numberOfEpisodes??null):null,tvStatus:data.mediaType==='tv'?(data.tvStatus||''):'',runtime:data.runtime||null,directors:Array.isArray(data.directors)?data.directors:[],countries:Array.isArray(data.countries)?data.countries:[],genres:Array.isArray(data.genres)?data.genres:[],posterUrl:data.posterUrl||'',overview:data.overview||'',tmdbId:data.tmdbId||null},personal:{status,rating:null,tags:[],shortReview:'',favorite},watchHistory:[],plans:[],radar:{discovered:false,ignored:false}})}
  function addTmdbMovieToLibrary(data,{status='want',favorite=false,watchRecord=null}={}){if(status==='watched'&&!watchRecord)throw new Error('看过状态必须包含真实观看记录');let movie=libraryMatchForData(data);if(!movie){movie=tmdbMovieFromData(data,status,favorite);appState.movies.push(movie)}else{movie.personal=movie.personal||{};if(status!=='watched')movie.personal.status=status;if(favorite)movie.personal.favorite=true}if(watchRecord){movie.watchHistory=movie.watchHistory||[];movie.watchHistory.push(watchRecord);movie.personal.status='watched';if(watchRecord.rating!=null)movie.personal.rating=watchRecord.rating}movie.updatedAt=new Date().toISOString();save();renderAll();return movie}
  function setLibraryStatus(movieId,status){const movie=appState.movies.find(m=>m.id===movieId);if(!movie)return null;if(status==='watching'&&movie.mediaType!=='tv')return movie;if(status==='watched'){detailState.movieId=movie.id;openWatchModal();return movie}movie.personal.status=status==='watching'?'watching':'want';movie.updatedAt=new Date().toISOString();save();renderAll();if(detailState.movieId===movie.id)renderDetail();return movie}
  function toggleLibraryFavorite(movieId){const movie=appState.movies.find(m=>m.id===movieId);if(!movie)return null;movie.personal.favorite=!movie.personal.favorite;movie.updatedAt=new Date().toISOString();save();renderAll();if(detailState.movieId===movie.id)renderDetail();return movie}
  function openPendingWatch(data){pendingWatchCreate={data};detailState.movieId=null;els.watchDateInput.value=localToday();els.watchRatingInput.value='';els.watchVenueInput.value='';els.watchNoteInput.value='';els.watchModal.showModal()}
  function setDetailContext(next){detailContext={source:next?.source==='tmdb'?'tmdb':'library',mediaType:next?.mediaType==='tv'?'tv':'movie',tmdbId:Number(next?.tmdbId)||null,libraryMovieId:next?.libraryMovieId||null,data:next?.data||{}};window.CineverseDetailContext=Object.freeze({...detailContext,data:Object.freeze({...detailContext.data})});return detailContext}
  function detailExternalMovie(data={}){
    const tv=data.mediaType==='tv';
    return {id:null,mediaType:tv?'tv':'movie',info:{title:data.title||'',originalTitle:data.originalTitle||'',year:data.year||null,releaseDate:data.releaseDate||data.firstAirDate||'',firstAirDate:tv?(data.firstAirDate||data.releaseDate||''):'',lastAirDate:tv?(data.lastAirDate||''):'',numberOfSeasons:tv?(data.numberOfSeasons??null):null,numberOfEpisodes:tv?(data.numberOfEpisodes??null):null,tvStatus:tv?(data.tvStatus||''):'',runtime:data.runtime||null,tmdbId:data.tmdbId||null,directors:Array.isArray(data.directors)?data.directors:[],countries:Array.isArray(data.countries)?data.countries:[],genres:Array.isArray(data.genres)?data.genres:[],overview:data.overview||'',posterUrl:data.posterUrl||''},personal:{status:null,rating:null,tags:[],shortReview:'',favorite:false},watchHistory:[],plans:[],radar:{discovered:false,publicReputation:data.publicScore!=null?Number(data.publicScore):null,matchScore:null,reason:'这部作品来自顶部 TMDb 搜索；加入影视库后会在同一详情页原地解锁个人数据。'}};
  }
  function currentDetailEntity(){const local=currentDetailMovie();if(local)return{movie:local,collected:true};if(detailContext.source==='tmdb'&&!detailContext.libraryMovieId)return{movie:detailExternalMovie(detailContext.data||{}),collected:false};return null}
  function openDetail(id){const m=appState.movies.find(x=>x.id===id);if(!m)return;detailState.movieId=id;setDetailContext({source:'library',mediaType:m.mediaType,tmdbId:m.info?.tmdbId,libraryMovieId:m.id,data:m.info});setView('detail');renderDetail();location.hash='detail/'+encodeURIComponent(id);window.dispatchEvent(new CustomEvent('cineverse:detail-library-opened',{detail:{libraryMovieId:m.id}}))}
  function openExternalDetail(data={}){detailState.movieId=null;setDetailContext({source:'tmdb',mediaType:data.mediaType==='tv'?'tv':'movie',tmdbId:Number(data.tmdbId)||null,libraryMovieId:null,data:{...data}});setView('detail');renderDetail();window.dispatchEvent(new CustomEvent('cineverse:detail-external-opened',{detail:{tmdbId:Number(data.tmdbId)||null,mediaType:data.mediaType==='tv'?'tv':'movie'}}))}
  function renderDetailStatusActions(movie,collected=true){if(!els.detailStatusActions)return;const options=movie.mediaType==='tv'?[['want','想看'],['watching','在看'],['watched','看过']]:[['want','想看'],['watched','看过']];els.detailStatusActions.innerHTML=options.map(([value,label])=>`<button type="button" data-detail-status="${value}" class="${collected&&movie.personal?.status===value?'active':''}">${label}</button>`).join('')}
  function renderExternalWatchHistory(m){els.detailWatchList.innerHTML='<div class="watch-empty">尚未加入影视库。选择「看过」后记录一次真实观看，就会在这里生成第一条记录。</div>';els.detailWatchCount.textContent='0';els.detailFirstWatch.textContent='—';els.detailTotalMinutes.textContent='—';els.detailTrend.innerHTML='<div class="watch-empty" style="width:100%">加入影视库后显示个人评分趋势</div>'}
  function setDetailAvailability(collected,currentPlan){els.detailPlanBtn.disabled=!collected;els.detailEditBtn.disabled=!collected;els.detailAddWatchBtn.disabled=!collected;els.detailAddWatchBtn2.disabled=!collected;els.detailReview.disabled=!collected;els.detailSaveReview.disabled=!collected;els.detailPlanBtn.textContent=collected?(currentPlan?`本月计划 · ${currentPlan.status==='completed'?'已完成':currentPlan.status==='deferred'?'已延期':'计划中'}`:'＋ 加入本月计划'):'加入影视库后可加入计划';els.detailEditBtn.textContent=collected?'✎ 编辑资料':'加入影视库后可编辑';if(!collected){els.detailAddWatchBtn.title='请使用上方「看过」按钮记录第一次观看';els.detailAddWatchBtn2.title='请使用上方「看过」按钮记录第一次观看';els.detailReview.placeholder='加入影视库后可记录个人影评'}else{els.detailAddWatchBtn.removeAttribute('title');els.detailAddWatchBtn2.removeAttribute('title');els.detailReview.placeholder=''}}
  function renderDetail(){
    const entity=currentDetailEntity();if(!entity)return;const {movie:m,collected}=entity,info=m.info||{},personal=m.personal||{},tv=m.mediaType==='tv',history=[...(m.watchHistory||[])].sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))),plans=m.plans||[],currentPlan=collected?plans.find(p=>p.month===CURRENT_MONTH):null;
    const view=els.detailView||document.getElementById('detailView');if(view){view.dataset.detailRenderer='core-unified';view.dataset.detailMode=collected?'library':'tmdb'}
    els.detailTitle.textContent=info.title||(tv?'未命名剧集':'未命名电影');els.detailOriginal.textContent=[info.originalTitle,info.year].filter(Boolean).join(' · ')||String(info.year||'');els.detailCreatorLabel.textContent=tv?'主创':'导演';els.detailDirectors.textContent=(info.directors||[]).join(' / ')||(collected?'未知':'待载入');els.detailCountries.textContent=(info.countries||[]).join(' / ')||(collected?'未知':'待载入');els.detailGenres.textContent=(info.genres||[]).join(' / ')||(collected?'待补全':'待载入');els.detailRuntimeLabel.textContent=tv?'单集时长':'片长';els.detailRuntime.textContent=info.runtime?`${info.runtime} 分钟`:'未知';els.detailReleaseLabel.textContent=tv?'首播':'上映';els.detailRelease.textContent=(tv?(info.firstAirDate||info.releaseDate):info.releaseDate)||info.year||'未知';els.detailMediaType.textContent=mediaTypeLabel(m);els.detailSeriesFact.classList.toggle('hidden',!tv);els.detailSeriesMeta.textContent=tv?[info.numberOfSeasons!=null?info.numberOfSeasons+'季':null,info.numberOfEpisodes!=null?info.numberOfEpisodes+'集':null,info.lastAirDate?(info.lastAirDate.slice(0,4)+' '+(info.tvStatus||'')):info.tvStatus].filter(Boolean).join(' · ')||(collected?'待补全':'待载入'):'—';els.detailTmdb.textContent=info.tmdbId||'未关联';els.detailOverview.textContent=info.overview||(collected?`暂无简介。可在编辑${tv?'剧集':'电影'}时通过 TMDb 搜索补全资料。`:'正在读取 TMDb 详情…');
    els.detailPoster.classList.toggle('has-image',Boolean(info.posterUrl));els.detailPoster.innerHTML=info.posterUrl?`<img src="${escAttr(info.posterUrl)}" alt="${escAttr(info.title)} 海报">`:`<div class="poster-title">${esc(info.title||mediaTypeLabel(m))}</div>`;
    els.detailFavorite.classList.toggle('on',collected&&Boolean(personal.favorite));renderDetailStatusActions(m,collected);setDetailAvailability(collected,currentPlan);
    els.detailTags.innerHTML=collected?((personal.tags||[]).length?(personal.tags||[]).map(t=>`<span>${esc(t)}</span>`).join(''):'<span>尚未添加个人标签</span>'):'<span>加入影视库后可添加个人标签</span>';els.detailRating.textContent=collected&&personal.rating!=null?Number(personal.rating).toFixed(1):'—';const starCount=collected&&personal.rating!=null?Math.max(1,Math.round(Number(personal.rating)/2)):0;els.detailStars.textContent=starCount?'★★★★★'.slice(0,starCount)+'☆☆☆☆☆'.slice(starCount):'☆☆☆☆☆';els.detailLastWatch.textContent=collected&&history[0]?.date?`最近观看：${formatDate(history[0].date)}`:(collected?'尚未记录观看日期':'尚未加入影视库');els.detailPlanMeta.textContent=collected&&currentPlan?`${CURRENT_MONTH} · ${currentPlan.status==='completed'?'已完成':currentPlan.status==='deferred'?'延期':'计划中'}`:(collected?'未加入本月计划':'加入影视库后可创建计划');
    const r=m.radar||{};els.detailRadarBadge.textContent=collected?(r.discovered?'✦ 雷达发现':'电影雷达'):'TMDb 浏览';els.detailRadarDate.textContent=collected?(r.discoveredAt||(r.discovered?'已记录':'—')):'—';els.detailPublicScore.textContent=r.publicReputation!=null?Number(r.publicReputation).toFixed(1):'—';els.detailMatchScore.textContent=collected&&r.matchScore!=null?`${r.matchScore}%`:'—';els.detailRadarReason.textContent=collected?(r.discovered?(r.reason||'这部作品曾通过你的电影雷达进入收藏。'):'尚未通过电影雷达发现这部作品。'):(r.reason||'这部作品来自顶部 TMDb 搜索。');
    els.detailReview.value=collected?(personal.shortReview||''):'';if(collected)renderWatchHistory(m,history);else renderExternalWatchHistory(m);renderRelated(m);
  }'''
pattern = re.compile(r"  function currentDetailMovie\(\)\{.*?\n  function renderWatchHistory", re.S)
index, count = pattern.subn(detail_block + "\n  function renderWatchHistory", index, count=1)
if count != 1:
    raise SystemExit(f'index detail block substitutions: {count}')
index = replace_required(
    index,
    "    openLibraryDetail:openDetail,\n    openWatchRecord(data){",
    "    openLibraryDetail:openDetail,\n    openExternalDetail,\n    openWatchRecord(data){",
    'detail API external entry',
)
index_path.write_text(index)

search_path = Path('global-tmdb-search-v2.js')
search = search_path.read_text()
search = replace_required(
    search,
    "      posterUrl:detail.poster_path ? `https://image.tmdb.org/t/p/w500${detail.poster_path}` : (result.poster_path ? `https://image.tmdb.org/t/p/w500${result.poster_path}` : '')\n",
    "      posterUrl:detail.poster_path ? `https://image.tmdb.org/t/p/w500${detail.poster_path}` : (result.poster_path ? `https://image.tmdb.org/t/p/w500${result.poster_path}` : ''),\n      publicScore:Number.isFinite(Number(detail.vote_average ?? result.vote_average)) ? Number(detail.vote_average ?? result.vote_average) : null\n",
    'bundle public score',
)
helper = r'''  function resultData(result) {
    const type = mediaTypeOf(result);
    const releaseDate = dateOf(result);
    return {
      mediaType:type,
      tmdbId:Number(result?.id) || null,
      title:titleOf(result),
      originalTitle:originalTitleOf(result),
      year:Number(String(releaseDate || '').slice(0,4)) || null,
      releaseDate,
      firstAirDate:type==='tv' ? releaseDate : '',
      lastAirDate:'',
      numberOfSeasons:null,
      numberOfEpisodes:null,
      tvStatus:'',
      runtime:null,
      directors:[],
      countries:[],
      genres:[],
      overview:'',
      posterUrl:result?.poster_path ? `https://image.tmdb.org/t/p/w500${result.poster_path}` : '',
      publicScore:Number.isFinite(Number(result?.vote_average)) ? Number(result.vote_average) : null
    };
  }

'''
search = replace_required(search, "  function detailApi() {", helper + "  function detailApi() {", 'resultData insertion')
preview_block = r'''  async function openPreview(result) {
    const local = localMatch(result);
    previewState = { result, previousViewId:visiblePageId(), libraryMovieId:local?.id || null };
    document.documentElement.dataset.detailReturnSource='search';
    closeDrop();
    if (local) {
      detailApi().openLibraryDetail(local.id);
      if ($('detailBack')) $('detailBack').textContent='‹ 返回搜索结果';
      return;
    }
    detailApi().openExternalDetail(resultData(result));
    if ($('detailBack')) $('detailBack').textContent='‹ 返回搜索结果';
    try {
      const bundle = await fetchBundle(result);
      if (previewState?.result?.id===result.id && mediaTypeOf(previewState.result)===mediaTypeOf(result)) {
        previewState.bundle=bundle;
        detailApi().openExternalDetail(bundleData(bundle));
        if ($('detailBack')) $('detailBack').textContent='‹ 返回搜索结果';
      }
    } catch (err) {
      if (previewState?.result?.id===result.id && mediaTypeOf(previewState.result)===mediaTypeOf(result)) {
        detailApi().openExternalDetail({...resultData(result),overview:`TMDb 详情读取失败：${err?.message || err}`});
        if ($('detailBack')) $('detailBack').textContent='‹ 返回搜索结果';
      }
    }
  }

  function upgradePreview(movie) {
    if (!movie) return;
    if (previewState) previewState.libraryMovieId = movie.id;
    detailApi().openLibraryDetail(movie.id);
    if ($('detailBack')) $('detailBack').textContent='‹ 返回搜索结果';
  }

'''
pattern = re.compile(r"  function setText\(id,value\) \{.*?\n  function closePreview\(\) \{", re.S)
search, count = pattern.subn(preview_block + "  function closePreview() {", search, count=1)
if count != 1:
    raise SystemExit(f'preview block substitutions: {count}')
css_pattern = re.compile(r"\n      html\.cv-search-detail-preview #detailPlanBtn,.*?\n      \.cv-search-preview-note\{[^\n]*\}", re.S)
search, count = css_pattern.subn('', search, count=1)
if count != 1:
    raise SystemExit(f'preview CSS substitutions: {count}')
search = search.replace("    document.documentElement.classList.remove('cv-search-detail-preview');\n", '')
search = search.replace("    $('globalSearchPreviewNote')?.remove();\n", '')
if 'function fillPreview' in search or 'cv-search-detail-preview' in search or 'globalSearchPreviewNote' in search:
    raise SystemExit('legacy split preview path still present')
search_path.write_text(search)

runtime_path = Path('content-center-runtime-v1.js')
runtime = runtime_path.read_text()
runtime = runtime.replace("    'detail-renderer-unified-v2',\n", '')
runtime = runtime.replace("    'detail-renderer-unified-v2.js?v=20260822-1053',\n", '')
runtime_path.write_text(runtime)

runtime_test_path = Path('test/content-runtime.test.js')
runtime_test = runtime_test_path.read_text()
runtime_test = replace_required(runtime_test, 'assert.equal(resources.length, 46);', 'assert.equal(resources.length, 45);', 'runtime count')
runtime_test = replace_required(
    runtime_test,
    "  assert.deepEqual(resources.slice(-2), [\n    'global-tmdb-search-v2.js?v=20260822-0322',\n    'detail-renderer-unified-v2.js?v=20260822-1053',\n  ]);",
    "  assert.equal(resources.at(-1), 'global-tmdb-search-v2.js?v=20260822-0322');",
    'runtime tail',
)
runtime_test = runtime_test.replace("  assert.ok(!resources.includes('detail-renderer-unified-v2.js?v=20260822-1053'));\n", '')
runtime_test_path.write_text(runtime_test)

unified_test_path = Path('test/unified-detail-state.test.js')
unified_test = unified_test_path.read_text()
unified_test = replace_required(
    unified_test,
    "  assert.match(search, /setDetailContext\\(\\{source:'tmdb'/);",
    "  assert.match(search, /openExternalDetail\\(resultData\\(result\\)\\)/);\n  assert.match(index, /function openExternalDetail\\(data=\\{\\}\\).*renderDetail\\(\\)/);",
    'TMDb browsing assertion',
)
if "test('library and TMDb details use one core renderer'" not in unified_test:
    unified_test += r'''

test('library and TMDb details use one core renderer', () => {
  assert.doesNotMatch(search, /function fillPreview/);
  assert.doesNotMatch(search, /cv-search-detail-preview/);
  assert.doesNotMatch(search, /globalSearchPreviewNote/);
  assert.match(search, /detailApi\(\)\.openExternalDetail\(resultData\(result\)\)/);
  assert.match(search, /detailApi\(\)\.openExternalDetail\(bundleData\(bundle\)\)/);
  assert.ok(index.includes("view.dataset.detailRenderer='core-unified'"));
  assert.ok(index.includes("view.dataset.detailMode=collected?'library':'tmdb'"));
  assert.ok(index.includes("const entity=currentDetailEntity();if(!entity)return"));
  assert.ok(index.includes('openExternalDetail,'));
});
'''
unified_test_path.write_text(unified_test)
