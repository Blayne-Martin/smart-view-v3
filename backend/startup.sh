#!/bin/sh
set -e

echo "=========================================="
echo "SmartView v2 Backend - Startup Script"
echo "=========================================="

# Ensure database path exists
mkdir -p /app/data

# Set database path
export DB_PATH="${DB_PATH:-/app/data/smartview.db}"

echo "🌱 Seeding database..."
node seed.cjs || true

echo ""
# Check if database has data (non-critical, warn but continue)
CUSTOMER_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM customers;" 2>/dev/null || echo "0")
echo "✓ Database check: $CUSTOMER_COUNT customers found"

echo ""
echo "🚀 Starting backend server..."
npm start
