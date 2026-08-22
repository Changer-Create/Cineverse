(() => {
  const splitList = value => window.CineverseCoreUtils.splitList(value);

  function parseCsvRows(text) {
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;
    const source = String(text || '');
    for (let index = 0; index < source.length; index++) {
      const current = source[index];
      const next = source[index + 1];
      if (quoted) {
        if (current === '"' && next === '"') {
          cell += '"';
          index++;
        } else if (current === '"') {
          quoted = false;
        } else {
          cell += current;
        }
      } else if (current === '"') {
        quoted = true;
      } else if (current === ',') {
        row.push(cell);
        cell = '';
      } else if (current === '\n') {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
      } else if (current !== '\r') {
        cell += current;
      }
    }
    if (cell || row.length) {
      row.push(cell);
      rows.push(row);
    }
    return rows;
  }

  function parseTitlePair(value) {
    const raw = String(value || '').replace(/\s+/g, ' ').trim();
    const parts = raw.split(/\s+\/\s+/, 2);
    return { title:(parts[0] || '').trim(), originalTitle:(parts[1] || '').trim() };
  }

  function cleanTitle(value) {
    return parseTitlePair(value).title;
  }

  function statusFromText(text, fallback = 'auto') {
    const value = String(text || '');
    if (/想看的影视|想看\s*[·(]|\/wish\b/i.test(value)) return 'want';
    if (/看过的影视|看过\s*[·(]|\/collect\b/i.test(value)) return 'watched';
    return fallback === 'auto' ? 'want' : fallback;
  }

  function normalizeStatus(value, fallback = 'auto') {
    if (/看过|watched|collect/i.test(String(value || ''))) return 'watched';
    if (/想看|want|wish/i.test(String(value || ''))) return 'want';
    return fallback === 'auto' ? 'want' : fallback;
  }

  function normalizeRating(value) {
    let rating = value;
    if (typeof rating === 'object' && rating !== null) rating = rating.value ?? null;
    rating = rating !== null && rating !== '' ? Number(rating) : null;
    if (rating !== null && rating <= 5) rating *= 2;
    return Number.isFinite(rating) ? rating : null;
  }

  function itemContainer(anchor) {
    let node = anchor;
    for (let depth = 0; depth < 8 && node; depth++, node = node.parentElement) {
      if (node.matches?.('.item,li,.movie-item,.subject-item,[class*="item"]')) return node;
      const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
      if (depth >= 2 && text.length >= 8 && text.length <= 2200 && node.querySelectorAll?.('a[href*="/subject/"]').length <= 3) return node;
    }
    return anchor.parentElement || anchor;
  }

  function parseHtml(text, mode = 'auto') {
    const doc = new DOMParser().parseFromString(String(text || ''), 'text/html');
    const context = `${doc.title || ''} ${(doc.body?.textContent || '').slice(0, 1200)}`;
    const pageStatus = statusFromText(context, mode);
    const entries = [];
    const seen = new Set();
    const anchors = [...doc.querySelectorAll('a[href*="/subject/"],a[href*="movie.douban.com/subject/"]')];

    for (const anchor of anchors) {
      const href = anchor.getAttribute('href') || '';
      const id = (href.match(/\/subject\/(\d+)/) || [])[1];
      if (!id || seen.has(id)) continue;
      const item = itemContainer(anchor);
      if (!item) continue;
      const imageAlt = anchor.querySelector('img')?.getAttribute('alt') || item.querySelector('img[alt]')?.getAttribute('alt') || '';
      const candidates = [
        item.querySelector('.title a em')?.textContent,
        item.querySelector('.title a')?.getAttribute('title'),
        item.querySelector('.title a')?.textContent,
        item.querySelector('[class*="title"] a')?.textContent,
        anchor.getAttribute('title'),
        anchor.querySelector('em')?.textContent,
        imageAlt,
        anchor.textContent
      ];
      let title = '';
      let originalTitle = '';
      for (const candidate of candidates) {
        const pair = parseTitlePair(candidate);
        if (pair.title && pair.title.length <= 120) {
          title = pair.title;
          originalTitle = pair.originalTitle;
          break;
        }
      }
      if (!title) continue;

      const raw = (item.textContent || '').replace(/\s+/g, ' ').trim();
      // 豆瓣标记时间只用于 watchHistory，不参与 TMDb 身份匹配。
      const dateText = (item.querySelector('.date')?.textContent || '').replace(/\s+/g, ' ').trim();
      const dateMatch = dateText.match(/((?:19|20)\d{2})\s*[-\/.年]\s*(\d{1,2})\s*[-\/.月]\s*(\d{1,2})/);
      const date = dateMatch ? `${dateMatch[1]}-${String(dateMatch[2]).padStart(2, '0')}-${String(dateMatch[3]).padStart(2, '0')}` : '';
      // 影片年份只从 intro 的上映信息读取；没有 intro 就留空。
      const intro = (item.querySelector('.intro')?.textContent || '').replace(/\s+/g, ' ').trim();
      const yearMatch = intro.match(/(?:^|[^\d])((?:18|19|20)\d{2})[-\/.年]/);
      const classes = [...item.querySelectorAll('[class*="rating"]')].flatMap(element => [...element.classList]);
      const ratingClass = classes.find(name => /^rating[1-5](?:-t)?$/.test(name));
      let rating = ratingClass ? Number((ratingClass.match(/rating([1-5])/) || [])[1]) * 2 : null;
      if (rating === null) {
        const scoreText = (item.querySelector('.rating_num')?.textContent || item.querySelector('[class*="score"]')?.textContent || '').trim();
        const score = Number(scoreText);
        if (Number.isFinite(score) && score >= 0 && score <= 10) rating = score;
      }
      const comment = (item.querySelector('.comment')?.textContent || item.querySelector('[class*="comment"]')?.textContent || '').trim();
      const tagText = (item.querySelector('.tags')?.textContent || item.querySelector('[class*="tag"]')?.textContent || '').replace(/^\s*标签[:：]?\s*/, '').trim();
      const status = /看过/.test(raw) ? 'watched' : /想看/.test(raw) ? 'want' : pageStatus;
      seen.add(id);
      entries.push({
        doubanId:id,
        title,
        originalTitle,
        year:yearMatch ? Number(yearMatch[1]) : null,
        status,
        date,
        rating,
        comment,
        tags:splitList(tagText)
      });
    }
    return entries;
  }

  function headerIndex(headers, names) {
    const normalized = headers.map(value => String(value || '').trim().toLowerCase());
    for (const name of names) {
      const index = normalized.indexOf(String(name).toLowerCase());
      if (index >= 0) return index;
    }
    return -1;
  }

  function parseCsv(text, mode = 'auto') {
    const rows = parseCsvRows(String(text || '').replace(/^\ufeff/, ''));
    if (rows.length < 2) return [];
    const headers = rows[0];
    const columns = {
      title:headerIndex(headers, ['title', 'name', '片名', '电影', '名称']),
      originalTitle:headerIndex(headers, ['originaltitle', 'original_title', '原名', '外文名', '英文名']),
      year:headerIndex(headers, ['year', '年份', '上映年份']),
      status:headerIndex(headers, ['status', '状态', 'collection', '类型']),
      date:headerIndex(headers, ['date', 'markedat', '标记日期', '观看日期', '日期']),
      rating:headerIndex(headers, ['rating', 'score', '评分', '我的评分']),
      comment:headerIndex(headers, ['comment', 'review', '短评', '评论', 'note']),
      id:headerIndex(headers, ['doubanid', 'douban_id', 'subject_id', '豆瓣id', '豆瓣 id']),
      tags:headerIndex(headers, ['tags', '标签'])
    };
    if (columns.title < 0) throw new Error('CSV 未找到片名/title 列');
    return rows.slice(1).map(row => {
      const pair = parseTitlePair(row[columns.title]);
      if (!pair.title) return null;
      const originalTitle = (columns.originalTitle >= 0 ? row[columns.originalTitle] : '') || pair.originalTitle || '';
      const yearText = columns.year >= 0 ? row[columns.year] : '';
      return {
        doubanId:columns.id >= 0 ? row[columns.id] : null,
        title:pair.title,
        originalTitle,
        year:yearText ? Number(String(yearText).match(/\d{4}/)?.[0]) : null,
        status:normalizeStatus(columns.status >= 0 ? row[columns.status] : '', mode),
        date:columns.date >= 0 ? row[columns.date] : '',
        rating:normalizeRating(columns.rating >= 0 ? row[columns.rating] : null),
        comment:columns.comment >= 0 ? row[columns.comment] : '',
        tags:columns.tags >= 0 ? splitList(row[columns.tags]) : []
      };
    }).filter(Boolean);
  }

  function parseJson(text, mode = 'auto') {
    const raw = JSON.parse(text);
    const entries = Array.isArray(raw) ? raw
      : Array.isArray(raw?.items) ? raw.items
      : Array.isArray(raw?.movies) ? raw.movies
      : Array.isArray(raw?.data) ? raw.data
      : [];
    if (!entries.length) throw new Error('JSON 中没有识别到电影数组');
    return entries.map(entry => {
      const subject = entry.subject || entry.movie || entry;
      const pair = parseTitlePair(subject.title || subject.name || entry.title || entry.name || entry['片名']);
      if (!pair.title) return null;
      const originalTitle = subject.originalTitle || subject.original_title || entry.originalTitle || entry.original_title || entry['原名'] || entry['外文名'] || entry['英文名'] || pair.originalTitle || '';
      const year = Number(String(subject.year || entry.year || entry['年份'] || '').match(/\d{4}/)?.[0]) || null;
      const url = subject.url || entry.url || '';
      const id = subject.doubanId || subject.douban_id || subject.subject_id || entry.doubanId || entry.douban_id || entry.subject_id || (String(url).match(/\/subject\/(\d+)/) || [])[1] || null;
      return {
        doubanId:id,
        title:pair.title,
        originalTitle,
        year,
        status:normalizeStatus(entry.status || entry.collection_type || entry.type || entry['状态'] || '', mode),
        date:entry.date || entry.markedAt || entry.create_time || entry['标记日期'] || '',
        rating:normalizeRating(entry.rating?.value ?? entry.rating ?? entry.score ?? entry['评分'] ?? null),
        comment:entry.comment || entry.shortReview || entry.review || entry['短评'] || '',
        tags:Array.isArray(entry.tags) ? entry.tags : splitList(entry.tags || entry['标签'])
      };
    }).filter(Boolean);
  }

  function parseFile(name, text, mode = 'auto') {
    const filename = String(name || '').toLowerCase();
    if (filename.endsWith('.json')) return parseJson(text, mode);
    if (filename.endsWith('.csv')) return parseCsv(text, mode);
    return parseHtml(text, mode);
  }

  window.CineverseDoubanImport = Object.freeze({
    parseCsvRows,
    parseTitlePair,
    cleanTitle,
    statusFromText,
    normalizeStatus,
    normalizeRating,
    parseHtml,
    parseCsv,
    parseJson,
    parseFile
  });
})();
