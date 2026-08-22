const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = join(__dirname, '..');
const runtimeSource = readFileSync(join(root, 'content-center-runtime-v1.js'), 'utf8');

function runRuntime({ pathname = '/index.html', token = '' } = {}) {
  const writes = [];
  const redirects = [];
  const context = {
    window: {},
    location: {
      pathname,
      replace: target => redirects.push(target),
    },
    document: {
      documentElement: { style: {} },
      write: markup => writes.push(markup),
    },
    sessionStorage: {
      getItem: key => key === 'movie-collection-admin-session-v1' ? token : null,
    },
  };
  vm.runInNewContext(runtimeSource, context, { filename: 'content-center-runtime-v1.js' });
  return { context, redirects, writes, markup: writes.join('') };
}

function resourceUrls(markup) {
  return [...markup.matchAll(/(?:src|href)="([^"]+)"/g)].map(match => match[1]);
}

test('main entry emits the established resources in order', () => {
  const result = runRuntime();
  const resources = resourceUrls(result.markup);

  assert.equal(result.redirects.length, 0);
  assert.equal(result.writes.length, 2);
  assert.equal(resources.length, 46);
  assert.deepEqual(resources.slice(0, 7), [
    'settings-responsive.css?v=20260821-1028',
    'large-screen-layout-v1.css?v=20260822-0208',
    'cineverse-config.js',
    'global-config-sync.js?v=20260821-1149',
    'site-brand.js',
    'nav-order.js',
    'library-pagination-top.js',
  ]);
  assert.equal(resources[7], 'content-observer-shield.js');
  assert.deepEqual(resources.slice(-2), [
    'global-tmdb-search-v2.js?v=20260822-0322',
    'detail-renderer-unified-v2.js?v=20260822-1053',
  ]);
  assert.ok(!resources.some(url => url.startsWith('admin-')));
});

test('authenticated admin entry preserves its guarded module order', () => {
  const result = runRuntime({ pathname: '/admin-console.html', token: 'session' });
  const resources = resourceUrls(result.markup);

  assert.equal(result.context.document.documentElement.style.visibility, 'hidden');
  assert.deepEqual(result.redirects, []);
  assert.equal(resources.length, 20);
  assert.equal(resources[7], 'admin-auth.js');
  assert.deepEqual(resources.slice(-2), ['admin-brand.js', 'admin-nav.js']);
  assert.ok(resources.includes('content-center-core.js'));
  assert.ok(resources.includes('tmdb-alias-match.js?v=20260821-0125'));
  assert.ok(!resources.includes('cloud-auth-v5.js?v=20260822-0253'));
  assert.ok(!resources.includes('global-tmdb-search-v2.js?v=20260822-0322'));
  assert.ok(!resources.includes('detail-renderer-unified-v2.js?v=20260822-1053'));
});

test('unauthenticated admin entry redirects before application modules load', () => {
  const result = runRuntime({ pathname: '/admin-console.html' });

  assert.deepEqual(result.redirects, ['admin.html']);
  assert.equal(result.context.document.documentElement.style.visibility, 'hidden');
  assert.equal(result.writes.length, 1);
  assert.equal(resourceUrls(result.markup).length, 7);
});

test('runtime bootstrap is idempotent', () => {
  const result = runRuntime();
  const initialWriteCount = result.writes.length;

  vm.runInNewContext(runtimeSource, result.context, { filename: 'content-center-runtime-v1.js' });
  assert.equal(result.writes.length, initialWriteCount);
});

test('runtime manifest exposes immutable ownership and dependencies', () => {
  const result = runRuntime();
  const manifest = result.context.window.CineverseRuntimeManifest;
  const ids = new Set(manifest.map(item => item.id));

  assert.equal(Object.isFrozen(manifest), true);
  assert.equal(ids.size, manifest.length);
  for (const item of manifest) {
    assert.equal(Object.isFrozen(item), true);
    assert.equal(Object.isFrozen(item.targets), true);
    assert.equal(Object.isFrozen(item.dependsOn), true);
    assert.ok(item.targets.every(target => target === 'app' || target === 'admin'));
    for (const dependency of item.dependsOn) assert.ok(ids.has(dependency), `${item.id} depends on missing ${dependency}`);
  }
  assert.deepEqual(
    Array.from(manifest.find(item => item.id === 'admin-auth').targets),
    ['admin'],
  );
});

test('app-only modules explicitly guard admin entry points', () => {
  const manifest = runRuntime().context.window.CineverseRuntimeManifest;
  for (const item of manifest.filter(entry => entry.type === 'script' && entry.targets.length === 1 && entry.targets[0] === 'app')) {
    const source = readFileSync(join(root, item.src.split('?')[0]), 'utf8');
    assert.match(source.slice(0, 500), /admin\|admin-console/, `${item.id} needs an admin guard`);
  }
});

test('every local runtime resource exists in the repository', () => {
  const resources = resourceUrls(runRuntime({ pathname: '/admin-console.html', token: 'session' }).markup);

  for (const resource of resources) {
    const relativePath = resource.split('?')[0];
    assert.doesNotThrow(
      () => readFileSync(join(root, relativePath)),
      `Missing runtime resource: ${relativePath}`,
    );
  }
});