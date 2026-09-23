import { createServer } from 'node:http';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { JsonProposalStore } from './store.js';

const currentDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(currentDir, '../..');
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '127.0.0.1';
const dataFile = resolve(process.env.DATA_FILE || join(projectRoot, 'backend/data/proposals.json'));
const frontendDir = resolve(process.env.FRONTEND_DIR || join(projectRoot, 'frontend'));
const crmMode = String(process.env.CRM_MODE || 'simulation').toLowerCase();

if (!['simulation', 'simulate', 'mock'].includes(crmMode)) {
  throw new Error('CRM_MODE is locked to simulation in this demo. Live CRM writes are not implemented.');
}

const store = new JsonProposalStore(dataFile);
await store.init();
const server = createServer(createApp({ store, frontendDir }));

server.listen(port, host, () => {
  console.log(`Kabin Financial demo: http://${host}:${port}`);
  console.log(`Persistent demo data: ${dataFile}`);
  console.log('CRM mode: simulation (writes disabled)');
});
