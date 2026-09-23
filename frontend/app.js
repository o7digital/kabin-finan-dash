(function () {
  'use strict';

  var moneyFormat = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
  var LOCAL_KEY = 'kabinFinancial.proposals.v1';
  var state = { catalogue: [], proposals: [], selectedId: '', api: false, scenario: null, lastFocus: null };
  var demoCatalogue = [
    { id: 'demo-toyota-land-cruiser', brand: 'Toyota', model: 'Land Cruiser', version: 'HE', modelYear: 2026, basePriceMxn: 1850000, armorOptions: [{ id: 'none', label: 'Sin blindaje', level: null, priceMxn: 0 }, { id: 'iii-a', label: 'Blindaje III-A', level: 'III-A', priceMxn: 1150000 }, { id: 'iv', label: 'Blindaje IV', level: 'IV', priceMxn: 1450000 }] },
    { id: 'demo-bmw-x5', brand: 'BMW', model: 'X5', version: 'xDrive40i', modelYear: 2026, basePriceMxn: 1550000, armorOptions: [{ id: 'none', label: 'Sin blindaje', level: null, priceMxn: 0 }, { id: 'iii-a', label: 'Blindaje III-A', level: 'III-A', priceMxn: 920000 }, { id: 'iv', label: 'Blindaje IV', level: 'IV', priceMxn: 1250000 }] },
    { id: 'demo-chevrolet-tahoe', brand: 'Chevrolet', model: 'Tahoe', version: 'High Country', modelYear: 2026, basePriceMxn: 2220000, armorOptions: [{ id: 'none', label: 'Sin blindaje', level: null, priceMxn: 0 }, { id: 'iii-a', label: 'Blindaje III-A', level: 'III-A', priceMxn: 1300000 }, { id: 'iv', label: 'Blindaje IV', level: 'IV', priceMxn: 1450000 }] }
  ];

  function byId(id) { return document.getElementById(id); }
  function money(value) { return moneyFormat.format(Math.round(Number(value) || 0)); }
  function escapeHtml(value) { return String(value == null ? '' : value).replace(/[&<>'"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c]; }); }
  function customerOf(proposal) { return proposal.customer || proposal.client || {}; }
  function vehicleOf(proposal) { return proposal.vehicle || {}; }
  function financingOf(proposal) { return proposal.financing || {}; }
  function localProposals() { try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); } catch (_) { return []; } }
  function writeLocal(items) { localStorage.setItem(LOCAL_KEY, JSON.stringify(items)); }
  function uniqueProposals(items) { var seen = {}; return items.filter(function (item) { if (!item || !item.id || seen[item.id]) return false; seen[item.id] = true; return true; }); }

  async function api(path, options) {
    var response = await fetch(path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, options || {}));
    var body = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(body.message || 'API no disponible');
    return body;
  }

  function setStorageStatus(available, detail) {
    state.api = available;
    var status = byId('storageStatus');
    status.className = 'system-status ' + (available ? 'online' : 'local');
    status.textContent = available ? 'API local · persistencia activa' : 'Modo local · respaldo del navegador';
    byId('storageDetail').textContent = detail || (available ? 'Datos guardados en el backend de demo.' : 'La API no responde; se usa localStorage.');
  }

  function toast(message) {
    var node = byId('toast');
    node.textContent = message;
    node.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { node.classList.remove('show'); }, 2800);
  }

  function go(id) {
    document.querySelectorAll('.view').forEach(function (node) { node.classList.toggle('active', node.id === id); });
    document.querySelectorAll('.nav button').forEach(function (node) { node.classList.toggle('active', node.dataset.target === id); });
    var names = { dashboard: 'Resumen', oportunidades: 'Oportunidades', simulador: 'Simulador', expedientes: 'Expedientes', catalogo: 'Catálogo', crm: 'Conexión CRM' };
    byId('crumb-current').textContent = names[id] || 'Kabin Financial';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function selectedVehicle() {
    return state.catalogue.find(function (vehicle) { return vehicle.id === byId('vehicle').value; }) || state.catalogue[0];
  }

  function selectedArmor(vehicle) {
    return (vehicle && vehicle.armorOptions || []).find(function (option) { return option.id === byId('armor').value || option.level === byId('armor').value; }) || (vehicle && vehicle.armorOptions || [])[0] || { id: 'none', label: 'Sin blindaje', level: null, priceMxn: 0 };
  }

  function renderArmor(preferred) {
    var vehicle = selectedVehicle();
    var select = byId('armor');
    var previous = preferred || select.value;
    select.innerHTML = (vehicle.armorOptions || []).map(function (option) {
      return '<option value="' + escapeHtml(option.id) + '">' + escapeHtml(option.label) + ' · ' + money(option.priceMxn) + ' ficticio</option>';
    }).join('');
    if ([].some.call(select.options, function (option) { return option.value === previous; })) select.value = previous;
    else if ([].some.call(select.options, function (option) { return option.value === 'iii-a'; })) select.value = 'iii-a';
  }

  function updateCalculation() {
    var vehicle = selectedVehicle();
    if (!vehicle) return;
    var armor = selectedArmor(vehicle);
    var scenario = window.KabinCalculator.calculateScenario({
      basePriceMxn: vehicle.basePriceMxn != null ? vehicle.basePriceMxn : vehicle.priceMxn,
      armorPriceMxn: armor.priceMxn,
      downPercent: byId('down').value,
      annualRate: byId('rate').value,
      termMonths: byId('term').value,
      residualPercent: byId('residual').value,
      product: byId('product').value
    });
    state.scenario = scenario;
    var name = [vehicle.brand, vehicle.model, vehicle.version].filter(Boolean).join(' ');
    byId('monthlyPayment').textContent = money(scenario.monthlyPaymentMxn);
    byId('paymentLabel').textContent = scenario.product === 'lease' ? 'Renta guía de demostración' : 'Pago mensual estimado · crédito';
    byId('vehicleNameOut').textContent = name;
    byId('baseOut').textContent = money(scenario.basePriceMxn);
    byId('armorOut').textContent = money(scenario.armorPriceMxn);
    byId('totalOut').textContent = money(scenario.totalPriceMxn);
    byId('downPctOut').textContent = String(scenario.downPercent);
    byId('downOut').textContent = money(scenario.downPaymentMxn);
    byId('financedOut').textContent = money(scenario.amountMxn);
    byId('termOut').textContent = scenario.termMonths + ' meses';
    byId('creditCompare').textContent = money(scenario.creditMonthlyPaymentMxn);
    byId('leaseCompare').textContent = money(scenario.leaseMonthlyPaymentMxn);
    byId('compareCredit').classList.toggle('active', scenario.product === 'credit');
    byId('compareLease').classList.toggle('active', scenario.product === 'lease');
    byId('residualField').style.display = scenario.product === 'lease' ? 'grid' : 'none';
    var target = Number(byId('capacity').value) || 0;
    var within = target > 0 && scenario.monthlyPaymentMxn <= target;
    byId('fitBox').classList.toggle('warning', !within);
    byId('fitTitle').textContent = !target ? 'Define un pago objetivo' : within ? 'Dentro del pago objetivo' : 'Supera el pago objetivo';
    byId('fitText').textContent = target ? 'Diferencia ilustrativa: ' + money(Math.abs(target - scenario.monthlyPaymentMxn)) + '. No representa aprobación.' : 'Comparación indicativa, no representa aprobación.';
  }

  function proposalInput() {
    var vehicle = selectedVehicle();
    var armor = selectedArmor(vehicle);
    var scenario = state.scenario;
    return {
      customer: { name: byId('clientName').value.trim(), email: byId('clientEmail').value.trim(), phone: byId('clientPhone').value.trim(), company: byId('clientCompany').value.trim(), type: byId('clientType').value },
      vehicle: { id: vehicle.id, crmVehicleId: vehicle.crmVehicleId || null, brand: vehicle.brand, model: vehicle.model, version: vehicle.version || '', armorLevel: armor.level || null, basePriceMxn: scenario.basePriceMxn, armorPriceMxn: scenario.armorPriceMxn },
      financing: { product: scenario.product, amountMxn: scenario.totalPriceMxn, financedAmountMxn: scenario.amountMxn, downPercent: scenario.downPercent, termMonths: scenario.termMonths, annualRate: scenario.annualRate, monthlyPaymentMxn: scenario.monthlyPaymentMxn, residualPercent: Number(byId('residual').value) || 0 }
    };
  }

  function localProposal(input) {
    var now = new Date().toISOString();
    return Object.assign({ id: 'local-' + Date.now(), reference: 'KF-LOCAL-' + String(Date.now()).slice(-6), createdAt: now, updatedAt: now, status: 'draft', source: 'local', fictionalData: true, documents: ['identification', 'address-proof', 'tax-status', 'business-docs'].map(function (id) { return { id: id, status: 'pending' }; }) }, input);
  }

  async function saveProposal() {
    updateCalculation();
    var input = proposalInput();
    if (!input.customer.name || !/^\S+@\S+\.\S+$/.test(input.customer.email)) { toast('Captura nombre y correo válido.'); return null; }
    var proposal;
    try {
      proposal = (await api('/api/proposals', { method: 'POST', body: JSON.stringify(input) })).proposal;
      proposal.source = 'api';
      setStorageStatus(true);
    } catch (_) {
      proposal = localProposal(input);
      var local = localProposals(); local.unshift(proposal); writeLocal(local);
      setStorageStatus(false);
    }
    state.proposals = uniqueProposals([proposal].concat(state.proposals));
    state.selectedId = proposal.id;
    renderProposals();
    selectProposal(proposal.id);
    toast('Propuesta ' + proposal.reference + ' guardada.');
    return proposal;
  }

  async function loadProposals() {
    var local = localProposals();
    try {
      var body = await api('/api/proposals');
      state.proposals = uniqueProposals((body.proposals || []).map(function (item) { item.source = 'api'; return item; }).concat(local));
      setStorageStatus(true);
    } catch (_) {
      state.proposals = local;
      setStorageStatus(false);
    }
    renderProposals();
  }

  function proposalRows(items, compact) {
    if (!items.length) return '<tr><td colspan="6"><div class="empty-state"><strong>Aún no hay propuestas</strong><span>Guarda una desde el simulador.</span></div></td></tr>';
    return items.map(function (proposal) {
      var customer = customerOf(proposal), vehicle = vehicleOf(proposal), financing = financingOf(proposal);
      var configuration = [vehicle.brand, vehicle.model, vehicle.armorLevel || 'Sin blindaje'].filter(Boolean).join(' · ');
      if (compact) return '<tr><td><strong>' + escapeHtml(customer.name) + '</strong></td><td>' + escapeHtml(configuration) + '</td><td class="money">' + money(financing.amountMxn) + '</td><td><span class="pill pill-amber">Borrador</span></td><td><button class="btn btn-small" data-open-proposal="' + escapeHtml(proposal.id) + '">Abrir</button></td></tr>';
      return '<tr><td><div class="person-name">' + escapeHtml(customer.name) + '</div><div class="person-company">' + escapeHtml(proposal.reference) + '</div></td><td>' + escapeHtml(configuration) + '</td><td>' + (financing.product === 'lease' ? 'Arrendamiento' : 'Crédito') + '</td><td class="money">' + money(financing.financedAmountMxn || financing.amountMxn) + '</td><td><span class="pill pill-neutral">' + (proposal.source === 'local' || String(proposal.id).indexOf('local-') === 0 ? 'Local' : 'API') + '</span></td><td><button class="btn btn-small" data-open-proposal="' + escapeHtml(proposal.id) + '">Abrir</button></td></tr>';
    }).join('');
  }

  function renderProposals() {
    byId('proposalTableBody').innerHTML = proposalRows(state.proposals, false);
    byId('recentProposalTable').innerHTML = proposalRows(state.proposals.slice(0, 3), true);
    byId('proposalTableCount').textContent = state.proposals.length + ' propuesta' + (state.proposals.length === 1 ? '' : 's');
    byId('opportunityCount').textContent = String(state.proposals.length);
    byId('opportunityNavCount').textContent = String(state.proposals.length);
    byId('caseCount').textContent = String(state.proposals.length);
    byId('pipelineValue').textContent = money(state.proposals.reduce(function (total, proposal) { return total + (Number(financingOf(proposal).amountMxn) || 0); }, 0));
    var incomplete = state.proposals.filter(function (p) { return (p.documents || []).some(function (d) { return !['uploaded', 'approved'].includes(d.status); }); }).length;
    byId('incompleteCount').textContent = incomplete + ' incompleto' + (incomplete === 1 ? '' : 's');
    byId('fileNavCount').textContent = String(incomplete);
    var options = '<option value="">Nueva propuesta</option>' + state.proposals.map(function (p) { return '<option value="' + escapeHtml(p.id) + '">' + escapeHtml(p.reference + ' · ' + customerOf(p).name) + '</option>'; }).join('');
    byId('proposalSelect').innerHTML = options;
    byId('caseProposalSelect').innerHTML = options.replace('Nueva propuesta', 'Seleccionar expediente');
    byId('proposalSelect').value = state.selectedId;
    byId('caseProposalSelect').value = state.selectedId;
  }

  function selectProposal(id) {
    var proposal = state.proposals.find(function (item) { return item.id === id; });
    if (!proposal) return;
    state.selectedId = id;
    var customer = customerOf(proposal), vehicle = vehicleOf(proposal), financing = financingOf(proposal);
    byId('clientName').value = customer.name || '';
    byId('clientEmail').value = customer.email || '';
    byId('clientPhone').value = customer.phone || '';
    byId('clientCompany').value = customer.company || '';
    byId('clientType').value = customer.type || 'Persona física';
    if ([].some.call(byId('vehicle').options, function (option) { return option.value === vehicle.id; })) byId('vehicle').value = vehicle.id;
    renderArmor((vehicle.armorLevel || 'none').toLowerCase());
    byId('product').value = financing.product || 'credit';
    byId('term').value = String(financing.termMonths || 48);
    byId('down').value = financing.downPercent == null ? 25 : financing.downPercent;
    byId('rate').value = financing.annualRate == null ? 17.5 : financing.annualRate;
    byId('residual').value = financing.residualPercent == null ? 20 : financing.residualPercent;
    byId('quoteId').textContent = proposal.reference;
    byId('proposalSelect').value = id;
    byId('caseProposalSelect').value = id;
    updateCalculation();
    renderDocuments(proposal);
  }

  function renderDocuments(proposal) {
    if (!proposal) return;
    var documents = proposal.documents || [];
    var complete = documents.filter(function (doc) { return ['uploaded', 'approved'].includes(doc.status); }).length;
    byId('caseTitle').textContent = proposal.reference + ' · ' + customerOf(proposal).name;
    byId('caseCaption').textContent = [vehicleOf(proposal).brand, vehicleOf(proposal).model, financingOf(proposal).product === 'lease' ? 'Arrendamiento' : 'Crédito'].filter(Boolean).join(' · ');
    byId('caseStatus').textContent = complete === documents.length && documents.length ? 'Listo para revisión' : 'En integración';
    byId('fileCount').textContent = complete + ' de ' + documents.length + ' documentos';
    byId('fileProgress').style.width = (documents.length ? complete / documents.length * 100 : 0) + '%';
    document.querySelectorAll('[data-document-id]').forEach(function (box) {
      var documentState = documents.find(function (doc) { return doc.id === box.dataset.documentId; });
      box.disabled = false;
      box.checked = !!documentState && ['uploaded', 'approved'].includes(documentState.status);
      var label = document.querySelector('[data-document-label="' + box.dataset.documentId + '"]');
      if (label) label.textContent = box.checked ? 'Recibido para revisión' : 'Pendiente de recepción';
    });
  }

  async function updateDocument(box) {
    var proposal = state.proposals.find(function (item) { return item.id === state.selectedId; });
    if (!proposal) { box.checked = false; toast('Selecciona una propuesta guardada.'); return; }
    var status = box.checked ? 'uploaded' : 'pending';
    try {
      if (proposal.source !== 'local' && String(proposal.id).indexOf('local-') !== 0) proposal = (await api('/api/proposals/' + encodeURIComponent(proposal.id) + '/documents/' + encodeURIComponent(box.dataset.documentId), { method: 'PATCH', body: JSON.stringify({ status: status }) })).proposal;
      else {
        var doc = (proposal.documents || []).find(function (item) { return item.id === box.dataset.documentId; });
        if (doc) doc.status = status;
        writeLocal(state.proposals.filter(function (item) { return item.source === 'local' || String(item.id).indexOf('local-') === 0; }));
      }
      var index = state.proposals.findIndex(function (item) { return item.id === proposal.id; });
      state.proposals[index] = proposal;
      renderDocuments(proposal); renderProposals();
    } catch (error) { box.checked = !box.checked; toast(error.message); }
  }

  function renderCatalogue() {
    byId('vehicle').innerHTML = state.catalogue.map(function (vehicle) { return '<option value="' + escapeHtml(vehicle.id) + '">' + escapeHtml([vehicle.brand, vehicle.model, vehicle.version].filter(Boolean).join(' ')) + '</option>'; }).join('');
    byId('catalogGrid').innerHTML = state.catalogue.map(function (vehicle, index) {
      var armor = (vehicle.armorOptions || []).find(function (option) { return option.level; }) || { label: 'Sin blindaje', priceMxn: 0 };
      return '<article class="card vehicle-card"><div class="vehicle-art"><span class="vehicle-tag">SUV premium · demo</span><span class="vehicle-code">' + escapeHtml((vehicle.model || '').slice(0, 2).toUpperCase()) + '</span></div><div class="vehicle-info"><div class="vehicle-make">' + escapeHtml(vehicle.brand + ' · ' + vehicle.modelYear) + '</div><h3>' + escapeHtml(vehicle.model + ' ' + (vehicle.version || '')) + '</h3><div class="vehicle-price"><span>Precio base ficticio</span><strong>' + money(vehicle.basePriceMxn != null ? vehicle.basePriceMxn : vehicle.priceMxn) + '</strong></div><div class="vehicle-price"><span>' + escapeHtml(armor.label) + ' ficticio</span><strong>' + money(armor.priceMxn) + '</strong></div><button class="btn btn-small" style="width:100%;margin-top:12px" data-catalog-index="' + index + '">Configurar este vehículo</button></div></article>';
    }).join('');
    renderArmor('iii-a'); updateCalculation();
  }

  async function loadCatalogue() {
    try { var body = await api('/api/catalogue'); state.catalogue = Array.isArray(body) ? body : body.vehicles; }
    catch (_) { state.catalogue = demoCatalogue; }
    if (!state.catalogue || !state.catalogue.length) state.catalogue = demoCatalogue;
    renderCatalogue();
  }

  function clientPreview(proposal) {
    var customer = customerOf(proposal), vehicle = vehicleOf(proposal), financing = financingOf(proposal);
    return { mode: 'simulation-local', writeEnabled: false, writePerformed: false, target: { method: 'POST', path: '/api/kabin/applications', authentication: 'Bearer JWT tenant-scoped (no configurado)' }, payload: { name: customer.name, email: customer.email, phone: customer.phone || null, company: customer.company || null, vehicleId: vehicle.crmVehicleId || null, amountMxn: financing.amountMxn, downPercent: financing.downPercent, termMonths: financing.termMonths, annualRate: financing.annualRate, message: 'Resumen local de demostración; sin envío.' }, requirements: ['Confirmar amountMxn.', 'Usar un vehicleId del CRM.', 'Añadir idempotencia y consentimiento.'] };
  }

  async function openCrmModal() {
    var proposal = state.proposals.find(function (item) { return item.id === state.selectedId; });
    if (!proposal) proposal = localProposal(proposalInput());
    var preview;
    try { preview = await api('/api/crm/preview', { method: 'POST', body: JSON.stringify(state.selectedId && proposal.source !== 'local' ? { proposalId: proposal.id } : { proposal: proposal }) }); }
    catch (_) { preview = clientPreview(proposal); }
    byId('modalProposal').textContent = proposal.reference || 'Borrador no guardado';
    byId('modalResult').textContent = 'Vista previa lista · 0 escrituras';
    byId('crmPayload').textContent = JSON.stringify(preview.payload, null, 2);
    byId('crmRequirements').innerHTML = (preview.requirements || []).map(function (item) { return '<li>' + escapeHtml(item) + '</li>'; }).join('');
    var modal = byId('crmModal'); state.lastFocus = document.activeElement; modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false'); modal.querySelector('.modal').focus();
  }

  function closeModal() { var modal = byId('crmModal'); modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); if (state.lastFocus) state.lastFocus.focus(); }

  async function simulateCrm() {
    var proposal = state.proposals.find(function (item) { return item.id === state.selectedId; });
    try {
      var result = await api('/api/crm/simulate', { method: 'POST', body: JSON.stringify(proposal && proposal.source !== 'local' ? { proposalId: proposal.id } : { proposal: proposal || localProposal(proposalInput()) }) });
      byId('modalResult').textContent = result.simulation && result.simulation.message || 'Simulación completada · 0 escrituras';
    } catch (_) { byId('modalResult').textContent = 'Simulación local completada · 0 escrituras'; }
    toast('Simulación segura completada. El CRM no fue modificado.');
  }

  document.addEventListener('click', async function (event) {
    var target = event.target.closest('[data-target]'); if (target) go(target.dataset.target);
    var open = event.target.closest('[data-open-proposal]'); if (open) { selectProposal(open.dataset.openProposal); go('simulador'); }
    var catalog = event.target.closest('[data-catalog-index]'); if (catalog) { byId('vehicle').selectedIndex = Number(catalog.dataset.catalogIndex); renderArmor('iii-a'); updateCalculation(); go('simulador'); }
    var action = event.target.closest('[data-action]'); if (!action) return;
    if (action.dataset.action === 'save') await saveProposal();
    if (action.dataset.action === 'crm') await openCrmModal();
    if (action.dataset.action === 'close-modal') closeModal();
    if (action.dataset.action === 'simulate-crm') await simulateCrm();
    if (action.dataset.action === 'open-file') { if (!state.selectedId) { var saved = await saveProposal(); if (!saved) return; } go('expedientes'); renderDocuments(state.proposals.find(function (p) { return p.id === state.selectedId; })); }
    if (action.dataset.action === 'open-selected' && state.selectedId) { selectProposal(state.selectedId); go('simulador'); }
  });

  ['armor', 'product', 'term', 'down', 'rate', 'residual', 'capacity'].forEach(function (id) { byId(id).addEventListener('input', updateCalculation); byId(id).addEventListener('change', updateCalculation); });
  byId('vehicle').addEventListener('change', function () { renderArmor('iii-a'); updateCalculation(); });
  byId('proposalSelect').addEventListener('change', function (event) { if (event.target.value) selectProposal(event.target.value); });
  byId('caseProposalSelect').addEventListener('change', function (event) { if (event.target.value) { selectProposal(event.target.value); renderDocuments(state.proposals.find(function (p) { return p.id === event.target.value; })); } });
  document.querySelectorAll('[data-document-id]').forEach(function (box) { box.addEventListener('change', function () { updateDocument(box); }); });
  byId('opportunitySearch').addEventListener('input', function (event) { var query = event.target.value.toLowerCase(); document.querySelectorAll('#proposalTableBody tr').forEach(function (row) { row.hidden = row.textContent.toLowerCase().indexOf(query) < 0; }); });
  byId('printProposal').addEventListener('click', function () { window.print(); });
  byId('crmModal').addEventListener('click', function (event) { if (event.target === byId('crmModal')) closeModal(); });
  document.addEventListener('keydown', function (event) { if (event.key === 'Escape' && byId('crmModal').classList.contains('open')) closeModal(); });

  Promise.all([loadCatalogue(), loadProposals()]).then(function () { updateCalculation(); });
})();
