import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const index = readFileSync('index.html', 'utf8');
const layout = readFileSync('large-screen-layout-v1.css', 'utf8');
const filters = readFileSync('library-filter-system-v1.js', 'utf8');
const cards = readFileSync('library-card-system-v1.js', 'utf8');
const appMain = readFileSync('app-main-v1.js', 'utf8');
const tmdbMatch = readFileSync('app-tmdb-match-v1.js', 'utf8');

assert.match(index, /<html[^>]*class="cineverse-app"/);
assert.match(layout, /html\.cineverse-app body\s*\{/);
assert.doesNotMatch(layout, /(^|\n)\s*body\s*\{[^}]*overflow:\s*hidden/s, 'desktop scroll locking must stay scoped to the public app');
assert.match(layout, /#homeView\s*\{[^}]*overflow-y:\s*auto/s, 'home must remain scrollable when its fixed grid cannot fit');
assert.match(filters, /confirm\(`确认覆盖筛选方案/, 'saved filter schemes require overwrite confirmation');
assert.match(cards, /movie-library:state-updated/, 'library deletion must publish a local state update');
assert.match(appMain, /function populateSelect\(/, 'watched filters require their select population helper');
assert.ok(index.indexOf('app-tmdb-match-v1.js') < index.indexOf('app-main-v1.js'), 'TMDb match domain must load before app-main');
assert.match(appMain, /TmdbMatch\.matchMovie\(movie,tmdbSearchByTitle\)/);
assert.doesNotMatch(appMain, /function cleanTmdbTitle\(/, 'TMDb title rules must stay outside app-main');
assert.match(tmdbMatch, /function compactSeasonTargets\(/);
const deleteStart = cards.indexOf('async function confirmDelete()');
const deleteEnd = cards.indexOf("document.addEventListener('click'", deleteStart);
const deleteFlow = cards.slice(deleteStart, deleteEnd);
assert.ok(deleteStart >= 0 && deleteEnd > deleteStart, 'library deletion flow must remain discoverable');
assert.doesNotMatch(deleteFlow, /reloadAfterCloudSync|location\.reload\s*\(/, 'library deletion must not reload the whole application');
assert.match(deleteFlow, /const notified = saveState\(state, 'delete'\)/, 'library deletion must notify through the gateway');

for (const asset of ['app-router-v1.js', 'app-library-model-v1.js']) {
  assert.match(index, new RegExp(`${asset.replaceAll('.', '\\.') }\\?v=20260822-2015`));
}
for (const asset of ['app-state-storage-v1.js', 'content-center-runtime-v1.js']) {
  assert.match(index, new RegExp(`${asset.replaceAll('.', '\\.') }\\?v=20260822-2300`));
}
assert.match(index, /app-tmdb-match-v1\.js\?v=20260822-2400/);
assert.match(index, /app-main-v1\.js\?v=20260822-2400/);

for (const asset of ['radar-20.js', 'radar-experience-v3.js', 'library-card-system-v1.js', 'rating-sync-v3.js', 'watch-record-edit-v1.js', 'cloud-auth-v5.js']) {
  assert.match(readFileSync('content-center-runtime-v1.js', 'utf8'), new RegExp(`${asset.replaceAll('.', '\\.') }\\?v=20260822-2300`));
}

console.log('Regression guard tests passed.');
