import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname } from 'node:path';
import { spawnSync } from 'node:child_process';

const roots = ['index.html', 'admin.html', 'admin-console.html', 'content-center-runtime-v1.js'];
const retired = [
  'content-center.js', 'cloud-auth.js', 'cloud-auth-redirect-fix.js',
  'cloud-local-edit-baseline-guard-v1.js', 'cloud-local-edit-baseline-guard-v2.js',
  'cloud-pending-memory.js', 'global-tmdb-search-v1.js',
  'library-card-actions-v2.js', 'library-display-experience-v1.js',
  'library-filter-controls-v3.js', 'library-filter-experience-v1.js',
  'library-filter-experience-v2.js', 'radar-experience-v2.js', 'rating-sync-v2.js'
];
const failures = [];
const localAsset = /(?:src|href)=["']([^"']+\.(?:js|css)(?:\?[^"']*)?)["']/g;

for (const root of roots) {
  const source = readFileSync(root, 'utf8');
  for (const [, url] of source.matchAll(localAsset)) {
    if (/^(?:https?:)?\/\//.test(url)) continue;
    const file = url.split('?')[0];
    if (!existsSync(file)) failures.push(`${root} references missing asset ${file}`);
  }
}
for (const file of retired) {
  if (existsSync(file)) failures.push(`retired implementation returned: ${file}`);
}
for (const file of readdirSync('.').filter(file => extname(file) === '.js')) {
  const check = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (check.status !== 0) failures.push(`${file} has invalid syntax: ${check.stderr.trim()}`);
}
if (failures.length) {
  console.error(failures.map(item => `- ${item}`).join('\n'));
  process.exit(1);
}
console.log('Runtime audit passed: entry assets exist, retired layers are absent, and JavaScript syntax is valid.');
