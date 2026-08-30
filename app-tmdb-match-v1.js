(() => {
  function cleanTitle(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFKC')
      .replace(/[\s·•:：—–\-_'"“”‘’.,，。!！?？()（）\[\]【】]/g, '');
  }

  function chineseSeasonNumber(value) {
    const raw = String(value || '').trim();
    if (/^\d+$/.test(raw)) return Number(raw);
    const numbers = { 零:0, 一:1, 二:2, 两:2, 三:3, 四:4, 五:5, 六:6, 七:7, 八:8, 九:9 };
    if (raw === '十') return 10;
    if (raw.includes('十')) {
      const [tens, ones] = raw.split('十');
      return (tens ? numbers[tens] || 0 : 1) * 10 + (ones ? numbers[ones] || 0 : 0);
    }
    return numbers[raw] ?? null;
  }

  function seasonTextInfo(text) {
    const value = String(text || '').trim();
    if (!value) return null;
    let match = value.match(/^(.*?)\s*第\s*([零一二两三四五六七八九十\d]+)\s*季(?:\s*.*)?$/i);
    if (match) return { base:trimSeasonSuffix(match[1]), season:chineseSeasonNumber(match[2]), raw:value };
    match = value.match(/^(.*?)\s*(?:Season|Series)\s*(\d+)\s*$/i);
    if (match) return { base:trimSeasonSuffix(match[1]), season:Number(match[2]), raw:value };
    match = value.match(/^(.*?)\s*S(\d+)\s*$/i);
    if (match) return { base:trimSeasonSuffix(match[1]), season:Number(match[2]), raw:value };
    return null;
  }

  function trimSeasonSuffix(value) {
    return String(value || '').trim().replace(/[\s:：·\-—]+$/, '');
  }

  function seasonInfoFromMovie(movie) {
    const chinese = seasonTextInfo(movie?.info?.title);
    const foreign = seasonTextInfo(movie?.info?.originalTitle);
    if (!chinese && !foreign) return null;
    return {
      season:chinese?.season ?? foreign?.season ?? null,
      titleBase:chinese?.base || '',
      originalBase:foreign?.base || '',
      sourceTitle:movie?.info?.title || '',
      sourceOriginal:movie?.info?.originalTitle || ''
    };
  }

  function seasonGroupKey(movie) {
    const info = seasonInfoFromMovie(movie);
    return info ? cleanTitle(info.originalBase || info.titleBase) : '';
  }

  function compactSeasonTargets(rows) {
    const seen = new Set();
    return (rows || []).filter(movie => {
      const key = seasonGroupKey(movie);
      if (!key) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function candidateTitle(candidate) {
    return candidate?.media_type === 'tv'
      ? candidate.name || candidate.original_name || ''
      : candidate?.title || candidate?.original_title || '';
  }

  function candidateOriginal(candidate) {
    return candidate?.media_type === 'tv'
      ? candidate.original_name || candidate.name || ''
      : candidate?.original_title || candidate?.title || '';
  }

  function candidateDate(candidate) {
    return candidate?.media_type === 'tv'
      ? candidate.first_air_date || ''
      : candidate?.release_date || '';
  }

  function uniqueCandidates(rows) {
    const unique = new Map();
    for (const candidate of rows || []) {
      if (!candidate?.id) continue;
      const key = `${candidate.media_type || 'movie'}:${candidate.id}`;
      if (!unique.has(key)) unique.set(key, candidate);
    }
    return [...unique.values()];
  }

  function exactByQuery(query, candidate, { tvOnly = false, preferOriginal = false } = {}) {
    const normalized = cleanTitle(query);
    if (!normalized || (tvOnly && candidate?.media_type !== 'tv')) return false;
    const title = cleanTitle(candidateTitle(candidate));
    const original = cleanTitle(candidateOriginal(candidate));
    return preferOriginal ? original === normalized || title === normalized : title === normalized || original === normalized;
  }

  async function matchMovie(movie, search) {
    if (typeof search !== 'function') throw new TypeError('TMDb matcher requires a search function');
    const season = seasonInfoFromMovie(movie);
    const tvOnly = Boolean(season);
    const foreign = String((season?.originalBase || movie?.info?.originalTitle) || '').trim();
    const chinese = String((season?.titleBase || movie?.info?.title) || '').trim();
    let foreignResults = [];
    let chineseResults = [];
    const exactForeign = candidate => exactByQuery(foreign, candidate, { tvOnly, preferOriginal:true });
    const exactChinese = candidate => exactByQuery(chinese, candidate, { tvOnly });

    if (foreign) {
      foreignResults = await search(foreign, tvOnly);
      const foreignExact = uniqueCandidates(foreignResults.filter(exactForeign));
      if (foreignExact.length === 1) {
        return { auto:foreignExact[0], candidates:foreignExact, reason:tvOnly ? '已去除季号，外文剧名唯一匹配' : '外文原名唯一精确匹配' };
      }
      if (foreignExact.length > 1) {
        chineseResults = await search(chinese, tvOnly);
        const chineseExact = uniqueCandidates(chineseResults.filter(exactChinese));
        const chineseIds = new Set(chineseExact.map(candidate => `${candidate.media_type || 'movie'}:${candidate.id}`));
        const intersection = foreignExact.filter(candidate => chineseIds.has(`${candidate.media_type || 'movie'}:${candidate.id}`));
        if (intersection.length === 1) {
          return { auto:intersection[0], candidates:intersection, reason:tvOnly ? '分季外文名重复，中文剧名唯一确认' : '外文原名重复，中文名唯一确认' };
        }
        return {
          auto:null,
          candidates:uniqueCandidates([...foreignExact, ...chineseExact, ...foreignResults, ...chineseResults]).slice(0, 6),
          reason:tvOnly ? '同一剧名存在多个 TMDb 剧集，需确认一次后自动合并全部分季' : '同一外文原名存在多个结果，中文名仍无法唯一确认'
        };
      }
      chineseResults = await search(chinese, tvOnly);
      const chineseExact = uniqueCandidates(chineseResults.filter(exactChinese));
      if (chineseExact.length === 1) {
        return { auto:chineseExact[0], candidates:chineseExact, reason:tvOnly ? '已去除季号，中文剧名唯一匹配' : '外文原名未命中，中文名唯一精确匹配' };
      }
      return {
        auto:null,
        candidates:uniqueCandidates([...chineseExact, ...foreignResults, ...chineseResults]).slice(0, 6),
        reason:chineseExact.length > 1
          ? (tvOnly ? '中文剧名存在多个结果，确认一次即可合并分季' : '中文名存在多个精确结果')
          : (tvOnly ? '去除季号后仍无法唯一确定剧集' : '外文原名与中文名均无法唯一确定')
      };
    }

    chineseResults = await search(chinese, tvOnly);
    const chineseExact = uniqueCandidates(chineseResults.filter(exactChinese));
    if (chineseExact.length === 1) {
      return { auto:chineseExact[0], candidates:chineseExact, reason:tvOnly ? '无外文名，去除季号后中文剧名唯一匹配' : '无外文原名，中文名唯一精确匹配' };
    }
    return {
      auto:null,
      candidates:uniqueCandidates([...chineseExact, ...chineseResults]).slice(0, 6),
      reason:tvOnly
        ? (chineseExact.length > 1 ? '中文剧名存在多个结果，确认一次即可合并全部分季' : '去除季号后仍无唯一 TMDb 剧集')
        : (chineseExact.length > 1 ? '中文名存在多个精确结果' : '中文名无法唯一确定')
    };
  }

  window.CineverseTmdbMatch = Object.freeze({
    cleanTitle,
    chineseSeasonNumber,
    seasonTextInfo,
    seasonInfoFromMovie,
    seasonGroupKey,
    compactSeasonTargets,
    candidateTitle,
    candidateOriginal,
    candidateDate,
    uniqueCandidates,
    exactByQuery,
    matchMovie
  });
})();
