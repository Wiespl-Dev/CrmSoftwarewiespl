// server.js - SQLite version for WIESPL CRM & OT Quotation System
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ==================== DATABASE (SQLite) ====================
const db = new Database('crm.db');
db.pragma('journal_mode = WAL');

// -------------------- CREATE TABLES --------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT,
    username TEXT UNIQUE,
    password_hash TEXT,
    role TEXT,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS enquiries (
    id TEXT PRIMARY KEY,
    hospital TEXT,
    city TEXT,
    state TEXT,
    contact TEXT,
    phone TEXT,
    email TEXT,
    ot_type TEXT,
    ot_count INTEGER,
    estimated_value REAL,
    stage TEXT,
    notes TEXT,
    enquiry_date TEXT,
    created_by TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS quotations (
    id TEXT PRIMARY KEY,
    quotation_no TEXT UNIQUE,
    enquiry_id TEXT,
    hospital TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    contact TEXT,
    phone TEXT,
    email TEXT,
    quotation_date TEXT,
    valid_until TEXT,
    transport TEXT,
    gst_percent REAL,
    subtotal REAL,
    gst_amount REAL,
    grand_total REAL,
    status TEXT,
    latitude REAL,
    longitude REAL,
    elevation TEXT,
    created_by TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (enquiry_id) REFERENCES enquiries(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS quotation_ots (
    id TEXT PRIMARY KEY,
    quotation_id TEXT,
    ot_index INTEGER,
    name TEXT,
    ot_type TEXT,
    length_ft REAL,
    width_ft REAL,
    height_ft REAL,
    floor_area_sqft REAL,
    wall_area_sqft REAL,
    coving_length_rft REAL,
    wall_panel_type TEXT,
    ceiling_panel_type TEXT,
    coving_type TEXT,
    flooring_type TEXT,
    self_leveling INTEGER,
    ot_config TEXT,
    ot_floor TEXT,
    ahu_floor TEXT,
    anaesth_pendant TEXT,
    surg_pendant TEXT,
    pass_box_qty INTEGER,
    storage_cab_qty INTEGER,
    led_lights_qty INTEGER,
    xray_viewer TEXT,
    writing_board_qty INTEGER,
    hvac_panel INTEGER,
    touch_panel_size TEXT,
    outside_panel_size TEXT,
    ismart INTEGER,
    shrm INTEGER,
    configured INTEGER,
    FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS quotation_ot_doors (
    id TEXT PRIMARY KEY,
    quotation_ot_id TEXT,
    door_type TEXT,
    size TEXT,
    leaf TEXT,
    material TEXT,
    vision_panel INTEGER,
    auto_operator INTEGER,
    location TEXT,
    FOREIGN KEY (quotation_ot_id) REFERENCES quotation_ots(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS quotation_hvac (
    quotation_id TEXT PRIMARY KEY,
    outside_temp REAL,
    outside_humidity REAL,
    inside_temp REAL,
    inside_humidity REAL,
    design_tr REAL,
    cfm INTEGER,
    hepa_position TEXT,
    plenum_type TEXT,
    duct_type TEXT,
    duct_area_sqft INTEGER,
    ahu_skin TEXT,
    static_pressure TEXT,
    motor_type TEXT,
    fire_damper INTEGER,
    particle_test INTEGER,
    airflow_test INTEGER,
    dop_test INTEGER,
    FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS rates (
    id TEXT PRIMARY KEY,
    category TEXT,
    item_key TEXT,
    label TEXT,
    unit TEXT,
    value REAL,
    updated_by TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(category, item_key),
    FOREIGN KEY (updated_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    action TEXT,
    entity_type TEXT,
    entity_id TEXT,
    old_data TEXT,
    new_data TEXT,
    ip_address TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS weather_cache (
    lat REAL,
    lng REAL,
    temperature REAL,
    humidity REAL,
    fetched_at TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (lat, lng)
  );
`);

// -------------------- DEFAULT DATA --------------------
// Insert default admin user (if not exists)
const adminExists = db.prepare('SELECT 1 FROM users WHERE username = ?').get('admin');
if (!adminExists) {
  const hashedPassword = bcrypt.hashSync('wiespl123', 10);
  db.prepare(`
    INSERT INTO users (id, name, username, password_hash, role, active)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), 'Admin User', 'admin', hashedPassword, 'admin', 1);
}

// Insert default rates (if table empty)
const rateCount = db.prepare('SELECT COUNT(*) as cnt FROM rates').get().cnt;
if (rateCount === 0) {
  const defaultRates = {
    panel: [
      { id:'ppgl_50mm', label:'PPGL Panel 50mm', value:2200, unit:'₹/sqft' },
      { id:'ppgl_100mm', label:'PPGL Panel 100mm', value:2450, unit:'₹/sqft' },
      { id:'ss304_50mm', label:'SS304 Panel 50mm', value:3500, unit:'₹/sqft' },
      { id:'ss304_100mm', label:'SS304 Panel 100mm', value:3800, unit:'₹/sqft' },
      { id:'gi_50mm', label:'GI Panel 50mm', value:1800, unit:'₹/sqft' },
      { id:'gi_100mm', label:'GI Panel 100mm', value:2000, unit:'₹/sqft' }
    ],
    flooring: [
      { id:'epoxy', label:'Epoxy Flooring', value:350, unit:'₹/sqft' },
      { id:'vinyl_2mm', label:'Vinyl 2mm', value:420, unit:'₹/sqft' },
      { id:'vinyl_3mm', label:'Vinyl 3mm', value:480, unit:'₹/sqft' },
      { id:'conductive_vinyl', label:'Conductive Vinyl', value:650, unit:'₹/sqft' },
      { id:'self_leveling', label:'Self Leveling Compound', value:85, unit:'₹/sqft' }
    ],
    ceiling: [
      { id:'ppgl_50mm', label:'Ceiling PPGL 50mm', value:1900, unit:'₹/sqft' },
      { id:'ss304_50mm', label:'Ceiling SS304 50mm', value:2800, unit:'₹/sqft' },
      { id:'gi_50mm', label:'Ceiling GI 50mm', value:1500, unit:'₹/sqft' }
    ],
    coving: [
      { id:'aluminum', label:'Aluminum Coving', value:365, unit:'₹/rft' },
      { id:'ss304', label:'SS304 Coving', value:480, unit:'₹/rft' },
      { id:'ppgl', label:'PPGL Coving', value:290, unit:'₹/rft' }
    ],
    door: [
      { id:'sliding_1800x2100', label:'Sliding Door 1800×2100', value:175000, unit:'₹/unit' },
      { id:'sliding_1200x2100', label:'Sliding Door 1200×2100', value:145000, unit:'₹/unit' },
      { id:'swing_1200x2100', label:'Swing Door 1200×2100', value:95000, unit:'₹/unit' }
    ],
    hvac: [
      { id:'ahu_per_tr', label:'AHU (per TR)', value:120000, unit:'₹/TR' },
      { id:'odu_per_tr', label:'ODU (per TR)', value:85000, unit:'₹/TR' },
      { id:'duct_gi', label:'GI Ducting', value:220, unit:'₹/sqft' },
      { id:'duct_ss', label:'SS Ducting', value:450, unit:'₹/sqft' },
      { id:'duct_pi', label:'PI Ducting', value:380, unit:'₹/sqft' },
      { id:'duct_al', label:'Aluminum Ducting', value:250, unit:'₹/sqft' },
      { id:'insulation', label:'Duct Insulation', value:45, unit:'₹/sqft' },
      { id:'grilles', label:'Supply/Return Grilles', value:8500, unit:'₹/unit' },
      { id:'vcd', label:'Volume Control Damper', value:6500, unit:'₹/unit' },
      { id:'fire_damper', label:'Fire Damper', value:15000, unit:'₹/unit' }
    ],
    plenum: [
      { id:'laf_10x10', label:'LAF Plenum 10×10', value:340000, unit:'₹/unit' },
      { id:'laf_8x6', label:'LAF Plenum 8×6', value:220000, unit:'₹/unit' },
      { id:'laf_6x6', label:'LAF Plenum 6×6', value:165000, unit:'₹/unit' }
    ],
    hepa: [
      { id:'h14_24x24', label:'HEPA H14 24×24', value:25000, unit:'₹/unit' },
      { id:'h14_12x24', label:'HEPA H14 12×24', value:15000, unit:'₹/unit' },
      { id:'pre_filter', label:'Pre Filter', value:3500, unit:'₹/unit' }
    ],
    pendant: [
      { id:'anaesthesia_single', label:'Anaesthesia Pendant Single', value:295000, unit:'₹/unit' },
      { id:'anaesthesia_double', label:'Anaesthesia Pendant Double', value:385000, unit:'₹/unit' },
      { id:'surgeon_single', label:'Surgeon Pendant Single', value:335000, unit:'₹/unit' },
      { id:'surgeon_double', label:'Surgeon Pendant Double', value:425000, unit:'₹/unit' }
    ],
    controls: [
      { id:'hvac_panel', label:'HVAC Control Panel IP65', value:105000, unit:'₹/unit' },
      { id:'touch_10', label:'Surgeon Touch Panel 10"', value:45000, unit:'₹/unit' },
      { id:'touch_15', label:'Surgeon Touch Panel 15"', value:65000, unit:'₹/unit' },
      { id:'touch_22', label:'Surgeon Touch Panel 22"', value:95000, unit:'₹/unit' },
      { id:'touch_32', label:'Surgeon Touch Panel 32"', value:195000, unit:'₹/unit' },
      { id:'touch_43', label:'Surgeon Touch Panel 43"', value:285000, unit:'₹/unit' },
      { id:'touch_55', label:'Surgeon Touch Panel 55"', value:395000, unit:'₹/unit' },
      { id:'outside_10', label:'Outside Panel 10"', value:35000, unit:'₹/unit' },
      { id:'outside_15', label:'Outside Panel 15"', value:55000, unit:'₹/unit' },
      { id:'outside_22', label:'Outside Panel 22"', value:85000, unit:'₹/unit' },
      { id:'outside_32', label:'Outside Panel 32"', value:150000, unit:'₹/unit' },
      { id:'ismart', label:'iSmart Device', value:65000, unit:'₹/unit' },
      { id:'shrm', label:'SHRM System', value:95000, unit:'₹/unit' }
    ],
    lighting: [
      { id:'led_2x2_36w', label:'LED 2×2 36W Panel', value:4500, unit:'₹/unit' },
      { id:'xray_twin', label:'X-Ray Viewer Twin', value:38000, unit:'₹/unit' },
      { id:'xray_single', label:'X-Ray Viewer Single', value:22000, unit:'₹/unit' }
    ],
    equipment: [
      { id:'pass_box', label:'Pass Box', value:85000, unit:'₹/unit' },
      { id:'storage_cabinet', label:'Storage Cabinet SS', value:48000, unit:'₹/unit' },
      { id:'writing_board', label:'Magnetic Writing Board', value:8500, unit:'₹/unit' }
    ],
    validation: [
      { id:'particle_count', label:'Particle Count Test', value:25000, unit:'₹/test' },
      { id:'airflow_test', label:'Airflow Test', value:15000, unit:'₹/test' },
      { id:'dop_test', label:'DOP Integrity Test', value:18000, unit:'₹/test' }
    ],
    charges: [
      { id:'labor_panel', label:'Panel Installation Labour', value:180, unit:'₹/sqft' },
      { id:'hvac_labor_pct', label:'HVAC Installation Labour (%)', value:12, unit:'%' },
      { id:'electrical', label:'Electrical Works (Lumpsum)', value:25000, unit:'₹' },
      { id:'commissioning', label:'Commissioning & Testing', value:45000, unit:'₹' },
      { id:'transport_local', label:'Transport (Local)', value:50000, unit:'₹' },
      { id:'transport_regional', label:'Transport (Regional)', value:125000, unit:'₹' },
      { id:'transport_national', label:'Transport (National)', value:200000, unit:'₹' },
      { id:'gst_pct', label:'GST (%)', value:18, unit:'%' }
    ]
  };
  const insertRate = db.prepare(`
    INSERT INTO rates (id, category, item_key, label, unit, value)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const [cat, items] of Object.entries(defaultRates)) {
    for (const item of items) {
      insertRate.run(uuidv4(), cat, item.id, item.label, item.unit, item.value);
    }
  }
}

// ==================== MIDDLEWARE ====================
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secretkey');
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

const checkRole = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Insufficient permissions' });
  next();
};

const logActivity = (req, action, entityType, entityId, oldData, newData) => {
  if (!req.user) return;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  db.prepare(`
    INSERT INTO activity_logs (user_id, action, entity_type, entity_id, old_data, new_data, ip_address)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(req.user.id, action, entityType, entityId, JSON.stringify(oldData), JSON.stringify(newData), ip);
};

// ==================== AUTH ====================
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  try {
    const user = db.prepare('SELECT * FROM users WHERE username = ? AND active = 1').get(username);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET || 'secretkey',
      { expiresIn: '7d' }
    );
    res.json({ token, user: { id: user.id, name: user.name, username: user.username, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', verifyToken, (req, res) => {
  const user = db.prepare('SELECT id, name, username, role FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// ==================== ENQUIRIES ====================
app.get('/api/enquiries', verifyToken, (req, res) => {
  const rows = db.prepare('SELECT * FROM enquiries ORDER BY created_at DESC').all();
  res.json(rows);
});

app.post('/api/enquiries', verifyToken, (req, res) => {
  const e = req.body;
  const id = uuidv4();
  const stmt = db.prepare(`
    INSERT INTO enquiries (id, hospital, city, state, contact, phone, email, ot_type, ot_count, estimated_value, stage, notes, enquiry_date, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    id, e.hospital, e.city, e.state, e.contact, e.phone, e.email,
    e.ot_type, e.ot_count, e.estimated_value, e.stage, e.notes,
    e.enquiry_date || new Date().toISOString().slice(0,10), req.user.id
  );
  logActivity(req, 'CREATE', 'enquiry', id, null, e);
  res.status(201).json({ id });
});

app.put('/api/enquiries/:id', verifyToken, (req, res) => {
  const { id } = req.params;
  const e = req.body;
  const stmt = db.prepare(`
    UPDATE enquiries SET hospital=?, city=?, state=?, contact=?, phone=?, email=?, ot_type=?, ot_count=?, estimated_value=?, stage=?, notes=?, enquiry_date=?
    WHERE id=?
  `);
  stmt.run(
    e.hospital, e.city, e.state, e.contact, e.phone, e.email,
    e.ot_type, e.ot_count, e.estimated_value, e.stage, e.notes, e.enquiry_date, id
  );
  logActivity(req, 'UPDATE', 'enquiry', id, null, e);
  res.json({ message: 'Updated' });
});

app.delete('/api/enquiries/:id', verifyToken, (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM enquiries WHERE id = ?').run(id);
  logActivity(req, 'DELETE', 'enquiry', id, null, null);
  res.json({ message: 'Deleted' });
});

// ==================== QUOTATIONS ====================
app.post('/api/quotations', verifyToken, (req, res) => {
  const { project, ots, hvac } = req.body;
  const qid = uuidv4();

  const transaction = db.transaction(() => {
    db.prepare(`
      INSERT INTO quotations (id, quotation_no, enquiry_id, hospital, address, city, state, contact, phone, email, quotation_date, valid_until, transport, gst_percent, subtotal, gst_amount, grand_total, status, latitude, longitude, elevation, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      qid, project.number, project.enquiryId || null, project.hospital, project.address,
      project.city, project.state, project.contact, project.phone, project.email,
      project.date, project.validUntil, project.transport, project.gstPct || 18,
      project.subtotal, project.gstAmount, project.grandTotal, 'Draft',
      project.latitude || null, project.longitude || null, project.elevation || null, req.user.id
    );

    for (let i = 0; i < ots.length; i++) {
      const ot = ots[i];
      if (!ot.configured) continue;
      const otId = uuidv4();
      const floorArea = ot.dimensions.l * ot.dimensions.w;
      const wallArea = 2 * (ot.dimensions.l + ot.dimensions.w) * ot.dimensions.h;
      const covingLen = 2 * (ot.dimensions.l + ot.dimensions.w) * 1.1;
      db.prepare(`
        INSERT INTO quotation_ots (
          id, quotation_id, ot_index, name, ot_type, length_ft, width_ft, height_ft,
          floor_area_sqft, wall_area_sqft, coving_length_rft, wall_panel_type, ceiling_panel_type,
          coving_type, flooring_type, self_leveling, ot_config, ot_floor, ahu_floor,
          anaesth_pendant, surg_pendant, pass_box_qty, storage_cab_qty, led_lights_qty,
          xray_viewer, writing_board_qty, hvac_panel, touch_panel_size, outside_panel_size,
          ismart, shrm, configured
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        otId, qid, i, ot.name, ot.type, ot.dimensions.l, ot.dimensions.w, ot.dimensions.h,
        floorArea, wallArea, covingLen, ot.materials.wallType, ot.materials.ceilType,
        ot.materials.covingType, ot.materials.floorType, ot.materials.selfLeveling === 'Yes' ? 1 : 0,
        ot.otConfig, ot.otFloor, ot.ahuFloor, ot.equipment.anaesthPendant, ot.equipment.surgPendant,
        ot.equipment.passBox, ot.equipment.storageCab, ot.equipment.ledLights, ot.equipment.xrayViewer,
        ot.equipment.writingBoard, ot.equipment.hvacPanel === 'Yes' ? 1 : 0,
        ot.equipment.touchPanelSize, ot.equipment.outsidePanelSize,
        ot.equipment.ismartDev === 'Yes' ? 1 : 0, ot.equipment.shrmSys === 'Yes' ? 1 : 0, 1
      );

      if (ot.doors && ot.doors.length) {
        const doorStmt = db.prepare(`
          INSERT INTO quotation_ot_doors (id, quotation_ot_id, door_type, size, leaf, material, vision_panel, auto_operator, location)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const door of ot.doors) {
          doorStmt.run(uuidv4(), otId, door.type, door.size, door.leaf, door.material,
            door.visionPanel === 'Yes' ? 1 : 0, door.autoOperator === 'Yes' ? 1 : 0, door.location);
        }
      }
    }

    db.prepare(`
      INSERT INTO quotation_hvac (
        quotation_id, outside_temp, outside_humidity, inside_temp, inside_humidity, design_tr,
        cfm, hepa_position, plenum_type, duct_type, duct_area_sqft, ahu_skin, static_pressure,
        motor_type, fire_damper, particle_test, airflow_test, dop_test
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      qid, hvac.outTemp, hvac.outHumid, hvac.inTemp, hvac.inHumid, hvac.designTR,
      hvac.cfm, hvac.hepa, hvac.plenum, hvac.ductType, hvac.ductArea, hvac.ahuSkin,
      hvac.staticPressure, hvac.motorType, hvac.fireDamper === 'Yes' ? 1 : 0,
      hvac.partTest === 'Yes' ? 1 : 0, hvac.airTest === 'Yes' ? 1 : 0, hvac.dopTest === 'Yes' ? 1 : 0
    );
  });

  try {
    transaction();
    logActivity(req, 'CREATE', 'quotation', qid, null, { project, ots, hvac });
    res.status(201).json({ id: qid });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/quotations', verifyToken, (req, res) => {
  const rows = db.prepare('SELECT id, quotation_no, hospital, quotation_date, grand_total, status FROM quotations ORDER BY created_at DESC').all();
  res.json(rows);
});

app.get('/api/quotations/:id', verifyToken, (req, res) => {
  const { id } = req.params;
  const quotation = db.prepare('SELECT * FROM quotations WHERE id = ?').get(id);
  if (!quotation) return res.status(404).json({ error: 'Not found' });

  const otRows = db.prepare('SELECT * FROM quotation_ots WHERE quotation_id = ? ORDER BY ot_index').all(id);
  const ots = [];
  for (const ot of otRows) {
    const doorRows = db.prepare('SELECT * FROM quotation_ot_doors WHERE quotation_ot_id = ?').all(ot.id);
    ots.push({
      id: ot.id,
      name: ot.name,
      type: ot.ot_type,
      dimensions: { l: ot.length_ft, w: ot.width_ft, h: ot.height_ft },
      materials: {
        wallType: ot.wall_panel_type,
        ceilType: ot.ceiling_panel_type,
        covingType: ot.coving_type,
        floorType: ot.flooring_type,
        selfLeveling: ot.self_leveling ? 'Yes' : 'No'
      },
      equipment: {
        anaesthPendant: ot.anaesth_pendant,
        surgPendant: ot.surg_pendant,
        passBox: ot.pass_box_qty,
        storageCab: ot.storage_cab_qty,
        ledLights: ot.led_lights_qty,
        xrayViewer: ot.xray_viewer,
        writingBoard: ot.writing_board_qty,
        hvacPanel: ot.hvac_panel ? 'Yes' : 'No',
        touchPanelSize: ot.touch_panel_size,
        outsidePanelSize: ot.outside_panel_size,
        ismartDev: ot.ismart ? 'Yes' : 'No',
        shrmSys: ot.shrm ? 'Yes' : 'No'
      },
      otFloor: ot.ot_floor,
      ahuFloor: ot.ahu_floor,
      doors: doorRows.map(d => ({
        type: d.door_type,
        size: d.size,
        leaf: d.leaf,
        material: d.material,
        visionPanel: d.vision_panel ? 'Yes' : 'No',
        autoOperator: d.auto_operator ? 'Yes' : 'No',
        location: d.location
      })),
      otConfig: ot.ot_config,
      configured: true
    });
  }

  const hvac = db.prepare('SELECT * FROM quotation_hvac WHERE quotation_id = ?').get(id) || {};
  const project = {
    number: quotation.quotation_no,
    hospital: quotation.hospital,
    address: quotation.address,
    city: quotation.city,
    state: quotation.state,
    contact: quotation.contact,
    phone: quotation.phone,
    email: quotation.email,
    date: quotation.quotation_date,
    validUntil: quotation.valid_until,
    transport: quotation.transport,
    gstPct: quotation.gst_percent,
    subtotal: quotation.subtotal,
    gstAmount: quotation.gst_amount,
    grandTotal: quotation.grand_total,
    latitude: quotation.latitude,
    longitude: quotation.longitude,
    elevation: quotation.elevation,
    enquiryId: quotation.enquiry_id
  };

  res.json({ project, ots, hvac: {
    outTemp: hvac.outside_temp,
    outHumid: hvac.outside_humidity,
    inTemp: hvac.inside_temp,
    inHumid: hvac.inside_humidity,
    designTR: hvac.design_tr,
    cfm: hvac.cfm,
    hepa: hvac.hepa_position,
    plenum: hvac.plenum_type,
    ductType: hvac.duct_type,
    ductArea: hvac.duct_area_sqft,
    ahuSkin: hvac.ahu_skin,
    staticPressure: hvac.static_pressure,
    motorType: hvac.motor_type,
    fireDamper: hvac.fire_damper ? 'Yes' : 'No',
    partTest: hvac.particle_test ? 'Yes' : 'No',
    airTest: hvac.airflow_test ? 'Yes' : 'No',
    dopTest: hvac.dop_test ? 'Yes' : 'No'
  } });
});

app.delete('/api/quotations/:id', verifyToken, (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM quotations WHERE id = ?').run(id);
  logActivity(req, 'DELETE', 'quotation', id, null, null);
  res.json({ message: 'Deleted' });
});

// ==================== RATES ====================
app.get('/api/rates', verifyToken, (req, res) => {
  const rows = db.prepare('SELECT * FROM rates').all();
  const grouped = {};
  for (const row of rows) {
    if (!grouped[row.category]) grouped[row.category] = [];
    grouped[row.category].push({ id: row.item_key, label: row.label, value: row.value, unit: row.unit });
  }
  res.json(grouped);
});

app.put('/api/rates/:category/:itemKey', verifyToken, checkRole('admin'), (req, res) => {
  const { category, itemKey } = req.params;
  const { value } = req.body;
  db.prepare('UPDATE rates SET value = ?, updated_by = ? WHERE category = ? AND item_key = ?')
    .run(value, req.user.id, category, itemKey);
  logActivity(req, 'UPDATE', 'rate', `${category}:${itemKey}`, null, { value });
  res.json({ message: 'Rate updated' });
});

// ==================== RESET RATES (NEW) ====================
app.post('/api/rates/reset', verifyToken, checkRole('admin'), (req, res) => {
  try {
    // Delete all existing rates
    db.prepare('DELETE FROM rates').run();
    // Re-insert default rates (same as initialisation)
    const defaultRates = {
      panel: [
        { id:'ppgl_50mm', label:'PPGL Panel 50mm', value:2200, unit:'₹/sqft' },
        { id:'ppgl_100mm', label:'PPGL Panel 100mm', value:2450, unit:'₹/sqft' },
        { id:'ss304_50mm', label:'SS304 Panel 50mm', value:3500, unit:'₹/sqft' },
        { id:'ss304_100mm', label:'SS304 Panel 100mm', value:3800, unit:'₹/sqft' },
        { id:'gi_50mm', label:'GI Panel 50mm', value:1800, unit:'₹/sqft' },
        { id:'gi_100mm', label:'GI Panel 100mm', value:2000, unit:'₹/sqft' }
      ],
      flooring: [
        { id:'epoxy', label:'Epoxy Flooring', value:350, unit:'₹/sqft' },
        { id:'vinyl_2mm', label:'Vinyl 2mm', value:420, unit:'₹/sqft' },
        { id:'vinyl_3mm', label:'Vinyl 3mm', value:480, unit:'₹/sqft' },
        { id:'conductive_vinyl', label:'Conductive Vinyl', value:650, unit:'₹/sqft' },
        { id:'self_leveling', label:'Self Leveling Compound', value:85, unit:'₹/sqft' }
      ],
      ceiling: [
        { id:'ppgl_50mm', label:'Ceiling PPGL 50mm', value:1900, unit:'₹/sqft' },
        { id:'ss304_50mm', label:'Ceiling SS304 50mm', value:2800, unit:'₹/sqft' },
        { id:'gi_50mm', label:'Ceiling GI 50mm', value:1500, unit:'₹/sqft' }
      ],
      coving: [
        { id:'aluminum', label:'Aluminum Coving', value:365, unit:'₹/rft' },
        { id:'ss304', label:'SS304 Coving', value:480, unit:'₹/rft' },
        { id:'ppgl', label:'PPGL Coving', value:290, unit:'₹/rft' }
      ],
      door: [
        { id:'sliding_1800x2100', label:'Sliding Door 1800×2100', value:175000, unit:'₹/unit' },
        { id:'sliding_1200x2100', label:'Sliding Door 1200×2100', value:145000, unit:'₹/unit' },
        { id:'swing_1200x2100', label:'Swing Door 1200×2100', value:95000, unit:'₹/unit' }
      ],
      hvac: [
        { id:'ahu_per_tr', label:'AHU (per TR)', value:120000, unit:'₹/TR' },
        { id:'odu_per_tr', label:'ODU (per TR)', value:85000, unit:'₹/TR' },
        { id:'duct_gi', label:'GI Ducting', value:220, unit:'₹/sqft' },
        { id:'duct_ss', label:'SS Ducting', value:450, unit:'₹/sqft' },
        { id:'duct_pi', label:'PI Ducting', value:380, unit:'₹/sqft' },
        { id:'duct_al', label:'Aluminum Ducting', value:250, unit:'₹/sqft' },
        { id:'insulation', label:'Duct Insulation', value:45, unit:'₹/sqft' },
        { id:'grilles', label:'Supply/Return Grilles', value:8500, unit:'₹/unit' },
        { id:'vcd', label:'Volume Control Damper', value:6500, unit:'₹/unit' },
        { id:'fire_damper', label:'Fire Damper', value:15000, unit:'₹/unit' }
      ],
      plenum: [
        { id:'laf_10x10', label:'LAF Plenum 10×10', value:340000, unit:'₹/unit' },
        { id:'laf_8x6', label:'LAF Plenum 8×6', value:220000, unit:'₹/unit' },
        { id:'laf_6x6', label:'LAF Plenum 6×6', value:165000, unit:'₹/unit' }
      ],
      hepa: [
        { id:'h14_24x24', label:'HEPA H14 24×24', value:25000, unit:'₹/unit' },
        { id:'h14_12x24', label:'HEPA H14 12×24', value:15000, unit:'₹/unit' },
        { id:'pre_filter', label:'Pre Filter', value:3500, unit:'₹/unit' }
      ],
      pendant: [
        { id:'anaesthesia_single', label:'Anaesthesia Pendant Single', value:295000, unit:'₹/unit' },
        { id:'anaesthesia_double', label:'Anaesthesia Pendant Double', value:385000, unit:'₹/unit' },
        { id:'surgeon_single', label:'Surgeon Pendant Single', value:335000, unit:'₹/unit' },
        { id:'surgeon_double', label:'Surgeon Pendant Double', value:425000, unit:'₹/unit' }
      ],
      controls: [
        { id:'hvac_panel', label:'HVAC Control Panel IP65', value:105000, unit:'₹/unit' },
        { id:'touch_10', label:'Surgeon Touch Panel 10"', value:45000, unit:'₹/unit' },
        { id:'touch_15', label:'Surgeon Touch Panel 15"', value:65000, unit:'₹/unit' },
        { id:'touch_22', label:'Surgeon Touch Panel 22"', value:95000, unit:'₹/unit' },
        { id:'touch_32', label:'Surgeon Touch Panel 32"', value:195000, unit:'₹/unit' },
        { id:'touch_43', label:'Surgeon Touch Panel 43"', value:285000, unit:'₹/unit' },
        { id:'touch_55', label:'Surgeon Touch Panel 55"', value:395000, unit:'₹/unit' },
        { id:'outside_10', label:'Outside Panel 10"', value:35000, unit:'₹/unit' },
        { id:'outside_15', label:'Outside Panel 15"', value:55000, unit:'₹/unit' },
        { id:'outside_22', label:'Outside Panel 22"', value:85000, unit:'₹/unit' },
        { id:'outside_32', label:'Outside Panel 32"', value:150000, unit:'₹/unit' },
        { id:'ismart', label:'iSmart Device', value:65000, unit:'₹/unit' },
        { id:'shrm', label:'SHRM System', value:95000, unit:'₹/unit' }
      ],
      lighting: [
        { id:'led_2x2_36w', label:'LED 2×2 36W Panel', value:4500, unit:'₹/unit' },
        { id:'xray_twin', label:'X-Ray Viewer Twin', value:38000, unit:'₹/unit' },
        { id:'xray_single', label:'X-Ray Viewer Single', value:22000, unit:'₹/unit' }
      ],
      equipment: [
        { id:'pass_box', label:'Pass Box', value:85000, unit:'₹/unit' },
        { id:'storage_cabinet', label:'Storage Cabinet SS', value:48000, unit:'₹/unit' },
        { id:'writing_board', label:'Magnetic Writing Board', value:8500, unit:'₹/unit' }
      ],
      validation: [
        { id:'particle_count', label:'Particle Count Test', value:25000, unit:'₹/test' },
        { id:'airflow_test', label:'Airflow Test', value:15000, unit:'₹/test' },
        { id:'dop_test', label:'DOP Integrity Test', value:18000, unit:'₹/test' }
      ],
      charges: [
        { id:'labor_panel', label:'Panel Installation Labour', value:180, unit:'₹/sqft' },
        { id:'hvac_labor_pct', label:'HVAC Installation Labour (%)', value:12, unit:'%' },
        { id:'electrical', label:'Electrical Works (Lumpsum)', value:25000, unit:'₹' },
        { id:'commissioning', label:'Commissioning & Testing', value:45000, unit:'₹' },
        { id:'transport_local', label:'Transport (Local)', value:50000, unit:'₹' },
        { id:'transport_regional', label:'Transport (Regional)', value:125000, unit:'₹' },
        { id:'transport_national', label:'Transport (National)', value:200000, unit:'₹' },
        { id:'gst_pct', label:'GST (%)', value:18, unit:'%' }
      ]
    };
    const insertRate = db.prepare(`
      INSERT INTO rates (id, category, item_key, label, unit, value)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const [cat, items] of Object.entries(defaultRates)) {
      for (const item of items) {
        insertRate.run(uuidv4(), cat, item.id, item.label, item.unit, item.value);
      }
    }
    logActivity(req, 'RESET', 'rates', 'all', null, null);
    res.json({ message: 'Rates reset to defaults' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ==================== WEATHER ====================
app.get('/api/weather', verifyToken, (req, res) => {
  const { lat, lng } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });
  const cached = db.prepare(`
    SELECT temperature, humidity FROM weather_cache
    WHERE lat = ? AND lng = ? AND fetched_at > datetime('now', '-2 hours')
  `).get(lat, lng);
  if (cached) {
    return res.json({ temperature: cached.temperature, humidity: cached.humidity });
  }
  const apiKey = process.env.WEATHER_API_KEY;
  if (!apiKey) {
    return res.json({ temperature: 30, humidity: 60 });
  }
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${apiKey}&units=metric`;
  axios.get(url).then(response => {
    const temp = response.data.main.temp;
    const humidity = response.data.main.humidity;
    db.prepare(`
      INSERT INTO weather_cache (lat, lng, temperature, humidity, fetched_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(lat, lng) DO UPDATE SET temperature=excluded.temperature, humidity=excluded.humidity, fetched_at=excluded.fetched_at
    `).run(lat, lng, temp, humidity);
    res.json({ temperature: temp, humidity });
  }).catch(err => {
    console.error(err);
    res.status(500).json({ error: 'Weather fetch failed' });
  });
});

// ==================== DASHBOARD (FIXED SQL) ====================
app.get('/api/dashboard/stats', verifyToken, (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as total FROM enquiries').get().total;
  const active = db.prepare("SELECT COUNT(*) as active FROM enquiries WHERE stage NOT IN ('Won','Lost')").get().active;
  const won = db.prepare("SELECT COUNT(*) as won FROM enquiries WHERE stage = 'Won'").get().won;
  const totalValue = db.prepare('SELECT SUM(estimated_value) as totalValue FROM enquiries').get().totalValue || 0;
  const recent = db.prepare('SELECT * FROM enquiries ORDER BY created_at DESC LIMIT 6').all();
  res.json({ total, active, won, totalValue, recent });
});

// ==================== USERS ====================
app.get('/api/users', verifyToken, checkRole('admin'), (req, res) => {
  const users = db.prepare('SELECT id, name, username, role, active FROM users').all();
  res.json(users);
});

app.post('/api/users', verifyToken, checkRole('admin'), async (req, res) => {
  const { name, username, password, role, active } = req.body;
  if (!name || !username || !password) return res.status(400).json({ error: 'Missing required fields' });
  const hashed = await bcrypt.hash(password, 10);
  const id = uuidv4();
  db.prepare('INSERT INTO users (id, name, username, password_hash, role, active) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, name, username, hashed, role, active ? 1 : 0);
  logActivity(req, 'CREATE', 'user', id, null, { name, username, role });
  res.status(201).json({ id });
});

app.put('/api/users/:id', verifyToken, checkRole('admin'), async (req, res) => {
  const { id } = req.params;
  const { name, username, password, role, active } = req.body;
  const updates = [];
  const values = [];
  if (name) { updates.push('name = ?'); values.push(name); }
  if (username) { updates.push('username = ?'); values.push(username); }
  if (password) { updates.push('password_hash = ?'); values.push(await bcrypt.hash(password, 10)); }
  if (role) { updates.push('role = ?'); values.push(role); }
  if (active !== undefined) { updates.push('active = ?'); values.push(active ? 1 : 0); }
  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
  values.push(id);
  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  logActivity(req, 'UPDATE', 'user', id, null, req.body);
  res.json({ message: 'User updated' });
});

app.delete('/api/users/:id', verifyToken, checkRole('admin'), (req, res) => {
  const { id } = req.params;
  if (id === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  logActivity(req, 'DELETE', 'user', id, null, null);
  res.json({ message: 'User deleted' });
});

// ==================== ROOT ROUTE ====================
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ==================== START SERVER ====================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));