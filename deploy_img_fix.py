"""部署修复：代理白名单 + 图片错误处理 + 下载修复"""
import paramiko
import os
import glob

LOCAL_BASE = r"C:\Users\Administrator\WorkBuddy\2026-06-01-14-19-15\ai-creation-platform"
REMOTE_BASE = "/app/ai-creation-platform"
SSH_HOST = "47.106.208.53"
SSH_USER = "root"
SSH_PASS = "Czz@19890802"

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(SSH_HOST, username=SSH_USER, password=SSH_PASS, timeout=30)
    sftp = ssh.open_sftp()

    # 1. Upload server files
    server_files = [
        ("server/src/routes/proxy.routes.ts", "server/src/routes/proxy.routes.ts"),
    ]
    for local_rel, remote_rel in server_files:
        local_path = os.path.join(LOCAL_BASE, local_rel.replace("/", os.sep))
        remote_path = f"{REMOTE_BASE}/{remote_rel}"
        sftp.put(local_path, remote_path)
        print(f"  Uploaded: {remote_rel}")

    # 2. Upload frontend dist
    dist_dir = os.path.join(LOCAL_BASE, "client", "dist")
    
    # Clean old assets on remote
    stdin, stdout, stderr = ssh.exec_command(f"rm -rf {REMOTE_BASE}/client/dist/assets/*")
    stdout.read()
    
    # Upload new files
    for root, dirs, files in os.walk(dist_dir):
        for f in files:
            local_path = os.path.join(root, f)
            rel_path = os.path.relpath(local_path, dist_dir).replace(os.sep, "/")
            remote_path = f"{REMOTE_BASE}/client/dist/{rel_path}"
            remote_dir = os.path.dirname(remote_path).replace(os.sep, "/")
            
            # Ensure directory exists
            try:
                sftp.stat(remote_dir)
            except FileNotFoundError:
                stdin, stdout, stderr = ssh.exec_command(f"mkdir -p {remote_dir}")
                stdout.read()
            
            sftp.put(local_path, remote_path)
            print(f"  Uploaded: client/dist/{rel_path}")

    # 3. Restart PM2
    print("\nRestarting PM2...")
    stdin, stdout, stderr = ssh.exec_command("pm2 restart ai-creation-api 2>&1")
    print(stdout.read().decode()[:500])

    # 4. Wait and verify
    import time
    time.sleep(5)
    
    stdin, stdout, stderr = ssh.exec_command("curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/api/v1/models")
    status = stdout.read().decode()
    print(f"\nAPI Status: {status}")
    
    # Test proxy with aitohumanize.com domain
    stdin, stdout, stderr = ssh.exec_command('curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:3000/api/v1/proxy?url=https%3A%2F%2Ffile2.aitohumanize.com%2Ftest.png"')
    proxy_status = stdout.read().decode()
    print(f"Proxy aitohumanize.com status: {proxy_status} (502=domain ok but file gone, 403=blocked)")

    sftp.close()
    ssh.close()
    print("\nDone!")

if __name__ == "__main__":
    main()
