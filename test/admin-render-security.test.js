const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');

const source = readFileSync(join(__dirname, '..', 'admin-data.js'), 'utf8');

test('admin action data attributes escape persisted identifiers', () => {
  for (const expression of [
    'data-feature-up="${escAttr(m.id)}"',
    'data-feature-down="${escAttr(m.id)}"',
    'data-feature-remove="${escAttr(m.id)}"',
    'data-edit-radar="${escAttr(r.id)}"',
    'data-delete-radar="${escAttr(r.id)}"',
    'data-edit-plan="${escAttr(movie.id)}"',
    'data-delete-plan="${escAttr(movie.id)}"',
    'data-plan-month="${escAttr(plan.month)}"',
  ]) {
    assert.ok(source.includes(expression), `Missing escaped attribute: ${expression}`);
  }
});

test('admin plan labels escape persisted month values', () => {
  assert.ok(source.includes('<span>${esc(monthLabel(month))}计划</span>'));
  assert.ok(source.includes('<div class="empty-ops">${esc(monthLabel(month))}暂无符合条件的计划</div>'));
});

test('admin TMDb results escape proxy-provided attributes', () => {
  assert.ok(source.includes('src="${escAttr(tmdbImage(x.poster_path,\'w92\'))}"'));
  assert.ok(source.includes('data-tmdb-use="${escAttr(tmdbId)}"'));
  assert.ok(source.includes("b.dataset.media==='tv'?'tv':'movie'"));
});
