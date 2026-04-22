# SmartView v2 — Implementation Design Spec

## Overview
Upgrade SmartView from v1 (basic dashboard) to v2 (performance-optimized, real-time, accessible monitoring platform).

## Phase 1: Backend Optimizations (P0) — Week 1

### 1.1 Database Indexes
Add indexes on frequently queried columns:
- `modem_stats(customer_id, recorded_at DESC)`
- `modem_history(customer_id, recorded_at DESC)`
- `customers(name, email)`

### 1.2 API Pagination
**Endpoint:** `GET /api/customers`
- Add `limit` (default: 50, max: 100) and `offset` (default: 0)
- Return `{ data, total, limit, offset }`

### 1.3 Time-Range Filtering
**Endpoint:** `GET /api/customers/:id/modem-history`
- Add `days` query param: `1|7|30|90` (default: 7)
- Server-side sample to 200 max data points
- Return aggregated data for ranges >24h

### 1.4 Payload Optimization
- Cap chart payloads at 200 points
- Implement server-side sampling for large datasets
- Add compression headers (gzip)

---

## Phase 2: Frontend Architecture (P1) — Week 1–2

### 2.1 Dependency Upgrades
- **Recharts** — Replace hand-rolled charts
- **TanStack Query (React Query)** — Client-side caching, deduping
- **react-router-dom** — URL-based navigation & deep-linking
- **@tanstack/react-virtual** — List virtualization

### 2.2 Component Refactor
Migrate from monolithic `App.jsx`:
```
src/
  components/
    Dashboard/        (fleet overview, summary tiles)
    CustomerDetail/   (individual modem stats)
    Charts/          (Recharts wrappers)
    Filters/         (status chips, time-range selector)
  hooks/
    useCustomers()   (TanStack Query hooks)
    useModemStats()
  pages/
    DashboardPage
    CustomerPage
```

### 2.3 Navigation Structure
- `/` — Fleet Dashboard (P2 feature)
- `/customers` — Customer list
- `/customers/:id` — Customer detail (modem stats)

### 2.4 Real-Time Streaming (SSE)
- Replace "LIVE" polling with Server-Sent Events
- Endpoint: `GET /api/customers/:id/modem-stats/stream`
- Auto-reconnect on disconnect

---

## Phase 3: New Features (P2) — Week 2–3

### 3.1 Fleet Dashboard Home
- **Summary Tiles:** Total customers, Healthy count, Warning count, Critical count
- **Worst Performers Table:** Top 10 modems by health risk score
- **Drill-down:** Click tile/row → go to customer detail

### 3.2 Health Status Filters
- Inline filter chips: `All | Healthy | Warning | Critical`
- Applied on both fleet & customer views
- URL state: `?status=warning`

### 3.3 Time-Range Selector
- Toggle buttons: `24h | 7d | 30d | 90d`
- Updates charts in real-time
- URL state: `?range=7d`

### 3.4 Accessibility (WCAG 2.1 AA)
- ARIA labels on all interactive elements
- Semantic HTML (`<button>`, `<nav>`, roles)
- Reduced-motion: `prefers-reduced-motion` media query
- Keyboard navigation (Tab, Enter, Escape)

---

## Phase 4: Testing & Documentation (Week 3)

### 4.1 Unit Tests (Vitest/Jest)
- API pagination logic
- TanStack Query hooks
- Time-range filtering calculations

### 4.2 Integration Tests
- End-to-end customer list → detail workflow
- SSE streaming connection lifecycle
- Filter chip state management

### 4.3 E2E Tests (Playwright/Cypress)
- Full user journeys
- Accessibility compliance checks
- Performance baselines (LCP, FID, CLS)

### 4.4 Documentation (Confluence)
- v2 Architecture Overview
- Component API reference
- Deployment instructions
- Known limitations & future work

---

## Tech Stack Summary

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Frontend** | React 18 + Recharts + TanStack Query + react-router | Performance, UX, maintainability |
| **Backend** | Node.js/Express (no changes) | Sufficient for v2 scope |
| **Database** | SQLite + indexes | v1 compatible, fast enough with optimization |
| **Real-Time** | Server-Sent Events (SSE) | Simpler than WebSocket for unidirectional stats |

---

## Success Criteria

✅ All P0 features (pagination, filtering, indexes, payloads) complete  
✅ All P1 features (Recharts, TanStack Query, routing, SSE) complete  
✅ P2 features (fleet dashboard, filters, time-range) implemented  
✅ 80%+ unit + integration test coverage  
✅ Accessibility audit passes WCAG 2.1 AA  
✅ Performance: LCP <2.5s, FID <100ms, CLS <0.1  
✅ Full Confluence documentation updated

---

## Risk Register

| Risk | Mitigation |
|------|-----------|
| SSE polling overload | Rate-limit to 1 update/sec; auto-backoff on disconnect |
| Large dataset queries | Server-side sampling; pagination enforced at API layer |
| Breaking changes to v1 API | Maintain `/api/v1/` routes in parallel during transition |
| Accessibility regressions | Automated a11y testing in CI; manual audit before release |

---

## Out of Scope

- ❌ Real modem telemetry ingestion (external infra)
- ❌ User authentication / multi-tenancy
- ❌ Tailwind CSS migration
- ❌ PostgreSQL migration (defer to v2.1)
