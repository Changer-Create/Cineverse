import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({ window:{} });
vm.runInContext(readFileSync('app-tmdb-match-v1.js', 'utf8'), context);
const Match = context.window.CineverseTmdbMatch;

assert.equal(Match.cleanTitle(' 花样年华：2046 '), '花样年华2046');
assert.equal(Match.chineseSeasonNumber('十二'), 12);
assert.deepEqual(
  JSON.parse(JSON.stringify(Match.seasonTextInfo('权力的游戏 第三季'))),
  { base:'权力的游戏', season:3, raw:'权力的游戏 第三季' }
);
assert.equal(Match.seasonTextInfo('The Bear Season 2').base, 'The Bear');
assert.equal(Match.seasonTextInfo('Slow Horses S4').season, 4);

const seasonOne = { id:'s1', info:{ title:'熊家餐馆 第一季', originalTitle:'The Bear Season 1' } };
const seasonTwo = { id:'s2', info:{ title:'熊家餐馆 第二季', originalTitle:'The Bear Season 2' } };
const movie = { id:'m1', info:{ title:'花样年华', originalTitle:'In the Mood for Love' } };
assert.equal(Match.seasonInfoFromMovie(seasonTwo).season, 2);
assert.deepEqual(
  Match.compactSeasonTargets([seasonOne, seasonTwo, movie]).map(item => item.id),
  ['s1', 'm1'],
  'different seasons of one series should produce one scan target'
);

const duplicateMovie = { id:42, media_type:'movie', title:'一一' };
assert.equal(Match.uniqueCandidates([duplicateMovie, duplicateMovie, { id:42, media_type:'tv', name:'一一' }]).length, 2);

{
  const calls = [];
  const result = await Match.matchMovie(
    { info:{ title:'花样年华', originalTitle:'In the Mood for Love' } },
    async (query, tvOnly) => {
      calls.push({ query, tvOnly });
      return [{ id:843, media_type:'movie', title:'花样年华', original_title:'In the Mood for Love', release_date:'2000-09-29' }];
    }
  );
  assert.equal(result.auto.id, 843);
  assert.equal(result.reason, '外文原名唯一精确匹配');
  assert.deepEqual(calls, [{ query:'In the Mood for Love', tvOnly:false }]);
}

{
  const result = await Match.matchMovie(
    seasonTwo,
    async (query, tvOnly) => {
      assert.equal(tvOnly, true, 'season imports must only search TMDb TV');
      assert.equal(query, 'The Bear', 'season suffix must be removed before searching');
      return [{ id:136315, media_type:'tv', name:'熊家餐馆', original_name:'The Bear', first_air_date:'2022-06-23' }];
    }
  );
  assert.equal(result.auto.id, 136315);
  assert.match(result.reason, /去除季号/);
}

{
  const sameOriginal = [
    { id:1, media_type:'movie', title:'候选甲', original_title:'Shared Title' },
    { id:2, media_type:'movie', title:'正确中文名', original_title:'Shared Title' }
  ];
  const result = await Match.matchMovie(
    { info:{ title:'正确中文名', originalTitle:'Shared Title' } },
    async query => query === 'Shared Title' ? sameOriginal : [sameOriginal[1]]
  );
  assert.equal(result.auto.id, 2, 'Chinese title should disambiguate duplicate original titles');
  assert.equal(result.reason, '外文原名重复，中文名唯一确认');
}

{
  const result = await Match.matchMovie(
    { info:{ title:'同名电影', originalTitle:'' } },
    async () => [
      { id:10, media_type:'movie', title:'同名电影', release_date:'1990-01-01' },
      { id:11, media_type:'movie', title:'同名电影', release_date:'2020-01-01' }
    ]
  );
  assert.equal(result.auto, null, 'release year must not silently choose between exact-title candidates');
  assert.equal(result.candidates.length, 2);
  assert.equal(result.reason, '中文名存在多个精确结果');
}

console.log('TMDb match domain tests passed.');
