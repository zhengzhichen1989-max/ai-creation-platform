#!/usr/bin/env python3
"""Deploy email password reset + customer service wechat QR code"""

import paramiko
import os

HOST = "47.106.208.53"
USER = "root"
PASSWORD = "Czz@19890802"
REMOTE_BASE = "/app/ai-creation-platform"
LOCAL_BASE = r"C:\Users\Administrator\WorkBuddy\2026-06-01-14-19-15\ai-creation-platform"

FILES = [
    # 后端 - 邮件服务
    "server/src/services/email.service.ts",
    "server/src/services/auth.service.ts",
    "server/src/routes/auth.routes.ts",
    "server/src/config/index.ts",
    "server/package.json",
    "server/package-lock.json",
    # 前端源码
    "client/src/api/auth.ts",
    "client/src/pages/ForgotPasswordPage.tsx",
    "client/src/pages/LoginPage.tsx",
    "client/src/components/CustomerService/CustomerService.tsx",
    "client/src/components/Layout/AppLayout.tsx",
]

BUILD_DIR = os.path.join(LOCAL_BASE, "client", "dist")

# 服务器 .env 追加内容（邮件配置）
EMAIL_ENV = """
# 邮件SMTP配置（密码找回功能）
EMAIL_HOST=smtp.qq.com
EMAIL_PORT=465
EMAIL_SECURE=true
EMAIL_USER=zhiyingworks@qq.com
EMAIL_PASS=slkzwzuhzffkbgdd
EMAIL_FROM_NAME=织影智作
"""


def ensure_remote_dir(sftp, remote_path):
    try:
        sftp.stat(remote_path)
    except FileNotFoundError:
        parent = os.path.dirname(remote_path)
        if parent and parent != remote_path:
            ensure_remote_dir(sftp, parent)
        sftp.mkdir(remote_path)
        print(f"  Created dir: {remote_path}")


def deploy_source_files(sftp):
    print("\n=== Deploying source files ===")
    for rel_path in FILES:
        local_path = os.path.join(LOCAL_BASE, rel_path.replace("/", os.sep))
        remote_path = f"{REMOTE_BASE}/{rel_path}"
        if not os.path.exists(local_path):
            print(f"  SKIP: {rel_path}")
            continue
        ensure_remote_dir(sftp, os.path.dirname(remote_path))
        sftp.put(local_path, remote_path)
        print(f"  OK: {rel_path}")


def deploy_build_output(sftp):
    print("\n=== Deploying client build output ===")
    remote_dist = f"{REMOTE_BASE}/client/dist"
    ensure_remote_dir(sftp, remote_dist)
    ensure_remote_dir(sftp, f"{remote_dist}/assets")
    count = 0
    for root, dirs, files in os.walk(BUILD_DIR):
        for fname in files:
            local_path = os.path.join(root, fname)
            rel = os.path.relpath(local_path, BUILD_DIR).replace(os.sep, "/")
            remote_path = f"{remote_dist}/{rel}"
            ensure_remote_dir(sftp, os.path.dirname(remote_path))
            sftp.put(local_path, remote_path)
            print(f"  OK: dist/{rel}")
            count += 1
    print(f"\nDeployed {count} build files")


def update_server_env(ssh):
    """检查并更新服务器 .env 文件，追加邮件配置"""
    print("\n=== Updating server .env ===")
    # 读取现有 .env
    stdin, stdout, stderr = ssh.exec_command(
        f"cat {REMOTE_BASE}/server/.env 2>/dev/null", timeout=15
    )
    current_env = stdout.read().decode("utf-8", errors="replace")

    if "EMAIL_USER" in current_env:
        print("  EMAIL config already exists, updating...")
        # 用 sed 更新已有的值
        cmds = [
            f"sed -i 's|^EMAIL_USER=.*|EMAIL_USER=zhiyingworks@qq.com|' {REMOTE_BASE}/server/.env",
            f"sed -i 's|^EMAIL_PASS=.*|EMAIL_PASS=slkzwzuhzffkbgdd|' {REMOTE_BASE}/server/.env",
        ]
        for cmd in cmds:
            ssh.exec_command(cmd, timeout=10)
        print("  Updated EMAIL_USER and EMAIL_PASS")
    else:
        print("  Appending EMAIL config to .env ...")
        # 追加到 .env
        append_cmd = f"cat >> {REMOTE_BASE}/server/.env << 'ENVEOF'\n{EMAIL_ENV}\nENVEOF"
        stdin2, stdout2, stderr2 = ssh.exec_command(append_cmd, timeout=15)
        stdout2.read()
        print("  Appended email config")

    # 验证
    stdin3, stdout3, _ = ssh.exec_command(
        f"grep 'EMAIL_USER' {REMOTE_BASE}/server/.env", timeout=10
    )
    print(f"  Verify: {stdout3.read().decode().strip()}")


def install_and_restart(ssh):
    print("\n=== Installing nodemailer & restarting ===")
    commands = [
        f"cd {REMOTE_BASE}/server && npm install --production 2>&1 | tail -5",
        "pm2 restart ai-creation-api 2>&1",
        "sleep 3 && pm2 status 2>&1",
    ]
    for cmd in commands:
        print(f"\n> {cmd}")
        stdin, stdout, stderr = ssh.exec_command(cmd, timeout=120)
        out = stdout.read().decode("utf-8", errors="replace")
        err = stderr.read().decode("utf-8", errors="replace")
        if out:
            print(out[:2000])
        if err:
            print(f"STDERR: {err[:500]}")


def main():
    print(f"Connecting to {HOST}...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=30)
    print("Connected!")

    sftp = ssh.open_sftp()

    deploy_source_files(sftp)
    deploy_build_output(sftp)

    sftp.close()

    update_server_env(ssh)
    install_and_restart(ssh)

    ssh.close()
    print("\n=== Deployment complete! ===")


if __name__ == "__main__":
    main()
