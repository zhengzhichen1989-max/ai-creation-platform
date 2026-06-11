#!/bin/bash
set -e

# Login
RESP=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@aicreation.com","password":"admin123"}')
echo "LOGIN: $(echo $RESP | cut -c1-100)"
TOKEN=$(echo "$RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['data']['token'])" 2>/dev/null)
if [ -z "$TOKEN" ]; then
  echo "FAILED TO GET TOKEN - full response:"
  echo "$RESP"
  exit 1
fi
echo "TOKEN: ${TOKEN:0:20}..."

# Test 1: sensitive prompt
echo ""
echo "=== Test 1: prompt='冰毒' ==="
curl -s -w "\nHTTP_CODE:%{http_code}\n" -X POST http://localhost:3000/api/v1/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"modelId":"gpt-image-2","prompt":"冰毒"}'

# Test 2: normal prompt
echo ""
echo "=== Test 2: prompt='一只猫' ==="
curl -s -w "\nHTTP_CODE:%{http_code}\n" -X POST http://localhost:3000/api/v1/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"modelId":"gpt-image-2","prompt":"一只猫"}'
