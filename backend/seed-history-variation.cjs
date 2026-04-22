'use strict';

// Injects day-to-day variation into modem_history health_score splits:
//  - ~15 fleet-wide "event" periods (1-3 days) where 20-50% of customers degrade
//  - Daily noise: each day a random 3-8% of healthy customers show mild issues
// This makes the Network History stacked-area chart visually interesting.

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data/smartview.db');
console.log('Adding history variation to:', DB_PATH);

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) { console.error('DB open error:', err); process.exit(1); }
});

function rand(min, max) { return min + Math.random() * (max - min); }
function r2(v) { return Math.round(v * 100) / 100; }

function execAsync(sql) {
  return new Promise((resolve, reject) =>
    db.exec(sql, (err) => err ? reject(err) : resolve())
  );
}
function runAsync(sql, params = []) {
  return new Promise((resolve, reject) =>
    db.run(sql, params, function (err) { err ? reject(err) : resolve(this); })
  );
}
function allAsync(sql, params = []) {
  return new Promise((resolve, reject) =>
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []))
  );
}

function degradedMetric(severity) {
  // severity: 'warn' or 'bad'
  if (severity === 'warn') {
    return {
      lat: r2(rand(60, 110)),
      jit: r2(rand(12, 28)),
      pl:  r2(rand(1.5, 5.5)),
      snr: r2(rand(19, 28)),
      health: 'Warn',
    };
  }
  return {
    lat: r2(rand(115, 300)),
    jit: r2(rand(22, 70)),
    pl:  r2(rand(5.5, 22)),
    snr: r2(rand(8, 19)),
    health: 'Bad',
  };
}

// Build list of dates for the past 90 days
function datesForRange(daysBack) {
  const dates = [];
  const now = new Date();
  for (let i = daysBack; i >= 1; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

async function seed() {
  await execAsync('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');

  const allDates = datesForRange(90);
  const customerRows = await allAsync(`SELECT id FROM customers ORDER BY RANDOM()`);
  const customerIds = customerRows.map(r => r.id);
  const total = customerIds.length;

  console.log(`Fleet: ${total} customers, ${allDates.length} days`);

  // ── Generate fleet-wide event windows ──────────────────────────────────────
  // ~15 events scattered across the 90 days, each 1-3 days long
  const events = [];
  let i = 3;
  while (i < allDates.length - 3) {
    const gap = Math.floor(rand(3, 9));         // days between events
    i += gap;
    if (i >= allDates.length - 2) break;
    const duration = Math.floor(rand(1, 4));     // event lasts 1-3 days
    const affectedPct = rand(0.18, 0.50);        // 18-50% of fleet affected
    const severity = Math.random() < 0.4 ? 'bad' : 'warn';
    events.push({ startIdx: i, duration, affectedPct, severity });
    i += duration;
  }
  console.log(`Injecting ${events.length} fleet events + daily noise...`);

  // Build a map: date -> { affectedFraction, severity } from events
  const eventMap = new Map();
  for (const ev of events) {
    for (let d = 0; d < ev.duration; d++) {
      const idx = ev.startIdx + d;
      if (idx >= allDates.length) break;
      // Ramp up on day 0, peak day 1, ramp down last day
      const ramp = ev.duration === 1 ? 1.0
        : d === 0 ? 0.5
        : d === ev.duration - 1 ? 0.4
        : 1.0;
      eventMap.set(allDates[idx], {
        fraction: ev.affectedPct * ramp,
        severity: ev.severity,
      });
    }
  }

  // ── Apply changes day by day ───────────────────────────────────────────────
  await execAsync('BEGIN TRANSACTION');
  let committed = 0;

  for (let di = 0; di < allDates.length; di++) {
    const date = allDates[di];
    const dayStart = `${date}T00:00:00.000Z`;
    const dayEnd   = `${date}T23:59:59.999Z`;

    // Event degradation for this day
    const event = eventMap.get(date);
    if (event) {
      const n = Math.floor(total * event.fraction);
      // Pick a random slice of customers
      const offset = Math.floor(Math.random() * (total - n));
      const affected = customerIds.slice(offset, offset + n);
      for (const custId of affected) {
        const m = degradedMetric(event.severity);
        await runAsync(
          `UPDATE modem_history SET latency=?, jitter=?, packet_loss=?, snr=?, health_score=?
           WHERE customer_id=? AND recorded_at >= ? AND recorded_at <= ?`,
          [m.lat, m.jit, m.pl, m.snr, m.health, custId, dayStart, dayEnd]
        );
      }
    }

    // Daily noise: 3-8% of fleet flip to Warn briefly regardless of events
    const noisePct = rand(0.03, 0.08);
    const noiseCount = Math.floor(total * noisePct);
    const noiseOffset = Math.floor(Math.random() * (total - noiseCount));
    const noisy = customerIds.slice(noiseOffset, noiseOffset + noiseCount);
    for (const custId of noisy) {
      const m = degradedMetric('warn');
      await runAsync(
        `UPDATE modem_history SET latency=?, jitter=?, packet_loss=?, snr=?, health_score=?
         WHERE customer_id=? AND recorded_at >= ? AND recorded_at <= ?`,
        [m.lat, m.jit, m.pl, m.snr, m.health, custId, dayStart, dayEnd]
      );
    }

    // Commit every 10 days to keep transactions small
    committed++;
    if (committed % 10 === 0) {
      await execAsync('COMMIT');
      process.stdout.write(`  ${committed}/${allDates.length} days processed\n`);
      await execAsync('BEGIN TRANSACTION');
    }
  }

  await execAsync('COMMIT');
  console.log('✓ Done.');
}

seed()
  .then(() => db.close())
  .catch((err) => { console.error('✗ Failed:', err); process.exit(1); });
