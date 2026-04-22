'use strict';

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { randomUUID } = require('crypto');

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data/smartview.db');
console.log('Seeding extra customers into:', DB_PATH);

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) { console.error('DB open error:', err); process.exit(1); }
});

function rand(min, max) { return min + Math.random() * (max - min); }
function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
function r2(v) { return Math.round(v * 100) / 100; }
function pick(arr) { return arr[randInt(0, arr.length - 1)]; }

const EXTRA = 900;
const HISTORY_DAYS = 90;
const HIST_BATCH = 200;

const FIRST = ['James','Mary','John','Patricia','Robert','Jennifer','Michael','Linda','William','Barbara','David','Elizabeth','Richard','Susan','Joseph','Jessica','Thomas','Sarah','Charles','Karen','Daniel','Nancy','Matthew','Lisa','Anthony','Betty','Mark','Margaret','Donald','Sandra'];
const LAST  = ['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez','Hernandez','Lopez','Gonzalez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin','Lee','Perez','Thompson','White','Harris','Sanchez','Clark','Ramirez','Lewis','Robinson'];

const PROFILES = [
  ...Array(70).fill('healthy'),
  ...Array(10).fill('poor'),
  ...Array(12).fill('intermittent'),
  ...Array(8).fill('oneoff'),
];

const RANGES = {
  healthy:      { lat:[5,22],   jit:[0.4,2.8], pl:[0,0.15], snr:[36,46] },
  poor:         { lat:[70,210], jit:[14,35],   pl:[3.5,10], snr:[13,24] },
  intermittent: { lat:[5,20],   jit:[0.4,25],  pl:[0,5],    snr:[22,45] },
  oneoff:       { lat:[5,20],   jit:[0.4,2.5], pl:[0,0.1],  snr:[36,46] },
};

function makeMetric(profile) {
  const r = RANGES[profile];
  const lat = r2(rand(r.lat[0], r.lat[1]));
  const jit = r2(rand(r.jit[0], r.jit[1]));
  const pl  = r2(rand(r.pl[0],  r.pl[1]));
  const snr = r2(rand(r.snr[0], r.snr[1]));
  const health = lat < 50 && pl < 1 && snr > 30 ? 'Good'
               : lat < 100 && pl < 5 && snr > 20 ? 'Warn'
               : 'Bad';
  return { lat, jit, pl, snr, health };
}

function runAsync(sql, params = []) {
  return new Promise((resolve, reject) =>
    db.run(sql, params, function (err) { err ? reject(err) : resolve(this); })
  );
}

function execAsync(sql) {
  return new Promise((resolve, reject) =>
    db.exec(sql, (err) => err ? reject(err) : resolve())
  );
}

function getAsync(sql, params = []) {
  return new Promise((resolve, reject) =>
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row))
  );
}

async function batchInsertHistory(rows) {
  // rows: [id, customer_id, latency, jitter, packet_loss, snr, health_score, recorded_at]
  for (let i = 0; i < rows.length; i += HIST_BATCH) {
    const chunk = rows.slice(i, i + HIST_BATCH);
    const placeholders = chunk.map(() => '(?,?,?,?,?,?,?,?)').join(',');
    await runAsync(
      `INSERT INTO modem_history (id, customer_id, latency, jitter, packet_loss, snr, health_score, recorded_at) VALUES ${placeholders}`,
      chunk.flat()
    );
  }
}

async function seed() {
  await execAsync('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');

  const existing = (await getAsync('SELECT COUNT(*) as n FROM customers')).n || 0;
  console.log(`Existing customers: ${existing}. Adding ${EXTRA} more...`);

  const startIndex = existing + 10000;
  const now = new Date().toISOString();
  const totalHours = HISTORY_DAYS * 24;

  await execAsync('BEGIN TRANSACTION');

  try {
    for (let i = 0; i < EXTRA; i++) {
      const profile  = PROFILES[i % PROFILES.length];
      const custId   = randomUUID();
      const name     = `${pick(FIRST)} ${pick(LAST)}`;
      const email    = `${name.toLowerCase().replace(' ', '.')}.${startIndex + i}@example.com`;

      await runAsync(
        `INSERT INTO customers (id, name, email, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
        [custId, name, email, now, now]
      );

      // Current stat
      const s = makeMetric(profile);
      await runAsync(
        `INSERT INTO modem_stats (id, customer_id, latency, jitter, packet_loss, snr, health_score, recorded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [randomUUID(), custId, s.lat, s.jit, s.pl, s.snr, s.health, now]
      );

      // History rows built in memory then batch-inserted
      const histRows = [];
      for (let h = 0; h < totalHours; h++) {
        const m  = makeMetric(profile);
        const ts = new Date(Date.now() - (totalHours - h) * 3600000).toISOString();
        histRows.push([randomUUID(), custId, m.lat, m.jit, m.pl, m.snr, m.health, ts]);
      }
      await batchInsertHistory(histRows);

      if ((i + 1) % 50 === 0) {
        await execAsync('COMMIT');
        console.log(`  ${i + 1}/${EXTRA} customers seeded`);
        await execAsync('BEGIN TRANSACTION');
      }
    }

    await execAsync('COMMIT');
    const total = (await getAsync('SELECT COUNT(*) as n FROM customers')).n;
    const histTotal = (await getAsync('SELECT COUNT(*) as n FROM modem_history')).n;
    console.log(`✓ Done. Customers: ${total}, history rows: ${histTotal}`);
  } catch (err) {
    await execAsync('ROLLBACK');
    throw err;
  }
}

seed()
  .then(() => db.close())
  .catch((err) => { console.error('✗ Failed:', err); process.exit(1); });
