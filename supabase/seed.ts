/**
 * Seed script — creates 100 customers + 90 days modem history + devices.
 * Run: npx tsx supabase/seed.ts
 * Requires DATABASE_URL in .env.local
 */
import 'dotenv/config'
import postgres from 'postgres'
import { randomUUID } from 'crypto'

const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', max: 1 })

// ── Helpers ───────────────────────────────────────────────────────────────────
const rand = (min: number, max: number) => min + Math.random() * (max - min)
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1))
const r2 = (v: number) => Math.round(v * 100) / 100
const pick = <T>(arr: T[]): T => arr[randInt(0, arr.length - 1)]

const FIRST = ['James','Mary','John','Patricia','Robert','Jennifer','Michael','Linda','William','Barbara','David','Elizabeth','Richard','Susan','Joseph','Jessica','Thomas','Sarah','Charles','Karen']
const LAST  = ['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez']

const PROFILES = [
  ...Array(70).fill('healthy'),
  ...Array(10).fill('poor'),
  ...Array(12).fill('intermittent'),
  ...Array(8).fill('oneoff'),
] as const

type Profile = 'healthy' | 'poor' | 'intermittent' | 'oneoff'

const RANGES: Record<Profile, { lat: [number,number]; jit: [number,number]; pl: [number,number]; snr: [number,number] }> = {
  healthy:      { lat:[5,22],   jit:[0.4,2.8],  pl:[0,0.15],  snr:[36,46] },
  poor:         { lat:[70,210], jit:[14,35],    pl:[3.5,10],  snr:[13,24] },
  intermittent: { lat:[5,20],   jit:[0.4,25],   pl:[0,5],     snr:[22,45] },
  oneoff:       { lat:[5,20],   jit:[0.4,2.5],  pl:[0,0.1],   snr:[36,46] },
}

function health(lat: number, pl: number, snr: number): 'Good' | 'Warn' | 'Bad' {
  if (lat < 50 && pl < 1 && snr > 30) return 'Good'
  if (lat < 100 && pl < 5 && snr > 20) return 'Warn'
  return 'Bad'
}

function makeMetric(profile: Profile) {
  const r = RANGES[profile]
  const lat = r2(rand(r.lat[0], r.lat[1]))
  const jit = r2(rand(r.jit[0], r.jit[1]))
  const pl  = r2(rand(r.pl[0],  r.pl[1]))
  const snr = r2(rand(r.snr[0], r.snr[1]))
  return { lat, jit, pl, snr, hs: health(lat, pl, snr) }
}

const DEVICE_TYPES = ['laptop','desktop','phone','tablet','games_console','smart_tv','wifi_extender','router','iot','other'] as const
const CONN_TYPES   = ['ethernet','wifi_2_4','wifi_5','wifi_6'] as const

async function seed() {
  console.log('Seeding SmartView v3...')

  const TOTAL = 100
  const HISTORY_DAYS = 90
  const INTERVAL_MINUTES = 15

  // ── Customers ──────────────────────────────────────────────────────────────
  const customers: { id: string; name: string; email: string; created_at: Date }[] = []
  for (let i = 0; i < TOTAL; i++) {
    customers.push({
      id: randomUUID(),
      name: `${pick(FIRST)} ${pick(LAST)}`,
      email: `customer${i + 1}@example.com`,
      created_at: new Date(Date.now() - rand(30, 180) * 24 * 60 * 60 * 1000),
    })
  }

  await sql`
    INSERT INTO customers ${sql(customers.map(c => ({ id: c.id, name: c.name, email: c.email, created_at: c.created_at, updated_at: c.created_at })))}
    ON CONFLICT (email) DO NOTHING
  `
  console.log(`Inserted ${customers.length} customers`)

  // ── Modem stats + history ──────────────────────────────────────────────────
  const profile = (i: number): Profile => PROFILES[i % PROFILES.length] as Profile

  const modemStats: object[] = []
  const modemHistory: object[] = []

  for (let i = 0; i < customers.length; i++) {
    const cid = customers[i].id
    const p = profile(i)

    // Latest stat
    const m = makeMetric(p)
    modemStats.push({ id: randomUUID(), customer_id: cid, latency: m.lat, jitter: m.jit, packet_loss: m.pl, snr: m.snr, health_score: m.hs, recorded_at: new Date() })

    // History
    const totalPoints = HISTORY_DAYS * 24 * 60 / INTERVAL_MINUTES
    for (let j = 0; j < totalPoints; j++) {
      const hm = makeMetric(p)
      const recorded_at = new Date(Date.now() - j * INTERVAL_MINUTES * 60 * 1000)
      modemHistory.push({ id: randomUUID(), customer_id: cid, latency: hm.lat, jitter: hm.jit, packet_loss: hm.pl, snr: hm.snr, health_score: hm.hs, recorded_at })
    }
  }

  // Insert in batches to avoid parameter limits
  await sql`INSERT INTO modem_stats ${sql(modemStats)} ON CONFLICT (customer_id) DO UPDATE SET latency = EXCLUDED.latency, jitter = EXCLUDED.jitter, packet_loss = EXCLUDED.packet_loss, snr = EXCLUDED.snr, health_score = EXCLUDED.health_score, recorded_at = EXCLUDED.recorded_at`
  console.log(`Inserted ${modemStats.length} modem stats`)

  const batchSize = 5000
  for (let b = 0; b < modemHistory.length; b += batchSize) {
    await sql`INSERT INTO modem_history ${sql(modemHistory.slice(b, b + batchSize))}`
    process.stdout.write(`\r  modem_history: ${Math.min(b + batchSize, modemHistory.length)}/${modemHistory.length}`)
  }
  console.log(`\nInserted ${modemHistory.length} modem history records`)

  // ── Devices ────────────────────────────────────────────────────────────────
  const devices: object[] = []
  const deviceStats: object[] = []

  for (const c of customers) {
    const routerId = randomUUID()
    const numDevices = randInt(2, 8)

    devices.push({ id: routerId, customer_id: c.id, parent_device_id: null, name: 'Home Router', device_type: 'router', connection_type: 'ethernet', mac_address: null, created_at: c.created_at })
    deviceStats.push({ id: randomUUID(), device_id: routerId, is_online: true, rssi_dbm: null, upload_mbps: r2(rand(10, 50)), download_mbps: r2(rand(100, 300)), latency_ms: r2(rand(1, 5)), recorded_at: new Date() })

    for (let d = 0; d < numDevices; d++) {
      const did = randomUUID()
      const dtype = pick([...DEVICE_TYPES])
      const ctype = pick([...CONN_TYPES])
      const isWifi = ctype !== 'ethernet'
      devices.push({ id: did, customer_id: c.id, parent_device_id: routerId, name: `${dtype.replace(/_/g, ' ')} ${d + 1}`, device_type: dtype, connection_type: ctype, mac_address: null, created_at: c.created_at })
      deviceStats.push({ id: randomUUID(), device_id: did, is_online: Math.random() > 0.15, rssi_dbm: isWifi ? r2(rand(-80, -40)) : null, upload_mbps: r2(rand(1, 20)), download_mbps: r2(rand(5, 100)), latency_ms: r2(rand(2, 30)), recorded_at: new Date() })
    }
  }

  for (let b = 0; b < devices.length; b += batchSize) {
    await sql`INSERT INTO devices ${sql(devices.slice(b, b + batchSize))} ON CONFLICT DO NOTHING`
  }
  await sql`INSERT INTO device_stats ${sql(deviceStats)} ON CONFLICT (device_id) DO NOTHING`
  console.log(`Inserted ${devices.length} devices, ${deviceStats.length} device stats`)

  await sql.end()
  console.log('Seeding complete.')
}

seed().catch((err) => {
  console.error(err)
  process.exit(1)
})
