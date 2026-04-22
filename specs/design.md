# SmartView v2 — Design Specification

**Project:** Blayne-Martin/smart-view  
**Version:** 2.0  
**Architect:** Archie  
**Date:** 2025  
**Status:** Approved for implementation

---

## 1. Overview

SmartView is an ISP intelligence dashboard for monitoring customer modem/broadband health. This v2 spec actions all P0/P1/P2 improvements identified in the architecture analysis.

### 1.1 Current Stack
- **Backend:** Node.js/Express, better-sqlite3, Docker
- **Frontend:** React 18 + Vite, raw CSS (no component library), hand-rolled SVG charts

### 1.2 v2 Goals
1. Fix critical performance issues (missing DB indexes, no pagination, oversized payloads)
2. Replace hand-rolled charts with Recharts + add time-range selector
3. Add TanStack Query for API caching
4. Add react-router-dom for URL-based navigation
5. Add fleet-level summary dashboard home screen
6. Add health-status filter chips to customer list
7. Fix or replace the fake LIVE indicator with real SSE polling
8. Add accessibility labels to all SVG/chart elements
9. Refactor App.jsx into proper separation of concerns
10. Add .gitignore to exclude .DS_Store and other artefacts

---

## 2. Architecture

### 2.1 Backend Changes

#### 2.1.1 DB Indexes (CRITICAL — P0)
Add indexes to `seed.js` and a new `migrations/001_add_indexes.sql`:
```sql
CREATE INDEX IF NOT EXISTS idx_modem_history_customer  ON modem_history(customer_id);
CREATE INDEX IF NOT EXISTS idx_modem_history_recorded  ON modem_history(customer_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_modem_daily_customer    ON modem_daily(customer_id);
CREATE INDEX IF NOT EXISTS idx_modem_stats_customer    ON modem_stats(customer_id);
CREATE INDEX IF NOT EXISTS idx_customers_name          ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_email         ON customers(email);
```

#### 2.1.2 New/Updated API Endpoints

| Method | Endpoint | Change |
|--------|----------|--------|
| GET | `/api/customers` | Add `limit`, `offset`, `status` query params for pagination + filter |
| GET | `/api/customers/fleet-summary` | NEW — fleet-level health aggregate |
| GET | `/api/customers/:id/modem-history` | Add `?days=1\|7\|30\|90` time-range param (default: 1) |
| GET | `/api/customers/:id/modem-daily` | Add `?days=30\|90` param (default: 30) |
| GET | `/api/telemetry/stream` | NEW — SSE endpoint for live modem stats refresh |

#### 2.1.3 Fleet Summary Endpoint
```
GET /api/customers/fleet-summary
Response:
{
  total: 1000,
  healthy: 712,
  warning: 158,
  critical: 130,
  avg_health_score: 3.8,
  top_issues: [{ customer_id, name, health_score, issues: ["Latency", "Packet Loss"] }] (top 10 worst)
}
```
Health classification uses the same thresholds as the frontend metric definitions.

#### 2.1.4 SSE Telemetry Stream
```
GET /api/telemetry/stream?customerId=123
Content-Type: text/event-stream

event: modem-stats
data: { customer_id, download_mbps, upload_mbps, latency_ms, ... }

// Heartbeat every 25s to keep connection alive through proxies
event: heartbeat
data: { ts: "2025-..." }
```
- Server polls `modem_stats` for the given `customerId` every 30 seconds
- Sends updated data only if values have changed (compare snapshot)
- On client disconnect, cleans up the interval
- Replaces the cosmetic "LIVE" dot with a real connection status indicator

#### 2.1.5 Pagination for /api/customers
```
GET /api/customers?q=john&limit=50&offset=0&status=critical
Response:
{
  customers: [...],
  total: 1000,       // total matching records (for pagination UI)
  limit: 50,
  offset: 0
}
```
Status filter maps to health classification computed via a JOIN with `modem_stats`.

---

### 2.2 Frontend Changes

#### 2.2.1 Routing Structure (react-router-dom v6)
```
/                    → FleetDashboard (new home screen)
/customers           → CustomerListView (sidebar + search)
/customers/:id       → CustomerDetailView (deep-links to specific customer)
```

#### 2.2.2 Component Architecture (as-built)

> **Implementation note (Skye, cleanup pass):** The component tree below reflects
> the *as-built* state after the v2 refactor. Two deliberate deviations from the
> original spec are called out inline and explained in §2.2.11.

```
src/
  main.jsx             ← BrowserRouter + QueryClientProvider
  App.jsx              ← Thin shell: applies theme, renders <AppRoutes>
  router.jsx           ← Route definitions + CustomerDetailView component
  hooks/
    useCustomers.js    ← TanStack Query: customer list
    useCustomer.js     ← TanStack Query: single customer
    useModemStats.js   ← TanStack Query: modem stats
    useModemHistory.js ← TanStack Query: modem history (with days param)
    useModemDaily.js   ← TanStack Query: modem daily
    useFleetSummary.js ← TanStack Query: fleet summary
    useTheme.js        ← Theme toggle logic
    useLiveStream.js   ← SSE connection hook
  components/
    layout/
      Sidebar.jsx          ← Sidebar: logo, nav, search, chips, customer list
      Header.jsx           ← Top bar: live indicator + theme toggle
      Layout.jsx           ← Root shell: Sidebar + Header + <Outlet>
    customer/
      CustomerList.jsx     ← Virtualised list (@tanstack/react-virtual)
      CustomerRow.jsx      ← Single customer row
      CustomerDetail.jsx   ← Customer detail panel (SSE + ModemStats)
      CustomerHeader.jsx   ← Name/badge/close button
      ContactCard.jsx      ← Contact info card
    fleet/
      FleetDashboard.jsx   ← Home screen
      FleetSummaryTiles.jsx← Total/Healthy/Warning/Critical tiles + fleet gauge
      WorstPerformers.jsx  ← Top 10 worst table
    modem/
      ModemStats.jsx       ← Refactored: Recharts charts, hooks, co-located
                              HealthGauge SVG arc (see §2.2.11 deviation #1)
      StatTile.jsx         ← Extracted stat tile (imported by ModemStats)
    charts/
      LineChartCard.jsx    ← Recharts LineChart wrapper
      BarChartCard.jsx     ← Recharts BarChart wrapper
    common/
      SearchBar.jsx        ← Canonical location — imported by Sidebar
      StatusFilterChips.jsx← All / Healthy / Warning / Critical filter chips
      ErrorBoundary.jsx    ← Component-level error isolation
      LoadingSkeleton.jsx  ← Shimmer skeleton (default + SkeletonRow variants)
      LiveIndicator.jsx    ← SSE-backed connection status dot
      TimeRangeSelector.jsx← 24h / 7d / 30d / 90d toggle
  styles/
    tokens.css             ← CSS custom properties
    animations.css         ← @keyframes + .anim-* utility classes
```

#### 2.2.3 Charting — Recharts
Replace hand-rolled SVG charts with Recharts components:
- `LineChartCard`: `<ResponsiveContainer><LineChart>` with `dot={false}`, `isAnimationActive={false}`
- `BarChartCard`: `<ResponsiveContainer><BarChart>`
- Both charts: `role="img"`, `aria-label` with avg/min/max values, `<CartesianGrid>`, `<Tooltip>`
- Time-range selector controls which history slice is fetched (1d/7d/30d/90d)
- Never render more than 200 data points in a single chart — sample/aggregate server-side

#### 2.2.4 TanStack Query Caching Strategy
```js
// Stale times:
customers list:     staleTime: 30_000   (30s)
fleet summary:      staleTime: 60_000   (1min)
customer detail:    staleTime: 300_000  (5min — contact info rarely changes)
modem-stats:        staleTime: 30_000   (30s — refreshed by SSE anyway)
modem-history:      staleTime: 60_000   (1min per time-range window)
modem-daily:        staleTime: 300_000  (5min — daily aggregates stable)
```

#### 2.2.5 Customer List Virtualisation
- Uses `@tanstack/react-virtual` `useVirtualizer` hook
- Row height: 60px (estimated), overscan: 5
- First page (limit=50) fetched on mount; server-side search returns top 50 results

#### 2.2.6 Fleet Dashboard (New Home Screen)
Summary tiles row:
- Total Customers
- Healthy (green)
- Warning (amber)
- Critical (red)
- Avg Fleet Health Score arc gauge

Below: "Worst Performers" table — top 10 customers by lowest health score, columns: Rank, Name, Company, City, Health Score, Status, Issues. Clicking a row navigates to `/customers/:id`.

#### 2.2.7 Health Status Filter Chips
Below the search bar in the sidebar:
```
[ All (1000) ] [ 🟢 Healthy (700) ] [ 🟡 Warning (170) ] [ 🔴 Critical (130) ]
```
Chip selection adds `?status=healthy|warning|critical` to the customers API call.
Chip group has `role="group"` and `aria-label="Filter by health status"`.

#### 2.2.8 Live Indicator — SSE-backed
`useLiveStream(customerId)` hook:
- Opens `EventSource` to `/api/telemetry/stream?customerId=X` when a customer is selected
- On `modem-stats` event: calls `queryClient.setQueryData` for the `modem-stats` key
- Connection states: `connecting` (amber dot), `connected` (green pulsing dot),
  `disconnected` (red dot), `idle` (grey dot, no customer selected)
- Closes EventSource on customer deselect or component unmount
- SSE stream is opened in `Layout.jsx` (derives customer ID from URL) and the
  resulting `streamStatus` is passed to `Header.jsx` → `LiveIndicator`
- `CustomerDetail.jsx` also calls `useLiveStream` independently so the indicator
  inside the detail header reflects the same state

#### 2.2.9 Error Boundaries
`ModemStats`, `FleetDashboard`, and `CustomerDetail` are each wrapped in
`<ErrorBoundary>`. Error state shows "Something went wrong" + "Try again" button.

#### 2.2.10 Accessibility
- All chart wrappers (`LineChartCard`, `BarChartCard`, `HealthGauge`): `role="img"` + `aria-label`
- Status filter chips: `role="group"`, `aria-label="Filter by health status"`, each chip has `aria-pressed`
- Customer list: `role="list"` on container, `role="listitem"` on rows
- Customer rows: `role="button"`, `aria-pressed={isSelected}`, `aria-label` with customer name
- Nav links: `aria-current="page"` on the active link
- Theme toggle: `aria-label` describing the action (not the current state)
- Main content area: `id="main-content"`, `role="main"`, `aria-label="Main content"`
- Sidebar: `role="complementary"`, `aria-label="Navigation and customer list"`
- Fleet dashboard: `role="region"`, `aria-label="Fleet overview dashboard"`
- Worst performers table: `role="table"` pattern with `role="row"`, `role="columnheader"`, `role="cell"`
- `prefers-reduced-motion` respected globally via `animations.css`

#### 2.2.11 Deliberate Deviations from Original Spec

**Deviation #1 — `modem/HealthGauge.jsx` not created as a standalone file**

The spec listed `frontend/src/components/modem/HealthGauge.jsx` as a separate
component. After review, the gauge component is co-located inside `ModemStats.jsx`
for the following reasons:

1. The gauge is only consumed in one place in the modem diagnostic view.
2. The fleet-level gauge (`FleetSummaryTiles.jsx → HealthGaugeCard`) has different
   sizing, label, and animation needs — a shared file would accumulate props to
   serve both uses without meaningful reduction in code.
3. Keeping the arc maths, colour thresholds, and health scoring logic in one file
   makes the score → colour → visual arc relationship immediately legible.

The fleet gauge remains in `FleetSummaryTiles.jsx`. If a third usage of the gauge
appears in a future feature, extract both to `modem/HealthGauge.jsx` at that point.

**Deviation #2 — `router.jsx` added; `App.jsx` reduced to a thin shell**

The original spec noted `router.jsx` as a target but the first-pass implementation
left all routing, layout logic, sidebar state, customer fetching, and theme handling
inline in `App.jsx` (≈350 lines). This has been corrected:

- `App.jsx` now only calls `useTheme()` (for the side-effect) and renders `<AppRoutes>`
- `router.jsx` owns the `<Routes>` tree, the `<Layout>` wrapper route, and the
  `CustomerDetailView` component (which now uses the `useCustomer` hook instead of
  an inlined `useQuery` call)
- `Layout.jsx`, `Sidebar.jsx`, and `Header.jsx` are now the live code path — they
  were complete but bypassed by the monolithic `App.jsx`

---

## 3. Database — Stay on SQLite + Add Indexes

Decision: **Retain SQLite** for this version. The data is read-heavy (all telemetry is pre-seeded). The missing indexes are the only critical fix needed now.

Migration path documented:
- When real modem telemetry ingestion is needed → PostgreSQL (same schema, minimal code change)
- TimescaleDB extension for `modem_history` time-series optimisation at scale

---

## 4. .gitignore

Add to repo root and frontend/:
```
.DS_Store
node_modules/
dist/
*.db
*.db-shm
*.db-wal
.env
```

---

## 5. New NPM Dependencies

### Backend (backend/package.json)
No new dependencies required.

### Frontend (frontend/package.json)
```json
{
  "dependencies": {
    "recharts": "^2.12.0",
    "@tanstack/react-query": "^5.0.0",
    "@tanstack/react-virtual": "^3.0.0",
    "react-router-dom": "^6.22.0"
  }
}
```
Remove: nothing (keep existing deps).

---

## 6. Implementation Sequence

1. **Cora** — DB: Add indexes to seed.js + create migrations/001_add_indexes.sql
2. **Daemon** — Backend: Fleet summary endpoint, pagination, time-range params, SSE stream
3. **Skye** — Frontend: Full refactor per component architecture above
4. **Quinn** — Test all endpoints, UI interactions, SSE, pagination, routing
5. **Paige** — Update Confluence Architecture Overview + create new SmartView v2 docs

---

## 7. Out of Scope (v2)

- Migration to PostgreSQL (documented but not actioned)
- Tailwind CSS migration (inline styles → shared style objects only)
- Real modem telemetry ingestion pipeline
- User authentication / multi-tenancy

---

# Feature Addendum: In-Home Device Monitoring

**Author:** Archie (Lead Architect)
**Date:** 2026-04-19
**Status:** Approved for implementation

---

## A1. Goals

- Store a variable number of connected in-home devices per customer (laptops, phones,
  consoles, routers, extenders, IoT, etc.)
- Model the physical network topology as a parent-child tree (each device has an optional
  parent device pointing to the upstream device it connects through)
- Record per-device metrics: RSSI (WiFi only), upload/download traffic, gateway latency,
  and online status — both current snapshot and historical time-series
- Expose four new REST endpoints consistent with the existing `/api/modems/:customerId/*`
  patterns (same auth, same ApiResponse wrapper, same sampling strategy for history)
- Add three new frontend pages: device list, topology view, device detail/history
- Seed realistic data for all ~1000 existing customers

---

## A2. Constraints

- SQLite single-file database — no JSON columns; topology tree is walked in application
  code, not with recursive CTEs
- Backend remains a single `index.ts` file — new handlers and routes are appended in the
  established pattern (section headers, handler function, route registration at bottom)
- No new npm dependencies — Recharts covers charting, React Router v6 covers routing,
  an inline recursive React component covers the topology tree render
- History table must not grow unboundedly — same step-down sampling strategy as
  `modem_history` (step = ceil(total / limit), default limit 200)
- RSSI is stored as NULL for Ethernet-connected devices; enforced at the application
  layer (API validation + seeder logic), not as a DB constraint, to keep the schema simple

---

## A3. Key Design Decisions

### A3.1 Topology: adjacency list

Each device row has a nullable `parent_device_id` TEXT FK referencing another device in
the same customer's network. The root node (the gateway router) has
`parent_device_id = NULL`.

**Why adjacency list over nested set or path enumeration:** With at most ~15 devices per
household the entire tree fits in a single `SELECT * FROM devices WHERE customer_id = ?`
query. The frontend (or a small helper) reconstructs the tree from the flat list in O(n).
Nested sets require rebalancing on every insert; path enumeration adds complexity for no
gain at this scale.

**Integrity rule enforced in app code:** when a device is given a `parent_device_id`, the
handler verifies that the referenced device belongs to the same `customer_id`. The
foreign key alone cannot express this constraint in SQLite without triggers.

### A3.2 Stats storage: two-table pattern

`device_stats` — one row per device (current snapshot, upserted by the seeder and any
future real ingestion pipeline).
`device_history` — append-only time-series, indexed by `(device_id, recorded_at)`.

This mirrors the existing `modem_stats` / `modem_history` split exactly, which means
the frontend hook pattern and the sampling logic can be copy-adapted rather than
invented from scratch.

### A3.3 Connection type encoding

`connection_type` TEXT column with four values: `ethernet`, `wifi_2_4`, `wifi_5`,
`wifi_6`. Validated as a Zod enum in the backend (no unknowns accepted from seed or
future API writes). RSSI is NULL when `connection_type = 'ethernet'`.

### A3.4 Device type vocabulary

`device_type` TEXT, Zod enum:
`laptop | desktop | phone | tablet | games_console | smart_tv | wifi_extender | router | iot | other`

### A3.5 Online status

`is_online INTEGER NOT NULL DEFAULT 1` in both tables. SQLite has no BOOLEAN; 1 = online,
0 = offline. The TypeScript interface exposes it as `is_online: number` and the frontend
casts to boolean.

### A3.6 Topology visualisation approach

A recursive React component (`DeviceTopologyNode`) renders nodes as `<div>` boxes
connected by SVG lines drawn in a container overlay. No dependency on a graph library
(D3, Cytoscape, etc.). The tree is shallow — at most three levels in typical home
networks (gateway -> extender -> leaf) — so a simple depth-first render with percentage
positioning is sufficient and performant.

The topology endpoint returns the same flat list as the device list endpoint (minus
pagination) plus the `parent_device_id` field. Tree reconstruction is done client-side
by `buildTree()` in the hook, which groups devices by parent in a single pass.

### A3.7 Seed data volume

- 1 root router per customer (`parent_device_id = NULL`)
- 0–2 WiFi extenders hanging off the router
- Remaining devices (total 3–14 per customer, average 6) distributed across router and
  extenders, with random connection types and device types
- History: 90 days at 4 readings/day = ~360 rows per device
- At 6 devices × 1000 customers × 360 rows = 2.16 M device_history rows — acceptable
  for SQLite with the composite index on `(device_id, recorded_at)`

---

## A4. New Database Tables

Full DDL is in `specs/db-schema.sql` (appended after the existing schema).

Three new tables:
- `devices` — device inventory per customer (static metadata + topology)
- `device_stats` — current snapshot (one row per device)
- `device_history` — append-only time-series

---

## A5. New API Endpoints

Full contract is appended to `specs/api-contract.yaml`.

All four endpoints sit under `/api/customers/:customerId/` and all require `requireAuth`.

```
GET /api/customers/:customerId/devices
  Query: limit (1-100, default 50), offset (default 0)
  Returns: paginated array of Device + current DeviceStat joined

GET /api/customers/:customerId/devices/topology
  No query params
  Returns: flat array of all devices with parent_device_id (no pagination — max ~15 rows)

GET /api/customers/:customerId/devices/:deviceId
  Returns: single Device + current DeviceStat

GET /api/customers/:customerId/devices/:deviceId/history
  Query: days (1|7|30|90, default 7), limit (1-200, default 200)
  Returns: sampled DeviceHistoryRecord array + samplingApplied flag
```

Route ordering note: `/topology` must be registered BEFORE `/:deviceId` in Express to
avoid the literal string "topology" being matched as a device ID.

---

## A6. Frontend Component Tree

### New files

```
frontend/src/api/client.ts
  + Device type
  + DeviceStat type
  + DeviceHistoryRecord type
  + DeviceWithStats type (Device + DeviceStat joined)
  + deviceAPI.getAll(customerId, limit?, offset?)
  + deviceAPI.getTopology(customerId)
  + deviceAPI.getById(customerId, deviceId)
  + deviceAPI.getHistory(customerId, deviceId, days?, limit?)

frontend/src/hooks/useDevices.ts  (new file)
  + useDevices(customerId)           staleTime 60s
  + useDeviceTopology(customerId)    staleTime 60s
  + useDevice(customerId, deviceId)  staleTime 60s
  + useDeviceHistory(customerId, deviceId, days)  staleTime 2min

frontend/src/components/Devices/  (new directory)
  DeviceList.tsx
    — Table of all devices for a customer
    — Columns: Type icon, Name, Connection badge, Online status dot, RSSI, Upload, Download, Latency
    — Each row links to /customers/:customerId/devices/:deviceId
    — Link back to customer detail in page header
    — "View Topology" button in header navigates to topology page

  DeviceTopology.tsx
    — Fetches topology flat list, runs buildTree() helper
    — Renders DeviceTopologyNode recursively inside a positioned container
    — Colour-coded: green border = online, red border = offline
    — Click a node to navigate to that device's detail page
    — Link back to device list in header

  DeviceDetail.tsx
    — Stat gauges: RSSI (WiFi only), upload, download, latency
    — Time range selector (reuses existing TimeRangeSelector component)
    — Recharts LineChart for each metric over time (reuses ModemChart pattern)
    — Breadcrumb: Customer -> Devices -> [device name]

  DeviceStatCard.tsx
    — Reusable card (rounded-2xl, border, bg-white) showing one metric
    — Props: label, value, unit, isGood: boolean
    — Used by DeviceDetail to display current stats

  DeviceTypeIcon.tsx
    — Maps device_type string to a short text label + emoji character
    — No SVG asset dependency; uses Unicode symbols
    — Used in DeviceList rows and DeviceTopology nodes
```

### Modified files

```
frontend/src/App.tsx
  + Route: /customers/:customerId/devices          -> DeviceList
  + Route: /customers/:customerId/devices/topology -> DeviceTopology
  + Route: /customers/:customerId/devices/:deviceId -> DeviceDetail

frontend/src/components/Customers/CustomerDetail.tsx
  + "In-Home Devices" button in the header section
    navigates to /customers/:customerId/devices
```

---

## A7. Implementation Order

**Phase 1 — Database (Cora)**
1. Append DDL for `devices`, `device_stats`, `device_history` tables and their indexes
   to the existing `db-schema.sql` spec; write and test the actual `CREATE TABLE` and
   `CREATE INDEX` statements that will be appended to the backend's DB initialisation
   block in `index.ts`

**Phase 2a — Backend route handlers (Daemon)**
2. Append to `backend/src/index.ts`:
   - TypeScript interfaces: `Device`, `DeviceStat`, `DeviceHistoryRecord`, `DeviceWithStats`
   - Zod schemas: `DeviceHistoryParamsSchema`, `DevicePaginationSchema`
   - Handler functions: `getDevices`, `getDeviceTopology`, `getDeviceById`,
     `getDeviceHistory`
   - Route registrations (topology route before :deviceId route)
   - DB initialisation: `CREATE TABLE IF NOT EXISTS` calls in the startup block

**Phase 2b — Seed script (Daemon)**
3. Write `backend/src/seed-devices.ts`:
   - Reads all customer IDs from the DB
   - For each customer: generates 3–15 devices with realistic topology
   - Inserts into `devices`, `device_stats`, `device_history`
   - Idempotent: `DELETE FROM devices WHERE customer_id = ?` before inserting
   - Runnable via `npx ts-node backend/src/seed-devices.ts`

**Phase 3 — Frontend (Skye)**
4. Add Device types and `deviceAPI` to `frontend/src/api/client.ts`
5. Create `frontend/src/hooks/useDevices.ts`
6. Create `frontend/src/components/Devices/DeviceTypeIcon.tsx`
7. Create `frontend/src/components/Devices/DeviceStatCard.tsx`
8. Create `frontend/src/components/Devices/DeviceList.tsx`
9. Create `frontend/src/components/Devices/DeviceTopology.tsx`
10. Create `frontend/src/components/Devices/DeviceDetail.tsx`
11. Add three routes to `frontend/src/App.tsx`
12. Add "In-Home Devices" link to `frontend/src/components/Customers/CustomerDetail.tsx`

**Phase 4 — QA (Quinn)**
13. API: all four endpoints happy path, 404 on unknown customer/device, invalid params
14. Frontend: device list renders, topology renders, history charts render, nav links work,
    RSSI hidden for wired devices, breadcrumbs correct

**Phase 5 — Docs (Paige)**
15. API reference section for the four new endpoints
16. Note seed script usage in the deployment runbook
