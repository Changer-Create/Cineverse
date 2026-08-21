const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = join(__dirname, '..');
const configSource = readFileSync(join(root, 'cineverse-config.js'), 'utf8');

test('shared service configuration is immutable and complete', () => {
  const context = { window:{} };
  vm.runInNewContext(configSource, context, { filename:'cineverse-config.js' });
  const config = context.window.CineverseConfig;

  assert.equal(Object.isFrozen(config), true);
  assert.equal(Object.isFrozen(config.endpoints), true);
  assert.match(config.endpoints.tmdbProxy, /\/functions\/v1\/tmdb-proxy$/);
  assert.match(config.endpoints.adminAuth, /\/functions\/v1\/admin-auth$/);
});

test('service URLs have a single production source', () => {
  const files = [
    'admin-auth.js', 'admin-data.js', 'admin.html', 'cloud-auth-v5.js',
    'global-config-sync.js', 'global-tmdb-search-v2.js',
    'home-radar-detail-navigation-v1.js', 'index.html', 'library-card-system-v1.js', 'radar-20.js',
    'radar-experience-v3.js', 'tmdb-alias-match.js', 'visual-copy-editor.js',
  ];
  for (const file of files) {
    const source = readFileSync(join(root, file), 'utf8');
    assert.doesNotMatch(source, /bjjralybdcuczwllxbvo\.supabase\.co/);
  }
});
