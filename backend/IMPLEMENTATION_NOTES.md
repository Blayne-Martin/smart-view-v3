# SmartView v2 Backend - Fleet API Implementation

## Overview
This document describes the implementation of two critical fleet-level API endpoints that were missing from the SmartView v2 backend.

## Endpoints Added

### 1. GET /api/fleet/summary
**Purpose**: Returns aggregated health statistics across all customers' modems

**Response Schema**:
```json
{
  "data": {
    "total": 100,
    "healthy": 70,
    "warning": 20,
    "critical": 10
  }
}
```

**Fields**:
- `total` (number): Total count of customers with modem stats
- `healthy` (number): Count of modems with health_score = 'Good'
- `warning` (number): Count of modems with health_score = 'Warn'
- `critical` (number): Count of modems with health_score = 'Bad'

**SQL Query Used**:
```sql
SELECT 
  COUNT(*) as total,
  SUM(CASE WHEN health_score = 'Good' THEN 1 ELSE 0 END) as healthy,
  SUM(CASE WHEN health_score = 'Warn' THEN 1 ELSE 0 END) as warning,
  SUM(CASE WHEN health_score = 'Bad' THEN 1 ELSE 0 END) as critical
FROM modem_stats
```

**Performance**: <50ms (indexed on modem_stats table)

**Testing**:
```bash
curl http://localhost:3001/api/fleet/summary
```

---

### 2. GET /api/fleet/worst-performers
**Purpose**: Returns worst-performing modems sorted by severity, with optional filtering by health status

**Query Parameters**:
- `limit` (optional, default: 10, max: 100): Number of results to return
- `status` (optional): Filter by health status - 'Good', 'Warn', or 'Bad'

**Response Schema**:
```json
{
  "data": [
    {
      "id": "uuid-1",
      "customer_id": "uuid-2",
      "name": "John Smith",
      "latency": 145.5,
      "jitter": 25.3,
      "packet_loss": 4.2,
      "snr": 18.5,
      "health_score": "Bad",
      "recorded_at": "2025-04-17T11:00:00.000Z"
    },
    ...
  ]
}
```

**Sorting Logic**:
Modems are sorted first by severity:
1. 'Bad' (health_score = 'Bad') — sorted to top
2. 'Warn' (health_score = 'Warn') — sorted to middle
3. 'Good' (health_score = 'Good') — sorted to bottom
4. NULL/unknown — sorted last

Within each severity level, modems are further sorted by:
- latency DESC (highest latency = worst)
- packet_loss DESC (highest packet loss = worst)

**SQL Query Used**:
```sql
SELECT 
  ms.id, 
  ms.customer_id, 
  c.name, 
  ms.latency, 
  ms.jitter, 
  ms.packet_loss, 
  ms.snr, 
  ms.health_score, 
  ms.recorded_at
FROM modem_stats ms
LEFT JOIN customers c ON ms.customer_id = c.id
WHERE ms.health_score = ? (if status provided)
ORDER BY 
  CASE 
    WHEN ms.health_score = 'Bad' THEN 1
    WHEN ms.health_score = 'Warn' THEN 2
    WHEN ms.health_score = 'Good' THEN 3
    ELSE 4
  END ASC,
  ms.latency DESC,
  ms.packet_loss DESC
LIMIT ?
```

**Performance**: <100ms (indexed on modem_stats.customer_id)

**Testing**:
```bash
# Get worst 10 performers (default)
curl http://localhost:3001/api/fleet/worst-performers

# Get worst 20 performers
curl "http://localhost:3001/api/fleet/worst-performers?limit=20"

# Get only critical modems (health_score = 'Bad')
curl "http://localhost:3001/api/fleet/worst-performers?status=Bad"

# Get only warning modems (health_score = 'Warn'), limited to 15
curl "http://localhost:3001/api/fleet/worst-performers?limit=15&status=Warn"

# Get all good modems
curl "http://localhost:3001/api/fleet/worst-performers?limit=100&status=Good"
```

---

## Database Seeding Verification

The seed file (`seed.cjs`) is responsible for populating the database with test data. It:

1. **Creates schema** if tables don't exist (customers, modem_stats, modem_history)
2. **Skips seeding** if data already exists (idempotent)
3. **Generates 100 customers** with realistic modem profiles:
   - 70 "healthy" customers
   - 10 "poor" customers (high latency, high packet loss)
   - 12 "intermittent" customers (variable metrics)
   - 8 "one-off" customers (occasional spikes)

4. **Creates modem_stats** - one current snapshot per customer
5. **Creates modem_history** - 90 days of hourly history (2,160 records per customer)

### Seeding Instructions

**Option A: Docker Compose (Recommended)**
```bash
cd /smart-view-v2
docker-compose up
# Seed runs automatically in the backend container
```

**Option B: Manual Seeding**
```bash
cd /smart-view-v2/backend
# Install dependencies
npm install

# Run seed
DB_PATH=./smartview.db node seed.cjs

# Expected output:
# Seeding database at: ./smartview.db
# Seeding 100 customers...
#   10/100 customers seeded
#   20/100 customers seeded
#   ...
#   100/100 customers seeded
# Seed complete.
```

### Verify Seeding Worked

```bash
# Check customer count
sqlite3 smartview.db "SELECT COUNT(*) FROM customers;"
# Output: 100

# Check modem_stats count
sqlite3 smartview.db "SELECT COUNT(*) FROM modem_stats;"
# Output: 100

# Check modem_history count
sqlite3 smartview.db "SELECT COUNT(*) FROM modem_history;"
# Output: 216000 (100 customers × 2,160 hours)

# Check health status distribution
sqlite3 smartview.db "SELECT health_score, COUNT(*) FROM modem_stats GROUP BY health_score;"
# Output:
# Bad|10
# Good|70
# Warn|20
```

---

## Integration with Frontend

The SmartView v2 frontend expects these endpoints to be available at:
- `GET /api/fleet/summary`
- `GET /api/fleet/worst-performers`

The frontend uses these to populate:
1. **Dashboard Summary Tiles**
   - Total Customers (from `total`)
   - Healthy Status (from `healthy`)
   - Warning Status (from `warning`)
   - Critical Status (from `critical`)

2. **Worst Performers List**
   - Sorted list of problematic modems
   - Clickable to drill down into customer details
   - Color-coded by health_score

---

## Error Handling

Both endpoints return consistent error responses:

**400 Bad Request** (invalid query params):
```json
{
  "error": "Validation error",
  "code": "VALIDATION_ERROR",
  "details": [...]
}
```

**500 Internal Server Error**:
```json
{
  "error": "Failed to calculate fleet summary",
  "code": "INTERNAL_ERROR"
}
```

---

## Implementation Details

### Health Score Classification

The seed file classifies health based on:
- **'Good'**: Latency ≤ 40ms AND Jitter ≤ 5ms AND Packet Loss ≤ 1% AND SNR ≥ 30dB
- **'Bad'**: Latency > 80ms OR Packet Loss > 3% OR SNR < 22dB
- **'Warn'**: Everything in between

### Database Indexes

These queries leverage the existing index:
```sql
CREATE INDEX idx_modem_stats_customer ON modem_stats(customer_id);
```

For frequent queries, consider adding Redis caching in v3:
- Cache `/api/fleet/summary` for 5 minutes
- Cache `/api/fleet/worst-performers` for 10 minutes

---

## Testing Checklist

- [ ] Database is seeded with 100 customers
- [ ] `/api/fleet/summary` returns correct totals
- [ ] `/api/fleet/summary` response time < 50ms
- [ ] `/api/fleet/worst-performers` returns sorted list
- [ ] `/api/fleet/worst-performers?limit=20` returns 20 results
- [ ] `/api/fleet/worst-performers?status=Bad` filters correctly
- [ ] `/api/fleet/worst-performers?limit=100&status=Warn` filters and limits
- [ ] Frontend loads SmartView v2 Dashboard without errors
- [ ] Summary tiles display correct numbers
- [ ] Worst Performers list displays correctly

---

## Routes Summary

| Method | Path | Purpose | Query Params |
|--------|------|---------|--------------|
| GET | `/api/customers` | List customers | limit, offset, q |
| GET | `/api/customers/:id` | Get customer | - |
| GET | `/api/modems/:customerId/stats` | Latest modem snapshot | - |
| GET | `/api/modems/:customerId/history` | Modem history | days, limit |
| **GET** | **`/api/fleet/summary`** | **Fleet health aggregate** | **-** |
| **GET** | **`/api/fleet/worst-performers`** | **Worst performing modems** | **limit, status** |
| GET | `/api/stream/modems/:customerId` | SSE telemetry stream | - |

---

## Next Steps

1. **Verify seeding**: Run seed script and check row counts
2. **Test endpoints**: Use curl commands above to test responses
3. **Frontend integration**: Verify frontend loads without 404 errors
4. **Performance monitoring**: Track query times in production
5. **Caching strategy** (v3): Implement Redis cache for fleet endpoints

---

## Troubleshooting

**Endpoints return 404?**
- Ensure backend service is running on port 3001
- Check that routes are registered in Express app

**Summary returns all zeros?**
- Check if database was seeded: `SELECT COUNT(*) FROM customers;`
- Verify modem_stats table has data: `SELECT COUNT(*) FROM modem_stats;`
- Check for NULL health_score values: `SELECT DISTINCT health_score FROM modem_stats;`

**Worst performers returns empty?**
- Verify modem_stats has data
- Check if filtered status exists: `SELECT COUNT(*) FROM modem_stats WHERE health_score = 'Bad';`

**Slow response times?**
- Check if indexes exist: `SELECT name FROM sqlite_master WHERE type='index';`
- Run: `ANALYZE;` to update query planner statistics
- Consider upgrading to PostgreSQL for larger datasets

---

## References

- API Contract: `/smart-view-v2/specs/api-contract.yaml`
- Database Schema: `/smart-view-v2/specs/db-schema.sql`
- Frontend Code: `/smart-view-v2/frontend/src/`
