const { execFileSync } = require('node:child_process');
const { readdirSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const files = readdirSync(root)
  .filter(file => file.endsWith('.js'))
  .sort();

for (const file of files) {
  execFileSync(process.execPath, ['--check', join(root, file)], { stdio: 'inherit' });
}

console.log(`Syntax checked ${files.length} top-level JavaScript files.`);
