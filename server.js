'use strict';

require('dotenv').config();

const express      = require('express');
const helmet       = require('helmet');
const cors         = require('cors');
const rateLimit    = require('express-rate-limit');
const jwt          = require('jsonwebtoken');
const bcrypt       = require('bcryptjs');
const db           = require('./db');

// ─── Environment ─────────────────────────────────────────────────────────────

const PORT           = parseInt(process.env.PORT || '3001', 10);
const JWT_SECRET     = process.env.JWT_SECRET || 'redbrick_ridge_default_secret_key_change_in_production';
const OWNER_PIN_HASH = process.env.OWNER_PIN_HASH || '$2a$12$xbW8RdGyU0S.B1GzfThy/uJnpRjVCTdjvDbCpmGowQH9UFv2qc8Vm'; // default hash for '2468'
const CORS_ORIGIN    = (process.env.CORS_ORIGIN || 'http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173')
                         .split(',')
                         .map(o => o.trim());

// ─── App ─────────────────────────────────────────────────────────────────────

const app = express();

app.set('trust proxy', 1);

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(helmet({
  contentSecurityPolicy: false // Allow static HTML to integrate smoothly
}));

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    // If CORS_ORIGIN is '*' or contains origin
    if (CORS_ORIGIN.includes('*') || CORS_ORIGIN.includes(origin)) return cb(null, true);
    return cb(null, true); // Permissive for local / clone setups
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.use(express.json({ limit: '32kb' }));

// ─── Rate Limiters ────────────────────────────────────────────────────────────

const enquiryPostLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many enquiry submissions. Please wait 15 minutes before trying again.' },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please wait 15 minutes.' },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sanitise(str) {
  if (typeof str !== 'string') return str;
  return str
    .trim()
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')
    .replace(/[<>"'`]/g, '');
}

function generateId() {
  const digits = () => String(Math.floor(100 + Math.random() * 900));
  let id;
  let tries = 0;
  do {
    id = `LEAD-${digits()}`;
    tries++;
    if (tries > 50) throw new Error('Could not generate unique enquiry ID');
  } while (db.prepare('SELECT 1 FROM enquiries WHERE id = ?').get(id));
  return id;
}

function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing authorization token' });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const VALID_STATUSES = new Set(['New Enquiry', 'Site Visit Booked', 'Quote Sent', 'Won']);

// ─── Routes ───────────────────────────────────────────────────────────────────

/** Health */
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/** Auth: POST /api/auth/login */
app.post('/api/auth/login', loginLimiter, wrap(async (req, res) => {
  const { pin } = req.body || {};
  if (!pin || typeof pin !== 'string') {
    return res.status(400).json({ error: 'PIN must be a string' });
  }

  const match = await bcrypt.compare(pin, OWNER_PIN_HASH);
  if (!match) {
    return res.status(401).json({ error: 'Incorrect PIN' });
  }

  const token = jwt.sign({ role: 'owner' }, JWT_SECRET, { expiresIn: '8h' });
  return res.json({ token });
}));

/** Enquiries: GET /api/enquiries (Protected) */
app.get('/api/enquiries', requireAuth, wrap(async (req, res) => {
  const { status, limit = 200, offset = 0 } = req.query;
  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 200, 1), 500);
  const parsedOffset = Math.max(parseInt(offset, 10) || 0, 0);

  let rows;
  if (status && VALID_STATUSES.has(status)) {
    rows = db.prepare(`
      SELECT id, name, phone, postcode, trade_label AS tradeLabel, property_type AS propertyType,
             scale_label AS scaleLabel, plan_status AS planStatus, timeline, budget_range AS budgetRange,
             visit_pref AS visitPref, notes, status, created_at AS createdAt
      FROM enquiries WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?
    `).all(status, parsedLimit, parsedOffset);
  } else {
    rows = db.prepare(`
      SELECT id, name, phone, postcode, trade_label AS tradeLabel, property_type AS propertyType,
             scale_label AS scaleLabel, plan_status AS planStatus, timeline, budget_range AS budgetRange,
             visit_pref AS visitPref, notes, status, created_at AS createdAt
      FROM enquiries ORDER BY created_at DESC LIMIT ? OFFSET ?
    `).all(parsedLimit, parsedOffset);
  }

  return res.json({ enquiries: rows, count: rows.length });
}));

/** Enquiries: POST /api/enquiries (Public) */
app.post('/api/enquiries', enquiryPostLimiter, wrap(async (req, res) => {
  const body = req.body || {};
  const sanitisedName = sanitise(body.name || '');
  const sanitisedPhone = sanitise(body.phone || '');
  const sanitisedPostcode = sanitise(body.postcode || '').toUpperCase();
  const sanitisedTrade = sanitise(body.tradeLabel || 'General Construction');
  const sanitisedProperty = sanitise(body.propertyType || 'Residential');
  const sanitisedScale = sanitise(body.scaleLabel || 'Standard');
  const sanitisedPlan = sanitise(body.planStatus || 'Need drawings & engineering');
  const sanitisedTimeline = sanitise(body.timeline || 'Flexible (within 3 months)');
  const sanitisedBudget = sanitise(body.budgetRange || 'To Quote');
  const sanitisedVisit = sanitise(body.visitPref || 'Flexible');
  const sanitisedNotes = sanitise(body.notes || '');

  if (!sanitisedName || !sanitisedPhone || !sanitisedPostcode) {
    return res.status(400).json({ error: 'Name, phone, and postcode are required' });
  }

  const id = body.id && /^LEAD-\d{3,6}$/.test(body.id) ? body.id : generateId();
  const status = body.status && VALID_STATUSES.has(body.status) ? body.status : 'New Enquiry';

  db.prepare(`
    INSERT OR REPLACE INTO enquiries (id, name, phone, postcode, trade_label, property_type, scale_label, plan_status, timeline, budget_range, visit_pref, notes, status)
    VALUES (@id, @name, @phone, @postcode, @trade_label, @property_type, @scale_label, @plan_status, @timeline, @budget_range, @visit_pref, @notes, @status)
  `).run({
    id,
    name: sanitisedName,
    phone: sanitisedPhone,
    postcode: sanitisedPostcode,
    trade_label: sanitisedTrade,
    property_type: sanitisedProperty,
    scale_label: sanitisedScale,
    plan_status: sanitisedPlan,
    timeline: sanitisedTimeline,
    budget_range: sanitisedBudget,
    visit_pref: sanitisedVisit,
    notes: sanitisedNotes,
    status
  });

  const row = db.prepare(`
    SELECT id, name, phone, postcode, trade_label AS tradeLabel, property_type AS propertyType,
           scale_label AS scaleLabel, plan_status AS planStatus, timeline, budget_range AS budgetRange,
           visit_pref AS visitPref, notes, status, created_at AS createdAt
    FROM enquiries WHERE id = ?
  `).get(id);

  return res.status(201).json({ enquiry: row });
}));

/** Enquiries: PATCH /api/enquiries/:id/status (Protected) */
app.patch('/api/enquiries/:id/status', requireAuth, wrap(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body || {};

  if (!status || !VALID_STATUSES.has(status)) {
    return res.status(400).json({ error: `status must be one of: ${[...VALID_STATUSES].join(', ')}` });
  }

  const existing = db.prepare('SELECT id FROM enquiries WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Enquiry not found' });

  db.prepare('UPDATE enquiries SET status = ? WHERE id = ?').run(status, id);
  return res.json({ success: true, message: `Status updated to ${status}` });
}));

/** Enquiries: DELETE /api/enquiries/:id (Protected) */
app.delete('/api/enquiries/:id', requireAuth, wrap(async (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT id FROM enquiries WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Enquiry not found' });

  db.prepare('DELETE FROM enquiries WHERE id = ?').run(id);
  return res.json({ message: `Enquiry ${id} deleted` });
}));

/** Brand Config: GET /api/brand (Public) */
app.get('/api/brand', wrap(async (_req, res) => {
  const row = db.prepare('SELECT config_json FROM brand_config WHERE id = 1').get();
  let config = {};
  try { config = JSON.parse(row?.config_json || '{}'); } catch (_) {}
  return res.json({ brand: config });
}));

/** Brand Config: PUT /api/brand (Protected) */
app.put('/api/brand', requireAuth, wrap(async (req, res) => {
  const body = req.body;
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return res.status(400).json({ error: 'Request body must be a JSON object' });
  }

  const json = JSON.stringify(body);
  if (Buffer.byteLength(json, 'utf8') > 64 * 1024) {
    return res.status(413).json({ error: 'Brand config exceeds 64 KB limit' });
  }

  db.prepare('UPDATE brand_config SET config_json = ? WHERE id = 1').run(json);
  return res.json({ brand: body });
}));

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, _next) => {
  console.error(`[ERROR] ${req.method} ${req.url} —`, err.message || err);
  if (res.headersSent) return;
  return res.status(500).json({ error: 'An unexpected error occurred' });
});

app.listen(PORT, () => {
  console.log(`[Redbrick & Ridge API] Listening on http://localhost:${PORT}`);
});

module.exports = app;
