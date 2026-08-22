const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = join(__dirname, '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');

function inlineScripts(source) {
  return [...source.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(match => !/\bsrc\s*=/.test(match[1]))
    .map((match, index) => ({ index, code: match[2] }));
}

test('index inline scripts compile as JavaScript', () => {
  const scripts = inlineScripts(html);
  assert.ok(scripts.length > 0, 'expected at least one inline script');
  for (const script of scripts) {
    try {
      new vm.Script(script.code, { filename: `index.inline-${script.index}.js` });
    } catch (error) {
      throw new Error(`inline script ${script.index} failed to compile:\n${error?.stack || error}`);
    }
  }
});
