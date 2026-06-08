import paramiko
import os
import sys

# 服务器配置
HOST = "47.106.208.53"
USER = "root"
PASS = "Czz@19890802"
REMOTE_BASE = "/app/ai-creation-platform"
LOCAL_BASE = r"C:\Users\Administrator\WorkBuddy\2026-06-01-14-19-15\ai-creation-platform"

# 需要部署的后端文件（源码，因为服务器用 tsx 直接跑）
SERVER_FILES = [
    "server/src/db/migrate.ts",
    "server/src/types/index.ts",
    "server/src/services/model.service.ts",
    "server/src/services/task.service.ts",
    "server/src/routes/tasks.routes.ts",
    "server/src/routes/admin.routes.ts",
    "server/src/adapters/dmxapi-video.adapter.ts",
    "server/src/adapters/dalle.adapter.ts",
    "server/src/adapters/flux.adapter.ts",
    "server/src/adapters/stable-diffusion.adapter.ts",
    "server/src/adapters/kling.adapter.ts",
    "server/src/adapters/seedance.adapter.ts",
    "server/src/adapters/sora.adapter.ts",
]

# 前端 dist 目录
CLIENT_DIST = "client/dist"

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASS)
    sftp = ssh.open_sftp()
    print(f"[OK] 已连接服务器 {HOST}")

    # 1. 上传后端源码
    print("\n--- 上传后端文件 ---")
    for f in SERVER_FILES:
        local_path = os.path.join(LOCAL_BASE, f)
        remote_path = f"{REMOTE_BASE}/{f}"
        if os.path.exists(local_path):
            # 确保远程目录存在
            remote_dir = os.path.dirname(remote_path)
            try:
                sftp.stat(remote_dir)
            except FileNotFoundError:
                # paramiko 不支持 makedirs，用 mkdir 逐级创建
                parts = remote_dir.split("/")
                for i in range(1, len(parts)):
                    subpath = "/".join(parts[:i+1])
                    try:
                        sftp.stat(subpath)
                    except FileNotFoundError:
                        sftp.mkdir(subpath)
            sftp.put(local_path, remote_path)
            print(f"  ✅ {f}")
        else:
            print(f"  ❌ 本地文件不存在: {f}")

    # 2. 上传前端 dist
    print("\n--- 上传前端 dist ---")
    dist_local = os.path.join(LOCAL_BASE, CLIENT_DIST)
    dist_remote = f"{REMOTE_BASE}/{CLIENT_DIST}"
    
    uploaded = 0
    for root, dirs, files in os.walk(dist_local):
        for fname in files:
            local_file = os.path.join(root, fname)
            rel_path = os.path.relpath(local_file, LOCAL_BASE).replace("\\", "/")
            remote_file = f"{REMOTE_BASE}/{rel_path}"
            
            # 确保远程目录存在
            remote_dir = os.path.dirname(remote_file)
            try:
                sftp.stat(remote_dir)
            except FileNotFoundError:
                parts = remote_dir.split("/")
                for i in range(1, len(parts)):
                    subpath = "/".join(parts[:i+1])
                    try:
                        sftp.stat(subpath)
                    except FileNotFoundError:
                        sftp.mkdir(subpath)
            
            sftp.put(local_file, remote_file)
            uploaded += 1
    
    print(f"  ✅ 前端文件上传完成: {uploaded} 个文件")

    # 3. 停止 PM2 → 清理旧数据库缓存 → 重启
    print("\n--- 重启服务 ---")
    cmds = [
        "cd /app/ai-creation-platform/server && pm2 stop ai-creation-api || true",
        "sleep 1",
        "cd /app/ai-creation-platform/server && npx tsx src/db/migrate.ts",
        "cd /app/ai-creation-platform/server && pm2 start ai-creation-api",
        "pm2 save",
    ]
    for cmd in cmds:
        print(f"  执行: {cmd}")
        stdin, stdout, stderr = ssh.exec_command(cmd)
        out = stdout.read().decode()
        err = stderr.read().decode()
        if out.strip():
            print(f"    stdout: {out.strip()[:200]}")
        if err.strip():
            print(f"    stderr: {err.strip()[:200]}")

    sftp.close()
    ssh.close()
    print("\n✅ 部署完成！")

if __name__ == "__main__":
    main()
