const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');
const match = source.match(/function safeImageDataUrl\(value\)\{[^\n]+/);
assert.ok(match, 'Missing safeImageDataUrl');
const safeImageDataUrl = vm.runInNewContext(`(${match[0]})`);

test('persisted profile images accept only raster image data URLs', () => {
  const png = 'data:image/png;base64,iVBORw0KGgo=';
  assert.equal(safeImageDataUrl(png), png);
  assert.equal(safeImageDataUrl('data:image/jpeg;base64,/9j/4AAQ'), 'data:image/jpeg;base64,/9j/4AAQ');
  assert.equal(safeImageDataUrl('data:image/svg+xml;base64,PHN2Zz4='), '');
  assert.equal(safeImageDataUrl('javascript:alert(1)'), '');
  assert.equal(safeImageDataUrl('https://example.com/tracker.png'), '');
});

test('settings normalization and uploads enforce the image boundary', () => {
  assert.match(source, /out\.profileAvatarDataUrl=safeImageDataUrl\(out\.profileAvatarDataUrl\)/);
  assert.match(source, /out\.wallpaperDataUrl=safeImageDataUrl\(out\.wallpaperDataUrl\)/);
  assert.match(source, /appState\.settings\.wallpaperDataUrl=safeImageDataUrl\(reader\.result\)/);
});

for (const file of ['ui-theme-system.js', 'ui-theme-seasonal.js']) {
  test(`${file} validates stored wallpaper data independently`, () => {
    const themeSource = readFileSync(join(__dirname, '..', file), 'utf8');
    assert.match(themeSource, /function safeImageDataUrl\(value\)/);
    assert.match(themeSource, /function wallpaper\(\)\{return safeImageDataUrl\(appSettings\(\)\.wallpaperDataUrl\)\}/);
    assert.doesNotMatch(themeSource, /function wallpaper\(\)\{return String\(/);
  });
}
