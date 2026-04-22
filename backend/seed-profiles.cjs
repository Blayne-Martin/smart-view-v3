'use strict';

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data/smartview.db');
console.log('Applying chronic/one-off profiles into:', DB_PATH);

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

function makeChronic() {
  const lat = r2(rand(110, 280));
  const jit = r2(rand(20, 60));
  const pl  = r2(rand(6, 20));
  const snr = r2(rand(8, 18));
  return { lat, jit, pl, snr, health: 'Bad' };
}

function makeOneOff() {
  const lat = r2(rand(130, 350));
  const jit = r2(rand(30, 90));
  const pl  = r2(rand(8, 30));
  const snr = r2(rand(6, 16));
  return { lat, jit, pl, snr, health: 'Bad' };
}

async function seed() {
  await execAsync('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');

  const HISTORY_DAYS = 90;
  const now = Date.now();
  const startMs = now - HISTORY_DAYS * 24 * 3600 * 1000;

  // Pull 250 random customers, split into chronic (100) and one-off (150)
  const candidates = await allAsync(
    `SELECT id FROM customers ORDER BY RANDOM() LIMIT 250`
  );
  const chronic = candidates.slice(0, 100);
  const oneoff  = candidates.slice(100);

  // ── Chronic: persistent bad metrics across all history ─────────────────────
  console.log(`Applying chronic issues to ${chronic.length} customers...`);
  await execAsync('BEGIN TRANSACTION');
  try {
    for (let i = 0; i < chronic.length; i++) {
      const custId = chronic[i].id;

      // Update every history row with consistently bad (but slightly varied) metrics
      // Do it in two passes to introduce mild variation
      const m1 = makeChronic();
      const m2 = makeChronic();
      const midpoint = new Date(startMs + (now - startMs) / 2).toISOString();
      const start    = new Date(startMs).toISOString();

      await runAsync(
        `UPDATE modem_history SET latency=?, jitter=?, packet_loss=?, snr=?, health_score=?
         WHERE customer_id=? AND recorded_at >= ?  AND recorded_at < ?`,
        [m1.lat, m1.jit, m1.pl, m1.snr, m1.health, custId, start, midpoint]
      );
      await runAsync(
        `UPDATE modem_history SET latency=?, jitter=?, packet_loss=?, snr=?, health_score=?
         WHERE customer_id=? AND recorded_at >= ?`,
        [m2.lat, m2.jit, m2.pl, m2.snr, m2.health, custId, midpoint]
      );

      // Current stat also bad
      await runAsync(
        `UPDATE modem_stats SET latency=?, jitter=?, packet_loss=?, snr=?, health_score=?
         WHERE customer_id=?`,
        [m2.lat, m2.jit, m2.pl, m2.snr, m2.health, custId]
      );

      if ((i + 1) % 25 === 0) {
        await execAsync('COMMIT');
        console.log(`  ${i + 1}/${chronic.length} chronic customers updated`);
        await execAsync('BEGIN TRANSACTION');
      }
    }
    await execAsync('COMMIT');
  } catch (err) {
    await execAsync('ROLLBACK');
    throw err;
  }

  // ── One-off: single incident window somewhere in history, current = healthy ─
  console.log(`Applying one-off issues to ${oneoff.length} customers...`);
  await execAsync('BEGIN TRANSACTION');
  try {
    for (let i = 0; i < oneoff.length; i++) {
      const custId = oneoff[i].id;

      // Single incident: 4–36 hours, placed randomly but at least 3 days from now
      const latestStart = now - 3 * 24 * 3600 * 1000;
      const incidentStartMs = startMs + Math.random() * (latestStart - startMs);
      const durationMs      = Math.floor(rand(4, 36)) * 3600 * 1000;
      const incidentEndMs   = incidentStartMs + durationMs;

      const incidentStart = new Date(incidentStartMs).toISOString();
      const incidentEnd   = new Date(incidentEndMs).toISOString();

      const m = makeOneOff();
      await runAsync(
        `UPDATE modem_history SET latency=?, jitter=?, packet_loss=?, snr=?, health_score=?
         WHERE customer_id=? AND recorded_at >= ? AND recorded_at < ?`,
        [m.lat, m.jit, m.pl, m.snr, m.health, custId, incidentStart, incidentEnd]
      );

      // Ensure current stat looks healthy (don't touch if already good)
      // Only reset if it's currently bad/warn from a previous script run
      await runAsync(
        `UPDATE modem_stats
         SET latency = MAX(5, MIN(22, latency * 0.15 + 5)),
             jitter = MAX(0.4, MIN(2.8, jitter * 0.1 + 0.4)),
             packet_loss = MAX(0, MIN(0.15, packet_loss * 0.02)),
             snr = MAX(36, MIN(46, snr * 0.8 + 36)),
             health_score = 'Good'
         WHERE customer_id = ? AND health_score != 'Good'`,
        [custId]
      );

      if ((i + 1) % 50 === 0) {
        await execAsync('COMMIT');
        console.log(`  ${i + 1}/${oneoff.length} one-off customers updated`);
        await execAsync('BEGIN TRANSACTION');
      }
    }
    await execAsync('COMMIT');
  } catch (err) {
    await execAsync('ROLLBACK');
    throw err;
  }

  console.log('✓ Done.');
}

seed()
  .then(() => db.close())
  .catch((err) => { console.error('✗ Failed:', err); process.exit(1); });
