import { spawnSync } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { extname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const directories = ['backend/src', 'backend/test', 'frontend', 'scripts'];
const files = [];

async function collect(directory) {
  try {
    for (const entry of await readdir(resolve(root, directory), { withFileTypes: true })) {
      const relative = `${directory}/${entry.name}`;
      if (entry.isDirectory()) await collect(relative);
      else if (extname(entry.name) === '.js') files.push(relative);
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

for (const directory of directories) await collect(directory);
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log(`Syntax OK (${files.length} JS files).`);
