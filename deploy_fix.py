#!/usr/bin/env python3
"""Deploy frontend + backend fixes to production server via SFTP"""

import paramiko
import os

HOST = "47.106.208.53"
USER = "root"
PASSWORD = "Czz@19890802"
REMOTE_BASE = "/app/ai-creation-platform"

LOCAL_BASE = r"C:\Users\Administrator\WorkBuddy\2026-06-01-14-19-15\ai-creation-platform"
BUILD_DIR = os.path.join(LOCAL_BASE, "client", "dist")

SERVER_FILES = [
    "server/src/utils/download.ts",
    "server/src/queue/image.worker.ts",
    "server/src/queue/video.worker.ts",
]


def ensure_remote_dir(sftp, remote_path):
    try:
        sftp.stat(remote_path)
    except FileNotFoundError:
        parent = os.path.dirname(remote_path)
        if parent:
            ensure_remote_dir(sftp, parent)
        sftp.mkdir(remote_path)
        print(f"  Created remote dir: {remote_path}")


def deploy_server_files(sftp):
    print("\n=== Deploying server files ===")
    for rel_path in SERVER_FILES:
        local_path = os.path.join(LOCAL_BASE, rel_path.replace("/", os.sep))
        remote_path = f"{REMOTE_BASE}/{rel_path}"

        if not os.path.exists(local_path):
            print(f"  SKIP (not found): {rel_path}")
            continue

        ensure_remote_dir(sftp, os.path.dirname(remote_path))
        sftp.put(local_path, remote_path)
        print(f"  OK: {rel_path}")


def clean_and_deploy_dist(sftp):
    print("\n=== Cleaning and deploying client/dist ===")
    remote_dist = f"{REMOTE_BASE}/client/dist"
    remote_assets = f"{remote_dist}/assets"

    # Clean old files in assets
    try:
        for fname in sftp.listdir(remote_assets):
            if fname.endswith(".js") or fname.endswith(".css"):
                old_path = f"{remote_assets}/{fname}"
                sftp.remove(old_path)
                print(f"  Removed old: assets/{fname}")
    except Exception as e:
        print(f"  Warning cleaning old files: {e}")

    # Deploy new files
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

    print(f"\nDeployed {count} dist files")


def rebuild_and_restart(ssh):
    print("\n=== Rebuilding server on remote ===")
    commands = [
        f"cd {REMOTE_BASE}/server && npm run build 2>&1",
        "pm2 restart ai-creation-api 2>&1",
        "sleep 2 && pm2 status 2>&1",
    ]
    for cmd in commands:
        print(f"\n> {cmd}")
        stdin, stdout, stderr = ssh.exec_command(cmd, timeout=120)
        out = stdout.read().decode("utf-8", errors="replace")
        err = stderr.read().decode("utf-8", errors="replace")
        if out:
            print(out[:2000])
        if err:
            print(f"STDERR: {err[:1000]}")


def main():
    print(f"Connecting to {HOST}...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=30)
    print("Connected!")

    sftp = ssh.open_sftp()

    # 1. Deploy server files
    deploy_server_files(sftp)

    # 2. Deploy frontend dist
    clean_and_deploy_dist(sftp)

    sftp.close()

    # 3. Rebuild and restart
    rebuild_and_restart(ssh)

    ssh.close()
    print("\n=== Deployment complete! ===")


if __name__ == "__main__":
    main()
