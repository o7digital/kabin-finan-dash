const CRM_APPLICATION_PATH = '/api/kabin/applications';

function nullable(value) {
  return value === undefined || value === '' ? null : value;
}
export function buildCrmPreview(proposal) {
  const customer = proposal.customer ?? proposal.client ?? {};
  const vehicle = proposal.vehicle ?? {};
  const financing = proposal.financing ?? {};
  const localReference = proposal.reference ?? proposal.id ?? 'sin-referencia';
  const armor = vehicle.armorLevel || 'sin blindaje';
  const monthly = Number(financing.monthlyPaymentMxn || 0);
  const payload = {
    name: customer.name,
    email: customer.email,
    phone: nullable(customer.phone),
    company: nullable(customer.company),
    vehicleId: nullable(vehicle.crmVehicleId),
    amountMxn: Number(financing.amountMxn || 0),
    downPercent: Number(financing.downPercent || 0),
    termMonths: Number(financing.termMonths || 0),
    annualRate: Number(financing.annualRate || 0),
    message: `Propuesta local ${localReference}; ${vehicle.brand || ''} ${vehicle.model || ''}; ${armor}; mensualidad ilustrativa ${monthly} MXN.`,
  };

  return {
    mode: 'simulation',
    writeEnabled: false,
    writePerformed: false,
    target: {
      method: 'POST',
      path: CRM_APPLICATION_PATH,
      authentication: 'Bearer JWT tenant-scoped (no configurado en la demo)',
    },
    payload,
    unmapped: [
      'monthlyPaymentMxn',
      'financingProduct',
      'armorSelection',
      'documents',
      'localProposalReference',
      'consent',
      'idempotencyKey',
    ],
    requirements: [
      'Confirmar la semántica de amountMxn (inversión total o monto financiado).',
      'Usar un vehicleId real del catálogo CRM; nunca el identificador local de demo.',
      'Definir autenticación servidor a servidor e idempotencia antes de habilitar escrituras.',
      'Resolver consentimiento y almacenamiento documental fuera del contrato actual.',
    ],
    source: {
      pullRequest: 'https://github.com/o7digital/crm-suites-o7/pull/3',
      inspectedCommit: 'a635302f0e93ecf5f1039fb14088ac99ef8fa479',
    },
  };
}

export function simulateCrmTransfer(proposal) {
  return {
    ...buildCrmPreview(proposal),
    simulation: {
      id: `SIM-${crypto.randomUUID()}`,
      status: 'simulated',
      networkRequestMade: false,
      simulatedAt: new Date().toISOString(),
      message: 'Simulación completada. No se envió información al CRM.',
    },
  };
}
