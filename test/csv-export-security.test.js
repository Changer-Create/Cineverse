const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');

function loadFunction(name) {
  const match = source.match(new RegExp(`function ${name}\\([^\\n]+`));
  assert.ok(match, `Missing ${name}`);
  return vm.runInNewContext(`(${match[0]})`);
}

test('CSV export neutralizes spreadsheet formulas', () => {
  const csvEscape = loadFunction('csvEscape');
  for (const value of ['=cmd()', '+SUM(1,2)', '-2+3', '@IMPORT']) {
    const encoded = csvEscape(value);
    assert.ok(encoded.startsWith('"\t'), `Unsafe CSV cell: ${encoded}`);
  }
  assert.equal(csvEscape('普通片名'), '普通片名');
});

test('CSV import removes only the formula-neutralization marker', () => {
  const csvCellValue = loadFunction('csvCellValue');
  assert.equal(csvCellValue('\t=cmd()'), '=cmd()');
  assert.equal(csvCellValue('\t普通片名'), '\t普通片名');
  assert.equal(csvCellValue("'=cmd()"), "'=cmd()");
});
