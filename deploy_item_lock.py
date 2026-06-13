import paramiko
import os

host = '47.106.208.53'
user = 'root'
password = 'Czz@19890802'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, username=user, password=password, timeout=30)
sftp = client.open_sftp()

# ========== 后端文件 ==========
# 1. 新建 item-lock.ts
print('[1/5] Uploading server/src/utils/item-lock.ts (NEW)...')
sftp.put('server/src/utils/item-lock.ts', '/app/ai-creation-platform/server/src/utils/item-lock.ts')
print('  -> OK')

# 2. 更新 shouzuo.routes.ts (已含 item-detect 端点 + lockedItems 逻辑)
print('[2/5] Uploading server/src/routes/shouzuo.routes.ts...')
sftp.put('server/src/routes/shouzuo.routes.ts', '/app/ai-creation-platform/server/src/routes/shouzuo.routes.ts')
print('  -> OK')

# 3. 更新 shouzuo.service.ts (已含 locked_items_json 字段)
print('[3/5] Uploading server/src/services/shouzuo.service.ts...')
sftp.put('server/src/services/shouzuo.service.ts', '/app/ai-creation-platform/server/src/services/shouzuo.service.ts')
print('  -> OK')

# ========== 前端文件 ==========
# 4. 上传 client/dist 
print('[4/5] Uploading client/dist...')
local_dist = 'client/dist'
remote_dist = '/app/ai-creation-platform/client/dist'

# 递归上传 dist
def upload_dir(local_dir, remote_dir):
    """递归上传目录"""
    for item in os.listdir(local_dir):
        local_path = os.path.join(local_dir, item)
        remote_path = f"{remote_dir}/{item}"
        if os.path.isdir(local_path):
            try:
                sftp.mkdir(remote_path)
            except:
                pass
            upload_dir(local_path, remote_path)
        else:
            sftp.put(local_path, remote_path)

# 确保远程 dist 目录存在
try:
    sftp.mkdir(remote_dist)
except:
    pass

# 上传 dist 中的所有文件
upload_dir(local_dist, remote_dist)
print('  -> OK')

# ========== 重启 PM2 ==========
print('[5/5] Restarting ai-creation-api...')
stdin, stdout, stderr = client.exec_command('pm2 restart ai-creation-api --update-env 2>&1', timeout=30)
print('  ->', stdout.read().decode().strip())

# 检查状态
stdin, stdout, stderr = client.exec_command('pm2 list 2>&1', timeout=10)
print('\nPM2 Status:')
print(stdout.read().decode())

# 验证 API 健康
import time
time.sleep(2)
stdin, stdout, stderr = client.exec_command('curl -s http://localhost:3000/api/v1/health 2>&1', timeout=10)
print('\nAPI Health:')
print(stdout.read().decode())

sftp.close()
client.close()
print('\n=== Deploy Complete ===')
