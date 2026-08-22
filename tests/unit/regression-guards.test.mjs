import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const index = readFileSync('index.html', 'utf8');
const layout = readFileSync('large-screen-layout-v1.css', 'utf8');
const filters = readFileSync('library-filter-system-v1.js', 'utf8');
const cards = readFileSync('library-card-system-v1.js', 'utf8');

assert.match(index, /<html[^>]*class="cineverse-app"/);
assert.match(layout, /html\.cineverse-app body\s*\{/);
assert.doesNotMatch(layout, /(^|\n)\s*body\s*\{[^}]*overflow:\s*hidden/s, 'desktop scroll locking must stay scoped to the public app');
assert.match(layout, /#homeView\s*\{[^}]*overflow-y:\s*auto/s, 'home must remain scrollable when its fixed grid cannot fit');
assert.match(filters, /confirm\(`确认覆盖筛选方案/, 'saved filter schemes require overwrite confirmation');
assert.match(cards, /movie-library:state-updated/, 'library deletion must publish a local state update');
const deleteStart = cards.indexOf('async function confirmDelete()');
const deleteEnd = cards.indexOf("document.addEventListener('click'", deleteStart);
const deleteFlow = cards.slice(deleteStart, deleteEnd);
assert.ok(deleteStart >= 0 && deleteEnd > deleteStart, 'library deletion flow must remain discoverable');
assert.doesNotMatch(deleteFlow, /reloadAfterCloudSync|location\.reload\s*\(/, 'library deletion must not reload the whole application');

for (const asset of ['app-router-v1.js', 'app-library-model-v1.js', 'app-main-v1.js', 'content-center-runtime-v1.js']) {
  assert.match(index, new RegExp(`${asset.replaceAll('.', '\\.') }\\?v=20260822-2015`));
}

console.log('Regression guard tests passed.');
