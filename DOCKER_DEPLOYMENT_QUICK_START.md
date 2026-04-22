# SmartView v2 Docker Quick Start

## 🚀 One-Command Deployment

```bash
cd /smart-view-v2 && docker-compose up --build
```

## ✅ Verification Checklist (2 minutes)

```bash
# 1. Check both containers are running
docker-compose ps

# 2. Test backend API
curl http://localhost:3000/api/health

# 3. Open dashboard in browser
# http://localhost:8081

# 4. Verify data loads
curl http://localhost:3000/api/customers | jq
```

## 🔧 What Was Fixed

| Issue | Solution | File |
|-------|----------|------|
| Backend port not exposed | Added `ports: "3000:3000"` | docker-compose.yml |
| Frontend can't reach backend | Added proxy rules + Docker network | nginx.conf + docker-compose.yml |
| Slow startup (npm install twice) | Removed npm install from startup.sh | startup.sh |
| Container crashes on seed failure | Made seed non-critical with `\|\| true` | startup.sh |
| Services start in wrong order | Added health checks + depends_on | docker-compose.yml |

## 📊 Service URLs

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | http://localhost:8081 | Dashboard UI |
| Backend API | http://localhost:3000 | REST API |
| Health Check | http://localhost:3000/api/health | Service status |

## 🐳 Common Commands

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f

# Restart backend
docker-compose restart backend

# Execute shell in backend
docker exec -it smartview-backend sh

# Check database
docker exec smartview-backend sqlite3 /app/data/smartview.db ".tables"
```

## 🆘 Troubleshooting

| Problem | Fix |
|---------|-----|
| Port 3000 already in use | `lsof -i :3000` then `kill -9 <PID>` |
| Frontend can't reach backend | Check `docker exec smartview-frontend curl http://backend:3000/api/health` |
| Container exits immediately | `docker-compose logs backend` to see error |
| Health check failing | Wait 40+ seconds for startup to complete |
| Database empty | Check `docker-compose logs backend` for seed errors |

## 📝 Architecture

```
┌─────────────────────────┐
│   Host Machine          │
│  :8081 (frontend)       │
│  :3000 (backend)        │
└────────────────────────── 
       ↓          ↓
┌────────────────────────────────┐
│  Docker Container Network      │
│  smartview-network (bridge)    │
├────────────┬───────────────────┤
│ Frontend   │ Backend           │
│ (nginx)    │ (Node.js)         │
│ :80        │ :3000             │
│            │ /app/data         │
│            │ (SQLite)          │
└────────────┴───────────────────┘
```

## ✨ Key Improvements

✅ **Proper networking** - Services communicate via Docker DNS (backend:3000)
✅ **Health checks** - Ensures frontend waits for backend to be ready
✅ **Fast startup** - npm install during build, not at runtime
✅ **Error resilience** - Seed failures don't crash the container
✅ **Security headers** - nginx adds X-Frame-Options, X-Content-Type, etc.
✅ **Data persistence** - SQLite database survives container restarts

## 📖 Full Documentation

See `DOCKER_FIX_COMPLETE.md` for:
- Detailed file changes explanation
- Step-by-step deployment instructions
- Troubleshooting guide with solutions
- Performance optimization tips
- Network diagram and architecture

---

**Status**: ✅ Ready to Deploy
**Time to Deploy**: ~2 minutes
**Time to Verify**: ~2 minutes
