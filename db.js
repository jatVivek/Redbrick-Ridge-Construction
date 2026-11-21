'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const DB_PATH = path.join(dataDir, 'redbrick_ridge.db');

const db = new Database(DB_PATH);

// Performance pragmas
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Schema ──────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS enquiries (
    id            TEXT PRIMARY KEY,            -- e.g. "LEAD-101"
    name          TEXT NOT NULL,
    phone         TEXT NOT NULL,
    postcode      TEXT NOT NULL,
    trade_label   TEXT NOT NULL,
    property_type TEXT NOT NULL,
    scale_label   TEXT,
    plan_status   TEXT,
    timeline      TEXT,
    budget_range  TEXT,
    visit_pref    TEXT,
    notes         TEXT,
    status        TEXT NOT NULL DEFAULT 'New Enquiry',
    created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  );

  CREATE TABLE IF NOT EXISTS brand_config (
    id          INTEGER PRIMARY KEY CHECK (id = 1),  -- singleton row
    config_json TEXT NOT NULL DEFAULT '{}'
  );

  -- Seed the brand_config singleton row if absent
  INSERT OR IGNORE INTO brand_config (id, config_json) VALUES (1, '{}');
`);

module.exports = db;
