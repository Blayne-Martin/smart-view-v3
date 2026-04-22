#!/bin/bash

# SmartView v2 Backend - Endpoint Test Script
# Usage: bash test-endpoints.sh [BASE_URL]

BASE_URL="${1:-http://localhost:3000}"
FAILED=0
PASSED=0

echo "=========================================="
echo "SmartView v2 - Endpoint Tests"
echo "=========================================="
echo "Base URL: $BASE_URL"
echo ""

# Helper function to test endpoint
test_endpoint() {
  local method=$1
  local path=$2
  local expected_code=$3
  local description=$4
  local params=$5

  local url="$BASE_URL$path"
  if [ -n "$params" ]; then
    url="$url?$params"
  fi

  echo -n "Testing $method $path ... "
  
  response=$(curl -s -w "\n%{http_code}" "$url")
  status=$(echo "$response" | tail -n1)
  body=$(echo "$response" | head -n-1)

  if [ "$status" = "$expected_code" ]; then
    echo "✓ (HTTP $status) $description"
    ((PASSED++))
  else
    echo "✗ (HTTP $status, expected $expected_code) $description"
    echo "  Response: $body"
    ((FAILED++))
  fi
}

# 1. Health check
test_endpoint "GET" "/health" "200" "Server is running"

# 2. Fleet summary
test_endpoint "GET" "/api/fleet/summary" "200" "Fleet summary endpoint"

# 3. Worst performers (default)
test_endpoint "GET" "/api/fleet/worst-performers" "200" "Worst performers (default)"

# 4. Worst performers (with limit)
test_endpoint "GET" "/api/fleet/worst-performers" "200" "Worst performers (limit 20)" "limit=20"

# 5. Customers list
test_endpoint "GET" "/api/customers" "200" "Customers list (default)"

# 6. Customers with pagination
test_endpoint "GET" "/api/customers" "200" "Customers list (limit 25)" "limit=25&offset=0"

# 7. Get first customer (assuming ID 1 exists)
test_endpoint "GET" "/api/customers/1" "200" "Get customer by ID"

# 8. Get modem stats for customer 1
test_endpoint "GET" "/api/customers/1/modem-stats" "200" "Get modem stats for customer"

# 9. Get modem history for customer 1
test_endpoint "GET" "/api/customers/1/modem-history" "200" "Get modem history (1 day)" "days=1"

# 10. Get modem history 7 days
test_endpoint "GET" "/api/customers/1/modem-history" "200" "Get modem history (7 days)" "days=7"

# 11. Get modem daily for customer 1
test_endpoint "GET" "/api/customers/1/modem-daily" "200" "Get modem daily (30 days)" "days=30"

# 12. Get modem daily 90 days
test_endpoint "GET" "/api/customers/1/modem-daily" "200" "Get modem daily (90 days)" "days=90"

# 13. Non-existent customer (404)
test_endpoint "GET" "/api/customers/99999" "404" "Non-existent customer (404)"

# 14. Non-existent endpoint (404)
test_endpoint "GET" "/api/nonexistent" "404" "Non-existent endpoint (404)"

# 15. CORS preflight for port 8081
echo -n "Testing CORS preflight from localhost:8081 ... "
cors_response=$(curl -s -i -X OPTIONS "$BASE_URL/api/fleet/summary" \
  -H "Origin: http://localhost:8081" \
  -H "Access-Control-Request-Method: GET" 2>&1 | grep -i "access-control-allow-origin")

if echo "$cors_response" | grep -q "localhost:8081\|*"; then
  echo "✓ CORS headers present"
  ((PASSED++))
else
  echo "✗ Missing CORS headers"
  ((FAILED++))
fi

echo ""
echo "=========================================="
echo "Test Results: $PASSED passed, $FAILED failed"
echo "=========================================="

if [ $FAILED -gt 0 ]; then
  exit 1
else
  exit 0
fi
