# SmartView v2 — API Reference

**Version:** 2.0  
**Base URL:** `http://localhost:3001` (dev) or `/api` (production)  
**Format:** JSON (request & response)  
**Last Updated:** 2025-01-17

---

## Authentication

SmartView v2 does not require authentication (assumes trusted internal network). Future versions (v3+) will implement JWT-based multi-tenancy.

---

## Overview

| Endpoint | Method | Purpose | Paginated | Cached |
|----------|--------|---------|-----------|--------|
| **Customers** | | | | |
| `/api/customers` | GET | List customers (search, filter, paginate) | ✅ Yes | 30s |
| `/api/customers/:id` | GET | Get single customer | — | 5min |
| `/api/customers/fleet-summary` | GET | Fleet health aggregates | — | 60s |
| **Modem Data** | | | | |
| `/api/customers/:id/modem-stats` | GET | Current modem snapshot | — | 30s |
| `/api/customers/:id/modem-history` | GET | Hourly telemetry history | — | 60s |
| `/api/customers/:id/modem-daily` | GET | Daily aggregated metrics | — | 5min |
| **Telemetry** | | | | |
| `/api/telemetry/stream` | GET | SSE stream (live updates) | — | — |

---

## API Endpoints

### 1. GET /api/customers — Paginated List with Search & Filter

Returns paginated customer list with optional search and health-status filtering.

#### Request

```http
GET /api/customers?q=smith&limit=50&offset=0&status=healthy
```

#### Query Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `q` | string | No | `""` | Search term (prefix match on name/email) |
| `limit` | integer | No | `50` | Results per page (1–200) |
| `offset` | integer | No | `0` | Records to skip (for pagination) |
| `status` | enum | No | `all` | Filter: `all`, `healthy`, `warning`, or `critical` |

#### Response

**Status:** `200 OK`

```json
{
  "customers": [
    {
      "id": 42,
      "name": "Acme Corp",
      "email": "admin@acmecorp.example.com",
      "phone": "+1-415-555-0182",
      "company": "Acme Corp",
      "city": "San Francisco",
      "country": "USA",
      "status": "healthy"
    },
    {
      "id": 51,
      "name": "Smith Inc",
      "email": "support@smithinc.example.com",
      "phone": "+1-212-555-0101",
      "company": "Smith Inc",
      "city": "New York",
      "country": "USA",
      "status": "warning"
    }
  ],
  "pagination": {
    "total": 1000,
    "limit": 50,
    "offset": 0,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

#### Error Responses

| Status | Description | Example |
|--------|-------------|---------|
| `400` | Invalid parameters (e.g., `limit > 200`) | `{ "error": "Invalid limit" }` |
| `500` | Database error | `{ "error": "Internal server error" }` |

#### Notes

- **Search behavior:** Prefix-based. `?q=smith` matches "Smith Inc" and "smithson@email.com", but NOT "j.smith@..." (full-text search in v3).
- **Status filtering:** Computed from latest `modem_stats` snapshot. `healthy` / `warning` / `critical` based on metric thresholds (see Architecture Overview).
- **Pagination:** Use `offset` for cursor pagination. For example: `offset=0` (page 1), `offset=50` (page 2), etc.
- **Performance:** <100ms with indexes; ~50 KB response for 50 customers.

---

### 2. GET /api/customers/:id — Single Customer Details

Retrieves full customer record by ID.

#### Request

```http
GET /api/customers/42
```

#### Path Parameters

| Name | Type | Description |
|------|------|-------------|
| `id` | integer | Customer ID (required) |

#### Response

**Status:** `200 OK`

```json
{
  "id": 42,
  "name": "Acme Corp",
  "email": "admin@acmecorp.example.com",
  "phone": "+1-415-555-0182",
  "company": "Acme Corp",
  "address": "123 Oak Street",
  "city": "San Francisco",
  "country": "USA",
  "createdAt": "2025-01-15T00:00:00Z"
}
```

#### Error Responses

| Status | Description | Example |
|--------|-------------|---------|
| `404` | Customer not found | `{ "error": "Customer not found" }` |
| `500` | Server error | `{ "error": "Internal server error" }` |

#### Notes

- **Cache:** TanStack Query caches for 5 minutes (contact info rarely changes)
- **Performance:** <5ms (primary key lookup)

---

### 3. GET /api/customers/fleet-summary — Fleet Health Dashboard

Returns aggregated health metrics for the entire fleet, plus top 10 worst-performing customers.

#### Request

```http
GET /api/customers/fleet-summary
```

#### Response

**Status:** `200 OK`

```json
{
  "total": 1000,
  "healthy": 712,
  "warning": 158,
  "critical": 130,
  "avgHealthScore": 3.8,
  "topIssues": [
    {
      "rank": 1,
      "customerId": 99,
      "name": "BadCorp LLC",
      "company": "BadCorp",
      "city": "Los Angeles",
      "healthScore": 1.2,
      "status": "critical",
      "issues": ["Low Download Speed", "High Latency", "Packet Loss"]
    },
    {
      "rank": 2,
      "customerId": 87,
      "name": "SlowNet Services",
      "company": "SlowNet",
      "city": "Chicago",
      "healthScore": 2.0,
      "status": "critical",
      "issues": ["High Jitter", "Low Upload Speed"]
    },
    {
      "rank": 3,
      "customerId": 105,
      "name": "WarningZone Inc",
      "company": "WarningZone",
      "city": "Boston",
      "healthScore": 2.8,
      "status": "warning",
      "issues": ["Latency"]
    }
  ]
}
```

#### Health Score Calculation

Average of 7 individual metric scores (each 1–5):
1. **Download Speed:** 5 (≥80 Mbps) → 4 (≥50) → 3 (≥35) → 2 (≥20) → 1 (<20)
2. **Upload Speed:** 5 (≥15 Mbps) → 4 (≥10) → 3 (≥7.5) → 2 (≥5) → 1 (<5)
3. **Latency:** 5 (≤12 ms) → 4 (≤40) → 3 (≤60) → 2 (≤80) → 1 (>80)
4. **Packet Loss:** 5 (≤0.3%) → 4 (≤1%) → 3 (≤2%) → 2 (≤3%) → 1 (>3%)
5. **SNR:** 5 (≥36 dB) → 4 (≥30) → 3 (≥26) → 2 (≥22) → 1 (<22)
6. **Uptime:** 5 (≥99.9%) → 4 (≥99%) → 3 (≥98%) → 2 (≥97%) → 1 (<97%)
7. **Jitter:** 5 (≤1.4 ms) → 4 (≤5) → 3 (≤10) → 2 (≤15) → 1 (>15)

#### Error Responses

| Status | Description | Example |
|--------|-------------|---------|
| `500` | Database error | `{ "error": "Internal server error" }` |

#### Notes

- **Performance:** 500–1000 ms (full table scan, but with indexed join). Recommended caching in production (5 min TTL).
- **Cache:** 60 seconds (TanStack Query default)
- **Worst Performers:** Limited to top 10 by lowest health score

---

### 4. GET /api/customers/:id/modem-stats — Current Snapshot

Returns the latest modem metrics for a customer.

#### Request

```http
GET /api/customers/42/modem-stats
```

#### Path Parameters

| Name | Type | Description |
|------|------|-------------|
| `id` | integer | Customer ID (required) |

#### Response

**Status:** `200 OK`

```json
{
  "id": 1,
  "customerId": 42,
  "downloadMbps": 245.5,
  "uploadMbps": 48.2,
  "latencyMs": 12.4,
  "jitterMs": 1.8,
  "packetLossPct": 0.02,
  "snrDb": 41.2,
  "uptimePct": 99.97,
  "modemModel": "ARRIS SG7550",
  "lastChecked": "2025-01-16T14:35:00Z"
}
```

#### Error Responses

| Status | Description | Example |
|--------|-------------|---------|
| `404` | Customer not found | `{ "error": "Customer not found" }` |
| `500` | Server error | `{ "error": "Internal server error" }` |

#### Notes

- **Cache:** 30 seconds (refreshed by SSE anyway)
- **Performance:** <5ms (unique customer_id lookup)
- **Live Updates:** Use `/api/telemetry/stream` for real-time updates instead of polling

---

### 5. GET /api/customers/:id/modem-history — Hourly Telemetry

Returns hourly modem telemetry for a customer within a specified time range.

#### Request

```http
GET /api/customers/42/modem-history?days=7
```

#### Path Parameters

| Name | Type | Description |
|------|------|-------------|
| `id` | integer | Customer ID (required) |

#### Query Parameters

| Name | Type | Required | Default | Values | Description |
|------|------|----------|---------|--------|-------------|
| `days` | integer | No | `1` | 1, 7, 30, 90 | Days of history to fetch |

#### Response

**Status:** `200 OK`

```json
{
  "customerId": 42,
  "days": 7,
  "data": [
    {
      "recordedAt": "2025-01-09T14:30:00Z",
      "downloadMbps": 240.2,
      "uploadMbps": 47.8,
      "latencyMs": 13.2,
      "packetLossPct": 0.03
    },
    {
      "recordedAt": "2025-01-09T14:35:00Z",
      "downloadMbps": 242.1,
      "uploadMbps": 48.1,
      "latencyMs": 12.9,
      "packetLossPct": 0.02
    },
    {
      "recordedAt": "2025-01-09T15:00:00Z",
      "downloadMbps": 245.5,
      "uploadMbps": 48.2,
      "latencyMs": 12.4,
      "packetLossPct": 0.02
    }
  ]
}
```

#### Data Points

| Days | Typical Count | Interval |
|------|---------------|----------|
| 1 | ~288 | 5 minutes |
| 7 | ~2,016 | 5 minutes (can be sampled to ~168 for charts) |
| 30 | ~8,640 | Pre-aggregated (use modem-daily instead) |
| 90 | ~25,920 | Pre-aggregated (use modem-daily instead) |

#### Error Responses

| Status | Description | Example |
|--------|-------------|---------|
| `404` | Customer not found | `{ "error": "Customer not found" }` |
| `400` | Invalid days parameter | `{ "error": "Invalid days parameter" }` |
| `500` | Server error | `{ "error": "Internal server error" }` |

#### Notes

- **Performance:** 15–100 ms (indexed by customer_id + recorded_at)
- **Chart Optimization:** Frontend should sample to ~200 data points max. For `days=7`, server can optionally return 1-hour samples.
- **Cache:** 60 seconds per time-range window
- **Typical Use:** Customer detail view, hourly/daily trend charts

---

### 6. GET /api/customers/:id/modem-daily — Daily Aggregates

Returns daily aggregated modem metrics for a customer.

#### Request

```http
GET /api/customers/42/modem-daily?days=30
```

#### Path Parameters

| Name | Type | Description |
|------|------|-------------|
| `id` | integer | Customer ID (required) |

#### Query Parameters

| Name | Type | Required | Default | Values | Description |
|------|------|----------|---------|--------|-------------|
| `days` | integer | No | `30` | 30, 90 | Days of daily aggregates |

#### Response

**Status:** `200 OK`

```json
{
  "customerId": 42,
  "days": 30,
  "data": [
    {
      "date": "2025-01-15",
      "avgDownloadMbps": 243.8,
      "avgUploadMbps": 48.0,
      "avgLatencyMs": 12.6,
      "avgPacketLossPct": 0.022,
      "avgJitterMs": 1.9,
      "avgSnrDb": 40.8,
      "avgUptimePct": 99.95
    },
    {
      "date": "2025-01-14",
      "avgDownloadMbps": 242.1,
      "avgUploadMbps": 47.5,
      "avgLatencyMs": 13.1,
      "avgPacketLossPct": 0.025,
      "avgJitterMs": 2.1,
      "avgSnrDb": 40.5,
      "avgUptimePct": 99.93
    }
  ]
}
```

#### Data Points

| Days | Expected Rows | Interval |
|------|---------------|----------|
| 30 | ≤30 | Daily (one per calendar day) |
| 90 | ≤90 | Daily |

#### Error Responses

| Status | Description | Example |
|--------|-------------|---------|
| `404` | Customer not found | `{ "error": "Customer not found" }` |
| `400` | Invalid days parameter | `{ "error": "Invalid days parameter" }` |
| `500` | Server error | `{ "error": "Internal server error" }` |

#### Notes

- **Performance:** 5–30 ms (pre-aggregated, indexed lookup)
- **Cache:** 5 minutes (daily data is stable)
- **Preferred for Charts:** Use instead of modem-history for monthly/quarterly views
- **Completeness:** May return fewer rows if data is incomplete (e.g., new customer with only 5 days of history)

---

### 7. GET /api/telemetry/stream — SSE Live Stream

Opens a Server-Sent Events connection for real-time modem stats updates.

#### Request

```http
GET /api/telemetry/stream?customerId=42
```

#### Query Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `customerId` | integer | **Yes** | Customer ID to stream stats for |

#### Response

**Status:** `200 OK`  
**Content-Type:** `text/event-stream`  
**Connection:** Keep-alive

#### Event Stream Format

**Event Type: `modem-stats`** (sent every 30s if data changed)

```
event: modem-stats
data: {"customerId":42,"downloadMbps":245.5,"uploadMbps":48.2,"latencyMs":12.4,"jitterMs":1.8,"packetLossPct":0.02,"snrDb":41.2,"uptimePct":99.97,"modemModel":"ARRIS SG7550","lastChecked":"2025-01-16T14:35:00Z"}

```

**Event Type: `heartbeat`** (sent every 30s to keep connection alive)

```
event: heartbeat
data: {"ts":"2025-01-16T14:35:30Z"}

```

#### JavaScript Client Example

```javascript
const eventSource = new EventSource('/api/telemetry/stream?customerId=42');

eventSource.addEventListener('modem-stats', (event) => {
  const data = JSON.parse(event.data);
  console.log('Updated modem stats:', data);
  // Update UI with fresh data
});

eventSource.addEventListener('heartbeat', (event) => {
  const heartbeat = JSON.parse(event.data);
  console.log('Heartbeat at:', heartbeat.ts);
});

eventSource.onerror = () => {
  console.error('SSE connection error');
  eventSource.close();
};

// On component unmount or customer change:
eventSource.close();
```

#### React Hook Example

```javascript
function useLiveStream(customerId) {
  const [status, setStatus] = useState('idle');
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!customerId) return;

    const eventSource = new EventSource(
      `/api/telemetry/stream?customerId=${customerId}`
    );

    setStatus('connecting');

    eventSource.addEventListener('modem-stats', (event) => {
      const data = JSON.parse(event.data);
      // Update TanStack Query cache
      queryClient.setQueryData(['modem-stats', customerId], data);
      setStatus('connected');
    });

    eventSource.addEventListener('heartbeat', () => {
      // Connection is alive
      if (status !== 'connected') setStatus('connected');
    });

    eventSource.onerror = () => {
      setStatus('disconnected');
      eventSource.close();
    };

    return () => eventSource.close();
  }, [customerId, queryClient, status]);

  return status;
}
```

#### Error Responses

| Status | Description | Example |
|--------|-------------|---------|
| `400` | Missing customerId | `{ "error": "customerId is required" }` |
| `404` | Customer not found | `{ "error": "Customer not found" }` |

#### Notes

- **Connection Lifetime:** Indefinite (until client closes or network error)
- **Polling Interval:** 30 seconds (server-side)
- **Change Detection:** Only sends `modem-stats` event if values changed since last send
- **Heartbeat:** Sent every 30s to keep connection alive through proxies/firewalls
- **Recommended Client Handling:**
  - Listen for `modem-stats` events → update TanStack Query cache (no re-fetch needed)
  - Listen for `heartbeat` events → update connection status indicator
  - On `error` or client unmount → `eventSource.close()`
  - Implement exponential backoff reconnection (v3)

---

## Data Type Reference

### Customer

```json
{
  "id": 42,
  "name": "string",
  "email": "string (unique)",
  "phone": "string",
  "company": "string (optional)",
  "address": "string (optional)",
  "city": "string",
  "country": "string",
  "createdAt": "ISO 8601 datetime",
  "status": "healthy | warning | critical (computed from modem_stats)"
}
```

### ModemStats

```json
{
  "id": 1,
  "customerId": 42,
  "downloadMbps": 245.5,
  "uploadMbps": 48.2,
  "latencyMs": 12.4,
  "jitterMs": 1.8,
  "packetLossPct": 0.02,
  "snrDb": 41.2,
  "uptimePct": 99.97,
  "modemModel": "string (optional)",
  "lastChecked": "ISO 8601 datetime"
}
```

### ModemHistoryRow

```json
{
  "recordedAt": "ISO 8601 datetime",
  "downloadMbps": 245.5,
  "uploadMbps": 48.2,
  "latencyMs": 12.4,
  "packetLossPct": 0.02
}
```

### ModemDailyRow

```json
{
  "date": "YYYY-MM-DD",
  "avgDownloadMbps": 243.8,
  "avgUploadMbps": 48.0,
  "avgLatencyMs": 12.6,
  "avgPacketLossPct": 0.022,
  "avgJitterMs": 1.9,
  "avgSnrDb": 40.8,
  "avgUptimePct": 99.95
}
```

---

## Rate Limiting

SmartView v2 has no built-in rate limiting (assumes trusted internal network). Rate limiting will be added in v3 with multi-tenancy.

---

## CORS & Headers

| Header | Value | Notes |
|--------|-------|-------|
| `Access-Control-Allow-Origin` | None (same-origin only) | v3 will add API key-based CORS |
| `Content-Type` | `application/json` | Or `text/event-stream` for SSE |
| `Cache-Control` | `no-cache` (SSE) or default | Respects browser cache |

---

## Error Codes

| Code | Meaning | Common Causes | Fix |
|------|---------|--------------|-----|
| `400` | Bad Request | Invalid query params, missing required field | Check endpoint documentation |
| `404` | Not Found | Customer ID doesn't exist | Verify customer exists |
| `500` | Internal Server Error | Database crash, unhandled exception | Check server logs |

---

## Example Request/Response Workflows

### Workflow 1: Search Customers + Drill Down

1. **Search for "smith":**
   ```
   GET /api/customers?q=smith&limit=50&offset=0
   → Returns 10 matching customers (Smith Inc, Smithson Corp, etc.)
   ```

2. **Click on "Smith Inc" (id=51):**
   ```
   GET /api/customers/51
   → Returns full customer details
   ```

3. **View modem diagnostics:**
   ```
   GET /api/customers/51/modem-stats
   → Returns current snapshot (health gauge, stat tiles)
   ```

4. **View 7-day trend:**
   ```
   GET /api/customers/51/modem-history?days=7
   → Returns ~168 hourly readings (or sampled)
   ```

5. **Open live stream:**
   ```
   GET /api/telemetry/stream?customerId=51
   → Persistent EventSource connection
   → Receives modem-stats + heartbeat events every 30s
   ```

### Workflow 2: Fleet Dashboard Load

1. **Load home page:**
   ```
   GET /api/customers/fleet-summary
   → Returns total/healthy/warning/critical counts + top 10 worst
   ```

2. **Click on worst performer (id=99):**
   ```
   GET /api/customers/99
   GET /api/customers/99/modem-stats
   GET /api/telemetry/stream?customerId=99
   → Navigates to detail view with live data
   ```

---

## Testing with curl

```bash
# Get customer list
curl http://localhost:3001/api/customers?limit=10

# Search
curl http://localhost:3001/api/customers?q=smith&limit=20

# Filter by status
curl http://localhost:3001/api/customers?status=critical

# Get single customer
curl http://localhost:3001/api/customers/42

# Fleet summary
curl http://localhost:3001/api/customers/fleet-summary

# Modem stats
curl http://localhost:3001/api/customers/42/modem-stats

# Modem history
curl http://localhost:3001/api/customers/42/modem-history?days=7

# Modem daily
curl http://localhost:3001/api/customers/42/modem-daily?days=30

# SSE stream (Ctrl+C to stop)
curl http://localhost:3001/api/telemetry/stream?customerId=42
```

---

**Maintained by:** Daemon (Backend)  
**Last Reviewed:** 2025-01-17  
**Next Review:** When new endpoints are added
