'use strict';

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'smartview.db');
console.log('Seeding database at:', DB_PATH);

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) { console.error('DB open error:', err); process.exit(1); }
});

// ── Helpers ────────────────────────────────────────────────────────────────────
function rand(min, max) { return min + Math.random() * (max - min); }
function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
function r2(v) { return Math.round(v * 100) / 100; }
function pick(arr) { return arr[randInt(0, arr.length - 1)]; }
function isoAt(msAgo) { return new Date(Date.now() - msAgo).toISOString(); }

// ── Config ─────────────────────────────────────────────────────────────────────
const TOTAL = 100;
const HISTORY_DAYS = 90;

const FIRST = ['James','Mary','John','Patricia','Robert','Jennifer','Michael','Linda','William','Barbara','David','Elizabeth','Richard','Susan','Joseph','Jessica','Thomas','Sarah','Charles','Karen'];
const LAST  = ['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez','Hernandez','Lopez','Gonzalez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin'];

const COMPANIES = ['Acme Corp', 'Tech Solutions', 'Global Systems', 'Digital Services', 'Innovation Labs', 'Cloud Systems', 'Data Works', 'Net Solutions', 'IT Services', 'Cyber Security'];
const CITIES = ['San Francisco', 'New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas'];
const COUNTRIES = ['USA', 'Canada', 'Mexico', 'UK', 'Germany', 'France', 'Japan', 'Australia'];

// Profile distribution
const PROFILES = [
  ...Array(70).fill('healthy'),
  ...Array(10).fill('poor'),
  ...Array(12).fill('intermittent'),
  ...Array(8).fill('oneoff'),
];

const RANGES = {
  healthy:      { dl:[150,300], ul:[30,50], lat:[5,22],   jit:[0.4,2.8], pl:[0,0.15], snr:[36,46] },
  poor:         { dl:[5,20],    ul:[1,5],   lat:[70,210], jit:[14,35],   pl:[3.5,10], snr:[13,24] },
  intermittent: { dl:[80,200],  ul:[15,40], lat:[5,20],   jit:[0.4,25],  pl:[0,5],    snr:[22,45] },
  oneoff:       { dl:[200,300], ul:[40,50], lat:[5,20],   jit:[0.4,2.5], pl:[0,0.1],  snr:[36,46] },
};

function makeMetric(profile) {
  const r = RANGES[profile];
  const dl = r2(rand(r.dl[0], r.dl[1]));
  const ul = r2(rand(r.ul[0], r.ul[1]));
  const lat = r2(rand(r.lat[0], r.lat[1]));
  const jit = r2(rand(r.jit[0], r.jit[1]));
  const pl  = r2(rand(r.pl[0],  r.pl[1]));
  const snr = r2(rand(r.snr[0], r.snr[1]));
  return { dl, ul, lat, jit, pl, snr, uptime: r2(99 + Math.random()) };
}

// ── Schema ─────────────────────────────────────────────────────────────────────
const schema = `
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;

CREATE TABLE IF NOT EXISTS customers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  email      TEXT    NOT NULL UNIQUE,
  phone      TEXT    NOT NULL,
  company    TEXT,
  address    TEXT,
  city       TEXT,
  country    TEXT,
  created_at TEXT    DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS modem_stats (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id     INTEGER NOT NULL UNIQUE,
  download_mbps   REAL    NOT NULL,
  upload_mbps     REAL    NOT NULL,
  latency_ms      REAL    NOT NULL,
  jitter_ms       REAL    NOT NULL,
  packet_loss_pct REAL    NOT NULL,
  snr_db          REAL    NOT NULL,
  uptime_pct      REAL    NOT NULL,
  modem_model     TEXT,
  last_checked    TEXT    DEFAULT (datetime('now')),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS modem_history (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id     INTEGER NOT NULL,
  recorded_at     TEXT    NOT NULL,
  download_mbps   REAL,
  upload_mbps     REAL,
  latency_ms      REAL,
  packet_loss_pct REAL,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS modem_daily (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id         INTEGER NOT NULL,
  date                TEXT    NOT NULL,
  avg_download_mbps   REAL,
  avg_upload_mbps     REAL,
  avg_latency_ms      REAL,
  avg_packet_loss_pct REAL,
  avg_jitter_ms       REAL,
  avg_snr_db          REAL,
  avg_uptime_pct      REAL,
  UNIQUE(customer_id, date),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  version    TEXT    PRIMARY KEY,
  applied_at TEXT    DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_modem_history_customer ON modem_history(customer_id);
CREATE INDEX IF NOT EXISTS idx_modem_history_customer_time ON modem_history(customer_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_modem_daily_customer ON modem_daily(customer_id);
CREATE INDEX IF NOT EXISTS idx_modem_daily_customer_date ON modem_daily(customer_id, date);
CREATE INDEX IF NOT EXISTS idx_modem_stats_customer ON modem_stats(customer_id);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
`;

function runAsync(sql, params = []) {
  return new Promise((resolve, reject) =>
    db.run(sql, params, function (err) { err ? reject(err) : resolve(this); })
  );
}

async function seed() {
  // Apply schema
  await new Promise((resolve, reject) =>
    db.exec(schema, (err) => (err ? reject(err) : resolve()))
  );

  // Check if already seeded
  const existing = await new Promise((resolve, reject) =>
    db.get('SELECT COUNT(*) as n FROM customers', (err, row) =>
      err ? reject(err) : resolve(row?.n || 0)
    )
  );
  if (existing > 0) {
    console.log(`✓ Database already has ${existing} customers — skipping seed.`);
    return;
  }

  console.log(`Seeding ${TOTAL} customers with modem data...`);

  const modems = ['Arris SB8200', 'Netgear CM700', 'Motorola MB8621', 'Arris SB6190', 'Netgear CM600'];

  for (let i = 0; i < TOTAL; i++) {
    const profile  = PROFILES[i % PROFILES.length];
    const name     = `${pick(FIRST)} ${pick(LAST)}`;
    const email    = `${name.toLowerCase().replace(' ', '.')}.${i}@example.com`;
    const phone    = `${randInt(200, 999)}-${randInt(200, 999)}-${randInt(1000, 9999)}`;
    const company  = pick(COMPANIES);
    const city     = pick(CITIES);
    const country  = pick(COUNTRIES);
    const now      = new Date().toISOString();

    // Insert customer
    const custRes = await new Promise((resolve, reject) =>
      db.run(
        `INSERT INTO customers (name, email, phone, company, city, country, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [name, email, phone, company, city, country, now],
        function (err) { err ? reject(err) : resolve(this.lastID); }
      )
    );

    const custId = custRes;

    // Current stats (1 record)
    const s = makeMetric(profile);
    await runAsync(
      `INSERT INTO modem_stats (customer_id, download_mbps, upload_mbps, latency_ms, jitter_ms,
                                packet_loss_pct, snr_db, uptime_pct, modem_model, last_checked)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [custId, s.dl, s.ul, s.lat, s.jit, s.pl, s.snr, s.uptime, pick(modems), now]
    );

    // History: one record per hour for HISTORY_DAYS
    const totalHours = HISTORY_DAYS * 24;
    for (let h = 0; h < totalHours; h++) {
      const m = makeMetric(profile);
      const ts = new Date(Date.now() - (totalHours - h) * 3600000).toISOString();
      await runAsync(
        `INSERT INTO modem_history (customer_id, recorded_at, download_mbps, upload_mbps, latency_ms, packet_loss_pct)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [custId, ts, m.dl, m.ul, m.lat, m.pl]
      );
    }

    // Daily aggregates: one record per day
    const dailyMap = new Map();
    const allHist = await new Promise((resolve, reject) =>
      db.all(
        'SELECT recorded_at, download_mbps, upload_mbps, latency_ms, packet_loss_pct FROM modem_history WHERE customer_id = ?',
        [custId],
        (err, rows) => err ? reject(err) : resolve(rows || [])
      )
    );

    for (const row of allHist) {
      const date = row.recorded_at.split('T')[0];
      if (!dailyMap.has(date)) {
        dailyMap.set(date, []);
      }
      dailyMap.get(date).push(row);
    }

    for (const [date, records] of dailyMap) {
      if (records.length > 0) {
        const avgDl = r2(records.reduce((s, r) => s + r.download_mbps, 0) / records.length);
        const avgUl = r2(records.reduce((s, r) => s + r.upload_mbps, 0) / records.length);
        const avgLat = r2(records.reduce((s, r) => s + r.latency_ms, 0) / records.length);
        const avgPl = r2(records.reduce((s, r) => s + r.packet_loss_pct, 0) / records.length);

        // For jitter and SNR, use values from current stats (approximation)
        const avgJit = s.jit;
        const avgSnr = s.snr;
        const avgUp = s.uptime;

        await runAsync(
          `INSERT OR IGNORE INTO modem_daily (customer_id, date, avg_download_mbps, avg_upload_mbps,
                                               avg_latency_ms, avg_packet_loss_pct, avg_jitter_ms, avg_snr_db, avg_uptime_pct)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [custId, date, avgDl, avgUl, avgLat, avgPl, avgJit, avgSnr, avgUp]
        );
      }
    }

    if ((i + 1) % 10 === 0) console.log(`  ${i + 1}/${TOTAL} customers seeded`);
  }

  console.log('✓ Seed complete.');
}

seed()
  .then(() => {
    console.log('✓ Database seeding finished successfully');
    db.close();
  })
  .catch((err) => { 
    console.error('✗ Seed failed:', err);
    process.exit(1);
  });
