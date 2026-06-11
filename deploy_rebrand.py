#!/usr/bin/env python3
"""Deploy brand rename: 智影工厂 ZhiyingWorks"""

import paramiko
import os

HOST = "47.106.208.53"
USER = "root"
PASSWORD = "Czz@19890802"
REMOTE_BASE = "/app/ai-creation-platform"
LOCAL_BASE = r"C:\Users\Administrator\WorkBuddy\2026-06-01-14-19-15\ai-creation-platform"

FILES = [
    "client/src/components/Layout/Sidebar.tsx",
    "client/src/pages/LoginPage.tsx",
    "client/src/pages/RegisterPage.tsx",
    "client/src/pages/ForgotPasswordPage.tsx",
    "client/src/pages/ResetPasswordPage.tsx",
    "client/src/pages/WorkspacePage.tsx",
    "server/src/services/email.service.ts",
    "client/index.html",
]

BUILD_DIR = os.path.join(LOCAL_BASE, "client", "dist")


def ensure_remote_dir(sftp, remote_path):
    try:
        sftp.stat(remote_path)
    except FileNotFoundError:
        parent = os.path.dirname(remote_path)
        if parent and parent != remote_path:
            ensure_remote_dir(sftp, parent)
        sftp.mkdir(remote_path)


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


def update_env_and_restart(ssh):
    print("\n=== Updating .env & restarting ===")
    cmds = [
        f"sed -i 's|^EMAIL_FROM_NAME=.*|EMAIL_FROM_NAME=智影工厂|' {REMOTE_BASE}/server/.env",
        "pm2 restart ai-creation-api 2>&1",
        "sleep 3 && pm2 status 2>&1",
    ]
    for cmd in cmds:
        print(f"\n> {cmd}")
        stdin, stdout, stderr = ssh.exec_command(cmd, timeout=60)
        out = stdout.read().decode("utf-8", errors="replace")
        if out:
            print(out[:2000])


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

    update_env_and_restart(ssh)
    ssh.close()
    print("\n=== Deployment complete! ===")


if __name__ == "__main__":
    main()
