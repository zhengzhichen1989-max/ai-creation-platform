import json, urllib.request

def api(method, path, data=None, token=None):
    url = f'http://localhost:3000{path}'
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, method=method)
    req.add_header('Content-Type', 'application/json')
    if token:
        req.add_header('Authorization', f'Bearer {token}')
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())

# Login
_, login_data = api('POST', '/api/v1/auth/login', {'email': 'admin@aicreation.com', 'password': 'admin123'})
token = login_data['data']['token']
print(f'Login OK, token: {token[:20]}...')

# Test 1: sensitive word
print()
print('=== Test 1: prompt="bingdu" ===')
status, data = api('POST', '/api/v1/tasks', {'modelId': 'gpt-image-2', 'prompt': '\u51b0\u6bd2'}, token)
print(f'HTTP {status}')
print(json.dumps(data, ensure_ascii=False, indent=2))

# Test 2: normal prompt
print()
print('=== Test 2: prompt="cat" ===')
status, data = api('POST', '/api/v1/tasks', {'modelId': 'gpt-image-2', 'prompt': '\u4e00\u53ea\u732b'}, token)
print(f'HTTP {status}')
print(json.dumps(data, ensure_ascii=False, indent=2)[:200])
