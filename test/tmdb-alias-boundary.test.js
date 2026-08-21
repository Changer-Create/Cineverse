const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');

const root = join(__dirname, '..');
const aliasSource = readFileSync(join(root, 'tmdb-alias-match.js'), 'utf8');

test('TMDb alias matching does not replace the global fetch function', () => {
  assert.doesNotMatch(aliasSource, /window\.fetch\s*=/);
  assert.match(aliasSource, /window\.MovieTmdbAliasMatch=Object\.freeze/);
});

test('each active TMDb client enriches responses at its request boundary', () => {
  for (const file of ['index.html', 'global-tmdb-search-v2.js', 'admin-data.js']) {
    const source = readFileSync(join(root, file), 'utf8');
    assert.match(
      source,
      /MovieTmdbAliasMatch\?\.enrich\(response,path,params\)/,
      `${file} must call the alias matcher explicitly`,
    );
  }
});
