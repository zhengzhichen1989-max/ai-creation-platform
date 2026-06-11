"""
部署脚本：手机验证码登录功能
- 上传 server 源文件
- 上传 client/dist
- npm install (新增 @alicloud/dysmsapi20170525)
- 更新 .env
- pm2 restart
"""
import paramiko
import os

HOST = "47.106.208.53"
PORT = 22
USER = "root"
PASS = "Czz@19890802"

BASE_LOCAL = "C:/Users/Administrator/WorkBuddy/2026-06-01-14-19-15/ai-creation-platform"
BASE_REMOTE = "/app/ai-creation-platform"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, PORT, USER, PASS)
sftp = client.open_sftp()

# --- 上传 server 源文件 ---
server_files = [
    "server/src/services/sms.service.ts",
    "server/src/services/auth.service.ts",
    "server/src/routes/auth.routes.ts",
    "server/src/db/migrate.ts",
    "server/src/config/index.ts",
    "server/src/types/index.ts",
    "server/.env",
    "server/package.json",
    "server/package-lock.json",
]

print("Uploading server source files...")
for f in server_files:
    local = os.path.join(BASE_LOCAL, f)
    remote = os.path.join(BASE_REMOTE, f).replace("\\", "/")
    try:
        sftp.put(local, remote)
        print(f"  OK: {f}")
    except Exception as e:
        print(f"  FAIL: {f} - {e}")

# --- 上传 dist ---
LOCAL_DIST = os.path.join(BASE_LOCAL, "client", "dist")
REMOTE_DIST = os.path.join(BASE_REMOTE, "client", "dist")

def upload_dir(sftp, local_dir, remote_dir):
    try:
        sftp.stat(remote_dir)
    except FileNotFoundError:
        sftp.mkdir(remote_dir)
    for item in os.listdir(local_dir):
        lp = os.path.join(local_dir, item)
        rp = (remote_dir + "/" + item).replace("\\", "/")
        if os.path.isdir(lp):
            upload_dir(sftp, lp, rp)
        else:
            sftp.put(lp, rp)

print("\nUploading client/dist...")
upload_dir(sftp, LOCAL_DIST, REMOTE_DIST)
print("  OK")

sftp.close()

# --- 服务器操作 ---
def run_cmd(cmd, desc):
    print(f"\n>>> {desc}")
    stdin, stdout, stderr = client.exec_command(cmd)
    out = stdout.read().decode()
    err = stderr.read().decode()
    if out.strip():
        print(out.strip())
    if err.strip():
        print("[stderr]", err.strip()[:300])
    return out

run_cmd(f"cd {BASE_REMOTE}/server && npm install", "npm install (SMS SDK)")
run_cmd(f"cd {BASE_REMOTE} && pm2 restart ai-creation-api", "pm2 restart")
run_cmd(f"cd {BASE_REMOTE} && pm2 status", "pm2 status")

client.close()
print("\nDone.")
