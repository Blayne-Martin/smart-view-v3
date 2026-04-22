-- SmartView v2 Database Optimization - Composite Indexes (P0)
-- Date: 2024
-- Purpose: Add optimized composite indexes for improved query performance
-- Database: SQLite

-- ============================================================================
-- COMPOSITE INDEXES FOR SMARTVIEW V2 OPTIMIZATION
-- ============================================================================

-- 1. Composite index on modem_stats(customer_id, recorded_at DESC)
-- Used for: Fetching latest stats for a customer, time-range queries
-- Impact: Improves queries filtering by customer and ordering by recorded_at
CREATE INDEX IF NOT EXISTS idx_modem_stats_customer_recorded_desc 
ON modem_stats(customer_id, recorded_at DESC);

-- 2. Composite index on customers(id, name, email)
-- Used for: Covering index for customer lookups with multiple columns
-- Impact: Allows queries to fetch id, name, email without table lookup
CREATE INDEX IF NOT EXISTS idx_customers_covering 
ON customers(id, name, email);

-- 3. Composite index on modem_history(customer_id, recorded_at DESC)
-- Used for: Fetching historical metrics for a customer in reverse chronological order
-- Impact: Improves time-series queries for historical analysis
CREATE INDEX IF NOT EXISTS idx_modem_history_customer_recorded_desc 
ON modem_history(customer_id, recorded_at DESC);

-- 4. Composite index on modem_daily(customer_id, date DESC)
-- Used for: Daily aggregates ordered by date for a specific customer
-- Impact: Optimizes dashboard queries for daily trends
CREATE INDEX IF NOT EXISTS idx_modem_daily_customer_date_desc 
ON modem_daily(customer_id, recorded_date DESC);

-- ============================================================================
-- NOTES
-- ============================================================================
-- - All indexes use IF NOT EXISTS for idempotency
-- - DESC ordering on time columns optimizes reverse chronological queries
-- - These are in addition to existing single-column indexes
-- - No tables or columns were modified
-- - Safe to run multiple times without issues
