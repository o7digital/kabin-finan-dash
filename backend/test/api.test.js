import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';
import { JsonProposalStore } from '../src/store.js';

let baseUrl;
let dataFile;
let server;
let temporaryDirectory;

before(async () => {
  temporaryDirectory = await mkdtemp(join(tmpdir(), 'kabin-financial-test-'));
  dataFile = join(temporaryDirectory, 'proposals.json');
  const store = new JsonProposalStore(dataFile);
  await store.init();
  server = createServer(createApp({ store }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await rm(temporaryDirectory, { recursive: true, force: true });
});

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
  });
  return { status: response.status, body: await response.json() };
}

test('parcours principal: catalogue, sauvegarde, documents et CRM simulé', async () => {
  const catalogue = await request('/api/catalogue');
  assert.equal(catalogue.status, 200);
  assert.equal(catalogue.body.fictionalData, true);
  assert.equal(catalogue.body.vehicles.length, 3);

  const created = await request('/api/proposals', {
    method: 'POST',
    body: JSON.stringify({
      customer: { name: 'Mariana Torres', email: 'mariana@example.test', phone: '+52 55 0000 0000', type: 'Persona física' },
      vehicle: {
        id: 'demo-toyota-land-cruiser', brand: 'Toyota', model: 'Land Cruiser', version: 'HE',
        armorLevel: 'III-A', basePriceMxn: 1850000, armorPriceMxn: 1150000,
      },
      financing: {
        product: 'credit', amountMxn: 3000000, financedAmountMxn: 2250000,
        downPercent: 25, termMonths: 48, annualRate: 17.5, monthlyPaymentMxn: 65478,
      },
    }),
  });
  assert.equal(created.status, 201);
  assert.match(created.body.proposal.reference, /^KF-DEMO-/);
  const id = created.body.proposal.id;

  const updated = await request(`/api/proposals/${id}/documents/identification`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'uploaded', fileName: 'identificacion-demo.pdf' }),
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.proposal.documents[0].status, 'uploaded');

  const preview = await request('/api/crm/preview', { method: 'POST', body: JSON.stringify({ proposalId: id }) });
  assert.equal(preview.status, 200);
  assert.equal(preview.body.target.path, '/api/kabin/applications');
  assert.equal(preview.body.writeEnabled, false);
  assert.equal(preview.body.payload.vehicleId, null);

  const simulation = await request('/api/crm/simulate', { method: 'POST', body: JSON.stringify({ proposalId: id }) });
  assert.equal(simulation.status, 200);
  assert.equal(simulation.body.simulation.networkRequestMade, false);

  const reloadedStore = new JsonProposalStore(dataFile);
  const persisted = await reloadedStore.get(id);
  assert.equal(persisted.customer.name, 'Mariana Torres');
  assert.equal(persisted.documents[0].status, 'uploaded');
});

test('refuse une proposition sans email valide', async () => {
  const result = await request('/api/proposals', {
    method: 'POST',
    body: JSON.stringify({ customer: { name: 'Demo', email: 'invalide' } }),
  });
  assert.equal(result.status, 400);
  assert.equal(result.body.error, 'validation_error');
});
