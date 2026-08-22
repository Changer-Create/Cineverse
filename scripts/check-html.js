const { execFileSync } = require('node:child_process');
const { existsSync, readFileSync } = require('node:fs');
const { dirname, join } = require('node:path');

const root = join(__dirname, '..');
const htmlFiles = execFileSync('git', ['ls-files', '*.html'], { cwd: root, encoding:'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)
  .filter(file => existsSync(join(root, file)));
const failures = [];

for (const file of htmlFiles) {
  const source = readFileSync(join(root, file), 'utf8');
  const ids = new Map();

  for (const match of source.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)) {
    const id = match[1];
    if (!id || /[${}]/.test(id)) continue;
    ids.set(id, (ids.get(id) || 0) + 1);
  }
  for (const [id, count] of ids) {
    if (count > 1) failures.push(`${file}: duplicate static id "${id}" (${count})`);
  }

  for (const match of source.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
    const reference = match[1].trim();
    if (!reference || /[${}]/.test(reference)) continue;
    if (/^(?:[a-z]+:|\/\/|#)/i.test(reference)) continue;
    const relativePath = reference.split(/[?#]/)[0];
    if (!relativePath) continue;
    const absolutePath = join(root, dirname(file), relativePath);
    if (!existsSync(absolutePath)) failures.push(`${file}: missing local resource "${relativePath}"`);
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Checked ${htmlFiles.length} HTML entry files.`);
}
