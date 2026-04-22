-- SmartView v3 — Initial Supabase PostgreSQL schema
-- Run in the Supabase SQL editor or via supabase db push

-- ── User profiles (extends auth.users) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_profiles (
  id          UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role        TEXT    NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_read_own_profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);
-- Service role bypasses RLS; all mutations go through service-role API routes

-- ── Customers ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  email       TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Modem stats (latest reading per customer) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS modem_stats (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  latency      REAL NOT NULL,
  jitter       REAL NOT NULL,
  packet_loss  REAL NOT NULL,
  snr          REAL NOT NULL,
  health_score TEXT NOT NULL CHECK (health_score IN ('Good', 'Warn', 'Bad')),
  recorded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (customer_id)
);

-- ── Modem history ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS modem_history (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  latency      REAL NOT NULL,
  jitter       REAL NOT NULL,
  packet_loss  REAL NOT NULL,
  snr          REAL NOT NULL,
  health_score TEXT NOT NULL CHECK (health_score IN ('Good', 'Warn', 'Bad')),
  recorded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Devices ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS devices (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id      UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  parent_device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
  name             TEXT NOT NULL,
  device_type      TEXT NOT NULL,
  connection_type  TEXT NOT NULL,
  mac_address      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Device stats (latest per device) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS device_stats (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id     UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  is_online     BOOLEAN NOT NULL DEFAULT true,
  rssi_dbm      REAL,
  upload_mbps   REAL NOT NULL DEFAULT 0,
  download_mbps REAL NOT NULL DEFAULT 0,
  latency_ms    REAL NOT NULL DEFAULT 0,
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (device_id)
);

-- ── Device history ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS device_history (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id     UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  is_online     BOOLEAN NOT NULL DEFAULT true,
  rssi_dbm      REAL,
  upload_mbps   REAL NOT NULL DEFAULT 0,
  download_mbps REAL NOT NULL DEFAULT 0,
  latency_ms    REAL NOT NULL DEFAULT 0,
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_modem_history_customer_time ON modem_history(customer_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_modem_stats_customer        ON modem_stats(customer_id);
CREATE INDEX IF NOT EXISTS idx_modem_history_recorded_at   ON modem_history(recorded_at);
CREATE INDEX IF NOT EXISTS idx_device_history_device_time  ON device_history(device_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_devices_customer_id         ON devices(customer_id);
CREATE INDEX IF NOT EXISTS idx_devices_parent_device_id    ON devices(parent_device_id);
CREATE INDEX IF NOT EXISTS idx_customers_name              ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_email             ON customers(email);
