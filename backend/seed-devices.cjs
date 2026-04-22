'use strict';

/**
 * seed-devices.cjs
 *
 * Populates devices, device_stats, and device_history for every customer
 * already in the database.
 *
 * Strategy (mirrors spec A3.7):
 *   - 1 root router per customer (parent_device_id = NULL)
 *   - 0–2 WiFi extenders hanging off the router
 *   - Remaining devices distributed across router + extenders
 *   - Total 3–15 devices per customer, average ~6
 *   - History: 90 days × 4 readings/day = 360 rows per device
 *
 * Usage:
 *   node backend/seed-devices.cjs
 *   DB_PATH=/app/data/smartview.db node backend/seed-devices.cjs
 */

const sqlite3 = require('sqlite3').verbose();
const { randomUUID } = require('crypto');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.resolve(__dirname, '../data/smartview.db');

// ── Constants ─────────────────────────────────────────────────────────────────

const DEVICE_TYPES = [
  'laptop', 'desktop', 'phone', 'tablet',
  'games_console', 'smart_tv', 'wifi_extender', 'router', 'iot', 'other',
];

const LEAF_DEVICE_TYPES = [
  'laptop', 'desktop', 'phone', 'tablet',
  'games_console', 'smart_tv', 'iot', 'other',
];

const WIFI_CONNECTION_TYPES = ['wifi_2_4', 'wifi_5', 'wifi_6'];
const ALL_CONNECTION_TYPES  = ['ethernet', 'wifi_2_4', 'wifi_5', 'wifi_6'];

const DEVICE_NAME_PREFIXES = {
  laptop:        ['MacBook', 'ThinkPad', 'Dell XPS', 'HP Laptop', 'Surface'],
  desktop:       ['iMac', 'Gaming PC', 'Work Desktop', 'Linux Box', 'NUC'],
  phone:         ['iPhone', 'Samsung Galaxy', 'Pixel', 'OnePlus', 'Xiaomi'],
  tablet:        ['iPad', 'Galaxy Tab', 'Surface Go', 'Kindle Fire', 'Lenovo Tab'],
  games_console: ['PlayStation 5', 'Xbox Series X', 'Nintendo Switch', 'Steam Deck'],
  smart_tv:      ['Samsung TV', 'LG OLED', 'Sony Bravia', 'TCL Roku TV', 'Fire TV'],
  wifi_extender: ['TP-Link Extender', 'Netgear Booster', 'Eero Node', 'Google Nest'],
  router:        ['Asus RT-AX88U', 'Netgear Nighthawk', 'TP-Link Archer', 'UniFi Dream Machine'],
  iot:           ['Smart Thermostat', 'Ring Doorbell', 'Nest Camera', 'Smart Plug', 'Smart Bulb'],
  other:         ['Unknown Device', 'Mystery Device', 'Generic Client'],
};

const ROOMS = ['Living Room', 'Bedroom', 'Kitchen', 'Office', 'Garage', 'Basement', 'Hallway'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function rng(min, max) {
  return Math.random() * (max - min) + min;
}

function rngInt(min, max) {
  return Math.floor(rng(min, max + 1));
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomMac() {
  return Array.from({ length: 6 }, () =>
    Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
  ).join(':');
}

function deviceName(type) {
  const prefixes = DEVICE_NAME_PREFIXES[type] || ['Device'];
  const prefix = pick(prefixes);
  const room   = pick(ROOMS);
  return `${room} ${prefix}`;
}

/**
 * Generate realistic stats for a device.
 * WiFi devices get rssi_dbm; Ethernet devices get null.
 */
function randomStats(connectionType, isOnline = true) {
  const rssi_dbm = connectionType === 'ethernet'
    ? null
    : parseFloat(rng(-85, -35).toFixed(1));

  // Slightly degrade WiFi 2.4 GHz devices
  const speedFactor = connectionType === 'wifi_2_4' ? 0.4
    : connectionType === 'wifi_5'  ? 0.75
    : connectionType === 'wifi_6'  ? 0.9
    : 1.0; // ethernet

  return {
    is_online:     isOnline ? 1 : 0,
    rssi_dbm,
    upload_mbps:   isOnline ? parseFloat((rng(1, 50)  * speedFactor).toFixed(2)) : 0,
    download_mbps: isOnline ? parseFloat((rng(5, 200) * speedFactor).toFixed(2)) : 0,
    latency_ms:    isOnline ? parseFloat(rng(1, 30).toFixed(2)) : 0,
  };
}

/**
 * Generate 90 days of history at 4 readings/day (every 6 hours).
 */
function generateHistory(deviceId, connectionType) {
  const records = [];
  const now     = Date.now();
  const total   = 90 * 4; // 360 readings

  for (let i = 0; i < total; i++) {
    const msAgo  = (total - i) * 6 * 60 * 60 * 1000;
    const ts     = new Date(now - msAgo).toISOString().replace('T', ' ').substring(0, 19);
    const online = Math.random() > 0.03; // 97% uptime
    const stats  = randomStats(connectionType, online);

    records.push({
      id:            randomUUID(),
      device_id:     deviceId,
      is_online:     stats.is_online,
      rssi_dbm:      stats.rssi_dbm,
      upload_mbps:   stats.upload_mbps,
      download_mbps: stats.download_mbps,
      latency_ms:    stats.latency_ms,
      recorded_at:   ts,
    });
  }

  return records;
}

// ── Promisified DB helpers ────────────────────────────────────────────────────

function dbRun(db, sql, params = []) {
  return new Promise((resolve, reject) =>
    db.run(sql, params, (err) => (err ? reject(err) : resolve()))
  );
}

function dbAll(db, sql, params = []) {
  return new Promise((resolve, reject) =>
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)))
  );
}

function dbGet(db, sql, params = []) {
  return new Promise((resolve, reject) =>
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)))
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function seed() {
  const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
      console.error('Cannot open database:', DB_PATH, err.message);
      process.exit(1);
    }
    console.log('Connected to:', DB_PATH);
  });

  // Enable WAL for faster bulk inserts
  await dbRun(db, 'PRAGMA journal_mode = WAL');
  await dbRun(db, 'PRAGMA synchronous = NORMAL');

  const customers = await dbAll(db, `
    SELECT c.id FROM customers c
    LEFT JOIN (SELECT customer_id FROM devices GROUP BY customer_id) d ON c.id = d.customer_id
    WHERE d.customer_id IS NULL
    ORDER BY c.id ASC
  `);
  if (!customers.length) {
    console.log('✓ All customers already have devices — nothing to do.');
    db.close();
    return;
  }

  console.log(`Seeding devices for ${customers.length} customers without devices...`);

  await dbRun(db, 'BEGIN TRANSACTION');

  let totalDevices  = 0;
  let totalStats    = 0;
  let totalHistory  = 0;

  for (let ci = 0; ci < customers.length; ci++) {
    const customerId = customers[ci].id;

    // ── Build device topology ────────────────────────────────────────────────

    const deviceCount  = rngInt(2, 6);
    const extCount     = rngInt(0, Math.min(2, deviceCount - 1));
    const deviceRows   = [];

    // Root router
    const rootId = randomUUID();
    const rootConnType = 'ethernet';
    deviceRows.push({
      id:               rootId,
      customer_id:      customerId,
      parent_device_id: null,
      name:             deviceName('router'),
      device_type:      'router',
      connection_type:  rootConnType,
      mac_address:      randomMac(),
    });

    // Extenders
    const extenderIds = [];
    for (let e = 0; e < extCount; e++) {
      const eid = randomUUID();
      extenderIds.push(eid);
      deviceRows.push({
        id:               eid,
        customer_id:      customerId,
        parent_device_id: rootId,
        name:             deviceName('wifi_extender'),
        device_type:      'wifi_extender',
        connection_type:  pick(['ethernet', 'wifi_5']),
        mac_address:      randomMac(),
      });
    }

    // Remaining leaf devices
    const parentPool = [rootId, ...extenderIds];
    const leafCount  = deviceCount - 1 - extCount;

    for (let l = 0; l < leafCount; l++) {
      const dtype  = pick(LEAF_DEVICE_TYPES);
      const connT  = pick(ALL_CONNECTION_TYPES);
      deviceRows.push({
        id:               randomUUID(),
        customer_id:      customerId,
        parent_device_id: pick(parentPool),
        name:             deviceName(dtype),
        device_type:      dtype,
        connection_type:  connT,
        mac_address:      Math.random() > 0.1 ? randomMac() : null,
      });
    }

    // ── Insert devices ───────────────────────────────────────────────────────
    for (const d of deviceRows) {
      await dbRun(db,
        `INSERT INTO devices (id, customer_id, parent_device_id, name, device_type, connection_type, mac_address)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [d.id, d.customer_id, d.parent_device_id, d.name, d.device_type, d.connection_type, d.mac_address]
      );
    }
    totalDevices += deviceRows.length;

    // ── Insert device_stats (current snapshot) ───────────────────────────────
    for (const d of deviceRows) {
      const stats = randomStats(d.connection_type);
      await dbRun(db,
        `INSERT INTO device_stats (id, device_id, is_online, rssi_dbm, upload_mbps, download_mbps, latency_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [randomUUID(), d.id, stats.is_online, stats.rssi_dbm,
         stats.upload_mbps, stats.download_mbps, stats.latency_ms]
      );
      totalStats++;
    }

    // ── Insert device_history ────────────────────────────────────────────────
    for (const d of deviceRows) {
      const history = generateHistory(d.id, d.connection_type);
      for (const h of history) {
        await dbRun(db,
          `INSERT INTO device_history
             (id, device_id, is_online, rssi_dbm, upload_mbps, download_mbps, latency_ms, recorded_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [h.id, h.device_id, h.is_online, h.rssi_dbm,
           h.upload_mbps, h.download_mbps, h.latency_ms, h.recorded_at]
        );
      }
      totalHistory += history.length;
    }

    if ((ci + 1) % 100 === 0 || ci + 1 === customers.length) {
      await dbRun(db, 'COMMIT');
      await dbRun(db, 'BEGIN TRANSACTION');
      console.log(`  ${ci + 1}/${customers.length} customers seeded...`);
    }
  }

  await dbRun(db, 'COMMIT');

  console.log('\nSeed complete:');
  console.log(`  Devices:        ${totalDevices}`);
  console.log(`  Device stats:   ${totalStats}`);
  console.log(`  History rows:   ${totalHistory}`);

  db.close((err) => {
    if (err) console.error('Error closing DB:', err);
    else console.log('Database closed.');
  });
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
