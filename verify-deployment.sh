#!/bin/bash

# SmartView v2 Docker Deployment Verification Script
# Run this script to verify all deployment fixes are working

set +e  # Don't exit on errors, we want to show all results

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# Test functions
print_header() {
  echo -e "\n${BLUE}═══════════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}\n"
}

pass() {
  echo -e "${GREEN}✓${NC} $1"
  ((PASSED++))
}

fail() {
  echo -e "${RED}✗${NC} $1"
  ((FAILED++))
}

warn() {
  echo -e "${YELLOW}⚠${NC} $1"
  ((WARNINGS++))
}

# Check prerequisites
print_header "Checking Prerequisites"

if ! command -v docker &> /dev/null; then
  fail "Docker is not installed"
else
  pass "Docker is installed"
fi

if ! command -v docker-compose &> /dev/null; then
  fail "Docker Compose is not installed"
else
  COMPOSE_VERSION=$(docker-compose --version)
  pass "Docker Compose installed: $COMPOSE_VERSION"
fi

# Check files exist
print_header "Checking Required Files"

FILES=(
  "docker-compose.yml"
  "backend/Dockerfile"
  "backend/startup.sh"
  "backend/seed.cjs"
  "frontend/nginx.conf"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    pass "Found: $file"
  else
    fail "Missing: $file"
  fi
done

# Verify docker-compose.yml configuration
print_header "Verifying docker-compose.yml"

if grep -q 'ports:' docker-compose.yml && grep -q '"3000:3000"' docker-compose.yml; then
  pass "Backend port mapping configured (3000:3000)"
else
  fail "Backend port mapping missing or incorrect"
fi

if grep -q 'smartview-network' docker-compose.yml; then
  pass "Docker network defined"
else
  fail "Docker network not defined"
fi

if grep -q 'healthcheck:' docker-compose.yml; then
  pass "Health check configured"
else
  fail "Health check not configured"
fi

if grep -q 'condition: service_healthy' docker-compose.yml; then
  pass "Frontend depends on backend health"
else
  fail "Frontend doesn't wait for backend health"
fi

# Verify Dockerfile
print_header "Verifying backend/Dockerfile"

if grep -q 'RUN npm install' backend/Dockerfile; then
  pass "npm install in Dockerfile"
else
  fail "npm install not found in Dockerfile"
fi

if grep -q 'RUN chmod +x ./startup.sh' backend/Dockerfile; then
  pass "startup.sh is executable"
else
  fail "startup.sh not set as executable"
fi

if grep -q 'apk add --no-cache sqlite curl' backend/Dockerfile; then
  pass "sqlite and curl tools installed"
else
  warn "sqlite and curl tools not installed in Dockerfile"
fi

# Verify startup.sh
print_header "Verifying backend/startup.sh"

if ! grep -q 'npm install' backend/startup.sh; then
  pass "npm install removed from startup.sh (only in Dockerfile)"
else
  fail "npm install still in startup.sh (should only be in Dockerfile)"
fi

if grep -q 'node seed.cjs || true' backend/startup.sh; then
  pass "Seed script is non-critical (uses || true)"
else
  warn "Seed script error handling could be improved"
fi

if ! grep -q 'exit 1' backend/startup.sh; then
  pass "No hard exit on seed failure"
else
  fail "startup.sh exits on seed failure (should be non-critical)"
fi

# Verify nginx.conf
print_header "Verifying frontend/nginx.conf"

if grep -q 'location /api/' frontend/nginx.conf; then
  pass "API proxy location block exists"
else
  fail "API proxy location block missing"
fi

if grep -q 'proxy_pass.*backend:3000' frontend/nginx.conf; then
  pass "Backend URL correctly configured (backend:3000)"
else
  fail "Backend URL not correctly configured"
fi

if grep -q 'resolver 127.0.0.11' frontend/nginx.conf; then
  pass "Docker DNS resolver configured"
else
  warn "Docker DNS resolver not explicitly configured"
fi

if grep -q 'X-Forwarded-For' frontend/nginx.conf; then
  pass "X-Forwarded-For header configured"
else
  warn "X-Forwarded-For header not configured"
fi

# Check if containers are already running
print_header "Checking Running Containers"

if docker-compose ps 2>/dev/null | grep -q smartview-backend; then
  BACKEND_STATUS=$(docker-compose ps smartview-backend 2>/dev/null | grep smartview-backend | awk '{print $5}')
  if [[ "$BACKEND_STATUS" == *"healthy"* ]] || [[ "$BACKEND_STATUS" == *"Up"* ]]; then
    pass "Backend container is running (status: $BACKEND_STATUS)"
  else
    fail "Backend container not healthy (status: $BACKEND_STATUS)"
  fi
  
  FRONTEND_STATUS=$(docker-compose ps smartview-frontend 2>/dev/null | grep smartview-frontend | awk '{print $5}')
  if [[ "$FRONTEND_STATUS" == *"Up"* ]]; then
    pass "Frontend container is running"
  else
    fail "Frontend container not running"
  fi
else
  warn "Containers not currently running"
  echo "    Run: docker-compose up"
fi

# If containers are running, run connectivity tests
if docker ps 2>/dev/null | grep -q smartview-backend; then
  print_header "Testing Service Connectivity"

  # Test backend health
  BACKEND_HEALTH=$(docker exec smartview-backend curl -s http://localhost:3000/api/health 2>&1)
  if [ $? -eq 0 ]; then
    pass "Backend health endpoint responding"
  else
    fail "Backend health endpoint not responding"
  fi

  # Test frontend to backend
  FRONTEND_TO_BACKEND=$(docker exec smartview-frontend curl -s http://backend:3000/api/health 2>&1)
  if [ $? -eq 0 ]; then
    pass "Frontend can reach backend via Docker DNS"
  else
    fail "Frontend cannot reach backend (Docker DNS issue)"
  fi

  # Test API endpoint
  CUSTOMER_COUNT=$(docker exec smartview-backend sqlite3 /app/data/smartview.db "SELECT COUNT(*) FROM customers;" 2>/dev/null)
  if [ -n "$CUSTOMER_COUNT" ] && [ "$CUSTOMER_COUNT" -gt 0 ]; then
    pass "Database has $CUSTOMER_COUNT customers"
  elif [ -n "$CUSTOMER_COUNT" ] && [ "$CUSTOMER_COUNT" -eq 0 ]; then
    warn "Database is empty (seed may have failed, but not critical)"
  else
    fail "Cannot query database"
  fi

  print_header "Testing Data Persistence"

  # Get initial customer count
  BEFORE=$(docker exec smartview-backend sqlite3 /app/data/smartview.db "SELECT COUNT(*) FROM customers;" 2>/dev/null || echo "0")
  
  if [ "$BEFORE" -gt 0 ]; then
    # Restart container
    docker-compose restart backend > /dev/null 2>&1
    sleep 3
    
    # Check customer count again
    AFTER=$(docker exec smartview-backend sqlite3 /app/data/smartview.db "SELECT COUNT(*) FROM customers;" 2>/dev/null || echo "0")
    
    if [ "$BEFORE" = "$AFTER" ]; then
      pass "Data persists after container restart ($BEFORE customers)"
    else
      fail "Data not persistent (before: $BEFORE, after: $AFTER)"
    fi
  else
    warn "Cannot test persistence (database empty)"
  fi
fi

# Port accessibility test
print_header "Checking Port Accessibility"

if netstat -tuln 2>/dev/null | grep -q ":3000 " || lsof -i :3000 2>/dev/null | grep -q LISTEN; then
  pass "Port 3000 is open and listening"
elif curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
  pass "Port 3000 is accessible"
else
  fail "Port 3000 is not accessible"
fi

if curl -s http://localhost:8081 > /dev/null 2>&1; then
  pass "Port 8081 is accessible"
else
  fail "Port 8081 is not accessible (containers may not be running)"
fi

# Display summary
print_header "Verification Summary"

TOTAL=$((PASSED + FAILED + WARNINGS))

echo -e "Tests passed:  ${GREEN}$PASSED${NC}"
echo -e "Tests failed:  ${RED}$FAILED${NC}"
echo -e "Warnings:      ${YELLOW}$WARNINGS${NC}"
echo -e "Total tests:   $TOTAL\n"

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All critical checks passed!${NC}"
  if [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}⚠ Review warnings above${NC}"
  fi
  exit 0
else
  echo -e "${RED}✗ Some checks failed. Review errors above.${NC}"
  exit 1
fi
