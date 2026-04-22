-- ============================================================
-- SmartView v2 — Add Critical DB Indexes (Migration 001)
-- ============================================================
-- Priority: P0 — CRITICAL
-- Impact: 100-1000x query speedup on modem_history queries
-- Engine: SQLite (better-sqlite3)
-- Idempotent: YES (all statements use IF NOT EXISTS)
-- ============================================================

-- ── Modem History Indexes ────────────────────────────────────
-- modem_history has 2.16M rows. Without these indexes, all
-- time-range queries do full table scans (extremely slow).

CREATE INDEX IF NOT EXISTS idx_modem_history_customer
  ON modem_history(customer_id);

CREATE INDEX IF NOT EXISTS idx_modem_history_customer_time
  ON modem_history(customer_id, recorded_at);

-- ── Modem Daily Indexes ──────────────────────────────────────
-- modem_daily supports the 30/90-day range filters.

CREATE INDEX IF NOT EXISTS idx_modem_daily_customer
  ON modem_daily(customer_id);

CREATE INDEX IF NOT EXISTS idx_modem_daily_customer_date
  ON modem_daily(customer_id, date);

-- ── Modem Stats Indexes ──────────────────────────────────────
-- modem_stats already has UNIQUE(customer_id) but an explicit
-- index helps the query planner and makes joins faster.

CREATE INDEX IF NOT EXISTS idx_modem_stats_customer
  ON modem_stats(customer_id);

-- ── Customer Search Indexes ──────────────────────────────────
-- Support GET /api/customers?q=smith (searches name + email)

CREATE INDEX IF NOT EXISTS idx_customers_name
  ON customers(name);

CREATE INDEX IF NOT EXISTS idx_customers_email
  ON customers(email);

-- ── Track Migration ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS schema_migrations (
  version    TEXT    PRIMARY KEY,
  applied_at TEXT    DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO schema_migrations(version) VALUES ('001_add_indexes');
