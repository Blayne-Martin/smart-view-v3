# SmartView v2 — Frontend Setup Guide

**Version:** 2.0  
**Updated:** 2025-01-17  
**Audience:** Frontend Engineers, DevOps  
**Prerequisites:** Node.js 18+, npm 9+

---

## 1. Quick Start

```bash
# Clone repository
git clone https://github.com/blayne-martin/smart-view.git
cd smart-view/frontend

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Start dev server
npm run dev

# Open browser
open http://localhost:5173
```

**Expected Output:**
```
  VITE v5.0.0  ready in 245 ms

  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

---

## 2. Installation

### 2.1 Prerequisites

| Requirement | Version | Check |
|-------------|---------|-------|
| Node.js | 18+ | `node --version` |
| npm | 9+ | `npm --version` |
| Backend | Running on :3001 | `curl http://localhost:3001/api/customers` |

### 2.2 Step-by-Step Setup

#### Step 1: Install Dependencies

```bash
cd frontend
npm install
```

**New dependencies (v2):**
```json
{
  "recharts": "^2.12.0",
  "@tanstack/react-query": "^5.0.0",
  "@tanstack/react-virtual": "^3.0.0",
  "react-router-dom": "^6.22.0"
}
```

**Verify installation:**
```bash
npm ls recharts @tanstack/react-query react-router-dom
```

#### Step 2: Environment Variables

Create `.env` file in `frontend/` directory:

```bash
# API Configuration
VITE_API_BASE_URL=http://localhost:3001
VITE_API_TIMEOUT=30000

# Feature Flags
VITE_ENABLE_SSE=true
VITE_ENABLE_CHARTS=true

# Build Configuration
VITE_SOURCE_MAP=true
```

**Environment Variables Reference:**

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_BASE_URL` | `http://localhost:3001` | Backend API URL (no trailing slash) |
| `VITE_API_TIMEOUT` | `30000` | Request timeout in milliseconds |
| `VITE_ENABLE_SSE` | `true` | Enable Server-Sent Events for live updates |
| `VITE_ENABLE_CHARTS` | `true` | Enable Recharts visualization |
| `VITE_SOURCE_MAP` | `true` | Generate source maps for debugging |

**Production `.env`:**
```bash
VITE_API_BASE_URL=https://api.smartview.company.com
VITE_API_TIMEOUT=30000
VITE_ENABLE_SSE=true
VITE_ENABLE_CHARTS=true
VITE_SOURCE_MAP=false
```

#### Step 3: Verify Backend Connectivity

```bash
# Test API connection
curl -s http://localhost:3001/api/customers?limit=5 | jq '.customers | length'

# Expected output: 5 (or number of available customers)
```

---

## 3. Development Server

### 3.1 Start Dev Server with SSE Support

```bash
# Start Vite dev server
npm run dev

# Output:
#  VITE v5.0.0  ready in 245 ms
#  ➜  Local:   http://localhost:5173/
#  ➜  press h to show help
```

### 3.2 Dev Server Features

- **Hot Module Replacement (HMR):** Code changes reload without page refresh
- **Source Maps:** JavaScript debugging in browser DevTools
- **CORS Proxy:** Requests to `/api/*` proxied to backend (see `vite.config.js`)

### 3.3 Vite Configuration for API Proxying

**`vite.config.js`:**
```javascript
export default {
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api'),
      },
      '/api/telemetry/stream': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: true,  // WebSocket support (for SSE)
      },
    },
  },
  // ... other config
};
```

**Why:** Avoids CORS errors during development. In production, nginx proxy handles this.

---

## 4. Project Structure

```
frontend/
├── src/
│   ├── main.jsx                   # Entry point: BrowserRouter + QueryClientProvider
│   ├── App.jsx                    # Thin shell (theme toggle)
│   ├── router.jsx                 # Route definitions
│   │
│   ├── hooks/
│   │   ├── useCustomers.js        # TanStack Query: customer list
│   │   ├── useCustomer.js         # TanStack Query: single customer
│   │   ├── useModemStats.js       # TanStack Query: modem snapshot
│   │   ├── useModemHistory.js     # TanStack Query: hourly history
│   │   ├── useModemDaily.js       # TanStack Query: daily aggregates
│   │   ├── useFleetSummary.js     # TanStack Query: fleet overview
│   │   ├── useTheme.js            # Theme toggle (localStorage)
│   │   └── useLiveStream.js       # SSE: EventSource wrapper
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Layout.jsx         # Root shell (Sidebar + Header)
│   │   │   ├── Header.jsx         # Top bar with live indicator
│   │   │   └── Sidebar.jsx        # Navigation + search + filters
│   │   │
│   │   ├── customer/
│   │   │   ├── CustomerList.jsx   # Virtualized customer list
│   │   │   ├── CustomerRow.jsx    # Single customer row
│   │   │   ├── CustomerDetail.jsx # Detail panel
│   │   │   ├── CustomerHeader.jsx # Name + info header
│   │   │   └── ContactCard.jsx    # Contact info display
│   │   │
│   │   ├── fleet/
│   │   │   ├── FleetDashboard.jsx # Home screen
│   │   │   └── FleetSummaryTiles.jsx # Tiles + gauge
│   │   │
│   │   ├── modem/
│   │   │   ├── ModemStats.jsx     # Diagnostic view
│   │   │   └── StatTile.jsx       # Reusable stat card
│   │   │
│   │   ├── charts/
│   │   │   ├── LineChartCard.jsx  # Recharts line chart
│   │   │   └── BarChartCard.jsx   # Recharts bar chart
│   │   │
│   │   └── common/
│   │       ├── SearchBar.jsx      # Search input
│   │       ├── StatusFilterChips.jsx # Health filter chips
│   │       ├── TimeRangeSelector.jsx # 1d/7d/30d/90d toggle
│   │       ├── LoadingSkeleton.jsx # Shimmer loader
│   │       ├── LiveIndicator.jsx  # Connection status dot
│   │       └── ErrorBoundary.jsx  # Error isolation
│   │
│   └── styles/
│       ├── tokens.css              # CSS custom properties
│       └── animations.css          # Keyframes + reduced-motion
│
├── .env.example                   # Environment template
├── .env                           # Actual env (git-ignored)
├── .gitignore                     # Ignore node_modules, dist, .env
├── package.json
├── vite.config.js
└── index.html
```

---

## 5. TanStack Query Setup

### 5.1 Query Client Configuration

**`src/main.jsx`:**
```javascript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,        // 30 seconds
      gcTime: 5 * 60 * 1000,    // 5 minutes (garbage collection time)
      retry: 1,                 // Retry failed requests once
      refetchOnWindowFocus: true, // Refetch when user returns to tab
    },
  },
});

export default function Root() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
```

### 5.2 Hook Pattern (useCustomers)

**`src/hooks/useCustomers.js`:**
```javascript
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_BASE_URL;

export function useCustomers() {
  const [searchParams] = useSearchParams();
  
  const q = searchParams.get('q') || '';
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');
  const status = searchParams.get('status') || 'all';

  return useQuery({
    queryKey: ['customers', { q, limit, offset, status }],
    queryFn: async () => {
      const params = new URLSearchParams({
        q,
        limit,
        offset,
        status,
      });
      const res = await fetch(`${API_BASE}/api/customers?${params}`);
      if (!res.ok) throw new Error('Failed to fetch customers');
      return res.json();
    },
    staleTime: 30_000,  // 30 seconds
  });
}
```

### 5.3 Cache Invalidation Example

**Invalidate fleet summary on customer list change:**
```javascript
import { useQueryClient } from '@tanstack/react-query';

export function useSelectCustomer() {
  const queryClient = useQueryClient();

  const selectCustomer = (customerId) => {
    // When a customer detail is loaded, invalidate fleet summary
    // (could be stale if customer's health changed)
    queryClient.invalidateQueries(['fleet-summary'], { exact: true });
  };

  return selectCustomer;
}
```

---

## 6. React Router Setup

### 6.1 Route Configuration

**`src/router.jsx`:**
```javascript
import { createRoutesFromElements, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import FleetDashboard from './components/fleet/FleetDashboard';
import CustomerDetailView from './components/customer/CustomerDetailView';

export const routes = createRoutesFromElements(
  <Route element={<Layout />}>
    <Route path="/" element={<FleetDashboard />} />
    <Route path="/customers" element={<CustomerListView />} />
    <Route path="/customers/:id" element={<CustomerDetailView />} />
  </Route>
);
```

### 6.2 Navigation Example

```javascript
import { useNavigate, useParams } from 'react-router-dom';

export function CustomerRow({ customer }) {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(`/customers/${customer.id}`)}
      role="button"
      tabIndex={0}
    >
      {customer.name}
    </div>
  );
}
```

---

## 7. SSE Implementation

### 7.1 Live Stream Hook

**`src/hooks/useLiveStream.js`:**
```javascript
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

const API_BASE = import.meta.env.VITE_API_BASE_URL;

export function useLiveStream(customerId) {
  const [status, setStatus] = useState('idle');
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!customerId || !import.meta.env.VITE_ENABLE_SSE) {
      setStatus('idle');
      return;
    }

    const eventSource = new EventSource(
      `${API_BASE}/api/telemetry/stream?customerId=${customerId}`
    );

    setStatus('connecting');

    eventSource.addEventListener('modem-stats', (event) => {
      const data = JSON.parse(event.data);
      queryClient.setQueryData(['modem-stats', customerId], data);
      setStatus('connected');
    });

    eventSource.addEventListener('heartbeat', (event) => {
      if (status !== 'connected') {
        setStatus('connected');
      }
    });

    eventSource.onerror = () => {
      setStatus('disconnected');
      eventSource.close();
    };

    return () => {
      eventSource.close();
      setStatus('idle');
    };
  }, [customerId, queryClient, status]);

  return status;
}
```

### 7.2 Live Indicator Component

**`src/components/common/LiveIndicator.jsx`:**
```javascript
import './LiveIndicator.css';

export function LiveIndicator({ status }) {
  const statusColor = {
    idle: 'grey',
    connecting: 'amber',
    connected: 'green',
    disconnected: 'red',
  };

  const label = {
    idle: 'No customer selected',
    connecting: 'Connecting...',
    connected: 'Live',
    disconnected: 'Disconnected',
  };

  return (
    <div className={`live-indicator live-indicator--${status}`}>
      <span className="live-indicator__dot" />
      <span className="live-indicator__label">{label[status]}</span>
    </div>
  );
}
```

**`src/components/common/LiveIndicator.css`:**
```css
.live-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
}

.live-indicator__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.live-indicator--idle .live-indicator__dot {
  background-color: #ccc;
}

.live-indicator--connecting .live-indicator__dot {
  background-color: #f5a623;
}

.live-indicator--connected .live-indicator__dot {
  background-color: #7ed321;
  animation: pulse 2s infinite;
}

.live-indicator--disconnected .live-indicator__dot {
  background-color: #d0021b;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@media (prefers-reduced-motion: reduce) {
  .live-indicator--connected .live-indicator__dot {
    animation: none;
    opacity: 0.7;
  }
}
```

---

## 8. Recharts Integration

### 8.1 Line Chart Example

**`src/components/charts/LineChartCard.jsx`:**
```javascript
import {
  LineChart,
  Line,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from 'recharts';

export function LineChartCard({ data, title, yAxisLabel }) {
  return (
    <div className="chart-card">
      <h3>{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="recordedAt" />
          <YAxis label={{ value: yAxisLabel, angle: -90, position: 'insideLeft' }} />
          <Tooltip />
          <Line type="monotone" dataKey="downloadMbps" stroke="#2196F3" dot={false} />
          <Line type="monotone" dataKey="uploadMbps" stroke="#FF9800" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

### 8.2 Chart Performance Optimization

```javascript
// Disable animations for performance
<LineChart data={data} isAnimationActive={false}>
  ...
</LineChart>

// Sample data if > 200 points
function sampleData(data, maxPoints = 200) {
  if (data.length <= maxPoints) return data;
  const samplingRate = Math.ceil(data.length / maxPoints);
  return data.filter((_, idx) => idx % samplingRate === 0);
}
```

---

## 9. Build for Production

### 9.1 Build Command

```bash
npm run build

# Output:
# frontend/dist/
# ├── index.html
# ├── assets/
# │   ├── main-abc123.js
# │   └── main-abc123.css
```

### 9.2 Build Configuration

**`vite.config.js` (production settings):**
```javascript
export default {
  build: {
    outDir: 'dist',
    sourcemap: false,          // Disabled in production
    minify: 'terser',          // JavaScript minification
    rollupOptions: {
      output: {
        manualChunks: {
          recharts: ['recharts'],
          'react-router': ['react-router-dom'],
          'tanstack-query': ['@tanstack/react-query'],
        },
      },
    },
  },
};
```

### 9.3 Docker Build

**`frontend/Dockerfile`:**
```dockerfile
# Build stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:18-alpine
WORKDIR /app
RUN npm install -g serve
COPY --from=builder /app/dist ./dist
EXPOSE 5173
CMD ["serve", "-s", "dist", "-l", "5173"]
```

**Build & run:**
```bash
docker build -t smartview-frontend:v2 .
docker run -p 5173:5173 smartview-frontend:v2
```

---

## 10. Testing

### 10.1 Unit Tests (Jest + React Testing Library)

```bash
npm install --save-dev @testing-library/react @testing-library/jest-dom vitest
npm run test
```

**Example test:**
```javascript
import { render, screen } from '@testing-library/react';
import { LiveIndicator } from './LiveIndicator';

test('shows connected status', () => {
  render(<LiveIndicator status="connected" />);
  expect(screen.getByText('Live')).toBeInTheDocument();
});
```

### 10.2 E2E Tests (Playwright)

```bash
npm install --save-dev @playwright/test
npx playwright install
npx playwright test
```

---

## 11. Debugging

### 11.1 Browser DevTools

**React DevTools:**
```
Chrome → Extensions → React Developer Tools
→ Inspect component props, state, hooks
```

**TanStack Query DevTools:**
```javascript
// Add to dev build only
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

<QueryClientProvider client={queryClient}>
  <App />
  {import.meta.env.DEV && <ReactQueryDevtools />}
</QueryClientProvider>
```

### 11.2 Network Inspection

**Check API calls in DevTools → Network tab:**
- Verify request headers include `Accept: application/json`
- Verify response status 200
- Check SSE connection: `Content-Type: text/event-stream`

### 11.3 Source Maps

**Enable in development (vite.config.js):**
```javascript
{
  sourcemap: true,  // Default in dev
}
```

**Disabled in production build (vite.config.js):**
```javascript
{
  build: {
    sourcemap: false,  // Reduces build size
  }
}
```

---

## 12. Common Issues & Troubleshooting

### Issue: "Failed to fetch customers"

**Cause:** Backend not running or CORS error

**Fix:**
```bash
# Check backend is running
curl http://localhost:3001/api/customers

# If not, start it:
cd backend && npm start

# Check VITE_API_BASE_URL in .env
cat .env | grep VITE_API_BASE_URL
```

### Issue: "Cannot find module 'recharts'"

**Cause:** Dependencies not installed

**Fix:**
```bash
npm install
npm ls recharts  # Verify installation
```

### Issue: SSE connection error (CORS)

**Cause:** Browser blocking SSE from different origin

**Fix:**
```javascript
// Ensure vite.config.js proxies /api to backend
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3001',
      changeOrigin: true,
      ws: true,  // Required for SSE
    },
  },
}
```

### Issue: Hot reload not working

**Cause:** Vite HMR disabled or misconfigured

**Fix:**
```javascript
// vite.config.js
{
  server: {
    middlewareMode: false,  // HMR enabled
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: 5173,
    },
  }
}
```

### Issue: Bundle size too large

**Fix:**
```bash
npm run build -- --analyze  # Analyze bundle
# Remove unused dependencies
npm uninstall <package>
# Enable code splitting in vite.config.js
```

---

## 13. Performance Monitoring

### 13.1 Lighthouse Audit

```bash
# In Chrome DevTools:
# 1. Open DevTools (F12)
# 2. Click "Lighthouse" tab
# 3. Run audit
# Target: 90+ score
```

### 13.2 Bundle Size Check

```bash
npm run build
du -sh dist/

# Expected: <500 KB (gzipped)
```

### 13.3 Runtime Performance

```javascript
// Measure component render time
import { useEffect } from 'react';

export function CustomerDetail() {
  useEffect(() => {
    const start = performance.now();
    return () => {
      const end = performance.now();
      console.log(`CustomerDetail rendered in ${end - start}ms`);
    };
  }, []);
  
  return <div>...</div>;
}
```

---

## 14. Deployment

### 14.1 Vercel Deployment

```bash
npm install -g vercel
vercel
# Follow prompts, configure environment variables

# Verify
vercel env pull
cat .env.local
```

### 14.2 Netlify Deployment

```bash
npm install -g netlify-cli
netlify deploy --prod --dir=dist

# Or configure in netlify.toml:
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/api/*"
  to = "https://api.smartview.com/:splat"
  status = 200
```

### 14.3 Docker + Nginx

**`nginx.conf`:**
```nginx
server {
  listen 80;
  server_name _;

  root /app/frontend/dist;
  index index.html;

  # API proxy
  location /api/ {
    proxy_pass http://backend:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_cache_bypass $http_upgrade;
  }

  # React Router fallback
  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

---

## 15. NPM Scripts Reference

```json
{
  "scripts": {
    "dev": "vite",                          // Start dev server
    "build": "vite build",                  // Production build
    "preview": "vite preview",              // Preview production build
    "lint": "eslint src --ext js,jsx",      // Lint code
    "type-check": "tsc --noEmit",           // TypeScript check (if enabled)
    "test": "vitest",                       // Run tests
    "test:ui": "vitest --ui",               // Test UI dashboard
    "coverage": "vitest --coverage",        // Code coverage
    "analyze": "vite-bundle-visualizer"     // Bundle analysis
  }
}
```

---

## Checklist for Local Development

- [ ] Node.js 18+ installed
- [ ] Backend running on http://localhost:3001
- [ ] `npm install` completed
- [ ] `.env` file created with `VITE_API_BASE_URL`
- [ ] `npm run dev` starts dev server on http://localhost:5173
- [ ] Browser shows "Fleet Dashboard" home screen
- [ ] No console errors (Network tab shows 200 responses)
- [ ] Live indicator appears in header
- [ ] Can search for customers
- [ ] Can click a customer to view details
- [ ] SSE connection opens (Network tab shows "stream?customerId=...")
- [ ] Charts render without errors

---

**Maintained by:** Skye (Frontend)  
**Last Reviewed:** 2025-01-17  
**Node version:** 18.16.0 (tested)  
**npm version:** 9.6.7 (tested)
