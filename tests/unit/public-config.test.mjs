import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({ window: {} });
vm.runInContext(readFileSync('public-config-v1.js', 'utf8'), context);
const config = context.window.CineversePublicConfig;

assert.equal(config.publicAppUrl, 'https://changer-create.github.io/Cineverse/');
assert.equal(config.tmdbProxyUrl, `${config.supabaseUrl}/functions/v1/tmdb-proxy`);
assert.equal(config.adminAuthUrl, `${config.supabaseUrl}/functions/v1/admin-auth`);
assert.equal(config.adminGlobalConfigUrl, `${config.supabaseUrl}/functions/v1/admin-global-config`);
assert.ok(!config.publicAppUrl.includes('cj956151388-png.github.io'));
console.log('Public config tests passed.');
