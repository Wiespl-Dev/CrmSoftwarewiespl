'use strict';
// ============================================================
//  WIESPL CRM & OT Quotation Builder - Full Stack Version
//  Backend API Integration (SQLite + JWT)
// ============================================================

// ========== API CONFIGURATION ==========
const API_BASE = 'http://localhost:5000/api';
let authToken = localStorage.getItem('token');
let currentUser = null;

// ========== HELPER: API CALLS ==========
async function apiCall(endpoint, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  if (res.status === 401 || res.status === 403) {
    logout();
    throw new Error('Session expired');
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'API error');
  }
  return res.json();
}

// ========== AUTHENTICATION ==========
async function login(username, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  if (!res.ok) throw new Error('Invalid credentials');
  const data = await res.json();
  authToken = data.token;
  localStorage.setItem('token', data.token);
  currentUser = data.user;
  return data.user;
}

function logout() {
  authToken = null;
  localStorage.removeItem('token');
  currentUser = null;
  document.getElementById('appContainer').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('loginPassword').value = '';
  document.getElementById('loginError').style.display = 'none';
}

async function restoreSession() {
  if (!authToken) return false;
  try {
    const user = await apiCall('/auth/me');
    currentUser = user;
    return true;
  } catch (e) {
    logout();
    return false;
  }
}

// ========== STORAGE HELPERS (now using API) ==========
async function getEnquiries() { return apiCall('/enquiries'); }
async function saveEnquiryToBackend(enq) {
  if (enq.id) return apiCall(`/enquiries/${enq.id}`, { method: 'PUT', body: JSON.stringify(enq) });
  else return apiCall('/enquiries', { method: 'POST', body: JSON.stringify(enq) });
}
async function deleteEnquiryBackend(id) { return apiCall(`/enquiries/${id}`, { method: 'DELETE' }); }

async function getQuotations() { return apiCall('/quotations'); }
async function saveQuotationToBackend(project, ots, hvac) {
  return apiCall('/quotations', { method: 'POST', body: JSON.stringify({ project, ots, hvac }) });
}
async function deleteQuotationBackend(id) { return apiCall(`/quotations/${id}`, { method: 'DELETE' }); }
async function loadQuotationById(id) { return apiCall(`/quotations/${id}`); }

async function getRates() { return apiCall('/rates'); }
async function updateRate(category, itemKey, value) {
  return apiCall(`/rates/${category}/${itemKey}`, { method: 'PUT', body: JSON.stringify({ value }) });
}
async function resetRates() { return apiCall('/rates/reset', { method: 'POST' }); }

async function getDashboardStats() { return apiCall('/dashboard/stats'); }

async function fetchRealWeather(lat, lng) {
  const data = await apiCall(`/weather?lat=${lat}&lng=${lng}`);
  return { outside_temp: data.temperature, outside_humidity: data.humidity };
}

// ========== UTILITIES ==========
function inr(n) { return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 }); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function toast(msg, type = 'success') {
  const z = document.getElementById('toastZone');
  const t = document.createElement('div');
  t.className = 'toast' + (type === 'error' ? ' error' : type === 'warn' ? ' warn' : '');
  const icon = { success: 'fa-check-circle', error: 'fa-times-circle', warn: 'fa-exclamation-triangle' }[type] || 'fa-info-circle';
  t.innerHTML = `<i class="fas ${icon}"></i> ${msg}`;
  z.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}
function confirm_modal(msg) { return window.confirm(msg); }
function badge(stage) {
  const m = { New: 'blue', 'In Progress': 'blue', Quoted: 'orange', Won: 'green', Lost: 'red', 'Follow Up': 'orange' };
  return `<span class="badge badge-${m[stage] || 'gray'}">${stage}</span>`;
}

// ========== ROLE & PAGE DEFINITIONS ==========
const PAGES = {
  dashboard: { label: 'Dashboard', icon: 'fa-chart-pie' },
  enquiries: { label: 'Enquiries', icon: 'fa-pen-to-square' },
  quotation: { label: 'Quotation Builder', icon: 'fa-file-invoice-dollar' },
  rates: { label: 'Rate Management', icon: 'fa-sliders' },
  users: { label: 'User Management', icon: 'fa-users' }
};

// ========== RENDER APP ==========
let activePage = 'dashboard';
function renderApp() {
  const role = { pages: currentUser?.role === 'admin' ? ['dashboard', 'enquiries', 'quotation', 'rates', 'users'] : currentUser?.role === 'sales' ? ['dashboard', 'enquiries', 'quotation'] : ['dashboard', 'enquiries'] };
  const nav = document.getElementById('sidebarNav');
  nav.innerHTML = '';
  const pages = role.pages;
  if (pages.includes('dashboard') || pages.includes('enquiries') || pages.includes('quotation')) {
    nav.insertAdjacentHTML('beforeend', '<div class="nav-section">Main</div>');
  }
  ['dashboard', 'enquiries', 'quotation'].forEach(p => {
    if (!pages.includes(p)) return;
    const pg = PAGES[p];
    nav.insertAdjacentHTML('beforeend', `<div class="nav-item" data-page="${p}"><i class="fas ${pg.icon}"></i><span>${pg.label}</span></div>`);
  });
  if (pages.includes('rates') || pages.includes('users')) {
    nav.insertAdjacentHTML('beforeend', '<div class="nav-section">Admin</div>');
  }
  ['rates', 'users'].forEach(p => {
    if (!pages.includes(p)) return;
    const pg = PAGES[p];
    nav.insertAdjacentHTML('beforeend', `<div class="nav-item" data-page="${p}"><i class="fas ${pg.icon}"></i><span>${pg.label}</span></div>`);
  });
  document.getElementById('userAvatar').textContent = (currentUser?.name || 'U').charAt(0).toUpperCase();
  document.getElementById('userName').textContent = currentUser?.name || '';
  document.getElementById('userRole').textContent = currentUser?.role === 'admin' ? 'Administrator' : currentUser?.role === 'sales' ? 'Sales Executive' : 'Viewer';
  nav.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', () => navigateTo(el.dataset.page));
  });
  if (!pages.includes(activePage)) activePage = pages[0] || 'dashboard';
  navigateTo(activePage);
}

function navigateTo(page) {
  if (!currentUser) return;
  const rolePages = currentUser.role === 'admin' ? ['dashboard', 'enquiries', 'quotation', 'rates', 'users'] : currentUser.role === 'sales' ? ['dashboard', 'enquiries', 'quotation'] : ['dashboard', 'enquiries'];
  if (!rolePages.includes(page)) { toast('Access denied', 'error'); return; }
  activePage = page;
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.page === page));
  document.getElementById('pageTitle').textContent = PAGES[page]?.label || page;
  const renderers = {
    dashboard: renderDashboard,
    enquiries: renderEnquiries,
    quotation: renderQuotation,
    rates: renderRates,
    users: renderUsers
  };
  (renderers[page] || (() => { document.getElementById('mainContent').innerHTML = '<p>Page not found</p>'; }))();
}

// ========== DASHBOARD ==========
async function renderDashboard() {
  const content = document.getElementById('mainContent');
  const actions = document.getElementById('topbarActions');
  actions.innerHTML = '';
  let stats = { total: 0, active: 0, won: 0, totalValue: 0, recent: [] };
  try {
    stats = await getDashboardStats();
  } catch (e) { console.error(e); }
  const recent = stats.recent || [];
  content.innerHTML = `
  <div class="stats-row">
    <div class="stat-card"><div class="stat-icon" style="background:#ebf8ff;color:#2b6cb0"><i class="fas fa-clipboard-list"></i></div><div><div class="stat-val">${stats.total}</div><div class="stat-lbl">Total Enquiries</div></div></div>
    <div class="stat-card"><div class="stat-icon" style="background:#fffaf0;color:#c05621"><i class="fas fa-fire"></i></div><div><div class="stat-val">${stats.active}</div><div class="stat-lbl">Active</div></div></div>
    <div class="stat-card"><div class="stat-icon" style="background:#f0fff4;color:#276749"><i class="fas fa-trophy"></i></div><div><div class="stat-val">${stats.won}</div><div class="stat-lbl">Won</div></div></div>
    <div class="stat-card"><div class="stat-icon" style="background:#f3e8ff;color:#6b21a8"><i class="fas fa-indian-rupee-sign"></i></div><div><div class="stat-val" style="font-size:16px">${inr(stats.totalValue)}</div><div class="stat-lbl">Pipeline Value</div></div></div>
  </div>
  <div class="card">
    <div class="card-header"><h3><i class="fas fa-clock"></i> Recent Enquiries</h3><button class="btn btn-outline btn-sm" onclick="navigateTo('enquiries')">View All</button></div>
    <div class="card-body" style="padding:0">
      <div class="scroll-x">
      <table class="data-table">
        <thead><tr><th>Hospital</th><th>City</th><th>OT Type</th><th>Contact</th><th>Value</th><th>Stage</th></tr></thead>
        <tbody>${recent.length ? recent.map(e => `<tr>
           <td><b>${esc(e.hospital)}</b></td>
           <td>${esc(e.city)}</span></td>
           <td>${esc(e.ot_type)}</span></td>
           <td>${esc(e.contact)}</span></td>
           <td class="mono">${inr(e.estimated_value)}</span></td>
           <td>${badge(e.stage)}</span></td>
          </tr>`).join('') : '<tr><td colspan="6" class="empty-state">No enquiries yet</td></tr>'}</tbody>
      </table>
      </div>
    </div>
  </div>`;
}

// ========== ENQUIRIES ==========
let editingEnqId = null;
async function renderEnquiries() {
  const actions = document.getElementById('topbarActions');
  actions.innerHTML = `<button class="btn btn-primary" onclick="showEnquiryModal()"><i class="fas fa-plus"></i> New Enquiry</button>`;
  await refreshEnquiriesContent();
}
async function refreshEnquiriesContent() {
  const content = document.getElementById('mainContent');
  let enqs = [];
  try { enqs = await getEnquiries(); } catch(e) { console.error(e); }
  content.innerHTML = `
  <div class="card">
    <div class="card-header"><h3><i class="fas fa-list"></i> All Enquiries</h3>
      <div class="flex-row gap-2">
        <input id="enqSearch" class="form-control" style="width:200px" placeholder="Search..." oninput="filterEnquiries()" value="">
        <select id="enqFilter" class="form-control" style="width:140px" onchange="filterEnquiries()">
          <option value="">All Stages</option>
          <option>New</option><option>In Progress</option><option>Follow Up</option><option>Quoted</option><option>Won</option><option>Lost</option>
        </select>
      </div>
    </div>
    <div class="card-body" style="padding:0">
    <div class="scroll-x">
    <table class="data-table" id="enqTable">
      <thead><tr><th>#</th><th>Hospital</th><th>City</th><th>Contact</th><th>OT Type</th><th>OTs</th><th>Value</th><th>Stage</th><th>Date</th><th>Actions</th></tr></thead>
      <tbody id="enqTbody">${renderEnqRows(enqs)}</tbody>
    </table></div></div>
  </div>`;
}
function renderEnqRows(enqs) {
  if (!enqs.length) return '<tr><td colspan="10"><div class="empty-state"><i class="fas fa-inbox"></i>No enquiries found</div></td></tr>';
  return enqs.map((e, i) => `<tr>
    <td>${i+1}</td>
    <td><b>${esc(e.hospital)}</b></td>
    <td>${esc(e.city)}</td>
    <td>${esc(e.contact)}</td>
    <td>${esc(e.ot_type)}</td>
    <td>${e.ot_count || 1}</td>
    <td class="mono">${inr(e.estimated_value)}</td>
    <td>${badge(e.stage)}</td>
    <td style="white-space:nowrap">${e.enquiry_date || ''}</td>
    <td>
      <button class="btn btn-ghost btn-sm" onclick="showEnquiryModal('${e.id}')"><i class="fas fa-edit"></i></button>
      <button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="deleteEnquiry('${e.id}')"><i class="fas fa-trash"></i></button>
    </td>
  </tr>`).join('');
}
async function filterEnquiries() {
  const q = (document.getElementById('enqSearch')?.value || '').toLowerCase();
  const stage = document.getElementById('enqFilter')?.value || '';
  let enqs = await getEnquiries();
  if (q) enqs = enqs.filter(e => (e.hospital + e.city + e.contact + e.ot_type).toLowerCase().includes(q));
  if (stage) enqs = enqs.filter(e => e.stage === stage);
  const tbody = document.getElementById('enqTbody');
  if (tbody) tbody.innerHTML = renderEnqRows(enqs);
}
async function showEnquiryModal(id = null) {
  editingEnqId = id;
  let e = { hospital: '', city: '', state: '', contact: '', phone: '', email: '', ot_type: 'Modular OT', ot_count: 1, estimated_value: 0, stage: 'New', notes: '', enquiry_date: new Date().toISOString().slice(0,10) };
  if (id) {
    const enqs = await getEnquiries();
    const found = enqs.find(x => x.id === id);
    if (found) e = found;
  }
  showModal('enquiryModal', `${id ? 'Edit' : 'New'} Enquiry`, `
  <div class="form-grid" style="grid-template-columns:1fr 1fr">
    <div class="form-group"><label>Hospital / Client Name *</label><input class="form-control" id="eHospital" value="${esc(e.hospital)}"></div>
    <div class="form-group"><label>City</label><input class="form-control" id="eCity" value="${esc(e.city)}"></div>
    <div class="form-group"><label>State</label><input class="form-control" id="eState" value="${esc(e.state || '')}"></div>
    <div class="form-group"><label>Contact Person</label><input class="form-control" id="eContact" value="${esc(e.contact)}"></div>
    <div class="form-group"><label>Phone</label><input class="form-control" id="ePhone" value="${esc(e.phone || '')}"></div>
    <div class="form-group"><label>Email</label><input class="form-control" id="eEmail" type="email" value="${esc(e.email || '')}"></div>
    <div class="form-group"><label>OT Type</label><select class="form-control" id="eOtType">
      ${['Modular OT', 'Cath Lab', 'ICU', 'CSSD', 'Cleanroom', 'Procedure Room', 'Other'].map(t => `<option${t === e.ot_type ? ' selected' : ''}>${t}</option>`).join('')}
    </select></div>
    <div class="form-group"><label>Number of OTs</label><input type="number" class="form-control" id="eOtCount" value="${e.ot_count || 1}" min="1"></div>
    <div class="form-group"><label>Estimated Value (₹)</label><input type="number" class="form-control" id="eValue" value="${e.estimated_value || 0}"></div>
    <div class="form-group"><label>Stage</label><select class="form-control" id="eStage">
      ${['New', 'In Progress', 'Follow Up', 'Quoted', 'Won', 'Lost'].map(s => `<option${s === e.stage ? ' selected' : ''}>${s}</option>`).join('')}
    </select></div>
  </div>
  <div class="form-group"><label>Notes</label><textarea class="form-control" id="eNotes" rows="3">${esc(e.notes || '')}</textarea></div>
  `, async () => await saveEnquiry());
}
async function saveEnquiry() {
  const hospital = document.getElementById('eHospital')?.value.trim();
  if (!hospital) { toast('Hospital name is required', 'error'); return false; }
  const obj = {
    hospital,
    city: document.getElementById('eCity')?.value.trim() || '',
    state: document.getElementById('eState')?.value.trim() || '',
    contact: document.getElementById('eContact')?.value.trim() || '',
    phone: document.getElementById('ePhone')?.value.trim() || '',
    email: document.getElementById('eEmail')?.value.trim() || '',
    ot_type: document.getElementById('eOtType')?.value || 'Modular OT',
    ot_count: parseInt(document.getElementById('eOtCount')?.value) || 1,
    estimated_value: parseFloat(document.getElementById('eValue')?.value) || 0,
    stage: document.getElementById('eStage')?.value || 'New',
    notes: document.getElementById('eNotes')?.value.trim() || '',
    enquiry_date: new Date().toISOString().slice(0,10)
  };
  if (editingEnqId) obj.id = editingEnqId;
  await saveEnquiryToBackend(obj);
  closeModal();
  toast(editingEnqId ? 'Enquiry updated' : 'Enquiry saved');
  await refreshEnquiriesContent();
  return true;
}
async function deleteEnquiry(id) {
  if (!confirm_modal('Delete this enquiry?')) return;
  await deleteEnquiryBackend(id);
  await refreshEnquiriesContent();
  toast('Deleted', 'warn');
}

// ========== QUOTATION BUILDER ==========
let QState = {
  step: 1,
  project: {},
  ots: [],
  currentOTIdx: 0,
  otCounts: { modular: 1, ivf: 0, cathLab: 0, nicu: 0, passage: 0, otherType: '', otherCount: 0 }
};
let mapInstance = null, mapMarker = null;

function initQState() {
  QState = { step: 1, project: {}, ots: [], currentOTIdx: 0, otCounts: { modular: 1, ivf: 0, cathLab: 0, nicu: 0, passage: 0, otherType: '', otherCount: 0 } };
}
function autoQuotNo() { return 'WIESPL-' + Date.now(); }
function addDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10); }

function renderQuotation() {
  const content = document.getElementById('mainContent');
  const actions = document.getElementById('topbarActions');
  actions.innerHTML = `<button class="btn btn-outline btn-sm" onclick="initQState();renderQuotation()"><i class="fas fa-refresh"></i> New Quotation</button>
                       <button class="btn btn-outline btn-sm" onclick="showLoadQuotationModal()"><i class="fas fa-folder-open"></i> Load Quotation</button>`;
  content.innerHTML = `<div id="stepBar" class="step-bar"></div><div id="quotContent"></div>`;
  renderStepBar();
  renderStep();
}
function renderStepBar() {
  const steps = ['Project Info', 'OT Setup', 'Configure OT', 'HVAC & Extras', 'Review & Output'];
  const bar = document.getElementById('stepBar');
  if (!bar) return;
  bar.innerHTML = steps.map((s, i) => {
    const n = i+1;
    const cls = n < QState.step ? 'done' : n === QState.step ? 'active' : '';
    const dot = n < QState.step ? '<i class="fas fa-check"></i>' : n;
    const line = i < steps.length-1 ? '<div class="step-line"></div>' : '';
    return `<div class="step-item ${cls}" onclick="gotoQStep(${n})"><div class="step-dot">${dot}</div><span class="step-label">${s}</span></div>${line}`;
  }).join('');
}
function gotoQStep(n) { if (n > QState.step) return; QState.step = n; renderStepBar(); renderStep(); }
function renderStep() {
  const c = document.getElementById('quotContent');
  if (!c) return;
  const steps = [null, renderQStep1, renderQStep2, renderQStep3, renderQStep4, renderQStep5];
  (steps[QState.step] || function(){})();
}

async function loadEnquiryDropdown() {
  const select = document.getElementById('qEnqLink');
  if (!select) return;
  const enqs = await getEnquiries();
  select.innerHTML = '<option value="">— Select enquiry to auto-fill —</option>' +
    enqs.map(e => `<option value="${e.id}" ${QState.project.enquiryId === e.id ? 'selected' : ''}>${esc(e.hospital)} – ${esc(e.city)} (${e.ot_type})</option>`).join('');
  select.onchange = linkEnquiry;
}

function renderQStep1() {
  const c = document.getElementById('quotContent');
  const p = QState.project;
  c.innerHTML = `
  <div class="qcard">
    <div class="qcard-head"><h4><i class="fas fa-building-columns"></i> Project & Client Information</h4></div>
    <div class="qcard-body">
      <div class="form-section">
        <div class="form-section-title"><i class="fas fa-link"></i> Link Existing Enquiry</div>
        <div class="form-group" style="max-width:400px">
          <select class="form-control" id="qEnqLink">
            <option value="">— Select enquiry to auto-fill —</option>
          </select>
        </div>
      </div>
      <div class="form-section">
        <div class="form-section-title"><i class="fas fa-hospital"></i> Client Details</div>
        <div class="form-grid">
          <div class="form-group"><label>Hospital / Client Name *</label><input class="form-control" id="qHospital" value="${esc(p.hospital||'')}"></div>
          <div class="form-group"><label>Address</label><input class="form-control" id="qAddress" value="${esc(p.address||'')}"></div>
          <div class="form-group"><label>City</label><input class="form-control" id="qCity" value="${esc(p.city||'')}"></div>
          <div class="form-group"><label>State</label><input class="form-control" id="qState" value="${esc(p.state||'')}"></div>
          <div class="form-group"><label>Contact Person</label><input class="form-control" id="qContact" value="${esc(p.contact||'')}"></div>
          <div class="form-group"><label>Phone</label><input class="form-control" id="qPhone" value="${esc(p.phone||'')}"></div>
          <div class="form-group"><label>Email</label><input class="form-control" id="qEmail" value="${esc(p.email||'')}"></div>
        </div>
      </div>
      <div class="form-section">
        <div class="form-section-title"><i class="fas fa-map-marker-alt"></i> Hospital Location (Map)</div>
        <div class="form-group"><div style="display:flex; gap:8px;"><input type="text" id="hospitalAddressSearch" class="form-control" placeholder="e.g., Apollo Hospital, Mumbai" style="flex:1;"><button class="btn btn-primary" onclick="searchAddress()"><i class="fas fa-search"></i> Search</button></div></div>
        <div id="locationMap" style="height:300px; width:100%; margin-bottom:12px; border-radius:8px; border:1px solid var(--border);"></div>
        <div class="form-grid">
          <div class="form-group"><label>Latitude</label><input type="text" id="qLatitude" class="form-control" readonly value="${esc(p.latitude||'')}"></div>
          <div class="form-group"><label>Longitude</label><input type="text" id="qLongitude" class="form-control" readonly value="${esc(p.longitude||'')}"></div>
          <div class="form-group"><label>Elevation (m)</label><input type="text" id="qElevation" class="form-control" value="${esc(p.elevation||'14')}"></div>
          <div class="form-group" style="display:flex; gap:8px; align-items:flex-end;"><button class="btn btn-outline btn-sm" onclick="fetchWeatherData()" style="flex:1"><i class="fas fa-cloud-sun"></i> Fetch Weather</button><button class="btn btn-outline btn-sm" onclick="openInGoogleMaps()" style="flex:1"><i class="fas fa-external-link-alt"></i> Open in Google Maps</button></div>
        </div>
      </div>
      <div class="form-section">
        <div class="form-section-title"><i class="fas fa-layer-group"></i> Nature of Enquiry</div>
        <div class="form-grid">
          <div class="form-group"><label>Modular OT</label><input type="number" class="form-control" id="qModularOT" min="0" value="${QState.otCounts.modular}"></div>
          <div class="form-group"><label>IVF</label><input type="number" class="form-control" id="qIVF" min="0" value="${QState.otCounts.ivf}"></div>
          <div class="form-group"><label>Cath Lab</label><input type="number" class="form-control" id="qCathLab" min="0" value="${QState.otCounts.cathLab}"></div>
          <div class="form-group"><label>NICU/ICU/PIC</label><input type="number" class="form-control" id="qNICU" min="0" value="${QState.otCounts.nicu}"></div>
          <div class="form-group"><label>OT Passage</label><input type="number" class="form-control" id="qOTPassage" min="0" value="${QState.otCounts.passage}"></div>
          <div class="form-group"><label>Other Type</label><input class="form-control" id="qOtherType" value="${esc(QState.otCounts.otherType)}"></div>
        </div>
      </div>
      <div class="form-section">
        <div class="form-section-title"><i class="fas fa-file-invoice"></i> Quotation Details</div>
        <div class="form-grid">
          <div class="form-group"><label>Quotation Number</label><input class="form-control" id="qNumber" value="${esc(p.number||autoQuotNo())}"></div>
          <div class="form-group"><label>Date</label><input class="form-control" type="date" id="qDate" value="${p.date||new Date().toISOString().slice(0,10)}"></div>
          <div class="form-group"><label>Valid Until</label><input class="form-control" type="date" id="qValid" value="${p.validUntil||addDays(30)}"></div>
          <div class="form-group"><label>Transport</label><select class="form-control" id="qTransport"><option value="Local" ${p.transport==='Local'?'selected':''}>Local</option><option value="Regional" ${p.transport==='Regional'?'selected':''}>Regional</option><option value="National" ${p.transport==='National'?'selected':''}>National</option></select></div>
        </div>
      </div>
    </div>
  </div>
  <div class="q-actions"><div></div><div class="q-actions-right"><button class="btn btn-primary btn-lg" onclick="saveQStep1()">Next: OT Setup <i class="fas fa-arrow-right"></i></button></div></div>`;
  setTimeout(() => {
    const lat = QState.project.latitude || '19.0760';
    const lng = QState.project.longitude || '72.8777';
    initLocationMap(lat, lng);
    const searchInput = document.getElementById('hospitalAddressSearch');
    if (searchInput) searchInput.addEventListener('keypress', e => { if (e.key === 'Enter') searchAddress(); });
    loadEnquiryDropdown();
  }, 100);
}

function initLocationMap(lat, lng) {
  if (mapInstance) { mapInstance.remove(); mapInstance = null; }
  const mapDiv = document.getElementById('locationMap');
  if (!mapDiv) return;
  const defaultLat = parseFloat(lat) || 19.0760;
  const defaultLng = parseFloat(lng) || 72.8777;
  mapInstance = L.map('locationMap').setView([defaultLat, defaultLng], 15);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; CartoDB', subdomains: 'abcd', maxZoom: 19 }).addTo(mapInstance);
  const markerIcon = L.divIcon({ html: '<i class="fas fa-map-marker-alt" style="font-size:24px; color:#e74c3c;"></i>', iconSize: [24,24], className: 'custom-marker' });
  mapMarker = L.marker([defaultLat, defaultLng], { draggable: true, icon: markerIcon }).addTo(mapInstance);
  mapMarker.on('dragend', e => { const pos = e.target.getLatLng(); document.getElementById('qLatitude').value = pos.lat.toFixed(6); document.getElementById('qLongitude').value = pos.lng.toFixed(6); QState.project.latitude = pos.lat.toFixed(6); QState.project.longitude = pos.lng.toFixed(6); });
  mapInstance.on('click', e => { mapMarker.setLatLng(e.latlng); document.getElementById('qLatitude').value = e.latlng.lat.toFixed(6); document.getElementById('qLongitude').value = e.latlng.lng.toFixed(6); QState.project.latitude = e.latlng.lat.toFixed(6); QState.project.longitude = e.latlng.lng.toFixed(6); });
  document.getElementById('qLatitude').value = defaultLat.toFixed(6);
  document.getElementById('qLongitude').value = defaultLng.toFixed(6);
  QState.project.latitude = defaultLat.toFixed(6);
  QState.project.longitude = defaultLng.toFixed(6);
}

function searchAddress() {
  const query = document.getElementById('hospitalAddressSearch')?.value.trim();
  if (!query) { toast('Please enter a hospital name or address', 'warn'); return; }
  toast('Searching...', 'info');
  fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`)
    .then(res => res.json())
    .then(data => {
      if (data && data.length) {
        const lat = parseFloat(data[0].lat), lon = parseFloat(data[0].lon);
        if (mapInstance) { mapInstance.setView([lat, lon], 16); mapMarker.setLatLng([lat, lon]); document.getElementById('qLatitude').value = lat.toFixed(6); document.getElementById('qLongitude').value = lon.toFixed(6); QState.project.latitude = lat.toFixed(6); QState.project.longitude = lon.toFixed(6); toast(`Location found`, 'success'); }
      } else toast('Address not found', 'error');
    })
    .catch(() => toast('Search failed', 'error'));
}
function openInGoogleMaps() {
  const lat = document.getElementById('qLatitude')?.value, lng = document.getElementById('qLongitude')?.value;
  if (lat && lng) window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
  else toast('No location selected', 'error');
}
async function fetchWeatherData() {
  const lat = document.getElementById('qLatitude')?.value;
  const lng = document.getElementById('qLongitude')?.value;
  if (!lat || !lng) { toast('Please select location on map first', 'warn'); return; }
  try {
    const weather = await fetchRealWeather(lat, lng);
    document.getElementById('hOutTemp').value = weather.outside_temp;
    document.getElementById('hOutHumid').value = weather.outside_humidity;
    toast(`Weather: ${weather.outside_temp}°C, ${weather.outside_humidity}%`, 'info');
  } catch(e) { toast('Weather fetch failed', 'error'); }
}
function generateOTsFromCounts() {
  const counts = QState.otCounts;
  const list = [];
  const addOT = (type, count) => { for (let i=1; i<=count; i++) list.push({ id: uid(), name: `${type} ${i}`, type: type, configured: false, doors: [] }); };
  addOT('Modular OT', counts.modular);
  addOT('IVF', counts.ivf);
  addOT('Cath Lab', counts.cathLab);
  addOT('NICU/ICU/PIC', counts.nicu);
  addOT('OT Passage', counts.passage);
  if (counts.otherType && counts.otherCount > 0) addOT(counts.otherType, counts.otherCount);
  return list;
}
async function linkEnquiry() {
  const id = document.getElementById('qEnqLink')?.value;
  if (!id) return;
  const enqs = await getEnquiries();
  const e = enqs.find(x => x.id === id);
  if (!e) return;
  ['Hospital','City','State','Contact','Phone','Email'].forEach(k => { const el = document.getElementById('q'+k); if(el) el.value = e[k.toLowerCase()] || ''; });
  QState.project.enquiryId = id;
}
function saveQStep1() {
  const hospital = document.getElementById('qHospital')?.value.trim();
  if (!hospital) { toast('Hospital name is required','error'); return false; }
  QState.otCounts = {
    modular: parseInt(document.getElementById('qModularOT')?.value) || 0,
    ivf: parseInt(document.getElementById('qIVF')?.value) || 0,
    cathLab: parseInt(document.getElementById('qCathLab')?.value) || 0,
    nicu: parseInt(document.getElementById('qNICU')?.value) || 0,
    passage: parseInt(document.getElementById('qOTPassage')?.value) || 0,
    otherType: document.getElementById('qOtherType')?.value.trim() || '',
    otherCount: 0
  };
  QState.ots = generateOTsFromCounts();
  QState.currentOTIdx = 0;
  QState.project = {
    ...QState.project,
    hospital, address: document.getElementById('qAddress')?.value.trim() || '',
    city: document.getElementById('qCity')?.value.trim() || '',
    state: document.getElementById('qState')?.value.trim() || '',
    contact: document.getElementById('qContact')?.value.trim() || '',
    phone: document.getElementById('qPhone')?.value.trim() || '',
    email: document.getElementById('qEmail')?.value.trim() || '',
    longitude: document.getElementById('qLongitude')?.value.trim() || '',
    latitude: document.getElementById('qLatitude')?.value.trim() || '',
    elevation: document.getElementById('qElevation')?.value.trim() || '',
    number: document.getElementById('qNumber')?.value.trim() || autoQuotNo(),
    date: document.getElementById('qDate')?.value || new Date().toISOString().slice(0,10),
    validUntil: document.getElementById('qValid')?.value || addDays(30),
    transport: document.getElementById('qTransport')?.value || 'Local'
  };
  QState.step = 2; renderStepBar(); renderStep();
  return true;
}
function renderQStep2() {
  const c = document.getElementById('quotContent');
  c.innerHTML = `<div class="qcard"><div class="qcard-head"><h4><i class="fas fa-layer-group"></i> Operating Theatre Setup</h4></div><div class="qcard-body"><p style="color:var(--text2);margin-bottom:16px;font-size:13px">Total OTs to configure: ${QState.ots.length}</p><div class="ot-grid" id="otGrid">${renderOTGrid()}</div></div></div><div class="q-actions"><button class="btn btn-outline" onclick="QState.step=1;renderStepBar();renderStep()"><i class="fas fa-arrow-left"></i> Back</button><div class="q-actions-right"><span style="font-size:12px;color:var(--text3);align-self:center">${QState.ots.filter(o=>o.configured).length} of ${QState.ots.length} configured</span><button class="btn btn-primary btn-lg" onclick="proceedToConfig()">Configure OTs <i class="fas fa-arrow-right"></i></button></div></div>`;
}
function renderOTGrid() {
  let html = QState.ots.map((ot,i) => `<div class="ot-card ${QState.currentOTIdx===i?'selected':''} ${ot.configured?'configured':''}" onclick="selectOT(${i})"><div class="ot-card-name">${esc(ot.name)}</div><div class="ot-card-dim">${ot.dimensions?`${ot.dimensions.l}×${ot.dimensions.w}×${ot.dimensions.h} ft`:'Not configured'}</div><div class="ot-card-status">${ot.configured?'<span style="color:var(--green);font-weight:600">✓ Configured</span>':'<span style="color:var(--orange)">Pending</span>'}</div><button class="btn btn-ghost btn-sm" style="margin-top:6px;color:var(--red);padding:2px 6px" onclick="removeOT(event,${i})"><i class="fas fa-times"></i></button></div>`).join('');
  return html;
}
function removeOT(e,i) { e.stopPropagation(); if(!confirm_modal('Remove this OT?')) return; QState.ots.splice(i,1); if(QState.currentOTIdx >= QState.ots.length) QState.currentOTIdx = Math.max(0, QState.ots.length-1); document.getElementById('otGrid').innerHTML = renderOTGrid(); }
function selectOT(i) { QState.currentOTIdx = i; document.getElementById('otGrid').innerHTML = renderOTGrid(); }
function proceedToConfig() { if(!QState.ots.length){ toast('Add at least one OT','error'); return; } QState.currentOTIdx = 0; QState.step = 3; renderStepBar(); renderStep(); }
function renderQStep3() {
  const c = document.getElementById('quotContent');
  const ot = QState.ots[QState.currentOTIdx] || {};
  const d = ot.dimensions || {l:20, w:20, h:10};
  const mat = ot.materials || {};
  const eqp = ot.equipment || {};
  const otConfig = ot.otConfig || 'Full';
  let touchSize = eqp.touchPanelSize || 'None', outsideSize = eqp.outsidePanelSize || 'None';
  c.innerHTML = `<div class="qcard" style="margin-bottom:10px"><div class="qcard-head" style="background:var(--brand);border-radius:var(--radius) var(--radius) 0 0"><h4 style="color:white"><i class="fas fa-hospital"></i> Configuring: <input id="otNameInput" value="${esc(ot.name||'OT-1')}" style="background:transparent;border:none;border-bottom:1px solid rgba(255,255,255,0.4);color:white;font-weight:700;font-size:14px;outline:none;width:140px"> &nbsp; <span style="opacity:.6;font-size:12px">${QState.currentOTIdx+1} of ${QState.ots.length}</span></h4><div style="display:flex;gap:6px">${QState.currentOTIdx>0?`<button class="btn btn-sm" style="background:rgba(255,255,255,0.15);color:white;border:none" onclick="switchOT(-1)">◀ Prev OT</button>`:''}${QState.currentOTIdx<QState.ots.length-1?`<button class="btn btn-sm" style="background:rgba(255,255,255,0.15);color:white;border:none" onclick="switchOT(1)">Next OT ▶</button>`:''}</div></div><div class="qcard-body"><div class="form-section"><div class="form-section-title"><i class="fas fa-ruler-combined"></i> Room Dimensions</div><div class="form-grid"><div class="form-group"><label>Length (ft)</label><input type="number" class="form-control" id="dimL" value="${d.l}" oninput="calcAreas()"></div><div class="form-group"><label>Width (ft)</label><input type="number" class="form-control" id="dimW" value="${d.w}" oninput="calcAreas()"></div><div class="form-group"><label>Finished Height (ft)</label><input type="number" class="form-control" id="dimH" value="${d.h}" oninput="calcAreas()"></div><div class="form-group"><label>Floor Area (sqft)</label><input class="form-control" id="calcFloor" disabled value="${d.l*d.w}"></div><div class="form-group"><label>Wall Area (sqft)</label><input class="form-control" id="calcWall" disabled value="${(2*(d.l+d.w)*d.h).toFixed(0)}"></div><div class="form-group"><label>Coving Length (rft)</label><input class="form-control" id="calcCoving" disabled value="${(2*(d.l+d.w)*1.1).toFixed(1)}"></div></div></div><div class="form-section"><div class="form-section-title"><i class="fas fa-square"></i> Wall & Ceiling Panels</div><div class="form-grid"><div class="form-group"><label>Wall Panel Type</label><select class="form-control" id="wallType">${['PPGL 50mm','PPGL 100mm','SS304 50mm','SS304 100mm','GI 50mm','GI 100mm'].map(t=>`<option ${(mat.wallType||'PPGL 50mm')===t?'selected':''}>${t}</option>`).join('')}</select></div><div class="form-group"><label>Ceiling Type</label><select class="form-control" id="ceilType">${['PPGL 50mm','SS304 50mm','GI 50mm'].map(t=>`<option ${(mat.ceilType||'PPGL 50mm')===t?'selected':''}>${t}</option>`).join('')}</select></div><div class="form-group"><label>Coving Type</label><select class="form-control" id="covingType">${['Aluminum','SS304','PPGL'].map(t=>`<option ${(mat.covingType||'Aluminum')===t?'selected':''}>${t}</option>`).join('')}</select></div></div></div><div class="form-section"><div class="form-section-title"><i class="fas fa-layer-group"></i> Flooring</div><div class="form-grid"><div class="form-group"><label>Flooring Type</label><select class="form-control" id="floorType">${['Epoxy','Vinyl 2mm','Vinyl 3mm','Conductive Vinyl'].map(t=>`<option ${(mat.floorType||'Vinyl 3mm')===t?'selected':''}>${t}</option>`).join('')}</select></div><div class="form-group"><label>Self-Leveling Compound</label><select class="form-control" id="selfLeveling"><option ${(mat.selfLeveling||'Yes')==='Yes'?'selected':''}>Yes</option><option ${mat.selfLeveling==='No'?'selected':''}>No</option></select></div></div></div><div class="form-section"><div class="form-section-title"><i class="fas fa-cog"></i> OT Specifications</div><div class="form-grid"><div class="form-group"><label>OT Configuration</label><select class="form-control" id="otConfigSelect">${['Full','Semi','Basic'].map(t=>`<option ${otConfig===t?'selected':''}>${t}</option>`).join('')}</select></div></div></div><div class="form-section"><div class="form-section-title"><i class="fas fa-building"></i> Location & Logistics</div><div class="form-grid"><div class="form-group"><label>OT Floor</label><select class="form-control" id="otFloor"><option>Basement</option><option>Ground Floor</option><option>1st Floor</option><option>2nd Floor</option><option>3rd Floor</option><option>4th Floor</option><option>5th Floor</option></select></div><div class="form-group"><label>AHU Floor</label><select class="form-control" id="ahuFloor"><option>Basement</option><option>Ground Floor</option><option>1st Floor</option><option>2nd Floor</option><option>3rd Floor</option><option>4th Floor</option><option>5th Floor</option><option>Terrace</option></select></div></div></div><div class="form-section"><div class="form-section-title"><i class="fas fa-door-open"></i> Door Configuration</div><div id="doorsContainer"></div><button type="button" class="btn btn-outline btn-sm" onclick="addDoor()" style="margin-top:8px;"><i class="fas fa-plus"></i> Add Door</button></div><div class="form-section"><div class="form-section-title"><i class="fas fa-plug"></i> Pendants & Equipment</div><div class="form-grid"><div class="form-group"><label>Anaesthesia Pendant</label><select class="form-control" id="anaesthPendant">${['None','Single Arm','Double Arm'].map(t=>`<option ${(eqp.anaesthPendant||'Single Arm')===t?'selected':''}>${t}</option>`).join('')}</select></div><div class="form-group"><label>Surgeon Pendant</label><select class="form-control" id="surgPendant">${['None','Single Arm','Double Arm'].map(t=>`<option ${(eqp.surgPendant||'Single Arm')===t?'selected':''}>${t}</option>`).join('')}</select></div><div class="form-group"><label>Pass Box (qty)</label><input type="number" class="form-control" id="passBox" value="${eqp.passBox||1}" min="0"></div><div class="form-group"><label>Storage Cabinet (qty)</label><input type="number" class="form-control" id="storageCab" value="${eqp.storageCab||2}" min="0"></div></div></div><div class="form-section"><div class="form-section-title"><i class="fas fa-lightbulb"></i> Lighting</div><div class="form-grid"><div class="form-group"><label>LED Peripheral Lights</label><input type="number" class="form-control" id="ledLights" value="${eqp.ledLights||8}" min="0"></div><div class="form-group"><label>X-Ray Viewer</label><select class="form-control" id="xrayViewer">${['None','Single','Twin'].map(t=>`<option ${(eqp.xrayViewer||'Single')===t?'selected':''}>${t}</option>`).join('')}</select></div><div class="form-group"><label>Writing Board</label><input type="number" class="form-control" id="writingBoard" value="${eqp.writingBoard||1}" min="0"></div></div></div><div class="form-section"><div class="form-section-title"><i class="fas fa-display"></i> Smart Controls</div><div class="form-grid"><div class="form-group"><label>HVAC Control Panel IP65</label><select class="form-control" id="hvacPanel"><option ${(eqp.hvacPanel||'Yes')==='Yes'?'selected':''}>Yes</option><option ${eqp.hvacPanel==='No'?'selected':''}>No</option></select></div><div class="form-group"><label>Surgeon Touch Panel</label><select class="form-control" id="touchPanelSize"><option value="None" ${touchSize==='None'?'selected':''}>None</option><option value="10" ${touchSize==='10'?'selected':''}>10"</option><option value="15" ${touchSize==='15'?'selected':''}>15"</option><option value="22" ${touchSize==='22'?'selected':''}>22"</option><option value="32" ${touchSize==='32'?'selected':''}>32"</option><option value="43" ${touchSize==='43'?'selected':''}>43"</option><option value="55" ${touchSize==='55'?'selected':''}>55"</option></select></div><div class="form-group"><label>Outside Panel</label><select class="form-control" id="outsidePanelSize"><option value="None" ${outsideSize==='None'?'selected':''}>None</option><option value="10" ${outsideSize==='10'?'selected':''}>10"</option><option value="15" ${outsideSize==='15'?'selected':''}>15"</option><option value="22" ${outsideSize==='22'?'selected':''}>22"</option><option value="32" ${outsideSize==='32'?'selected':''}>32"</option></select></div><div class="form-group"><label>iSmart Device</label><select class="form-control" id="ismartDev"><option ${(eqp.ismartDev||'Yes')==='Yes'?'selected':''}>Yes</option><option ${eqp.ismartDev==='No'?'selected':''}>No</option></select></div><div class="form-group"><label>SHRM System</label><select class="form-control" id="shrmSys"><option ${(eqp.shrmSys||'Yes')==='Yes'?'selected':''}>Yes</option><option ${eqp.shrmSys==='No'?'selected':''}>No</option></select></div></div></div></div></div><div class="q-actions"><button class="btn btn-outline" onclick="QState.step=2;renderStepBar();renderStep()"><i class="fas fa-arrow-left"></i> Back</button><div class="q-actions-right"><button class="btn btn-outline" onclick="saveOTConfig(false)"><i class="fas fa-save"></i> Save OT Config</button>${QState.currentOTIdx < QState.ots.length-1 ? `<button class="btn btn-primary" onclick="saveOTConfig(true,true)">Save & Next OT <i class="fas fa-arrow-right"></i></button>` : `<button class="btn btn-primary btn-lg" onclick="saveOTConfig(true)">Next: HVAC & Extras <i class="fas fa-arrow-right"></i></button>`}</div></div>`;
  setTimeout(() => {
    const ot = QState.ots[QState.currentOTIdx];
    if (ot) { document.getElementById('otFloor').value = ot.otFloor || 'Ground Floor'; document.getElementById('ahuFloor').value = ot.ahuFloor || 'Ground Floor'; if (!ot.doors) ot.doors = []; renderDoors(); }
  }, 50);
}
function calcAreas() {
  const l = parseFloat(document.getElementById('dimL')?.value) || 0;
  const w = parseFloat(document.getElementById('dimW')?.value) || 0;
  const h = parseFloat(document.getElementById('dimH')?.value) || 0;
  document.getElementById('calcFloor').value = (l*w).toFixed(0);
  document.getElementById('calcWall').value = (2*(l+w)*h).toFixed(0);
  document.getElementById('calcCoving').value = (2*(l+w)*1.1).toFixed(1);
}
function switchOT(dir) { saveOTConfig(false); QState.currentOTIdx += dir; renderStep(); }
function addDoor() { const idx = QState.currentOTIdx; const ot = QState.ots[idx]; if (!ot.doors) ot.doors = []; ot.doors.push({ type:'Sliding', size:'1800×2100', leaf:'Equal Leaf', material:'SS304', visionPanel:'Yes', autoOperator:'No', location:'Main OT Entry' }); renderDoors(); }
function removeDoor(doorIndex) { const idx = QState.currentOTIdx; const ot = QState.ots[idx]; if (ot.doors && ot.doors[doorIndex]) { ot.doors.splice(doorIndex,1); renderDoors(); } }
function updateDoorField(doorIndex, field, value) { const idx = QState.currentOTIdx; const ot = QState.ots[idx]; if (ot.doors && ot.doors[doorIndex]) ot.doors[doorIndex][field] = value; }
function renderDoors() {
  const container = document.getElementById('doorsContainer');
  if (!container) return;
  const idx = QState.currentOTIdx;
  const ot = QState.ots[idx];
  const doors = ot.doors || [];
  if (doors.length === 0) { container.innerHTML = '<div class="empty-state" style="padding:20px;">No doors added. Click "Add Door" to configure.</div>'; return; }
  let html = '';
  doors.forEach((door, i) => { html += `<div class="door-card" style="border:1px solid var(--border); border-radius:8px; padding:12px; margin-bottom:12px; background:#fafbfc;"><div style="display:flex; justify-content:space-between; margin-bottom:8px;"><strong>Door ${i+1}</strong><button type="button" class="btn btn-ghost btn-sm" onclick="removeDoor(${i})" style="color:var(--red)"><i class="fas fa-trash"></i></button></div><div class="form-grid" style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:8px;"><div class="form-group"><label>Type</label><select class="form-control" onchange="updateDoorField(${i}, 'type', this.value)"><option ${door.type === 'Swing' ? 'selected' : ''}>Swing</option><option ${door.type === 'Sliding' ? 'selected' : ''}>Sliding</option></select></div><div class="form-group"><label>Size</label><select class="form-control" onchange="updateDoorField(${i}, 'size', this.value)"><option ${door.size === '1200×2100' ? 'selected' : ''}>1200×2100</option><option ${door.size === '1500×2100' ? 'selected' : ''}>1500×2100</option><option ${door.size === '1800×2100' ? 'selected' : ''}>1800×2100</option><option ${door.size === '2100×2400' ? 'selected' : ''}>2100×2400</option></select></div><div class="form-group"><label>Leaf Pattern</label><select class="form-control" onchange="updateDoorField(${i}, 'leaf', this.value)"><option ${door.leaf === 'Equal Leaf' ? 'selected' : ''}>Equal Leaf</option><option ${door.leaf === 'Unequal Leaf' ? 'selected' : ''}>Unequal Leaf</option></select></div><div class="form-group"><label>Material</label><select class="form-control" onchange="updateDoorField(${i}, 'material', this.value)"><option ${door.material === 'PPGI' ? 'selected' : ''}>PPGI</option><option ${door.material === 'PPGL' ? 'selected' : ''}>PPGL</option><option ${door.material === 'SS304' ? 'selected' : ''}>SS304</option><option ${door.material === 'SS316' ? 'selected' : ''}>SS316</option><option ${door.material === 'GI Powder Coated' ? 'selected' : ''}>GI Powder Coated</option></select></div><div class="form-group"><label>Vision Panel</label><select class="form-control" onchange="updateDoorField(${i}, 'visionPanel', this.value)"><option ${door.visionPanel === 'Yes' ? 'selected' : ''}>Yes</option><option ${door.visionPanel === 'No' ? 'selected' : ''}>No</option></select></div><div class="form-group"><label>Auto Operator</label><select class="form-control" onchange="updateDoorField(${i}, 'autoOperator', this.value)"><option ${door.autoOperator === 'Yes' ? 'selected' : ''}>Yes</option><option ${door.autoOperator === 'No' ? 'selected' : ''}>No</option></select></div><div class="form-group"><label>Location</label><select class="form-control" onchange="updateDoorField(${i}, 'location', this.value)"><option ${door.location === 'Main OT Entry' ? 'selected' : ''}>Main OT Entry</option><option ${door.location === 'Scrub Area' ? 'selected' : ''}>Scrub Area</option><option ${door.location === 'Clean Corridor' ? 'selected' : ''}>Clean Corridor</option><option ${door.location === 'Dirty Corridor' ? 'selected' : ''}>Dirty Corridor</option><option ${door.location === 'Recovery Room' ? 'selected' : ''}>Recovery Room</option><option ${door.location === 'Passage' ? 'selected' : ''}>Passage</option></select></div></div></div>`; });
  container.innerHTML = html;
}
function saveOTConfig(proceed=false, nextOT=false) {
  const i = QState.currentOTIdx;
  const l = parseFloat(document.getElementById('dimL')?.value) || 20;
  const w = parseFloat(document.getElementById('dimW')?.value) || 20;
  const h = parseFloat(document.getElementById('dimH')?.value) || 10;
  QState.ots[i] = {
    ...QState.ots[i],
    name: document.getElementById('otNameInput')?.value || `OT-${i+1}`,
    dimensions: {l,w,h},
    materials: {
      wallType: document.getElementById('wallType')?.value || 'PPGL 50mm',
      ceilType: document.getElementById('ceilType')?.value || 'PPGL 50mm',
      covingType: document.getElementById('covingType')?.value || 'Aluminum',
      selfLeveling: document.getElementById('selfLeveling')?.value || 'Yes',
      floorType: document.getElementById('floorType')?.value || 'Vinyl 3mm'
    },
    equipment: {
      anaesthPendant: document.getElementById('anaesthPendant')?.value || 'Single Arm',
      surgPendant: document.getElementById('surgPendant')?.value || 'Single Arm',
      passBox: parseInt(document.getElementById('passBox')?.value) || 0,
      storageCab: parseInt(document.getElementById('storageCab')?.value) || 0,
      ledLights: parseInt(document.getElementById('ledLights')?.value) || 0,
      xrayViewer: document.getElementById('xrayViewer')?.value || 'None',
      writingBoard: parseInt(document.getElementById('writingBoard')?.value) || 0,
      hvacPanel: document.getElementById('hvacPanel')?.value || 'Yes',
      touchPanelSize: document.getElementById('touchPanelSize')?.value || 'None',
      outsidePanelSize: document.getElementById('outsidePanelSize')?.value || 'None',
      ismartDev: document.getElementById('ismartDev')?.value || 'No',
      shrmSys: document.getElementById('shrmSys')?.value || 'No'
    },
    otFloor: document.getElementById('otFloor')?.value || 'Ground Floor',
    ahuFloor: document.getElementById('ahuFloor')?.value || 'Ground Floor',
    doors: QState.ots[i].doors || [],
    otConfig: document.getElementById('otConfigSelect')?.value || 'Full',
    configured: true
  };
  toast('OT config saved');
  if(proceed){
    if(nextOT){ QState.currentOTIdx++; renderStep(); }
    else { QState.step = 4; renderStepBar(); renderStep(); }
  }
}
function renderQStep4() {
  const c = document.getElementById('quotContent');
  const hvac = QState.project.hvac || {};
  c.innerHTML = `<div class="qcard"><div class="qcard-head"><h4><i class="fas fa-wind"></i> Heat Load & HVAC Configuration</h4></div><div class="qcard-body"><div class="form-section"><div class="form-section-title"><i class="fas fa-thermometer-half"></i> Ambient Conditions</div><div class="form-grid"><div class="form-group"><label>Outside Temp (°C)</label><input type="number" class="form-control" id="hOutTemp" value="${hvac.outTemp||35}"></div><div class="form-group"><label>Outside Humidity (%)</label><input type="number" class="form-control" id="hOutHumid" value="${hvac.outHumid||60}"></div><div class="form-group"><label>Inside Temp (°C)</label><input type="number" class="form-control" id="hInTemp" value="${hvac.inTemp||21}"></div><div class="form-group"><label>Inside Humidity (%)</label><input type="number" class="form-control" id="hInHumid" value="${hvac.inHumid||50}"></div></div></div><div class="form-section"><div class="form-section-title"><i class="fas fa-fire"></i> Internal Heat Loads</div><div class="form-grid"><div class="form-group"><label>No. of Persons</label><input type="number" class="form-control" id="hPersons" value="${hvac.persons||6}"></div><div class="form-group"><label>Equipment Load (kW)</label><input type="number" class="form-control" id="hEquipKW" value="${hvac.equipKW||2}" step="0.1"></div><div class="form-group"><label>Lighting Load (W/sqft)</label><input type="number" class="form-control" id="hLightLoad" value="${hvac.lightLoad||0.3}" step="0.1"></div><div class="form-group"><label>Calculated Load (TR)</label><input class="form-control mono" id="hCalcTR" disabled></div><div class="form-group"><label>Design TR (override)</label><input type="number" class="form-control" id="hDesignTR" value="${hvac.designTR||''}" step="0.5"></div></div><button class="btn btn-primary btn-sm" onclick="calcTR()" style="margin-top:4px"><i class="fas fa-calculator"></i> Recalculate TR</button></div><div class="form-section"><div class="form-section-title"><i class="fas fa-snowflake"></i> HVAC System</div><div class="form-grid"><div class="form-group"><label>HEPA Position</label><select class="form-control" id="hHEPA"><option ${(hvac.hepa||'Terminal')==='Terminal'?'selected':''}>Terminal</option><option ${hvac.hepa==='In AHU'?'selected':''}>In AHU</option></select></div><div class="form-group"><label>Plenum Type</label><select class="form-control" id="hPlenum">${['LAF 10×10','LAF 8×6','LAF 6×6','No LAF'].map(t=>`<option ${(hvac.plenum||'LAF 10×10')===t?'selected':''}>${t}</option>`).join('')}</select></div><div class="form-group"><label>CFM Value</label><input type="number" class="form-control" id="hCFM" value="${hvac.cfm||''}" oninput="calcACH()"></div><div class="form-group"><label>ACH (auto)</label><input class="form-control mono" id="hACH" disabled></div></div></div><div class="form-section"><div class="form-section-title"><i class="fas fa-screwdriver-wrench"></i> Ducting & AHU</div><div class="form-grid"><div class="form-group"><label>Ducting Type</label><select class="form-control" id="hDuctType">${['Aluminum','GI','SS','PI'].map(t=>`<option ${(hvac.ductType||'Aluminum')===t?'selected':''}>${t}</option>`).join('')}</select></div><div class="form-group"><label>Ducting Area (sqft)</label><input type="number" class="form-control" id="hDuctArea" value="${hvac.ductArea||1500}"></div><div class="form-group"><label>AHU Skin Thickness</label><select class="form-control" id="hAHUSkin"><option ${(hvac.ahuSkin||'25mm')==='25mm'?'selected':''}>25mm</option><option ${hvac.ahuSkin==='45mm'?'selected':''}>45mm</option></select></div><div class="form-group"><label>Static Pressure (mm WG)</label><input type="text" class="form-control" id="hStaticPressure" value="${hvac.staticPressure||'100'}"></div><div class="form-group"><label>Motor Type</label><select class="form-control" id="hMotorType">${['Standard','IE2','IE3','IE4'].map(t=>`<option ${(hvac.motorType||'IE3')===t?'selected':''}>${t}</option>`).join('')}</select></div><div class="form-group"><label>Fire Damper</label><select class="form-control" id="hFireDamper"><option ${(hvac.fireDamper||'Yes')==='Yes'?'selected':''}>Yes</option><option ${hvac.fireDamper==='No'?'selected':''}>No</option></select></div></div></div><div class="form-section"><div class="form-section-title"><i class="fas fa-check-double"></i> Validation Tests</div><div class="form-grid"><div class="form-group"><label>Particle Count Test</label><select class="form-control" id="hPartTest"><option ${(hvac.partTest||'Yes')==='Yes'?'selected':''}>Yes</option><option ${hvac.partTest==='No'?'selected':''}>No</option></select></div><div class="form-group"><label>Airflow Test</label><select class="form-control" id="hAirTest"><option ${(hvac.airTest||'Yes')==='Yes'?'selected':''}>Yes</option><option ${hvac.airTest==='No'?'selected':''}>No</option></select></div><div class="form-group"><label>DOP Integrity Test</label><select class="form-control" id="hDopTest"><option ${(hvac.dopTest||'Yes')==='Yes'?'selected':''}>Yes</option><option ${hvac.dopTest==='No'?'selected':''}>No</option></select></div></div></div></div></div><div class="q-actions"><button class="btn btn-outline" onclick="QState.step=3;renderStepBar();renderStep()"><i class="fas fa-arrow-left"></i> Back</button><div class="q-actions-right"><button class="btn btn-primary btn-lg" onclick="saveQStep4()">Next: Review & Output <i class="fas fa-arrow-right"></i></button></div></div>`;
  calcACH(); calcTR();
}
function calcTR() {
  const ot = QState.ots[QState.currentOTIdx] || {};
  const d = ot.dimensions || {l:20,w:20,h:10};
  const floor = d.l*d.w; const wall = 2*(d.l+d.w)*d.h; const volume = d.l*d.w*d.h;
  const persons = parseFloat(document.getElementById('hPersons')?.value)||6;
  const equipKW = parseFloat(document.getElementById('hEquipKW')?.value)||2;
  const lightLoad = parseFloat(document.getElementById('hLightLoad')?.value)||0.3;
  const personKW = persons*0.1;
  const lightKW = (lightLoad*floor)/1000;
  const envelopeKW = wall*0.02+floor*0.015;
  const freshAirKW = (volume*5/60)*0.0018;
  const totalKW = personKW+lightKW+equipKW+envelopeKW+freshAirKW;
  const tr = (totalKW/3.517*1.15).toFixed(1);
  const el = document.getElementById('hCalcTR');
  if(el) el.value=tr;
  const des = document.getElementById('hDesignTR');
  if(des && !des._edited) des.value=tr;
}
function calcACH() {
  const ot = QState.ots[QState.currentOTIdx] || {};
  const d = ot.dimensions || {l:20,w:20,h:10};
  const volume = d.l*d.w*d.h;
  const cfm = parseFloat(document.getElementById('hCFM')?.value)||3000;
  const ach = Math.round((cfm*60)/volume);
  const el = document.getElementById('hACH');
  if(el) el.value=ach;
}
function saveQStep4() {
  QState.project.hvac = {
    outTemp: parseFloat(document.getElementById('hOutTemp')?.value) || 35,
    outHumid: parseFloat(document.getElementById('hOutHumid')?.value) || 60,
    inTemp: parseFloat(document.getElementById('hInTemp')?.value) || 21,
    inHumid: parseFloat(document.getElementById('hInHumid')?.value) || 50,
    persons: parseInt(document.getElementById('hPersons')?.value) || 6,
    equipKW: parseFloat(document.getElementById('hEquipKW')?.value) || 2,
    lightLoad: parseFloat(document.getElementById('hLightLoad')?.value) || 0.3,
    designTR: parseFloat(document.getElementById('hDesignTR')?.value) || 0,
    cfm: parseInt(document.getElementById('hCFM')?.value) || 3000,
    hepa: document.getElementById('hHEPA')?.value || 'Terminal',
    plenum: document.getElementById('hPlenum')?.value || 'LAF 10×10',
    ductType: document.getElementById('hDuctType')?.value || 'Aluminum',
    ductArea: parseInt(document.getElementById('hDuctArea')?.value) || 1500,
    ahuSkin: document.getElementById('hAHUSkin')?.value || '25mm',
    staticPressure: document.getElementById('hStaticPressure')?.value || '100',
    motorType: document.getElementById('hMotorType')?.value || 'IE3',
    fireDamper: document.getElementById('hFireDamper')?.value || 'Yes',
    partTest: document.getElementById('hPartTest')?.value || 'Yes',
    airTest: document.getElementById('hAirTest')?.value || 'Yes',
    dopTest: document.getElementById('hDopTest')?.value || 'Yes'
  };
  QState.step = 5; renderStepBar(); renderStep();
}
function computeBOQ() {
  if (!window.__rates) {
    // rates not loaded yet – return empty but don't crash
    return { allLines: [], hvacLines: [], otTotals: [], otBasic:0, hvacTotal:0, transport:0, subtotal:0, gst:0, grand:0, gstPct:18, trans:'Local', otTech:[], totalTR:0, totalCFM:0, totalArea:0 };
  }
  const r = (cat,id) => { const items = window.__rates[cat] || []; const item = items.find(x=>x.id===id); return item ? item.value : 0; };
  const gstPct = getChargeVal('gst_pct')||18;
  const hvac = QState.project.hvac || {};
  const trans = QState.project.transport || 'Local';
  const transKey = {Local:'transport_local', Regional:'transport_regional', National:'transport_national'}[trans] || 'transport_local';
  let allLines = [], otTotals = [], otTech = [];
  QState.ots.forEach(ot => {
    if(!ot.configured) return;
    const d = ot.dimensions || {l:20,w:20,h:10};
    const mat = ot.materials || {};
    const eqp = ot.equipment || {};
    const floor = d.l*d.w;
    const wall = 2*(d.l+d.w)*d.h;
    const coving = 2*(d.l+d.w)*1.1;
    const lines = [];
    const wallKey = { 'PPGL 50mm':'ppgl_50mm','PPGL 100mm':'ppgl_100mm','SS304 50mm':'ss304_50mm','SS304 100mm':'ss304_100mm','GI 50mm':'gi_50mm','GI 100mm':'gi_100mm' }[mat.wallType||'PPGL 50mm'] || 'ppgl_50mm';
    const wallRate = r('panel',wallKey);
    lines.push({desc:`Wall Panels – ${mat.wallType||'PPGL 50mm'}`, qty:wall.toFixed(1), unit:'Sqft', rate:wallRate, amount:wall*wallRate});
    const ceilKey = { 'PPGL 50mm':'ppgl_50mm','SS304 50mm':'ss304_50mm','GI 50mm':'gi_50mm' }[mat.ceilType||'PPGL 50mm'] || 'ppgl_50mm';
    const ceilRate = r('ceiling',ceilKey);
    lines.push({desc:`Ceiling Panels – ${mat.ceilType||'PPGL 50mm'}`, qty:floor.toFixed(1), unit:'Sqft', rate:ceilRate, amount:floor*ceilRate});
    const covKey = { 'Aluminum':'aluminum','SS304':'ss304','PPGL':'ppgl' }[mat.covingType||'Aluminum'] || 'aluminum';
    const covRate = r('coving',covKey);
    lines.push({desc:`Coving – ${mat.covingType||'Aluminum'}`, qty:coving.toFixed(1), unit:'Rft', rate:covRate, amount:coving*covRate});
    const floorKey = { 'Epoxy':'epoxy','Vinyl 2mm':'vinyl_2mm','Vinyl 3mm':'vinyl_3mm','Conductive Vinyl':'conductive_vinyl' }[mat.floorType||'Vinyl 3mm'] || 'vinyl_3mm';
    const floorRate = r('flooring',floorKey);
    lines.push({desc:`Flooring – ${mat.floorType||'Vinyl 3mm'}`, qty:floor.toFixed(1), unit:'Sqft', rate:floorRate, amount:floor*floorRate});
    if(mat.selfLeveling==='Yes') lines.push({desc:'Self Leveling Compound', qty:floor.toFixed(1), unit:'Sqft', rate:r('flooring','self_leveling'), amount:floor*r('flooring','self_leveling')});
    if (ot.doors && ot.doors.length) {
      ot.doors.forEach(door => {
        let rateId = '';
        if (door.type === 'Sliding') { if (door.size === '1200×2100') rateId = 'sliding_1200x2100'; else rateId = 'sliding_1800x2100'; }
        else { rateId = 'swing_1200x2100'; }
        let baseRate = r('door', rateId);
        let extraCost = 0;
        if (door.autoOperator === 'Yes') extraCost += 45000;
        if (door.visionPanel === 'Yes') extraCost += 12000;
        if (door.material === 'SS316') extraCost += baseRate * 0.3;
        else if (door.material === 'SS304') extraCost += baseRate * 0.15;
        const totalDoorCost = baseRate + extraCost;
        lines.push({ desc: `Door (${door.type}, ${door.size}, ${door.leaf}, ${door.material}, ${door.location})`, qty: 1, unit: 'Nos', rate: totalDoorCost, amount: totalDoorCost });
      });
    }
    if(eqp.anaesthPendant && eqp.anaesthPendant!=='None'){ const ak = eqp.anaesthPendant==='Double Arm' ? 'anaesthesia_double' : 'anaesthesia_single'; lines.push({desc:`Anaesthesia Pendant – ${eqp.anaesthPendant}`, qty:1, unit:'Nos', rate:r('pendant',ak), amount:r('pendant',ak)}); }
    if(eqp.surgPendant && eqp.surgPendant!=='None'){ const sk = eqp.surgPendant==='Double Arm' ? 'surgeon_double' : 'surgeon_single'; lines.push({desc:`Surgeon Pendant – ${eqp.surgPendant}`, qty:1, unit:'Nos', rate:r('pendant',sk), amount:r('pendant',sk)}); }
    if(eqp.passBox>0) lines.push({desc:'Pass Box', qty:eqp.passBox, unit:'Nos', rate:r('equipment','pass_box'), amount:eqp.passBox*r('equipment','pass_box')});
    if(eqp.storageCab>0) lines.push({desc:'Storage Cabinet SS', qty:eqp.storageCab, unit:'Nos', rate:r('equipment','storage_cabinet'), amount:eqp.storageCab*r('equipment','storage_cabinet')});
    if(eqp.ledLights>0) lines.push({desc:'LED Panel Light 2×2 36W', qty:eqp.ledLights, unit:'Nos', rate:r('lighting','led_2x2_36w'), amount:eqp.ledLights*r('lighting','led_2x2_36w')});
    if(eqp.xrayViewer && eqp.xrayViewer!=='None'){ const xk = eqp.xrayViewer==='Twin' ? 'xray_twin' : 'xray_single'; lines.push({desc:`X-Ray Viewer – ${eqp.xrayViewer}`, qty:1, unit:'Nos', rate:r('lighting',xk), amount:r('lighting',xk)}); }
    if(eqp.writingBoard>0) lines.push({desc:'Magnetic Writing Board', qty:eqp.writingBoard, unit:'Nos', rate:r('equipment','writing_board'), amount:eqp.writingBoard*r('equipment','writing_board')});
    if(eqp.hvacPanel==='Yes') lines.push({desc:'HVAC Control Panel IP65', qty:1, unit:'Nos', rate:r('controls','hvac_panel'), amount:r('controls','hvac_panel')});
    if(eqp.touchPanelSize && eqp.touchPanelSize !== 'None') { const touchId = `touch_${eqp.touchPanelSize}`; const touchRate = r('controls', touchId); if(touchRate) lines.push({desc:`Surgeon Touch Panel ${eqp.touchPanelSize}"`, qty:1, unit:'Nos', rate:touchRate, amount:touchRate}); }
    if(eqp.outsidePanelSize && eqp.outsidePanelSize !== 'None') { const outsideId = `outside_${eqp.outsidePanelSize}`; const outsideRate = r('controls', outsideId); if(outsideRate) lines.push({desc:`Outside Panel ${eqp.outsidePanelSize}"`, qty:1, unit:'Nos', rate:outsideRate, amount:outsideRate}); }
    if(eqp.ismartDev==='Yes') lines.push({desc:'iSmart Device', qty:1, unit:'Nos', rate:r('controls','ismart'), amount:r('controls','ismart')});
    if(eqp.shrmSys==='Yes') lines.push({desc:'SHRM System', qty:1, unit:'Nos', rate:r('controls','shrm'), amount:r('controls','shrm')});
    const laborRate = r('charges','labor_panel') || 180;
    lines.push({desc:'Panel Installation Labour', qty:(wall+floor).toFixed(1), unit:'Sqft', rate:laborRate, amount:(wall+floor)*laborRate, isLabour:true});
    lines.push({desc:'Electrical Works', qty:1, unit:'LS', rate:r('charges','electrical')||25000, amount:r('charges','electrical')||25000, isLabour:true});
    const otTotal = lines.reduce((s,l)=>s+l.amount,0);
    allLines.push({otName:ot.name, lines});
    otTotals.push(otTotal);
    const volume = d.l*d.w*d.h;
    const tr = (()=>{ const p=parseInt(QState.project.hvac?.persons)||6; const eq=parseFloat(QState.project.hvac?.equipKW)||2; const lt=parseFloat(QState.project.hvac?.lightLoad)||0.3; const personKW=p*0.1; const lightKW=(lt*floor)/1000; const envelopeKW=wall*0.02+floor*0.015; const freshAirKW=(volume*5/60)*0.0018; const totalKW=personKW+lightKW+eq+envelopeKW+freshAirKW; return (totalKW/3.517*1.15).toFixed(1); })();
    const cfm = QState.project.hvac?.cfm || Math.round((volume*25)/60);
    otTech.push({name:ot.name, type:ot.type, config:ot.otConfig, dimensions:`${d.l}'×${d.w}'×${d.h}'`, cfm:cfm, cost:otTotal, tr:tr});
  });
  const hvacLines = [];
  const trDesign = hvac.designTR || 5;
  hvacLines.push({desc:'AHU (per TR)', qty:trDesign, unit:'TR', rate:r('hvac','ahu_per_tr'), amount:trDesign*r('hvac','ahu_per_tr')});
  hvacLines.push({desc:'Outdoor Unit (ODU) (per TR)', qty:trDesign, unit:'TR', rate:r('hvac','odu_per_tr'), amount:trDesign*r('hvac','odu_per_tr')});
  const ductKey = { 'GI':'duct_gi','SS':'duct_ss','PI':'duct_pi','Aluminum':'duct_al' }[hvac.ductType||'Aluminum'] || 'duct_al';
  hvacLines.push({desc:`Ducting – ${hvac.ductType||'Aluminum'}`, qty:hvac.ductArea||1500, unit:'Sqft', rate:r('hvac',ductKey), amount:(hvac.ductArea||1500)*r('hvac',ductKey)});
  hvacLines.push({desc:'Duct Insulation', qty:hvac.ductArea||1500, unit:'Sqft', rate:r('hvac','insulation'), amount:(hvac.ductArea||1500)*r('hvac','insulation')});
  if(hvac.fireDamper==='Yes') hvacLines.push({desc:'Fire Damper', qty:1, unit:'Nos', rate:r('hvac','fire_damper'), amount:r('hvac','fire_damper')});
  const plenumKey = { 'LAF 10×10':'laf_10x10','LAF 8×6':'laf_8x6','LAF 6×6':'laf_6x6' }[hvac.plenum||'LAF 10×10'] || 'laf_10x10';
  if(hvac.plenum !== 'No LAF') hvacLines.push({desc:`LAF Plenum – ${hvac.plenum}`, qty:QState.ots.filter(o=>o.configured).length, unit:'Nos', rate:r('plenum',plenumKey), amount:QState.ots.filter(o=>o.configured).length*r('plenum',plenumKey)});
  if(hvac.hepaQty>0) hvacLines.push({desc:'HEPA Filter H14 24×24', qty:hvac.hepaQty, unit:'Nos', rate:r('hepa','h14_24x24'), amount:hvac.hepaQty*r('hepa','h14_24x24')});
  const hvacBase = hvacLines.reduce((s,l)=>s+l.amount,0);
  const hvacLabour = hvacBase * (r('charges','hvac_labor_pct')||12)/100;
  hvacLines.push({desc:'HVAC Installation Labour (12%)', qty:1, unit:'LS', rate:hvacLabour.toFixed(0), amount:hvacLabour, isLabour:true});
  hvacLines.push({desc:'Commissioning & Testing', qty:1, unit:'LS', rate:r('charges','commissioning')||45000, amount:r('charges','commissioning')||45000, isLabour:true});
  if(hvac.partTest==='Yes') hvacLines.push({desc:'Particle Count Test', qty:1, unit:'LS', rate:r('validation','particle_count'), amount:r('validation','particle_count')});
  if(hvac.airTest==='Yes') hvacLines.push({desc:'Airflow Test', qty:1, unit:'LS', rate:r('validation','airflow_test'), amount:r('validation','airflow_test')});
  if(hvac.dopTest==='Yes') hvacLines.push({desc:'DOP Integrity Test', qty:1, unit:'LS', rate:r('validation','dop_test'), amount:r('validation','dop_test')});
  const hvacTotal = hvacLines.reduce((s,l)=>s+l.amount,0);
  const otBasic = otTotals.reduce((s,v)=>s+v,0);
  const transport = r('charges',transKey) || 50000;
  const subtotal = otBasic + hvacTotal + transport;
  const gst = subtotal * gstPct / 100;
  const grand = subtotal + gst;
  const totalTR = otTech.reduce((s,ot)=>s+parseFloat(ot.tr),0).toFixed(1);
  const totalCFM = otTech.reduce((s,ot)=>s+ot.cfm,0);
  const totalArea = otTech.reduce((s,ot)=>{ const dims=ot.dimensions.split('×'); return s+(parseFloat(dims[0])*parseFloat(dims[1])); },0).toFixed(0);
  return { allLines, hvacLines, otTotals, otBasic, hvacTotal, transport, subtotal, gst, grand, gstPct, trans, otTech, totalTR, totalCFM, totalArea };
}
function getChargeVal(id) { const rates = window.__rates || {}; const items = rates.charges || []; const item = items.find(x=>x.id===id); return item ? item.value : 0; }
async function renderQStep5() {
  if (!window.__rates) { await getRates().then(r => { window.__rates = r; renderQStep5(); }); return; }
  const boq = computeBOQ();
  const c = document.getElementById('quotContent');
  c.innerHTML = `<div class="qcard"><div class="qcard-head"><h4><i class="fas fa-calculator"></i> Bill of Quantities – Summary</h4></div><div class="qcard-body"><div class="form-section-title">📋 Configured OTs Summary</div><div class="scroll-x"><table class="data-table" style="margin-bottom:16px"><thead><tr><th>OT Name</th><th>Type</th><th>Config</th><th>Dimensions</th><th>CFM</th><th>Cost</th></tr></thead><tbody id="perOtSummaryBody"></tbody></table></div>${boq.allLines.map((grp,gi)=>`<div class="form-section-title" style="margin-top:${gi>0?'20px':'0'}">${grp.otName}</div><div class="scroll-x"><table class="data-table" style="margin-bottom:8px"><thead><tr><th>#</th><th>Description</th><th>Qty</th><th>Unit</th><th class="text-right">Rate (₹)</th><th class="text-right">Amount (₹)</th></tr></thead><tbody>${grp.lines.map((l,i)=>`<tr style="${l.isLabour?'background:#fffaf0':''}"><td>${i+1}${l.isLabour?'*':''}</td><td>${esc(l.desc)}</span></td><td>${l.qty}</span></td><td>${l.unit}</span></td><td class="text-right mono">${inr(l.rate)}</span></td><td class="text-right mono">${inr(l.amount)}</span></td></tr>`).join('')}<tr style="background:#ebf5fb;font-weight:700"><td colspan="5">OT Sub-Total</td><td class="text-right mono">${inr(boq.otTotals[gi])}</td></tr></tbody></table></div>`).join('')}<div class="form-section-title" style="margin-top:20px"><i class="fas fa-wind"></i> HVAC & Validation (Project-Wide)</div><div class="scroll-x"><table class="data-table" style="margin-bottom:8px"><thead><tr><th>#</th><th>Description</th><th>Qty</th><th>Unit</th><th class="text-right">Rate (₹)</th><th class="text-right">Amount (₹)</th></tr></thead><tbody>${boq.hvacLines.map((l,i)=>`<tr style="${l.isLabour?'background:#fffaf0':''}"><td>${i+1}${l.isLabour?'*':''}</td><td>${esc(l.desc)}</span></td><td>${l.qty}</span></td><td>${l.unit}</span></td><td class="text-right mono">${inr(l.rate)}</span></td><td class="text-right mono">${inr(l.amount)}</span></td></tr>`).join('')}<tr style="background:#ebf5fb;font-weight:700"><td colspan="5">HVAC Sub-Total</td><td class="text-right mono">${inr(boq.hvacTotal)}</td></tr></tbody></table></div><div class="form-section-title">🔬 Project Technical Summary</div><div class="summary-grid" style="margin-bottom:16px"><div class="sum-box"><div class="lbl">Total TR</div><div class="val">${boq.totalTR} TR</div></div><div class="sum-box"><div class="lbl">Total CFM</div><div class="val">${boq.totalCFM} CFM</div></div><div class="sum-box"><div class="lbl">Total Area</div><div class="val">${boq.totalArea} sq.ft</div></div></div><div class="form-section-title">💰 Financial Summary</div><div class="summary-grid"><div class="sum-box"><div class="lbl">OT Scope Total</div><div class="val">${inr(boq.otBasic)}</div></div><div class="sum-box"><div class="lbl">HVAC & Validation</div><div class="val">${inr(boq.hvacTotal)}</div></div><div class="sum-box"><div class="lbl">Transport (${boq.trans})</div><div class="val">${inr(boq.transport)}</div></div><div class="sum-box"><div class="lbl">Installation & Labor</div><div class="val">${inr(boq.hvacLines.filter(l=>l.isLabour).reduce((s,l)=>s+l.amount,0) + boq.allLines.flatMap(g=>g.lines).filter(l=>l.isLabour).reduce((s,l)=>s+l.amount,0))}</div></div><div class="sum-box"><div class="lbl">Sub-Total</div><div class="val">${inr(boq.subtotal)}</div></div><div class="sum-box"><div class="lbl">GST (${boq.gstPct}%)</div><div class="val">${inr(boq.gst)}</div></div><div class="sum-box highlight"><div class="lbl">GRAND TOTAL</div><div class="val">${inr(boq.grand)}</div></div></div></div></div><div class="q-actions"><button class="btn btn-outline" onclick="QState.step=4;renderStepBar();renderStep()"><i class="fas fa-arrow-left"></i> Back</button><div class="q-actions-right"><button class="btn btn-outline" onclick="printQuotation()"><i class="fas fa-print"></i> Print</button><button class="btn btn-outline" onclick="exportToExcel()"><i class="fas fa-file-excel"></i> Export Excel</button><button class="btn btn-success" onclick="generatePDFQuotation()"><i class="fas fa-file-pdf"></i> Generate PDF Quotation</button><button class="btn btn-primary" onclick="saveQuotation()"><i class="fas fa-save"></i> Save Quotation</button></div></div>`;
  const tbody = document.getElementById('perOtSummaryBody');
  if(tbody) { tbody.innerHTML = boq.otTech.map(ot => `<tr><td><strong>${esc(ot.name)}</strong></td><td>${esc(ot.type)}</td><td>${esc(ot.config)}</td><td>${ot.dimensions}</td><td>${ot.cfm}</td><td class="mono">${inr(ot.cost)}</td></tr>`).join(''); }
}
async function saveQuotation() {
  // Ensure rates are loaded before computing BOQ
  if (!window.__rates) {
    await getRates().then(r => { window.__rates = r; });
  }
  const boq = computeBOQ();
  const payload = {
    project: { ...QState.project, subtotal: boq.subtotal, gstAmount: boq.gst, grandTotal: boq.grand, gstPct: boq.gstPct },
    ots: QState.ots,
    hvac: QState.project.hvac || {}
  };
  try {
    await saveQuotationToBackend(payload.project, payload.ots, payload.hvac);
    toast('Quotation saved permanently');
  } catch (err) { toast('Save failed: ' + err.message, 'error'); }
}

// ========== PRINT & PDF (restored original print logic) ==========
function printQuotation() {
  const boq = computeBOQ();
  const p = QState.project;
  let sno = 1;
  const pLines = (lines) => lines.map(l => `
    <tr>
      <td>${sno++}</td>
      <td>${l.desc}</td>
      <td>${l.qty}</td>
      <td>${l.unit}</td>
      <td style="text-align:right">${Number(l.rate).toLocaleString('en-IN',{maximumFractionDigits:0})}</td>
      <td style="text-align:right">${Number(l.amount).toLocaleString('en-IN',{maximumFractionDigits:0})}</td>
    </tr>
  `).join('');
  const html = `
  <div class="print-page">
    <div class="print-header">
      <div><div class="print-logo-text">WIESPL</div><div class="print-logo-sub">Wipro Infrastructure Engineering Specialties Pvt. Ltd.<br>Modular OT & Cleanroom Specialists</div></div>
      <div class="print-meta"><b>Quotation No:</b> ${p.number||''}<br><b>Date:</b> ${p.date||''}<br><b>Valid Until:</b> ${p.validUntil||''}</div>
    </div>
    <div class="print-title">SUPPLY, INSTALLATION & COMMISSIONING<br>OF MODULAR OPERATION THEATRE SYSTEM</div>
    <div class="print-client">
      <div class="print-client-item"><span>To:</span> ${p.hospital||''}</div>
      <div class="print-client-item"><span>City:</span> ${p.city||''}, ${p.state||''}</div>
      <div class="print-client-item"><span>Contact:</span> ${p.contact||''}</div>
      <div class="print-client-item"><span>Phone:</span> ${p.phone||''}</div>
    </div>
    ${boq.allLines.map((grp,gi)=>`
      <div class="print-section-title">${grp.otName} – Civil & Interior Scope</div>
      <table class="print-table">
        <thead><tr><th>#</th><th>Description</th><th>Qty</th><th>Unit</th><th>Rate (₹)</th><th>Amount (₹)</th></tr></thead>
        <tbody>${pLines(grp.lines)}<tr style="font-weight:700;background:#e8f4fd"><td colspan="5">Sub-Total – ${grp.otName}</td><td style="text-align:right">${boq.otTotals[gi].toLocaleString('en-IN',{maximumFractionDigits:0})}</td></tr></tbody>
      </table>
    `).join('')}
    <div class="print-section-title">HVAC, Filtration & Validation</div>
    <table class="print-table">
      <thead><tr><th>#</th><th>Description</th><th>Qty</th><th>Unit</th><th>Rate (₹)</th><th>Amount (₹)</th></tr></thead>
      <tbody>${pLines(boq.hvacLines)}</tbody>
    </table>
    <div class="print-totals" style="margin-top:20px">
      <div class="print-total-row"><span>OT Scope Total</span><span>${inr(boq.otBasic)}</span></div>
      <div class="print-total-row"><span>HVAC & Validation</span><span>${inr(boq.hvacTotal)}</span></div>
      <div class="print-total-row"><span>Transport (${boq.trans})</span><span>${inr(boq.transport)}</span></div>
      <div class="print-total-row"><span>Sub-Total</span><span>${inr(boq.subtotal)}</span></div>
      <div class="print-total-row"><span>GST @ ${boq.gstPct}%</span><span>${inr(boq.gst)}</span></div>
      <div class="print-total-row grand"><span>GRAND TOTAL</span><span>${inr(boq.grand)}</span></div>
    </div>
    <div class="print-terms">
      <b>Terms & Conditions:</b><br>
      1. Payment: 40% advance, 50% before dispatch, 10% on commissioning.<br>
      2. Delivery: 8–12 weeks from order confirmation & advance receipt.<br>
      3. Warranty: 12 months from date of commissioning.<br>
      4. Civil works (if any) to be completed by client before installation.<br>
      5. Prices are valid for 30 days from quotation date.
    </div>
    <div class="print-footer">WIESPL · This is a computer generated quotation · www.wiespl.com</div>
  </div>`;
  document.getElementById('printArea').innerHTML = html;
  document.getElementById('printArea').style.display = 'block';
  window.print();
  setTimeout(() => { document.getElementById('printArea').style.display = 'none'; }, 1000);
}
function generatePDFQuotation() { printQuotation(); }

// ========== EXCEL EXPORT (using XLSX) ==========
function exportToExcel() {
  if (typeof XLSX === 'undefined') { toast('Excel library not loaded', 'error'); return; }
  const boq = computeBOQ();
  const p = QState.project;
  const wb = XLSX.utils.book_new();
  const summaryData = [
    ['WIESPL – OT Quotation'], [''],
    ['Quotation No', p.number || ''], ['Date', p.date || ''], ['Valid Until', p.validUntil || ''], [''],
    ['Client', p.hospital || ''], ['City', p.city || ''], ['Contact', p.contact || ''], [''],
    ['FINANCIAL SUMMARY'],
    ['Item', 'Amount (₹)'],
    ['OT Scope Total', boq.otBasic],
    ['HVAC & Validation', boq.hvacTotal],
    [`Transport (${boq.trans})`, boq.transport],
    ['Installation & Labor', boq.hvacLines.filter(l => l.isLabour).reduce((s, l) => s + l.amount, 0) + boq.allLines.flatMap(g => g.lines).filter(l => l.isLabour).reduce((s, l) => s + l.amount, 0)],
    ['Sub-Total', boq.subtotal],
    [`GST (${boq.gstPct}%)`, boq.gst],
    ['GRAND TOTAL', boq.grand]
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
  ws1['!cols'] = [{ wch: 30 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'Summary');
  const header = ['#', 'Description', 'Qty', 'Unit', 'Rate (₹)', 'Amount (₹)'];
  const boqData = [header];
  let sno = 1;
  boq.allLines.forEach((grp) => {
    boqData.push([`--- ${grp.otName} ---`, '', '', '', '', '']);
    grp.lines.forEach(l => boqData.push([sno++, l.desc, l.qty, l.unit, l.rate, l.amount]));
    const otTotal = grp.lines.reduce((sum, l) => sum + l.amount, 0);
    boqData.push(['', 'Sub-Total', '', '', '', otTotal]);
    boqData.push(['', '', '', '', '', '']);
  });
  boqData.push(['--- HVAC & Validation ---', '', '', '', '', '']);
  boq.hvacLines.forEach(l => boqData.push([sno++, l.desc, l.qty, l.unit, l.rate, l.amount]));
  boqData.push(['', 'HVAC Sub-Total', '', '', '', boq.hvacTotal]);
  const ws2 = XLSX.utils.aoa_to_sheet(boqData);
  ws2['!cols'] = [{ wch: 5 }, { wch: 50 }, { wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'BOQ Detail');
  XLSX.writeFile(wb, `WIESPL_Quotation_${p.number?.replace(/\//g, '_') || 'Quote'}.xlsx`);
  toast('Excel exported successfully');
}

// ========== LOAD QUOTATION MODAL ==========
async function showLoadQuotationModal() {
  const list = await getQuotations();  // Fixed: was listQuotations
  showModal('loadQuotModal', 'Load Quotation', `<select id="loadQuotSelect" class="form-control">${list.map(q => `<option value="${q.id}">${q.quotation_no} - ${q.hospital} (${inr(q.grand_total)})</option>`).join('')}</select>`, async () => {
    const id = document.getElementById('loadQuotSelect').value;
    const data = await loadQuotationById(id);
    QState.project = data.project;
    QState.ots = data.ots;
    QState.project.hvac = data.hvac;
    QState.otCounts.modular = data.ots.filter(o => o.type === 'Modular OT').length;
    QState.step = 5;
    renderStepBar();
    renderStep();
    closeModal();
    toast('Quotation loaded');
  });
}

// ========== RATE MANAGEMENT ==========
const RATE_CATS = { panel:'Wall Panels', flooring:'Flooring', ceiling:'Ceiling Panels', coving:'Coving', door:'Doors', hvac:'HVAC', plenum:'Plenum/LAF', hepa:'HEPA/Filters', pendant:'Pendants', controls:'Controls', lighting:'Lighting', equipment:'Equipment', validation:'Validation', charges:'Charges & GST' };
let activeCat = 'panel';
async function renderRates() {
  const content = document.getElementById('mainContent');
  const actions = document.getElementById('topbarActions');
  actions.innerHTML = `<button class="btn btn-success" onclick="saveAllRates()"><i class="fas fa-save"></i> Save All Rates</button><button class="btn btn-outline btn-sm" onclick="resetRates()"><i class="fas fa-undo"></i> Reset Defaults</button>`;
  const rates = await getRates();
  window.__rates = rates;
  content.innerHTML = `<div class="card"><div class="card-header"><h3><i class="fas fa-sliders"></i> Rate Management</h3><span style="font-size:12px;color:var(--text3)">All prices in Indian Rupees</span></div><div class="card-body"><div class="rates-tabs">${Object.entries(RATE_CATS).map(([k,v])=>`<div class="rate-tab ${activeCat===k?'active':''}" onclick="switchRateCat('${k}')">${v}</div>`).join('')}</div><div id="ratesBody">${renderRateCat(activeCat, rates)}</div></div></div>`;
}
function switchRateCat(cat) { activeCat = cat; document.querySelectorAll('.rate-tab').forEach(el=>el.classList.toggle('active',el.textContent===RATE_CATS[cat])); renderRates(); }
function renderRateCat(cat, rates) {
  const items = rates[cat] || [];
  return `<div><div class="rate-row" style="background:var(--bg);font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.5px"><span>Description</span><span>Rate</span><span>Unit</span></div>${items.map(item=>`<div class="rate-row"><span class="rate-name">${esc(item.label)}</span><input class="rate-input" data-cat="${cat}" data-id="${item.id}" value="${item.value}" type="number" min="0" step="1"><span class="rate-unit">${item.unit}</span></div>`).join('')}</div>`;
}
async function saveAllRates() {
  const inputs = document.querySelectorAll('.rate-input');
  for (const el of inputs) {
    const cat = el.dataset.cat, id = el.dataset.id;
    const newVal = parseFloat(el.value);
    if (!isNaN(newVal)) await updateRate(cat, id, newVal);
  }
  toast('All rates saved');
  renderRates();
}
async function resetRates() { if(confirm_modal('Reset all rates to defaults?')) { await resetRates(); renderRates(); toast('Rates reset'); } }

// ========== USER MANAGEMENT ==========
async function renderUsers() {
  const content = document.getElementById('mainContent');
  const actions = document.getElementById('topbarActions');
  actions.innerHTML = `<button class="btn btn-primary" onclick="showUserModal()"><i class="fas fa-plus"></i> Add User</button>`;
  const users = await apiCall('/users');
  content.innerHTML = `<div class="card"><div class="card-header"><h3><i class="fas fa-users"></i> All Users</h3></div><div class="card-body" style="padding:0"><div class="scroll-x"><table class="data-table"><thead><tr><th>User</th><th>Username</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead><tbody>${users.map(u => `<tr>
    <td><div style="display:flex;align-items:center;gap:8px"><div class="user-table-av">${u.name.charAt(0)}</div>${esc(u.name)}</div></td>
    <td class="mono">${esc(u.username)}</td>
    <td>${u.role}</td>
    <td>${u.active?'<span class="badge badge-green">Active</span>':'<span class="badge badge-gray">Inactive</span>'}</td>
    <td><button class="btn btn-ghost btn-sm" onclick="showUserModal('${u.id}')"><i class="fas fa-edit"></i></button>${u.id!==currentUser?.id?`<button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="deleteUser('${u.id}')"><i class="fas fa-trash"></i></button>`:''}</td>
  </tr>`).join('')}</tbody></table></div></div></div>`;
}
let editingUserId = null;
function showUserModal(id=null) {
  editingUserId = id;
  showModal('userModal', `${id?'Edit':'Add'} User`, `<div class="form-grid"><div class="form-group"><label>Full Name</label><input class="form-control" id="uName"></div><div class="form-group"><label>Username</label><input class="form-control" id="uUsername"></div><div class="form-group"><label>Password</label><input type="password" class="form-control" id="uPassword"></div><div class="form-group"><label>Role</label><select class="form-control" id="uRole"><option value="admin">Admin</option><option value="sales">Sales</option><option value="viewer">Viewer</option></select></div><div class="form-group"><label>Active</label><select class="form-control" id="uActive"><option value="1">Active</option><option value="0">Inactive</option></select></div></div>`, async () => {
    const payload = { name: document.getElementById('uName').value, username: document.getElementById('uUsername').value, password: document.getElementById('uPassword').value, role: document.getElementById('uRole').value, active: document.getElementById('uActive').value === '1' };
    if (editingUserId) await apiCall(`/users/${editingUserId}`, { method: 'PUT', body: JSON.stringify(payload) });
    else await apiCall('/users', { method: 'POST', body: JSON.stringify(payload) });
    closeModal(); toast('User saved'); renderUsers();
  });
}
async function deleteUser(id) { if(confirm_modal('Delete user?')) { await apiCall(`/users/${id}`, { method: 'DELETE' }); renderUsers(); toast('Deleted'); } }

// ========== MODAL HELPER ==========
function showModal(id, title, bodyHTML, onConfirm, extraClass=''){
  const existing=document.getElementById('_modalOverlay');
  if(existing) existing.remove();
  const overlay=document.createElement('div');
  overlay.className='modal-overlay';
  overlay.id='_modalOverlay';
  overlay.innerHTML=`<div class="modal ${extraClass}"><div class="modal-head"><h3>${title}</h3><button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button></div><div class="modal-body">${bodyHTML}</div><div class="modal-foot"><button class="btn btn-outline" onclick="closeModal()">Cancel</button><button class="btn btn-primary" id="_modalConfirm">Save</button></div></div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click',e=>{ if(e.target===overlay) closeModal(); });
  if(onConfirm) document.getElementById('_modalConfirm').addEventListener('click',()=>{ if(onConfirm()!==false) {} });
}
function closeModal(){ const el=document.getElementById('_modalOverlay'); if(el) el.remove(); }

// ========== LOGIN HANDLER ==========
document.getElementById('loginBtn').addEventListener('click', async () => {
  const u = document.getElementById('loginUsername').value.trim();
  const p = document.getElementById('loginPassword').value;
  try {
    await login(u, p);
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('appContainer').style.display = 'flex';
    await restoreSession();
    renderApp();
  } catch (err) {
    document.getElementById('loginError').style.display = 'block';
  }
});
document.getElementById('loginPassword').addEventListener('keydown', e => { if(e.key==='Enter') document.getElementById('loginBtn').click(); });
document.getElementById('logoutBtn').addEventListener('click', () => { logout(); });

// Auto-restore session
restoreSession().then(success => {
  if(success){
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('appContainer').style.display = 'flex';
    renderApp();
  } else {
    document.getElementById('loginScreen').style.display = 'flex';
  }
});

// Expose globals
window.fetchWeatherData = fetchWeatherData;
window.generatePDFQuotation = generatePDFQuotation;
window.calcAreas = calcAreas;
window.calcTR = calcTR;
window.calcACH = calcACH;
window.switchOT = switchOT;
window.saveOTConfig = saveOTConfig;
window.selectOT = selectOT;
window.removeOT = removeOT;
window.proceedToConfig = proceedToConfig;
window.saveQStep1 = saveQStep1;
window.saveQStep4 = saveQStep4;
window.gotoQStep = gotoQStep;
window.linkEnquiry = linkEnquiry;
window.searchAddress = searchAddress;
window.openInGoogleMaps = openInGoogleMaps;
window.addDoor = addDoor;
window.removeDoor = removeDoor;
window.updateDoorField = updateDoorField;
window.showEnquiryModal = showEnquiryModal;
window.deleteEnquiry = deleteEnquiry;
window.filterEnquiries = filterEnquiries;
window.showUserModal = showUserModal;
window.deleteUser = deleteUser;
window.switchRateCat = switchRateCat;
window.saveAllRates = saveAllRates;
window.resetRates = resetRates;
window.saveQuotation = saveQuotation;
window.showLoadQuotationModal = showLoadQuotationModal;
window.printQuotation = printQuotation;
window.exportToExcel = exportToExcel;
window.navigateTo = navigateTo;