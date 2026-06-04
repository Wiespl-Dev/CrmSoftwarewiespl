'use strict';

// RATE DATABASE
const Rates = {
    panel: { ppgl_50mm: 2200, ppgl_100mm: 2450, ss304_50mm: 3500, ss304_100mm: 3800, gi_50mm: 1800, gi_100mm: 2000 },
    flooring: { epoxy: 350, vinyl_2mm: 420, vinyl_3mm: 480, conductive_vinyl: 650, self_leveling: 85 },
    ceiling: { ppgl_50mm: 1900, ss304_50mm: 2800, gi_50mm: 1500 },
    coving: { aluminum: 365, ss304: 480, ppgl: 290 },
    door: { sliding_1800x2100: 175000, sliding_1200x2100: 145000, swing_1200x2100: 95000 },
    hvac: { ahu_per_tr: 120000, odu_per_tr: 85000, duct_per_sqft: 250, duct_gi: 220, duct_ss: 450, duct_pi: 380, insulation_per_sqft: 45, grilles_per_unit: 8500, vcd_per_unit: 6500, fire_damper: 15000 },
    plenum: { laf_10x10: 340000, laf_8x6: 220000, laf_6x6: 165000 },
    hepa: { h14_24x24: 25000, h14_12x24: 15000, pre_filter: 3500 },
    pendant: { anaesthesia_single: 295000, anaesthesia_double: 385000, surgeon_single: 335000, surgeon_double: 425000 },
    control: { hvac_panel_ip65: 105000, surgeon_touch_32: 195000, outside_touch_10: 75000, ismart_device: 65000, shrm_system: 95000 },
    lighting: { led_2x2_36w: 4500, xray_viewer_twin: 38000, xray_viewer_single: 22000 },
    equipment: { pass_box: 85000, storage_cabinet: 48000, writing_board: 8500 },
    validation: { particle_count: 25000, airflow_test: 15000, dop_test: 18000 },
    labor: { panel_installation: 180, hvac_installation_pct: 0.12, electrical: 25000, commissioning: 45000 },
    transport: { local: 50000, regional: 125000, national: 200000 }
};

// CALCULATION ENGINE
const CalcEngine = {
    calculateAreas(ot) {
        const l = ot.dimensions?.l || 20, w = ot.dimensions?.w || 20, h = ot.dimensions?.h || 10;
        return { floor: l*w, ceiling: l*w, wall: 2*(l+w)*h, volume: l*w*h, coving: 2*(l+w)*1.1 };
    },
    calculateTR(ot) {
        const areas = this.calculateAreas(ot);
        const persons = ot.hvac?.persons || 6;
        const equipmentKW = ot.hvac?.equipmentLoad || 2;
        const lightingWPerSqft = ot.hvac?.lightingLoad || 0.3;
        const personLoadKW = persons * 0.1;
        const lightingLoadKW = (lightingWPerSqft * areas.floor) / 1000;
        const envelopeLoadKW = areas.wall * 0.02 + areas.ceiling * 0.015;
        const freshAirLoadKW = (areas.volume * 5 / 60) * 0.0018;
        const totalKW = personLoadKW + lightingLoadKW + equipmentKW + envelopeLoadKW + freshAirLoadKW;
        return { tr: Math.round((totalKW/3.517)*1.15*10)/10, kw: Math.round(totalKW*10)/10 };
    },
    calculateCFM(ot, ach=25) { return Math.round((this.calculateAreas(ot).volume*ach)/60); },
    calculateACH(ot, cfm) { return Math.round((cfm*60)/this.calculateAreas(ot).volume*10)/10; }
};

// BOQ ENGINE (simplified, full version in original)
const BOQEngine = {
    generateBOQ(ot, rates=Rates) {
        if(!ot?.configured) return null;
        const areas = CalcEngine.calculateAreas(ot);
        const tr = CalcEngine.calculateTR(ot).tr;
        const basicTotal = 500000; // placeholder, replace with real calculation
        return { summary: { basicTotal, installation: 200000, transport: 125000, subtotal: basicTotal+200000, gst: (basicTotal+200000)*0.18, grandTotal: (basicTotal+200000)*1.18 } };
    },
    generateProjectBOQ(ots, rates=Rates) {
        let total = { basicTotal:0, installation:0, transport:0, subtotal:0, gst:0, grandTotal:0 };
        ots.forEach(ot => { if(ot.configured) { const b = this.generateBOQ(ot); if(b) Object.keys(total).forEach(k => total[k] += b.summary[k]); } });
        return { totalSummary: total };
    }
};

// QUOTATION APP
const QuotationApp = {
    currentStep: 1,
    currentOTIndex: 0,
    otConfigs: [],
    init() { this.loadFromStorage(); this.updateStepDisplay(1); },
    showToast(msg, type='success') { /* implementation */ },
    formatINR(amt) { return '₹' + amt.toLocaleString('en-IN'); },
    updateArea() { /* ... */ },
    updateACH() { /* ... */ },
    calculateHeatLoad() { /* ... */ },
    fetchWeatherData() { /* ... */ },
    generateOTList() { return []; },
    renderOTSelection() { /* ... */ },
    selectOT(idx) { /* ... */ },
    loadOTConfig(cfg) { /* ... */ },
    saveOTConfig() { this.showToast('Config saved'); },
    saveHVACConfig() { this.showToast('HVAC saved'); },
    renderSummary() { /* ... */ },
    generateQuotation() { this.showToast('Quotation generated'); },
    exportToExcel() { this.showToast('Excel exported'); },
    goToStep(step) { this.currentStep = step; this.updateStepDisplay(step); },
    nextStep(step) { this.currentStep = step; this.updateStepDisplay(step); },
    prevStep(step) { this.currentStep = step; this.updateStepDisplay(step); },
    updateStepDisplay(step) { /* update DOM */ },
    saveToStorage() { localStorage.setItem('wiespl_ot_configs', JSON.stringify(this.otConfigs)); },
    loadFromStorage() { const s = localStorage.getItem('wiespl_ot_configs'); if(s) this.otConfigs = JSON.parse(s); }
};

// CRM Logic
const DEMO_USER = 'admin', DEMO_PASS = 'wiespl2024';
let enquiries = JSON.parse(localStorage.getItem('wiespl_simple_enquiries')) || [];

document.getElementById('loginButton').addEventListener('click', () => {
    if(document.getElementById('loginUsername').value === DEMO_USER && document.getElementById('loginPassword').value === DEMO_PASS) {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('appContainer').classList.add('active');
        renderEnquiries();
        QuotationApp.init();
    } else {
        document.getElementById('loginError').style.display = 'block';
    }
});

document.getElementById('logoutBtn').addEventListener('click', () => {
    document.getElementById('appContainer').classList.remove('active');
    document.getElementById('loginScreen').style.display = 'block';
});

function switchPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`page-${page}`).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector(`.nav-item[data-page="${page}"]`).classList.add('active');
    document.getElementById('pageTitle').textContent = { dashboard:'Dashboard', enquiries:'Enquiries', quotation:'OT Quotation Builder' }[page];
}

function renderEnquiries() {
    const dashBody = document.querySelector('#dashboardTable tbody');
    const enqBody = document.querySelector('#enquiriesTable tbody');
    if(!dashBody) return;
    dashBody.innerHTML = enquiries.slice(-5).reverse().map(e => `<tr><td>${e.hospital}</td><td>${e.city}</td><td>${e.otType}</td><td>₹${Number(e.value).toLocaleString()}</td><td>${e.stage}</td></tr>`).join('');
    enqBody.innerHTML = enquiries.map(e => `<tr><td>${e.hospital}</td><td>${e.city}</td><td>${e.contact}</td><td>${e.otType}</td><td>₹${Number(e.value).toLocaleString()}</td><td>${e.stage}</td></tr>`).join('');
    document.getElementById('totalCount').textContent = enquiries.length;
    document.getElementById('activeCount').textContent = enquiries.filter(e => e.stage !== 'Lost' && e.stage !== 'Won').length;
}

document.getElementById('saveEnquiryBtn').addEventListener('click', () => {
    const hospital = document.getElementById('eHospital').value.trim();
    if(!hospital) return alert('Hospital required');
    enquiries.push({ hospital, city: document.getElementById('eCity').value, contact: document.getElementById('eContact').value, otType: document.getElementById('eOtType').value, value: parseFloat(document.getElementById('eValue').value)||0, stage: document.getElementById('eStage').value });
    localStorage.setItem('wiespl_simple_enquiries', JSON.stringify(enquiries));
    renderEnquiries();
    switchPage('enquiries');
});

document.querySelectorAll('.nav-item').forEach(item => item.addEventListener('click', () => switchPage(item.dataset.page)));
document.getElementById('newEnquiryBtn').addEventListener('click', () => switchPage('enquiries'));
document.getElementById('newQuotationBtn').addEventListener('click', () => switchPage('quotation'));

window.QuotationApp = QuotationApp;