# SmartView v1 → v2 Migration Guide

**Version:** 2.0  
**Migration Date:** 2025-01-17  
**Effort:** ~2–4 hours (backend + frontend, full test suite)  
**Downtime:** ~10 minutes (database migration + deployment)

---

## Overview

SmartView v2 introduces significant performance improvements, new UI features, and architectural changes. This guide walks through upgrading from v1 to v2 with minimal disruption.

### What's New in v2?

✅ **Backend:**
- Database indexes (10–100x query speedup)
- Pagination and filtering
- SSE real-time updates
- Fleet summary endpoint

✅ **Frontend:**
- React Router v6 (URL-based navigation)
- TanStack Query (HTTP caching)
- Recharts (better visualizations)
- Virtualized customer list (1000+ customers)
- Accessibility improvements (ARIA labels, semantic HTML)

---

## Phase 1: Preparation (No Downtime)

### 1.1 Backup Current Database

```bash
# Production database backup
cp /var/data/smartview.db /var/data/smartview.db.backup.v1
ls -lh /var/data/smartview.db.backup.v1
```

**Verify backup integrity:**
```bash
sqlite3 /var/data/smartview.db.backup.v1 "SELECT COUNT(*) FROM customers;"
# Output: 1000 (or your count)
```

### 1.2 Review Breaking Changes

**Frontend Breaking Changes:**
- URLs changed from query params to path-based routing (see §2.1)
- Component props may differ (test all navigations)
- CSS classes renamed (update any custom styles)

**Backend Breaking Changes:**
- `/api/customers?status=` param is NEW (existing code unaffected)
- `/api/customers/fleet-summary` is NEW endpoint
- SSE endpoint `/api/telemetry/stream` is NEW
- No breaking changes to existing `/api/customers/:id/modem-*` endpoints (backward compatible)

**Database Breaking Changes:**
- No schema changes (same tables)
- Indexes added (safe, non-breaking)
- No data migration needed

### 1.3 Test v2 in Staging

**Deploy v2 backend to staging:**
```bash
git checkout v2
npm install
npm test  # Verify all tests pass
npm start
```

**Deploy v2 frontend to staging:**
```bash
cd frontend
npm install
npm run build
npm run preview
# Open http://localhost:4173
```

**Smoke test checklist:**
- [ ] Customer list loads
- [ ] Search works
- [ ] Filter chips work
- [ ] Click customer → detail view opens
- [ ] Live indicator connects
- [ ] Charts render without errors
- [ ] API calls return 200 status

---

## Phase 2: Database Migration

### 2.1 Apply Database Indexes (Critical)

**Standalone database migration (non-destructive):**

```bash
# 1. Stop current backend (if running)
sudo systemctl stop smartview-backend

# 2. Backup again (just in case)
cp /var/data/smartview.db /var/data/smartview.db.backup.pre-indexes

# 3. Apply migration
sqlite3 /var/data/smartview.db < cora/migrations/001_add_indexes.sql

# 4. Verify indexes were created
sqlite3 /var/data/smartview.db ".indexes"
# Output should include:
# idx_modem_history_customer_time
# idx_modem_daily_customer_date
# idx_modem_stats_customer
# idx_customers_name
# idx_customers_email

# 5. Verify integrity
sqlite3 /var/data/smartview.db "SELECT COUNT(*) FROM customers;"
sqlite3 /var/data/smartview.db "SELECT COUNT(*) FROM modem_history;"
```

**Migration script (automated):**

```bash
#!/bin/bash
set -e

DB_PATH="${DATABASE_PATH:=/var/data/smartview.db}"

echo "Backing up database..."
cp "$DB_PATH" "$DB_PATH.backup.$(date +%s)"

echo "Applying migration: 001_add_indexes.sql"
sqlite3 "$DB_PATH" < cora/migrations/001_add_indexes.sql

echo "Verifying indexes..."
sqlite3 "$DB_PATH" ".indexes modem_history"
sqlite3 "$DB_PATH" ".indexes modem_daily"
sqlite3 "$DB_PATH" ".indexes modem_stats"
sqlite3 "$DB_PATH" ".indexes customers"

echo "Migration complete!"
echo "Database size: $(du -sh $DB_PATH | cut -f1)"
```

**Performance verification:**

```bash
# Before indexes: measure query time
time sqlite3 /var/data/smartview.db \
  "SELECT * FROM modem_history WHERE customer_id = 42 AND recorded_at >= datetime('now', '-7 days')"
# Expected before: 2–5 seconds

# After indexes: measure again
time sqlite3 /var/data/smartview.db \
  "SELECT * FROM modem_history WHERE customer_id = 42 AND recorded_at >= datetime('now', '-7 days')"
# Expected after: 50–200ms (10–100x improvement!)

# Expected output: real    0m0.050s
```

### 2.2 Verify No Data Loss

```bash
# Count records before and after
echo "Customers: $(sqlite3 /var/data/smartview.db 'SELECT COUNT(*) FROM customers')"
echo "Modem History: $(sqlite3 /var/data/smartview.db 'SELECT COUNT(*) FROM modem_history')"
echo "Modem Daily: $(sqlite3 /var/data/smartview.db 'SELECT COUNT(*) FROM modem_daily')"
echo "Modem Stats: $(sqlite3 /var/data/smartview.db 'SELECT COUNT(*) FROM modem_stats')"

# Expected: Same counts as v1
```

---

## Phase 3: Backend Deployment

### 3.1 Update Backend Code

```bash
cd backend

# Pull latest v2 code
git fetch origin v2
git checkout v2

# Install dependencies (no new dependencies required)
npm install

# Verify version
grep '"version"' package.json
# Expected: "2.0.0"
```

### 3.2 Environment Configuration

**Check `.env` file (no changes needed for existing vars):**

```bash
# .env stays the same:
DATABASE_PATH=/var/data/smartview.db
NODE_ENV=production
API_PORT=3000
LOG_LEVEL=info

# Optional v2 additions (not required):
# CACHE_FLEET_SUMMARY=false  # Redis caching (future feature)
```

### 3.3 Test Backend Locally

```bash
# Start backend
npm start

# Test endpoints
curl http://localhost:3000/api/customers?limit=10
# Should return 10 customers with new status field

curl http://localhost:3000/api/customers/fleet-summary
# Should return new fleet aggregates

curl http://localhost:3000/api/customers/42 -N \
  | head -c 200
# Should return stream of SSE events
```

### 3.4 Deploy Backend

**Option A: Docker Compose**

```bash
# Update docker-compose.yml image tag
docker-compose down
docker-compose up -d

# Verify
docker-compose logs backend | head -20
# Look for "Server listening on :3000"
```

**Option B: Systemd Service**

```bash
sudo systemctl stop smartview-backend
sudo systemctl start smartview-backend
sudo systemctl status smartview-backend

# Verify
curl http://localhost:3000/api/customers?limit=1
# Should return 200 with customer data
```

**Option C: Manual Deployment**

```bash
# Stop current process
pkill -f "node backend/server.js"

# Start new version
cd /opt/smartview/backend
npm start &

# Verify
sleep 2
curl http://localhost:3000/api/customers?limit=1
```

### 3.5 Rollback Procedure (if needed)

```bash
# Stop v2 backend
sudo systemctl stop smartview-backend

# Restore v1 code
git checkout v1
npm install

# Restore database (optional, usually safe to keep v2)
# cp /var/data/smartview.db.backup.pre-indexes /var/data/smartview.db

# Start v1 backend
sudo systemctl start smartview-backend

# Verify
curl http://localhost:3000/api/customers | jq '.customers[0]'
# Should work as before
```

---

## Phase 4: Frontend Deployment

### 4.1 Update Frontend Code

```bash
cd frontend

# Pull latest v2 code
git fetch origin v2
git checkout v2

# Install dependencies (new packages added)
npm install
# New packages:
#  - recharts@^2.12.0
#  - @tanstack/react-query@^5.0.0
#  - @tanstack/react-virtual@^3.0.0
#  - react-router-dom@^6.22.0

# Verify installation
npm ls recharts @tanstack/react-query react-router-dom
```

### 4.2 Build Frontend

```bash
npm run build

# Verify build
ls -lh dist/
# Expected: index.html + assets/ folder, total <500 KB

# Check for errors
npm run build 2>&1 | grep -i "error\|warning"
```

### 4.3 Test Frontend Build

```bash
# Preview production build
npm run preview
# Open http://localhost:4173
# Test same checklist as Phase 1.3
```

### 4.4 Deploy Frontend (Static Files)

**Option A: Docker**

```bash
# Build container
docker build -t smartview-frontend:v2 .

# Push to registry (if using)
docker tag smartview-frontend:v2 myregistry.com/smartview-frontend:v2
docker push myregistry.com/smartview-frontend:v2

# Update docker-compose.yml
# docker-compose up -d frontend

# Verify
docker logs smartview-frontend
# Should show "Listening on :5173" or similar
```

**Option B: Static Web Server**

```bash
# Copy built files to web server
rsync -av frontend/dist/ /var/www/smartview/

# Verify
ls -la /var/www/smartview/
# Should have index.html + assets/

# Test
curl http://localhost/index.html | head -20
# Should show <html> with smartview content
```

**Option C: S3 + CloudFront (AWS)**

```bash
# Upload to S3
aws s3 sync frontend/dist/ s3://smartview-frontend-prod/

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id E1234ABCD \
  --paths "/*"

# Verify
curl https://smartview.company.com/
# Should load new frontend
```

### 4.5 Update Nginx Configuration

**`/etc/nginx/sites-available/smartview`:**

```nginx
server {
  listen 80;
  server_name smartview.company.com;

  # Redirect HTTP → HTTPS
  return 301 https://$server_name$request_uri;
}

server {
  listen 443 ssl http2;
  server_name smartview.company.com;

  ssl_certificate /etc/letsencrypt/live/smartview.company.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/smartview.company.com/privkey.pem;

  # Frontend (static files)
  root /var/www/smartview;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;  # React Router fallback
  }

  # API proxy to backend
  location /api/ {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    
    # Required for SSE
    proxy_set_header Connection "";
    proxy_cache off;
    proxy_buffering off;
    
    # Standard headers
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  # Gzip compression
  gzip on;
  gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
}
```

**Reload Nginx:**
```bash
sudo nginx -t  # Verify config
sudo systemctl reload nginx
```

### 4.6 Rollback Frontend (if needed)

```bash
# Restore v1 frontend
cd /var/www/smartview
git checkout v1
npm run build
rsync -av dist/ /var/www/smartview/

# Clear browser cache and reload
# Ctrl+Shift+Delete in browser (or use incognito window)
```

---

## Phase 5: Testing & Validation

### 5.1 Smoke Tests (Production)

**Manual tests:**
- [ ] Open https://smartview.company.com
- [ ] See "Fleet Dashboard" with tiles + worst performers
- [ ] Search for a customer
- [ ] Click customer → detail view opens
- [ ] See modem stats + charts
- [ ] Live indicator shows "Connected" (green dot pulsing)
- [ ] Select different time ranges (1d, 7d, 30d, 90d)
- [ ] Charts update with correct data
- [ ] Click "All" / "Healthy" / "Warning" / "Critical" filter chips
- [ ] Customer list filters correctly
- [ ] Pagination works (next/prev pages)

**API tests:**

```bash
# Test each endpoint
for endpoint in \
  "/api/customers?limit=10" \
  "/api/customers/fleet-summary" \
  "/api/customers/42" \
  "/api/customers/42/modem-stats" \
  "/api/customers/42/modem-history?days=7" \
  "/api/customers/42/modem-daily?days=30"
do
  echo "Testing $endpoint"
  curl -s "http://localhost:3000$endpoint" | jq . > /dev/null || echo "FAILED"
done
```

### 5.2 Performance Tests

**Backend response times:**

```bash
# Time a few key endpoints
for i in {1..10}; do
  time curl -s http://localhost:3000/api/customers?limit=50 > /dev/null
done

# Expected: <100ms per request (should be much faster than v1)
```

**Frontend load time:**

```bash
# Use Lighthouse audit
# Chrome DevTools → Lighthouse → Run Audit
# Target: 90+ Performance score
```

**Database query times:**

```bash
# Check query plans
sqlite3 /var/data/smartview.db "EXPLAIN QUERY PLAN SELECT * FROM modem_history WHERE customer_id = 42 AND recorded_at >= datetime('now', '-7 days')"

# Expected: Should use idx_modem_history_customer_time
```

### 5.3 User Acceptance Testing (UAT)

**Provide v2 access to stakeholders:**

1. Send them the URL: https://smartview.company.com
2. Ask them to:
   - View fleet dashboard
   - Search for customers
   - View customer details
   - Check charts render correctly
   - Verify live indicator shows "Connected"
3. Collect feedback (expected: much faster, better UX)

### 5.4 Logging & Monitoring

**Check logs for errors:**

```bash
# Backend logs
journalctl -u smartview-backend -n 50

# Frontend errors (browser console)
# Open DevTools (F12) → Console tab
# Should see no red errors (warnings OK)

# Nginx access logs
tail -f /var/log/nginx/access.log | grep smartview.company.com
```

---

## Phase 6: Cleanup

### 6.1 Archive v1 Code

```bash
# Tag v1 release
git tag -a v1-archived -m "v1 archived after v2 migration"
git push origin v1-archived

# Keep v1 branch for reference, but don't deploy from it
git branch -m v1-archived
```

### 6.2 Update Documentation

- [ ] Update team wiki with new API endpoints
- [ ] Update runbooks with new deployment steps
- [ ] Update status page: "v2 deployed"
- [ ] Send announcement: "SmartView v2 is live"

### 6.3 Monitor Metrics (First 24 Hours)

```bash
# Check dashboard metrics
watch 'curl -s http://localhost:3000/api/customers/fleet-summary | jq .'

# Expected: Fleet summary loads in <1 second (should be 10x faster than v1)

# Check error logs
journalctl -u smartview-backend -f | grep -i error

# Expected: No errors, maybe a few warnings
```

### 6.4 Schedule v1 Removal (1 Month Later)

```bash
# After v2 is stable for a month:
# 1. Delete v1 branch
git branch -d v1

# 2. Archive v1 backup
tar czf /backup/smartview-v1-backup.tar.gz /var/data/smartview.db.backup.v1
rm /var/data/smartview.db.backup.v1

# 3. Remove v1 Docker images
docker rmi smartview-backend:v1 smartview-frontend:v1

# 4. Update runbooks to remove v1 references
```

---

## Troubleshooting Migration Issues

### Issue: "Database is locked"

**Cause:** Backend still running during migration

**Fix:**
```bash
# Stop backend before migration
sudo systemctl stop smartview-backend

# Verify it's stopped
ps aux | grep "node backend"  # Should return nothing

# Then run migration
sqlite3 /var/data/smartview.db < migrations/001_add_indexes.sql

# Start backend
sudo systemctl start smartview-backend
```

### Issue: "Index already exists"

**Cause:** Migration already applied (safe, idempotent)

**Fix:**
```bash
# Check existing indexes
sqlite3 /var/data/smartview.db ".indexes"

# Try running migration again (uses IF NOT EXISTS)
sqlite3 /var/data/smartview.db < migrations/001_add_indexes.sql

# If error, verify database integrity
sqlite3 /var/data/smartview.db "PRAGMA integrity_check;"
# Should return "ok"
```

### Issue: "New features not showing in frontend"

**Cause:** Browser cached old version

**Fix:**
```bash
# Hard refresh in browser
# Windows/Linux: Ctrl+Shift+Delete
# Mac: Cmd+Shift+Delete
# Or open Incognito window

# Clear CDN cache (if using)
aws cloudfront create-invalidation --distribution-id E123456 --paths "/*"

# Verify new version deployed
curl https://smartview.company.com/index.html | grep -i "react-router"
# Should return content mentioning react-router-dom
```

### Issue: "SSE not connecting (live indicator red)"

**Cause:** Nginx config not passing through SSE headers

**Fix:**
```bash
# Update nginx config with SSE support:
location /api/ {
  proxy_cache off;
  proxy_buffering off;
  proxy_set_header Connection "";
}

# Reload nginx
sudo systemctl reload nginx

# Test SSE connection
curl -N http://localhost:3000/api/telemetry/stream?customerId=42
# Should return stream of events (keep watching for 30+ seconds)
```

### Issue: "500 error on fleet-summary endpoint"

**Cause:** Indexes not applied, query is slow/timing out

**Fix:**
```bash
# Check indexes exist
sqlite3 /var/data/smartview.db ".indexes customers"
sqlite3 /var/data/smartview.db ".indexes modem_stats"

# If missing, apply migration
sqlite3 /var/data/smartview.db < migrations/001_add_indexes.sql

# Test query directly
sqlite3 /var/data/smartview.db "SELECT COUNT(*) FROM customers;"

# Check logs
journalctl -u smartview-backend -n 50 | grep error
```

---

## Rollback Checklist

If you need to roll back to v1:

- [ ] Stop v2 backend: `sudo systemctl stop smartview-backend`
- [ ] Stop v2 frontend: `sudo systemctl stop smartview-frontend`
- [ ] Restore v1 code: `git checkout v1`
- [ ] Restart backend: `sudo systemctl start smartview-backend`
- [ ] Restore frontend (from S3/backup)
- [ ] Reload Nginx: `sudo systemctl reload nginx`
- [ ] Test: `curl http://localhost:3000/api/customers`
- [ ] Verify live: `https://smartview.company.com`

**Note:** Database indexes (added in v2) are safe to keep. No data loss risk.

---

## Migration Validation Checklist

- [ ] Database backup completed
- [ ] Database indexes applied
- [ ] Backend v2 deployed and tested
- [ ] Frontend v2 built and deployed
- [ ] Nginx config updated for SSE
- [ ] All endpoints tested (HTTP 200)
- [ ] Fleet dashboard loads (no errors)
- [ ] Customer search works
- [ ] Customer detail view works
- [ ] Charts render correctly
- [ ] Live indicator connects
- [ ] Performance improved (queries <100ms)
- [ ] UAT passed by stakeholders
- [ ] Monitoring/alerts configured
- [ ] Team notified of go-live
- [ ] v1 code archived

---

## Post-Migration Follow-Up

**After 1 week:**
- Review error logs for issues
- Collect user feedback
- Monitor performance metrics
- Update team documentation

**After 1 month:**
- Declare v1 end-of-life
- Archive v1 backups
- Remove v1 code branches
- Plan v3 features (PostgreSQL, authentication)

---

**Migration Owner:** DevOps/Platform Team  
**Prepared by:** Paige (Documentation)  
**Reviewed by:** Daemon (Backend), Skye (Frontend), Archie (Architecture)  
**Date:** 2025-01-17
