const { execFileSync } = require('node:child_process');
const { existsSync, readFileSync } = require('node:fs');
const { dirname, extname, join } = require('node:path');

const root = join(__dirname, '..');
const tracked = execFileSync('git', ['ls-files'], { cwd:root, encoding:'utf8' }).split(/\r?\n/).filter(Boolean);
const production = tracked.filter(file => ['.html', '.js'].includes(extname(file)) && !file.startsWith('test/') && !file.startsWith('scripts/'));
const removed = [
  'cloud-auth.js', 'global-tmdb-search-v1.js', 'radar-experience-v2.js', 'rating-sync-v2.js',
  'library-filter-experience-v1.js', 'library-filter-controls-v3.js', 'library-filter-experience-v2.js',
  'library-display-experience-v1.js', 'cloud-auth-redirect-fix.js', 'cloud-local-edit-baseline-guard-v1.js',
  'cloud-local-edit-baseline-guard-v2.js', 'cloud-pending-memory.js', 'index(20260820-023858).html',
];
const failures = [];
let localReferences = 0;

for (const file of production) {
  const source = readFileSync(join(root, file), 'utf8');
  for (const removedFile of removed) {
    if (source.includes(removedFile)) failures.push(`${file}: references removed artifact "${removedFile}"`);
  }
  for (const match of source.matchAll(/["'`]([^"'`\s]+\.(?:js|css))(?:\?[^"'`\s]*)?["'`]/gi)) {
    const reference = match[1];
    if (/^(?:[a-z]+:|\/\/)/i.test(reference) || /[${}]/.test(reference)) continue;
    localReferences++;
    if (!existsSync(join(root, dirname(file), reference))) failures.push(`${file}: missing runtime reference "${reference}"`);
  }
}

if (failures.length) {
  console.error([...new Set(failures)].join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Checked ${localReferences} runtime references across ${production.length} production files.`);
}
