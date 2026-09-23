import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { demoCatalogue } from './catalogue.js';
import { buildCrmPreview, simulateCrmTransfer } from './crm-adapter.js';
import { ValidationError, validateDocumentPatch, validateProposal } from './validation.js';

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

function json(response, status, body, extraHeaders = {}) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...extraHeaders,
  });
  response.end(JSON.stringify(body));
}
function localCorsHeaders(request) {
  const origin = request.headers.origin;
  if (!origin || !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    Vary: 'Origin',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
  };
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1_000_000) throw new ValidationError('El cuerpo de la solicitud es demasiado grande.');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new ValidationError('El cuerpo debe ser JSON válido.');
  }
}

async function proposalFromBody(store, request) {
  const body = await readJsonBody(request);
  if (body.proposalId) return { proposal: await store.get(String(body.proposalId)), body };
  if (body.proposal && typeof body.proposal === 'object') return { proposal: body.proposal, body };
  return { proposal: null, body };
}

async function serveStatic(response, frontendDir, pathname) {
  if (!frontendDir) return false;
  const root = resolve(frontendDir);
  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  let filePath = resolve(root, normalize(relativePath));
  if (!filePath.startsWith(`${root}/`) && filePath !== root) return false;
  try {
    if (!(await stat(filePath)).isFile()) return false;
  } catch {
    if (!extname(relativePath)) filePath = join(root, 'index.html');
    else return false;
  }
  try {
    const data = await readFile(filePath);
    response.writeHead(200, {
      'Content-Type': MIME_TYPES[extname(filePath)] ?? 'application/octet-stream',
      'Cache-Control': extname(filePath) === '.html' ? 'no-cache' : 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(data);
    return true;
  } catch {
    return false;
  }
}

export function createApp({ store, frontendDir = null }) {
  if (!store) throw new Error('A proposal store is required');

  return async function app(request, response) {
    const cors = localCorsHeaders(request);
    if (request.method === 'OPTIONS') {
      response.writeHead(204, cors);
      response.end();
      return;
    }

    const url = new URL(request.url, 'http://localhost');
    const path = url.pathname;
    try {
      if (request.method === 'GET' && path === '/api/health') {
        json(response, 200, { status: 'ok', persistence: 'json-file', crmMode: 'simulation', crmWriteEnabled: false }, cors);
        return;
      }
      if (request.method === 'GET' && path === '/api/catalogue') {
        json(response, 200, { fictionalData: true, disclaimer: 'Precios ficticios para demostración.', vehicles: demoCatalogue }, cors);
        return;
      }
      if (request.method === 'GET' && path === '/api/proposals') {
        const proposals = (await store.list()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        json(response, 200, { proposals }, cors);
        return;
      }
      if (request.method === 'POST' && path === '/api/proposals') {
        const proposal = await store.create(validateProposal(await readJsonBody(request)));
        json(response, 201, { proposal }, cors);
        return;
      }
      const proposalMatch = path.match(/^\/api\/proposals\/([^/]+)$/);
      if (request.method === 'GET' && proposalMatch) {
        const proposal = await store.get(decodeURIComponent(proposalMatch[1]));
        if (!proposal) json(response, 404, { error: 'proposal_not_found', message: 'Propuesta no encontrada.' }, cors);
        else json(response, 200, { proposal }, cors);
        return;
      }
      const documentMatch = path.match(/^\/api\/proposals\/([^/]+)\/documents\/([^/]+)$/);
      if (request.method === 'PATCH' && documentMatch) {
        const proposal = await store.updateDocument(
          decodeURIComponent(documentMatch[1]),
          decodeURIComponent(documentMatch[2]),
          validateDocumentPatch(await readJsonBody(request)),
        );
        if (!proposal) json(response, 404, { error: 'document_not_found', message: 'Propuesta o documento no encontrado.' }, cors);
        else json(response, 200, { proposal }, cors);
        return;
      }
      if (request.method === 'POST' && ['/api/crm/preview', '/api/crm/simulate'].includes(path)) {
        const { proposal } = await proposalFromBody(store, request);
        if (!proposal) {
          json(response, 404, { error: 'proposal_not_found', message: 'Guarda o selecciona una propuesta antes de simular.' }, cors);
          return;
        }
        const result = path.endsWith('/simulate') ? simulateCrmTransfer(proposal) : buildCrmPreview(proposal);
        json(response, 200, result, cors);
        return;
      }
      if (path.startsWith('/api/')) {
        json(response, 404, { error: 'not_found', message: 'Ruta API no encontrada.' }, cors);
        return;
      }
      if (request.method === 'GET' && await serveStatic(response, frontendDir, path)) return;
      json(response, 404, { error: 'not_found', message: 'Recurso no encontrado.' }, cors);
    } catch (error) {
      if (error instanceof ValidationError) {
        json(response, 400, { error: 'validation_error', message: error.message, fields: error.fields }, cors);
        return;
      }
      console.error(error);
      json(response, 500, { error: 'internal_error', message: 'No fue posible completar la operación.' }, cors);
    }
  };
}
