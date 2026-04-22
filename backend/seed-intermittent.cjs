'use strict';

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data/smartview.db');
console.log('Injecting intermittent issues into:', DB_PATH);

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) { console.error('DB open error:', err); process.exit(1); }
});

function rand(min, max) { return min + Math.random() * (max - min); }
function r2(v) { return Math.round(v * 100) / 100; }

function allAsync(sql, params = []) {
  return new Promise((resolve, reject) =>
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows))
  );
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

// Degraded metric ranges during an incident
function makeIncidentMetric() {
  const lat = r2(rand(120, 350));
  const jit = r2(rand(25, 80));
  const pl  = r2(rand(5, 25));
  const snr = r2(rand(8, 19));
  return { lat, jit, pl, snr, health: 'Bad' };
}

// Recovering metric ranges (transitioning back to normal)
function makeRecoveringMetric() {
  const lat = r2(rand(60, 120));
  const jit = r2(rand(10, 30));
  const pl  = r2(rand(1, 6));
  const snr = r2(rand(19, 28));
  const health = lat < 100 && pl < 5 && snr > 20 ? 'Warn' : 'Bad';
  return { lat, jit, pl, snr, health };
}

async function seed() {
  await execAsync('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');

  // Pick 200 random customers to give intermittent issues to
  const candidates = await allAsync(
    `SELECT id FROM customers ORDER BY RANDOM() LIMIT 200`
  );
  console.log(`Applying intermittent issues to ${candidates.length} customers...`);

  const HISTORY_DAYS = 90;
  const now = Date.now();
  const startMs = now - HISTORY_DAYS * 24 * 3600 * 1000;

  await execAsync('BEGIN TRANSACTION');

  try {
    for (let i = 0; i < candidates.length; i++) {
      const custId = candidates[i].id;

      // 3–7 incident windows per customer
      const numIncidents = Math.floor(rand(3, 8));
      for (let inc = 0; inc < numIncidents; inc++) {
        // Random start within the 90-day window
        const incidentStartMs = startMs + Math.random() * (now - startMs - 24 * 3600 * 1000);
        // Incident lasts 2–18 hours
        const durationHours = Math.floor(rand(2, 18));
        const incidentEndMs = incidentStartMs + durationHours * 3600 * 1000;
        // Recovery period after: 1–6 hours
        const recoveryEndMs = incidentEndMs + Math.floor(rand(1, 6)) * 3600 * 1000;

        const incidentStart = new Date(incidentStartMs).toISOString();
        const incidentEnd   = new Date(incidentEndMs).toISOString();
        const recoveryEnd   = new Date(recoveryEndMs).toISOString();

        // Update history rows during the incident window
        const m = makeIncidentMetric();
        await runAsync(
          `UPDATE modem_history
           SET latency = ?, jitter = ?, packet_loss = ?, snr = ?, health_score = ?
           WHERE customer_id = ? AND recorded_at >= ? AND recorded_at < ?`,
          [m.lat, m.jit, m.pl, m.snr, m.health, custId, incidentStart, incidentEnd]
        );

        // Update recovery window with warning-level metrics
        const r = makeRecoveringMetric();
        await runAsync(
          `UPDATE modem_history
           SET latency = ?, jitter = ?, packet_loss = ?, snr = ?, health_score = ?
           WHERE customer_id = ? AND recorded_at >= ? AND recorded_at < ?`,
          [r.lat, r.jit, r.pl, r.snr, r.health, custId, incidentEnd, recoveryEnd]
        );
      }

      // Also update the current modem_stat for ~30 of these customers to look mid-incident
      if (i < 30) {
        const m = makeRecoveringMetric();
        await runAsync(
          `UPDATE modem_stats SET latency = ?, jitter = ?, packet_loss = ?, snr = ?, health_score = ?
           WHERE customer_id = ?`,
          [m.lat, m.jit, m.pl, m.snr, m.health, custId]
        );
      }

      if ((i + 1) % 50 === 0) {
        await execAsync('COMMIT');
        console.log(`  ${i + 1}/${candidates.length} customers updated`);
        await execAsync('BEGIN TRANSACTION');
      }
    }

    await execAsync('COMMIT');
    console.log('✓ Done.');
  } catch (err) {
    await execAsync('ROLLBACK');
    throw err;
  }
}

seed()
  .then(() => db.close())
  .catch((err) => { console.error('✗ Failed:', err); process.exit(1); });
