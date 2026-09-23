import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const EMPTY_STORE = Object.freeze({ version: 1, proposals: [] });

function clone(value) {
  return structuredClone(value);
}
export class JsonProposalStore {
  constructor(filePath) {
    if (!filePath) throw new Error('A data file path is required');
    this.filePath = filePath;
    this.state = null;
    this.queue = Promise.resolve();
  }

  async init() {
    if (this.state) return;
    await mkdir(dirname(this.filePath), { recursive: true });
    try {
      const parsed = JSON.parse(await readFile(this.filePath, 'utf8'));
      if (!parsed || !Array.isArray(parsed.proposals)) throw new Error('Invalid proposal store');
      this.state = { version: 1, proposals: parsed.proposals };
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      this.state = clone(EMPTY_STORE);
      await this.persist();
    }
  }

  async persist() {
    const temporaryPath = `${this.filePath}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(this.state, null, 2)}\n`, 'utf8');
    await rename(temporaryPath, this.filePath);
  }

  async list() {
    await this.init();
    return clone(this.state.proposals);
  }

  async get(id) {
    await this.init();
    const proposal = this.state.proposals.find((item) => item.id === id);
    return proposal ? clone(proposal) : null;
  }

  async mutate(mutator) {
    const operation = this.queue.then(async () => {
      await this.init();
      const result = await mutator(this.state.proposals);
      await this.persist();
      return clone(result);
    });
    this.queue = operation.catch(() => undefined);
    return operation;
  }

  create(proposal) {
    return this.mutate((proposals) => {
      proposals.push(proposal);
      return proposal;
    });
  }

  updateDocument(proposalId, documentId, patch) {
    return this.mutate((proposals) => {
      const proposal = proposals.find((item) => item.id === proposalId);
      if (!proposal) return null;
      const document = proposal.documents.find((item) => item.id === documentId);
      if (!document) return null;
      Object.assign(document, patch);
      proposal.updatedAt = patch.updatedAt;
      const complete = proposal.documents.every((item) => ['uploaded', 'approved'].includes(item.status));
      proposal.status = complete ? 'documents-ready' : 'draft';
      return proposal;
    });
  }
}
