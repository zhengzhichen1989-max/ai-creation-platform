"""
部署定价更新 - 上传后端文件 + 执行数据库迁移 + 重启PM2
"""
import paramiko
import os
import time

BASE = r"C:\Users\Administrator\WorkBuddy\2026-06-01-14-19-15\ai-creation-platform"
REMOTE = "/app/ai-creation-platform"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect("47.106.208.53", username="root", password="Czz@19890802", timeout=30)
sftp = ssh.open_sftp()

# 1. Upload modified backend files
files = [
    ("server/src/db/migrate.ts", "server/src/db/migrate.ts"),
    ("server/src/services/auth.service.ts", "server/src/services/auth.service.ts"),
    ("server/migrate_pricing.cjs", "server/migrate_pricing.cjs"),
]

print("=== 上传后端文件 ===")
for local_rel, remote_rel in files:
    local_path = os.path.join(BASE, local_rel.replace("/", os.sep))
    remote_path = f"{REMOTE}/{remote_rel}"
    sftp.put(local_path, remote_path)
    print(f"  ✅ {remote_rel}")

sftp.close()

# 2. Backup database
print("\n=== 备份数据库 ===")
stdin, stdout, stderr = ssh.exec_command(f"cp {REMOTE}/server/data/ai-creation.db {REMOTE}/server/data/ai-creation.db.bak.$(date +%Y%m%d%H%M%S)")
stdout.read()
print("  ✅ 数据库已备份")

# 3. Execute pricing migration
print("\n=== 执行定价迁移 ===")
stdin, stdout, stderr = ssh.exec_command(f"cd {REMOTE}/server && node migrate_pricing.cjs 2>&1")
out = stdout.read().decode()
err = stderr.read().decode()
print(out)
if err and "Error" in err:
    print("STDERR:", err)

# 4. Restart PM2
print("\n=== 重启PM2 ===")
stdin, stdout, stderr = ssh.exec_command("pm2 restart ai-creation-api 2>&1")
print(stdout.read().decode())
time.sleep(3)

# 5. Verify API health
print("=== 验证API ===")
stdin, stdout, stderr = ssh.exec_command("curl -s http://127.0.0.1:3000/api/v1/models | python3 -c \"import sys,json; d=json.load(sys.stdin); models=d.get('data',[]); [print(f'  {m[\\\"name\\\"]}: {m[\\\"costCredits\\\"]}积分') for m in models]\" 2>&1")
print(stdout.read().decode())

stdin, stdout, stderr = ssh.exec_command("curl -s http://127.0.0.1:3000/api/v1/credits/packages | python3 -c \"import sys,json; d=json.load(sys.stdin); pkgs=d.get('data',[]); [print(f'  {p[\\\"name\\\"]}: {p[\\\"credits\\\"]}积分/¥{p[\\\"priceCents\\\"]/100:.0f}') for p in pkgs]\" 2>&1")
print(stdout.read().decode())

# 6. Clean up migration script
stdin, stdout, stderr = ssh.exec_command(f"rm -f {REMOTE}/server/migrate_pricing.cjs")
stdout.read()
print("=== 迁移脚本已清理 ===")

ssh.close()
print("\n✅ 部署完成!")
