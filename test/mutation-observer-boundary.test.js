const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');

const root = join(__dirname, '..');
const shieldSource = readFileSync(join(root, 'content-observer-shield.js'), 'utf8');
const observerConsumers = [
  'content-center-core.js',
  'content-schema-extra.js',
  'detail-layout-unified-v1.js',
  'feedback-sidebar-entry-v1.js',
  'home-plan-full-list-v1.js',
  'home-radar-detail-navigation-v1.js',
  'home-random-overview-v2.js',
  'library-card-actions-v2.js',
  'library-card-system-v1.js',
  'nav-order.js',
  'plan-calendar-rich-cards-v1.js',
  'radar-experience-v3.js',
  'site-brand.js',
  'status-model-v3.js',
  'ui-theme-default-backgrounds.js',
  'visual-copy-editor-core.js',
  'watch-history-pagination-v1.js',
  'watch-record-edit-v1.js',
];

test('observer shield does not replace the browser MutationObserver', () => {
  assert.doesNotMatch(shieldSource, /window\.MutationObserver\s*=/);
  assert.match(shieldSource, /MovieMutationObserver/);
});

test('application observers opt into the shield explicitly', () => {
  for (const file of observerConsumers) {
    const source = readFileSync(join(root, file), 'utf8');
    assert.doesNotMatch(source, /new MutationObserver/);
    assert.match(source, /new window\.MovieMutationObserver/);
  }
});
