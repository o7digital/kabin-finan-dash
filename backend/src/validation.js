import { randomUUID } from 'node:crypto';

export class ValidationError extends Error {
  constructor(message, fields = {}) {
    super(message);
    this.name = 'ValidationError';
    this.fields = fields;
  }
}
function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function text(value, max = 200) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function number(value, min, max, field) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new ValidationError(`El campo ${field} no es válido.`, { [field]: 'invalid' });
  }
  return parsed;
}

function defaultDocuments(clientType) {
  const business = /moral|empresa/i.test(clientType);
  return [
    { id: 'identification', label: business ? 'Identificación del representante' : 'Identificación oficial', status: 'pending' },
    { id: 'address-proof', label: 'Comprobante de domicilio', status: 'pending' },
    { id: 'tax-status', label: 'Constancia de situación fiscal', status: 'pending' },
    { id: 'business-docs', label: business ? 'Acta constitutiva y poderes' : 'Comprobantes de ingresos', status: 'pending' },
  ];
}

export function validateProposal(input) {
  const body = object(input);
  const customerInput = object(body.customer ?? body.client);
  const vehicleInput = object(body.vehicle);
  const financingInput = object(body.financing);
  const name = text(customerInput.name ?? body.name, 150);
  const email = text(customerInput.email ?? body.email, 250).toLowerCase();
  if (!name) throw new ValidationError('El nombre del cliente es obligatorio.', { name: 'required' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ValidationError('Captura un correo válido para guardar la propuesta.', { email: 'invalid' });
  }

  const basePriceMxn = number(vehicleInput.basePriceMxn, 0, 1_000_000_000, 'basePriceMxn');
  const armorPriceMxn = number(vehicleInput.armorPriceMxn ?? 0, 0, 1_000_000_000, 'armorPriceMxn');
  const amountMxn = number(financingInput.amountMxn, 0, 1_000_000_000, 'amountMxn');
  const now = new Date().toISOString();
  const token = randomUUID().split('-')[0].toUpperCase();

  return {
    id: randomUUID(),
    reference: `KF-DEMO-${token}`,
    status: 'draft',
    fictionalData: true,
    calculationVersion: 'demo-v1',
    createdAt: now,
    updatedAt: now,
    customer: {
      name,
      email,
      phone: text(customerInput.phone ?? body.phone, 40),
      company: text(customerInput.company ?? body.company, 160),
      type: text(customerInput.type ?? body.clientType, 100) || 'Persona física',
    },
    vehicle: {
      id: text(vehicleInput.id ?? body.vehicleId, 120) || 'demo-vehicle',
      crmVehicleId: text(vehicleInput.crmVehicleId, 120) || null,
      brand: text(vehicleInput.brand, 120),
      model: text(vehicleInput.model, 120),
      version: text(vehicleInput.version, 120),
      armorLevel: text(vehicleInput.armorLevel, 100) || null,
      basePriceMxn,
      armorPriceMxn,
    },
    financing: {
      product: ['credit', 'lease'].includes(financingInput.product) ? financingInput.product : 'credit',
      amountMxn,
      financedAmountMxn: number(financingInput.financedAmountMxn ?? amountMxn, 0, 1_000_000_000, 'financedAmountMxn'),
      downPercent: number(financingInput.downPercent, 0, 100, 'downPercent'),
      termMonths: number(financingInput.termMonths, 1, 120, 'termMonths'),
      annualRate: number(financingInput.annualRate, 0, 100, 'annualRate'),
      monthlyPaymentMxn: number(financingInput.monthlyPaymentMxn, 0, 1_000_000_000, 'monthlyPaymentMxn'),
      residualPercent: number(financingInput.residualPercent ?? 0, 0, 100, 'residualPercent'),
    },
    documents: defaultDocuments(customerInput.type ?? body.clientType ?? ''),
  };
}

export function validateDocumentPatch(input) {
  const body = object(input);
  const allowed = ['pending', 'uploaded', 'approved', 'rejected'];
  if (!allowed.includes(body.status)) {
    throw new ValidationError('Estado documental no válido.', { status: 'invalid' });
  }
  return {
    status: body.status,
    fileName: text(body.fileName, 240) || null,
    notes: text(body.notes, 1000) || null,
    updatedAt: new Date().toISOString(),
  };
}
