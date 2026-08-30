import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync('ui-theme-nature-v2.css', 'utf8');

function lastThemeBlock(theme) {
  const blocks = [...css.matchAll(new RegExp(`body\\[data-ui-theme="${theme}"\\]\\s*\\{([^}]*)\\}`, 'g'))];
  assert.ok(blocks.length, `missing ${theme} theme block`);
  return blocks.at(-1)[1];
}
function token(block, name) {
  const match = block.match(new RegExp(`--${name}:([^;]+)`));
  assert.ok(match, `missing --${name}`);
  return match[1].trim();
}
function rgb(value) {
  if (value.startsWith('#')) {
    const hex = value.slice(1);
    return [0, 2, 4].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16));
  }
  return value.split(',').map(Number);
}
function luminance(color) {
  const channels = rgb(color).map(value => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}
function contrast(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

for (const theme of ['snow', 'ocean']) {
  const block = lastThemeBlock(theme);
  const panel = token(block, 'panel-rgb');
  for (const name of ['daylight-heading', 'daylight-muted', 'daylight-accent', 'daylight-gold', 'daylight-success', 'daylight-danger']) {
    assert.ok(
      contrast(token(block, name), panel) >= 4.5,
      `${theme} --${name} must meet WCAG AA against its panel surface`
    );
  }
}

assert.match(css, /\.settings-title h2/);
assert.match(css, /\.theme-preset b/);
assert.match(css, /\.douban-guide-step>b/);
assert.match(css, /\.stats-summary-card\.gold b/);
assert.match(css, /body\[data-ui-theme="ocean"\][\s\S]*\.tmdb-search-row button[\s\S]*color:#3d2608!important/);

assert.match(css, /Runtime-injected library and plan styles load after this stylesheet/);
assert.match(css, /#libraryGrid \.library-score-box\{[\s\S]*background:[^;]+!important/);
assert.match(css, /#libraryGrid \.library-score-box\.public b\{[\s\S]*color:var\(--daylight-accent\)!important/);
assert.match(css, /#libraryGrid \.library-status-display\.watched\{[\s\S]*color:var\(--daylight-success\)!important/);
assert.match(css, /#libraryView :is\([\s\S]*\.library-filter-toggle,[\s\S]*\.filter-mode-btn[\s\S]*color:var\(--daylight-heading\)!important/);
assert.match(css, /#planView \.plan-rich-title\{[\s\S]*color:var\(--daylight-heading\)!important/);
assert.match(css, /#planView :is\([\s\S]*\.plan-rich-director,\.plan-rich-runtime[\s\S]*color:var\(--daylight-muted\)!important/);
assert.match(css, /#planView \.plan-ring::before\{[\s\S]*background:[^;]+!important/);
assert.match(css, /#planView :is\([\s\S]*\.plan-list-row input,[\s\S]*\.plan-empty button[\s\S]*color:var\(--daylight-heading\)!important/);

console.log('Light theme contrast tests passed.');
