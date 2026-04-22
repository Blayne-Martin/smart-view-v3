# SmartView v2 - Deployment Checklist ✅

## Pre-Deployment Verification

### 1. Code Quality Check
- [x] CORS middleware installed and configured
- [x] Database seeding script updated with correct schema
- [x] All 4 endpoints implemented with correct column names
- [x] Type definitions match API contract
- [x] Error handling implemented (404s, validation errors)

### 2. Dependencies
```bash
cd /workspace/smart-view-v2/backend
npm list cors
npm list express
npm list sqlite3
npm list zod
```

Expected:
- ✅ cors@^2.8.5
- ✅ express@^4.18.2
- ✅ sqlite3@^5.1.6
- ✅ zod@^3.22.4

### 3. Build Verification
```bash
npm run build
# Should complete with no errors
ls -la dist/
# Should contain: index.js
```

### 4. Database Schema Verification
```bash
sqlite3 ./smartview.db ".schema"

# Should contain tables:
# - customers
# - modem_stats
# - modem_history
# - modem_daily
# - schema_migrations
```

---

## Local Testing (Pre-Docker)

### Step 1: Seed Database
```bash
export DB_PATH=./smartview.db
node seed.cjs

# Expected output:
# Seeding 100 customers with modem data...
# ✓ Database already has 100 customers — skipping seed.
# (or: Seeding database at: ./smartview.db)
```

### Step 2: Start Backend
```bash
npm start
# or npm run dev

# Expected output:
# ✓ SmartView v2 Backend API listening on port 3000
# ✓ Health check: http://localhost:3000/health
# ✓ CORS enabled for localhost:8081
# ✓ Database ready: 100 customers found
```

### Step 3: Test Endpoints
```bash
# 1. Health check
curl http://localhost:3000/health
# Expected: {"status":"ok"}

# 2. Fleet summary
curl http://localhost:3000/api/fleet/summary
# Expected: 200 OK with fleet data

# 3. Worst performers
curl http://localhost:3000/api/fleet/worst-performers
# Expected: 200 OK with array of 10 or fewer items

# 4. Customers
curl http://localhost:3000/api/customers
# Expected: 200 OK with paginated customer list

# 5. Modem stats for customer 1
curl http://localhost:3000/api/customers/1/modem-stats
# Expected: 200 OK with modem stats

# 6. CORS validation
curl -H "Origin: http://localhost:8081" http://localhost:3000/api/fleet/summary -v
# Expected: access-control-allow-origin header present
```

---

## Docker Deployment

### Step 1: Build Image
```bash
cd /workspace/smart-view-v2/backend
docker build -t smartview-backend:latest .

# Expected output:
# Successfully tagged smartview-backend:latest
# (Image should include seeded database in build)
```

### Step 2: Run Container
```bash
docker run -p 3000:3000 \
  -v smartview-data:/app/data \
  -e DB_PATH=/app/data/smartview.db \
  smartview-backend:latest

# Expected output:
# ✓ Connected to SQLite database: /app/data/smartview.db
# Seeding 100 customers with modem data...
# ✓ Seed complete.
# ✓ SmartView v2 Backend API listening on port 3000
```

### Step 3: Verify Container
```bash
curl http://localhost:3000/api/fleet/summary
# Expected: 200 OK with fleet data

docker logs <container-id>
# Should show seeding logs and startup messages
```

---

## Docker Compose Deployment

### Step 1: Prepare Environment
```bash
cd /workspace/smart-view-v2

# Check docker-compose.yml exists
ls -la docker-compose.yml

# Expected: Should exist and reference backend service
```

### Step 2: Start Services
```bash
docker-compose up -d

# Expected output:
# Creating smartview-backend ... done
# Creating smartview-frontend ... done
```

### Step 3: Verify Services
```bash
# Check backend
curl http://localhost:3000/api/fleet/summary
# Expected: 200 OK

# Check frontend
curl http://localhost:8081
# Expected: 200 OK (HTML page loads)

# Check logs
docker-compose logs -f backend
# Should show: ✓ Database ready: 100 customers found
```

---

## Production Deployment Checklist

### Pre-deployment
- [ ] All tests passing: `bash test-endpoints.sh`
- [ ] Docker image built successfully
- [ ] Environment variables set:
  - [ ] `DB_PATH=/app/data/smartview.db`
  - [ ] `PORT=3000` (optional, defaults to 3000)
- [ ] Database directory created: `/app/data`
- [ ] Backups taken (if updating existing deployment)

### Deployment
- [ ] Docker image pushed to registry
- [ ] Container started with volume mount for `/app/data`
- [ ] Health check passes: `curl http://localhost:3000/health`
- [ ] CORS working: `curl -H "Origin: http://localhost:8081" http://localhost:3000/api/fleet/summary`
- [ ] All 4 endpoints verified:
  - [ ] GET /api/fleet/summary → 200 OK
  - [ ] GET /api/fleet/worst-performers → 200 OK
  - [ ] GET /api/customers → 200 OK
  - [ ] GET /api/customers/1/modem-stats → 200 OK

### Post-deployment
- [ ] Frontend can connect (no CORS errors in browser console)
- [ ] Dashboard loads data (summary tiles show numbers)
- [ ] Worst performers list displays
- [ ] Customer search works
- [ ] No 404 errors in API calls
- [ ] Database logs show proper startup

---

## Troubleshooting During Deployment

### Issue: "CORS error in browser"
```bash
# Verify CORS middleware is loaded
curl -H "Origin: http://localhost:8081" http://localhost:3000/api/fleet/summary -v
# Should see: access-control-allow-origin header

# If not present:
# 1. Check package.json has cors dependency
npm list cors
# 2. Rebuild: npm run build
# 3. Restart server
```

### Issue: "Database not found" / Empty data
```bash
# Check if seeding ran
sqlite3 /app/data/smartview.db "SELECT COUNT(*) FROM customers;"

# If 0:
export DB_PATH=/app/data/smartview.db
node seed.cjs

# In Docker, rebuild with --no-cache
docker build --no-cache -t smartview-backend:latest .
```

### Issue: "Cannot connect to backend from frontend"
```bash
# Check backend is running
curl http://localhost:3000/health

# Check port mapping in Docker
docker ps | grep smartview-backend
# Should show: 0.0.0.0:3000->3000/tcp

# Check frontend is connecting to correct URL
# Frontend should call: http://localhost:3000/api/*
```

### Issue: "Port 3000 already in use"
```bash
# Find process using port 3000
lsof -i :3000

# Kill it
kill -9 <PID>

# Or use different port
PORT=3001 npm start
```

---

## Performance Validation

### Expected Response Times

| Endpoint | Time | Notes |
|----------|------|-------|
| /health | <5ms | Status check |
| /api/fleet/summary | <100ms | Single aggregate query |
| /api/fleet/worst-performers | <100ms | Indexed query with join |
| /api/customers | <50ms | Paginated list query |
| /api/customers/:id/modem-stats | <5ms | Single row lookup |
| /api/customers/:id/modem-history | <100ms | Time-range query with sampling |

### Load Testing (Optional)
```bash
# Simple load test with Apache Bench
ab -n 100 -c 10 http://localhost:3000/api/fleet/summary

# Expected:
# Requests per second: >100
# Failed requests: 0
# Average time per request: <100ms
```

---

## Rollback Procedure

If deployment fails:

1. **Stop current container**:
```bash
docker stop <container-id>
```

2. **Restore previous database** (if available):
```bash
docker volume rm smartview-data  # Remove bad volume
# Recreate volume with backup
```

3. **Revert to previous image**:
```bash
docker run -p 3000:3000 smartview-backend:previous
```

4. **Verify rollback**:
```bash
curl http://localhost:3000/api/fleet/summary
# Should return data
```

---

## Post-Deployment Monitoring

### Daily Checks
```bash
# Check API responsiveness
curl -o /dev/null -s -w "%{http_code}" http://localhost:3000/api/fleet/summary
# Should return: 200

# Check database integrity
sqlite3 /app/data/smartview.db "SELECT COUNT(*) FROM customers;"
# Should return: 100

# Check container is running
docker ps | grep smartview-backend
# Should show container with status "Up"
```

### Weekly Checks
```bash
# Check disk usage
df -h /app/data
# Should be <100MB

# Check logs for errors
docker logs smartview-backend | grep -i error
# Should be minimal errors

# Run full test suite
bash test-endpoints.sh http://localhost:3000
# Should pass all tests
```

---

## Success Criteria

✅ **Deployment is successful if ALL of the following are true**:

1. Backend starts without errors
2. Logs show: "Database ready: 100 customers found"
3. Logs show: "CORS enabled for localhost:8081"
4. All 4 required endpoints return 200 OK
5. Each endpoint returns valid JSON (not empty)
6. Frontend on port 8081 can connect (no CORS errors)
7. Dashboard loads and displays data
8. Worst performers list shows items
9. Customer search works
10. Response time <100ms for all endpoints

---

## Support

If issues occur:
1. Check logs: `docker logs <container-id>`
2. Run test script: `bash test-endpoints.sh`
3. Check database: `sqlite3 /app/data/smartview.db ".schema"`
4. Review implementation: `/workspace/results/daemon-latest.md`

---

**Status**: ✅ Ready for deployment
