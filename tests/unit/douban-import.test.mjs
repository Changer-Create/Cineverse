import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ratingElement = { classList:['rating5-t'] };
const elements = {
  '.title a em':null,
  '.title a':null,
  '[class*="title"] a':null,
  '.date':{ textContent:'2026-08-20' },
  '.intro':{ textContent:'2000-09-29 / 中国香港 / 剧情' },
  '.rating_num':null,
  '[class*="score"]':null,
  '.comment':{ textContent:'重看仍然动人' },
  '[class*="comment"]':null,
  '.tags':{ textContent:'标签: 爱情 / 王家卫' },
  '[class*="tag"]':null,
  'img[alt]':null
};
const item = {
  textContent:'花样年华 / In the Mood for Love 重看仍然动人',
  parentElement:null,
  matches:selector => selector.includes('.item'),
  querySelector:selector => elements[selector] ?? null,
  querySelectorAll:selector => selector === '[class*="rating"]' ? [ratingElement] : []
};
const anchor = {
  textContent:'花样年华 / In the Mood for Love',
  parentElement:item,
  matches:() => false,
  getAttribute:name => name === 'href' ? 'https://movie.douban.com/subject/1291557/' : null,
  querySelector:() => null,
  querySelectorAll:() => []
};
class FakeDOMParser {
  parseFromString() {
    return {
      title:'我看过的影视',
      body:{ textContent:'我看过的影视' },
      querySelectorAll:selector => selector.includes('/subject/') ? [anchor] : []
    };
  }
}

const context = vm.createContext({ window:{}, crypto:{ randomUUID:() => 'test-id' }, DOMParser:FakeDOMParser });
for (const file of ['app-core-utils-v1.js', 'app-douban-import-v1.js']) {
  vm.runInContext(readFileSync(file, 'utf8'), context);
}
const Douban = context.window.CineverseDoubanImport;

assert.deepEqual(
  JSON.parse(JSON.stringify(Douban.parseTitlePair('花样年华 / In the Mood for Love'))),
  { title:'花样年华', originalTitle:'In the Mood for Love' }
);
assert.equal(Douban.cleanTitle('一一 / Yi Yi'), '一一');
assert.equal(Douban.statusFromText('我看过的影视 /collect'), 'watched');
assert.equal(Douban.normalizeRating(4.5), 9);
assert.equal(Douban.normalizeRating(8), 8);

const quotedRows = Douban.parseCsvRows('title,comment\r\n"一一","他说""很好"""');
assert.equal(quotedRows[1][0], '一一');
assert.equal(quotedRows[1][1], '他说"很好"');

const csv = [
  '豆瓣 ID,片名,年份,状态,标记日期,评分,短评,标签',
  '1292064,"楚门的世界 / The Truman Show",1998,看过,2026-08-20,4.5,"重看仍然动人","成长 / 自由"'
].join('\r\n');
const [csvEntry] = Douban.parseCsv(csv);
assert.equal(csvEntry.doubanId, '1292064');
assert.equal(csvEntry.title, '楚门的世界');
assert.equal(csvEntry.originalTitle, 'The Truman Show');
assert.equal(csvEntry.year, 1998);
assert.equal(csvEntry.status, 'watched');
assert.equal(csvEntry.rating, 9);
assert.deepEqual([...csvEntry.tags], ['成长', '自由']);

const [jsonEntry] = Douban.parseJson(JSON.stringify({ items:[{
  subject:{ title:'花样年华 / In the Mood for Love', year:'2000', url:'https://movie.douban.com/subject/1291557/' },
  status:'collect',
  rating:{ value:5 },
  markedAt:'2026-08-21',
  tags:['爱情', '王家卫']
}] }));
assert.equal(jsonEntry.doubanId, '1291557');
assert.equal(jsonEntry.status, 'watched');
assert.equal(jsonEntry.rating, 10);
assert.equal(jsonEntry.date, '2026-08-21');
assert.deepEqual([...jsonEntry.tags], ['爱情', '王家卫']);

assert.equal(Douban.parseFile('list.CSV', csv)[0].title, '楚门的世界');
const [htmlEntry] = Douban.parseHtml('<html></html>');
assert.equal(htmlEntry.doubanId, '1291557');
assert.equal(htmlEntry.title, '花样年华');
assert.equal(htmlEntry.originalTitle, 'In the Mood for Love');
assert.equal(htmlEntry.year, 2000, 'release year must come from intro metadata');
assert.equal(htmlEntry.date, '2026-08-20', 'marked date must remain a watch date');
assert.equal(htmlEntry.rating, 10);
assert.equal(htmlEntry.status, 'watched');
assert.deepEqual([...htmlEntry.tags], ['爱情', '王家卫']);
assert.throws(() => Douban.parseJson('{"items":[]}'), /没有识别到电影数组/);
assert.throws(() => Douban.parseCsv('wrong\nvalue'), /未找到片名/);

console.log('Douban import parser tests passed.');
