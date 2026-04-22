# SmartView v2 — Architecture Overview

**Version:** 2.0  
**Last Updated:** 2025-01-17  
**Status:** Production Ready  
**Audience:** Architects, Backend Engineers, Frontend Engineers

---

## 1. System Overview

SmartView v2 is an ISP intelligence dashboard for monitoring customer modem/broadband health. The system collects modem telemetry data, aggregates it daily, and provides a responsive web interface for viewing fleet-level health metrics and deep-diving into individual customer diagnostics.

### 1.1 Core Use Cases

1. **Fleet Dashboard** — Real-time overview of all customer health statuses (healthy/warning/critical)
2. **Customer Search & Filter** — Quickly find customers by name, email, or health status
3. **Customer Detail View** — Drill down into individual customer modem diagnostics
4. **Modem Analytics** — View hourly/daily telemetry trends (1d/7d/30d/90d time ranges)
5. **Live Status** — SSE-backed real-time updates of modem stats

### 1.2 Key Metrics

| Metric | Normal | Warning | Critical |
|--------|--------|---------|----------|
| **Download Speed** | ≥50 Mbps | 20–49 Mbps | <20 Mbps |
| **Upload Speed** | ≥10 Mbps | 5–9 Mbps | <5 Mbps |
| **Latency** | ≤40 ms | 40–80 ms | >80 ms |
| **Packet Loss** | ≤1% | 1–3% | >3% |
| **SNR** | ≥30 dB | 22–30 dB | <22 dB |
| **Uptime** | ≥99% | 97–99% | <97% |
| **Jitter** | ≤5 ms | 5–15 ms | >15 ms |

**Health Score Calculation:** Each metric is scored 1–5; average across all 7 metrics = final health score (1.0–5.0).

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      BROWSER (React 18)                         │
│                                                                   │
│  ┌──────────┐  ┌──────────────────────────────────────────────┐ │
│  │ Router   │  │  TanStack Query Cache                         │ │
│  │ (v6)     │  │  (customers, fleet, modem history/daily)    │ │
│  └────────┬─┘  └────────────────────────────────────────────┬─┘ │
│           │                                                   │   │
│  ┌────────▼───────────────────────────────────────────────────┴──┐│
│  │                    Component Tree                            ││
│  │                                                              ││
│  │  App.jsx (thin shell)                                       ││
│  │   ├─ Layout.jsx (SSE hook + <Outlet>)                       ││
│  │   │  ├─ Header.jsx (LiveIndicator)                          ││
│  │   │  ├─ Sidebar.jsx (search, filters, customer list)        ││
│  │   │  └─ Main Content                                        ││
│  │   │     ├─ FleetDashboard.jsx (tiles + worst performers)   ││
│  │   │     └─ CustomerDetailView.jsx (stats + charts)         ││
│  │   │        ├─ ModemStats.jsx (HealthGauge + stat tiles)    ││
│  │   │        ├─ LineChartCard (Recharts)                     ││
│  │   │        └─ BarChartCard (Recharts)                      ││
│  │                                                              ││
│  └──────────────────────────────────────────────────────────────┘│
│                                                                   │
│          Hooks (TanStack Query + SSE)                           │
│  useCustomers() / useCustomer() / useFleetSummary()            │
│  useModemStats() / useModemHistory() / useModemDaily()         │
│  useLiveStream() [SSE / EventSource]                           │
│                                                                   │
└─────────────────────┬───────────────────────────────────────────┘
                      │ HTTPS
                      │
          ┌───────────▼──────────────┐
          │   Backend (Node/Express)  │
          │                           │
          │  /api/customers           │
          │  /api/customers/:id       │
          │  /api/customers/fleet...  │
          │  /api/customers/:id/...   │
          │  /api/telemetry/stream    │
          │                           │
          └───────────┬───────────────┘
                      │ SQLite queries
                      │
          ┌───────────▼──────────────┐
          │   SQLite Database        │
          │  (better-sqlite3)        │
          │                          │
          │  ├─ customers            │
          │  ├─ modem_stats          │ (with indexes)
          │  ├─ modem_history        │
          │  └─ modem_daily          │
          │                          │
          └──────────────────────────┘
```

---

## 3. Backend Architecture

### 3.1 Technology Stack

- **Runtime:** Node.js 18+
- **Framework:** Express 4.x
- **Database:** SQLite (better-sqlite3)
- **Deployment:** Docker (nginx + Node.js containers)

### 3.2 API Layer

#### 3.2.1 Customer Management Endpoints

| Endpoint | Method | Purpose | Parameters |
|----------|--------|---------|-----------|
| `/api/customers` | GET | Paginated customer list | `q`, `limit`, `offset`, `status` |
| `/api/customers/:id` | GET | Single customer details | — |
| `/api/customers/fleet-summary` | GET | Fleet aggregates | — |

#### 3.2.2 Modem Data Endpoints

| Endpoint | Method | Purpose | Parameters |
|----------|--------|---------|-----------|
| `/api/customers/:id/modem-stats` | GET | Current snapshot | — |
| `/api/customers/:id/modem-history` | GET | Hourly history | `days` (1/7/30/90) |
| `/api/customers/:id/modem-daily` | GET | Daily aggregates | `days` (30/90) |

#### 3.2.3 Telemetry (SSE)

| Endpoint | Method | Purpose | Parameters |
|----------|--------|---------|-----------|
| `/api/telemetry/stream` | GET | Server-sent events | `customerId` |

### 3.3 Database Schema

#### Core Tables

**`customers`** — ISP end-user accounts
```
id (PK) | name | email | phone | company | address | city | country | created_at
```

**`modem_stats`** — Latest snapshot (one per customer)
```
id (PK) | customer_id (UNIQUE, FK) | download_mbps | upload_mbps | 
latency_ms | jitter_ms | packet_loss_pct | snr_db | uptime_pct | 
modem_model | last_checked
```

**`modem_history`** — Time-series telemetry (hourly, 5-min intervals)
```
id (PK) | customer_id (FK) | recorded_at | download_mbps | upload_mbps | 
latency_ms | packet_loss_pct
```
*Index:* `idx_modem_history_customer_time` (customer_id, recorded_at)

**`modem_daily`** — Pre-aggregated daily statistics
```
id (PK) | customer_id (FK) | date | avg_download_mbps | avg_upload_mbps | 
avg_latency_ms | avg_packet_loss_pct | avg_jitter_ms | avg_snr_db | avg_uptime_pct
```
*Index:* `idx_modem_daily_customer_date` (customer_id, date)

#### Critical Indexes (v2 P0)

These indexes transformed query performance from 1–5 seconds to 15–100ms:

```sql
CREATE INDEX idx_modem_history_customer_time   ON modem_history(customer_id, recorded_at);
CREATE INDEX idx_modem_daily_customer_date     ON modem_daily(customer_id, date);
CREATE INDEX idx_modem_stats_customer          ON modem_stats(customer_id);
CREATE INDEX idx_customers_name                ON customers(name);
CREATE INDEX idx_customers_email               ON customers(email);
```

### 3.4 Request Flow Example

**Scenario:** User navigates to `/customers/42`

1. **Frontend:** React Router matches `/customers/:id` → `CustomerDetailView` component
2. **Frontend:** `useCustomer(42)` hook calls TanStack Query
3. **TanStack Query:** Check cache (staleTime: 5 min) → if stale, fetch
4. **API Call:** `GET /api/customers/42` → JSON response with customer details
5. **Backend:** Query `customers` table (indexed by PK) → return in <5ms
6. **Frontend:** Render customer header + contact info
7. **Frontend:** Concurrently, `useModemStats(42)` queries `/api/customers/42/modem-stats`
8. **Backend:** Query `modem_stats` (indexed lookup) → return in <5ms
9. **Frontend:** `useLiveStream(42)` opens EventSource to `/api/telemetry/stream?customerId=42`
10. **Backend:** Poll `modem_stats` every 30s, send SSE events on change
11. **Frontend:** Render live indicator (green = connected), receive real-time stat updates

---

## 4. Frontend Architecture

### 4.1 Technology Stack

- **Framework:** React 18
- **Build:** Vite 5.x
- **Routing:** react-router-dom v6
- **State Management:** TanStack Query v5 (server state only)
- **Charts:** Recharts v2.12+
- **Virtual Scrolling:** @tanstack/react-virtual
- **Styling:** CSS Modules + CSS custom properties

### 4.2 Component Hierarchy

```
src/
├── main.jsx                    ← Entry: BrowserRouter + QueryClientProvider
├── App.jsx                     ← Thin shell (theme, <AppRoutes>)
├── router.jsx                  ← Route definitions
│
├── hooks/
│   ├── useCustomers.js        ← TanStack Query: customer list
│   ├── useCustomer.js         ← TanStack Query: single customer
│   ├── useModemStats.js       ← TanStack Query: current snapshot
│   ├── useModemHistory.js     ← TanStack Query: hourly history (cached per days param)
│   ├── useModemDaily.js       ← TanStack Query: daily aggregates
│   ├── useFleetSummary.js     ← TanStack Query: fleet overview
│   ├── useTheme.js            ← Theme toggle (localStorage)
│   └── useLiveStream.js       ← SSE: EventSource wrapper
│
├── components/
│   ├── layout/
│   │   ├── Layout.jsx         ← Root shell (Sidebar + Header + <Outlet>)
│   │   ├── Header.jsx         ← Top bar with live indicator + theme toggle
│   │   └── Sidebar.jsx        ← Nav, search, filter chips, customer list
│   │
│   ├── customer/
│   │   ├── CustomerList.jsx   ← Virtualized list (@tanstack/react-virtual)
│   │   ├── CustomerRow.jsx    ← Single list row (clickable, statuschip)
│   │   ├── CustomerDetail.jsx ← Detail panel (stats + charts)
│   │   ├── CustomerHeader.jsx ← Name/badge/close
│   │   └── ContactCard.jsx    ← Address/email/phone
│   │
│   ├── fleet/
│   │   ├── FleetDashboard.jsx ← Home: tiles + worst performers table
│   │   └── FleetSummaryTiles.jsx ← 4 tile cards + fleet health gauge
│   │
│   ├── modem/
│   │   ├── ModemStats.jsx     ← Diagnostic view: health gauge + 8 stat tiles
│   │   └── StatTile.jsx       ← Reusable stat display card
│   │
│   ├── charts/
│   │   ├── LineChartCard.jsx  ← Recharts: hourly history
│   │   └── BarChartCard.jsx   ← Recharts: daily aggregates
│   │
│   ├── common/
│   │   ├── SearchBar.jsx      ← Text input for customer search
│   │   ├── StatusFilterChips.jsx ← All / Healthy / Warning / Critical
│   │   ├── TimeRangeSelector.jsx ← 1d / 7d / 30d / 90d toggle
│   │   ├── LoadingSkeleton.jsx ← Shimmer loader
│   │   ├── LiveIndicator.jsx  ← SSE status dot
│   │   └── ErrorBoundary.jsx  ← Component error isolation
│
└── styles/
    ├── tokens.css              ← CSS variables (colors, spacing, etc.)
    └── animations.css          ← Keyframes, reduced-motion
```

### 4.3 Routing Structure

```
/                            → FleetDashboard (home)
/customers                   → CustomerListView (with Sidebar active)
/customers/:id               → CustomerDetailView (detail panel open)
```

### 4.4 TanStack Query Caching Strategy

**Goal:** Balance freshness with network efficiency

| Data | Stale Time | Use Case |
|------|-----------|----------|
| **Customer list** | 30s | Search results, pagination |
| **Fleet summary** | 60s | Dashboard tiles |
| **Customer detail** | 5 min | Contact info (rarely changes) |
| **Modem stats** | 30s | Latest snapshot (refreshed by SSE) |
| **Modem history** | 1 min | Charts (already pre-aggregated by server) |
| **Modem daily** | 5 min | Daily trend (very stable) |

**Cache Keys:**
```js
['customers', { q, limit, offset, status }]    // Scoped by search params
['customer', id]                                // Unique per customer
['fleet-summary']                               // Single global key
['modem-stats', customerId]                     // Per customer
['modem-history', customerId, days]             // Per customer + time window
['modem-daily', customerId, days]               // Per customer + time window
```

### 4.5 SSE Implementation (`useLiveStream`)

```js
// Pseudo-code
function useLiveStream(customerId) {
  const [status, setStatus] = useState('idle');
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!customerId) {
      setStatus('idle');
      return;
    }

    const eventSource = new EventSource(
      `/api/telemetry/stream?customerId=${customerId}`
    );

    setStatus('connecting');

    eventSource.addEventListener('modem-stats', (event) => {
      const data = JSON.parse(event.data);
      // Update cache without re-fetching
      queryClient.setQueryData(['modem-stats', customerId], data);
      setStatus('connected');
    });

    eventSource.addEventListener('heartbeat', () => {
      setStatus('connected');
    });

    eventSource.onerror = () => {
      setStatus('disconnected');
      eventSource.close();
    };

    return () => eventSource.close();
  }, [customerId, queryClient]);

  return status; // 'idle' | 'connecting' | 'connected' | 'disconnected'
}
```

---

## 5. Key Features & Implementation

### 5.1 Fleet Dashboard (Home Screen)

**Path:** `/`

**Components:**
- **Summary Tiles:** Total, Healthy, Warning, Critical (with counts)
- **Fleet Health Gauge:** Arc visualization of average health score (1.0–5.0)
- **Worst Performers Table:** Top 10 customers with lowest scores, sortable by rank/name/score

**Data Flow:**
1. `FleetDashboard` → `useFleetSummary()` (TanStack Query)
2. Backend aggregates all customers' modem_stats
3. Calculates health status and score for each customer
4. Returns summary counts + top 10 worst

### 5.2 Customer List with Search & Filter

**Path:** `/customers`

**Features:**
- **Search bar:** Prefix search by name/email (server-side filtered)
- **Status filter chips:** All / Healthy / Warning / Critical (URL-bound)
- **Virtual scrolling:** Handles 1000+ customers efficiently (row height: 60px)
- **Pagination:** Server enforces `limit=50` per page

**Data Flow:**
1. Sidebar: `SearchBar` input → updates `q` query param
2. Status chip click → adds `?status=critical` to URL
3. `useCustomers()` hook reads URL params
4. Backend filters + paginates
5. Frontend renders 50 rows, virtualizes rest

### 5.3 Customer Detail View

**Path:** `/customers/:id`

**Panels:**
1. **Header:** Name, email, phone, city, company
2. **Modem Diagnostics:**
   - **Health Gauge:** 1–5 arc, color-coded
   - **8 Stat Tiles:** Download, Upload, Latency, Jitter, Packet Loss, SNR, Uptime, Modem Model
   - **Live Indicator:** SSE connection status (green = connected)
3. **Charts:**
   - **Time Range Selector:** 1d / 7d / 30d / 90d
   - **Line Chart:** Download, Upload, Latency, Packet Loss (hourly from modem_history)
   - **Bar Chart:** Daily aggregates (avg metrics by day from modem_daily)

**Data Flow:**
1. Router params `:id` → `useCustomer(id)` + `useModemStats(id)` + `useLiveStream(id)`
2. `useLiveStream` opens SSE → gets real-time updates
3. Time range selector changes → `useModemHistory(id, days)` fetches new window
4. Charts render with Recharts (max 200 data points, sample if needed)

### 5.4 Real-Time Live Indicator

**Component:** `Header.jsx` → `LiveIndicator.jsx`

**States:**
- 🟤 **Idle:** No customer selected (grey)
- 🟡 **Connecting:** SSE handshake in progress (amber)
- 🟢 **Connected:** Active SSE stream, received heartbeat (green, pulsing)
- 🔴 **Disconnected:** SSE error or timeout (red)

**Implementation:**
- `Layout.jsx` calls `useLiveStream(customerIdFromURL)`
- Result passed to `Header.jsx`
- `LiveIndicator` renders colored dot + animated pulse (on 'connected')
- Uses `prefers-reduced-motion` media query for accessibility

### 5.5 Accessibility Features

- **ARIA Labels:** All images (`role="img"`), charts, buttons
- **Semantic HTML:** `<nav>`, `<main>`, `<section>`, `<button>`, `<a>`
- **Keyboard Navigation:** Tab order, Enter to select, Escape to close panels
- **Color Contrast:** WCAG AA minimum (4.5:1 for text)
- **Reduced Motion:** `@media (prefers-reduced-motion: reduce)` disables animations
- **Focus Management:** Focus trap in modals, restoration on close
- **List Semantics:** `role="list"` on containers, `role="listitem"` on rows

---

## 6. Performance Optimizations

### 6.1 Backend Performance

| Optimization | Impact | Effort |
|--------------|--------|--------|
| **Database indexes** | 10–100x query speedup (1–5s → 15–100ms) | ✅ Done (v2 P0) |
| **Pagination (limit/offset)** | Reduces payload from 10 MB to 50 KB per page | ✅ Done |
| **Server-side sampling** | For days≥7: sample 5-min data → 1-hour intervals | ⚠️ Optional |
| **Response compression** | gzip reduces JSON 70–80% | ✅ Express middleware |
| **Connection pooling** | SQLite BUSY timeout + WAL mode | ✅ better-sqlite3 defaults |
| **Caching** | Redis cache for fleet-summary (5 min TTL) | ⏳ v3 future |

### 6.2 Frontend Performance

| Optimization | Impact | Status |
|--------------|--------|--------|
| **Vite build** | Code splitting, lazy loading | ✅ Vite 5.x |
| **React 18 Suspense** | Streamed HTML + concurrent rendering | ✅ Built-in |
| **Virtual scrolling** | 1000+ customers rendered as <10 DOM nodes | ✅ @tanstack/react-virtual |
| **TanStack Query** | HTTP cache avoids refetches | ✅ Configured |
| **Recharts optimization** | Disabled animations (`isAnimationActive={false}`) | ✅ All charts |
| **Code splitting** | Lazy load detail views | ⏳ v3 future |
| **Service Worker** | Offline support + precaching | ⏳ v3 future |

### 6.3 Network Performance

- **SSE for live updates:** Avoids polling overhead, reduces client complexity
- **Pagination:** Limits initial payload size
- **Gzip compression:** Standard Express middleware
- **HTTP/2:** Nginx proxy handles multiplexing

---

## 7. Security Considerations

- **No authentication in v2:** Assumes trusted internal network (ISP admin dashboard)
- **CORS:** Disabled (single-origin, same domain)
- **SQL Injection:** Prevented via parameterized queries (better-sqlite3)
- **XSS:** React's built-in escaping + CSP headers (future)
- **HTTPS:** Enforced by nginx proxy in production

**Future (v3):**
- Multi-tenancy + JWT authentication
- Rate limiting + API key management
- Audit logging for compliance

---

## 8. Deployment Architecture

### 8.1 Docker Compose Stack

```yaml
services:
  backend:
    image: smartview-backend:v2
    ports:
      - "3001:3000"
    volumes:
      - ./data/smartview.db:/app/smartview.db
    environment:
      - NODE_ENV=production
      - DATABASE_PATH=/app/smartview.db

  frontend:
    image: smartview-frontend:v2
    ports:
      - "3000:5173"

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
```

### 8.2 Runtime Requirements

- **Node.js:** 18+ (LTS recommended)
- **SQLite:** Bundled (better-sqlite3 native module)
- **Memory:** 256 MB minimum (backend), 512 MB total recommended
- **Disk:** 500 MB for database (1000 customers × 1 year data)
- **CPU:** 1 core sufficient for <100 concurrent users

---

## 9. Known Limitations & Future Work

### 9.1 v2 Scope

✅ **Completed:**
- Database indexes for query performance
- Pagination and filtering
- SSE real-time updates
- React Router v6 navigation
- Recharts for better visualizations
- TanStack Query for caching
- Accessibility baseline (ARIA labels, semantic HTML)

❌ **Out of Scope (v3):**
- Real-time modem telemetry ingestion (currently pre-seeded data)
- User authentication / multi-tenancy
- PostgreSQL migration (documented but not actioned)
- Full-text search (FTS5)
- Service worker / offline mode
- Advanced analytics (anomaly detection, forecasting)

### 9.2 Performance Roadmap

| Version | Optimization | Expected Impact |
|---------|--------------|-----------------|
| **v2** | Indexes + pagination | 10–100x query speedup |
| **v3** | PostgreSQL + caching | Sub-100ms all queries |
| **v4** | TimescaleDB + streaming | Real-time ingestion at scale |

---

## 10. References

- **Design Spec:** `/workspace/specs/design.md`
- **API Contract:** `/workspace/specs/api-contract.yaml`
- **Database Schema:** `/workspace/specs/db-schema.sql`
- **Backend Guide:** `/workspace/specs/BACKEND_IMPLEMENTATION_GUIDE.md`

---

**Maintained by:** Archie (Architecture)  
**Last Reviewed:** 2025-01-17
