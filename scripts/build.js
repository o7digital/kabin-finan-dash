import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await Promise.all([
  cp(resolve(root, 'frontend'), resolve(dist, 'frontend'), { recursive: true }),
  cp(resolve(root, 'backend/src'), resolve(dist, 'backend/src'), { recursive: true }),
]);
console.log('Build ready in dist/.');
