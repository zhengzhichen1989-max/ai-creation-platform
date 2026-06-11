#!/usr/bin/env python3
"""Deploy V1 bugfixes to production server via SFTP

V1 fixes in this deployment:
1. server/src/utils/download.ts - Content-Type vs URL extension priority, 0-byte check
2. server/src/queue/image.worker.ts - try/catch around downloadIfExternal
3. client/dist/* - Frontend rebuild with ImageResult/VideoResult getMediaUrl() fix
"""

import paramiko
import os

HOST = "47.106.208.53"
USER = "root"
PASSWORD = "Czz@19890802"
REMOTE_BASE = "/app/ai-creation-platform"

LOCAL_BASE = r"C:\Users\Administrator\WorkBuddy\2026-06-01-14-19-15\ai-creation-platform"
BUILD_DIR = os.path.join(LOCAL_BASE, "client", "dist")

# Server source files that changed (tsx runs directly, no build needed)
SERVER_FILES = [
    "server/src/utils/download.ts",
    "server/src/queue/image.worker.ts",
]


def ensure_remote_dir(sftp, remote_path):
    """Ensure remote directory exists, creating parents as needed."""
    try:
        sftp.stat(remote_path)
    except FileNotFoundError:
        parent = os.path.dirname(remote_path)
        if parent:
            ensure_remote_dir(sftp, parent)
        sftp.mkdir(remote_path)
        print(f"  Created remote dir: {remote_path}")


def deploy_server_files(sftp):
    """Deploy changed server TS source files (tsx runs them directly)."""
    print("\n=== Deploying server source files ===")
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
    """Clean old frontend assets and deploy new build."""
    print("\n=== Cleaning and deploying client/dist ===")
    remote_dist = f"{REMOTE_BASE}/client/dist"
    remote_assets = f"{remote_dist}/assets"

    # Clean old JS/CSS files in assets
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


def restart_server(ssh):
    """Restart PM2 process to pick up server source changes."""
    print("\n=== Restarting backend (PM2) ===")
    stdin, stdout, stderr = ssh.exec_command("pm2 restart ai-creation-api 2>&1")
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    if out:
        print(out[:1000])
    if err:
        print(f"STDERR: {err[:500]}")

    stdin, stdout, stderr = ssh.exec_command("sleep 3 && pm2 status 2>&1")
    print(stdout.read().decode()[:1000])


def main():
    print(f"Connecting to {HOST}...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=30)
    print("Connected!")

    sftp = ssh.open_sftp()

    # 1. Deploy server source files (download.ts, image.worker.ts)
    deploy_server_files(sftp)

    # 2. Deploy frontend dist
    clean_and_deploy_dist(sftp)

    sftp.close()

    # 3. Restart backend to pick up source changes
    restart_server(ssh)

    ssh.close()
    print("\n=== V1 Bugfix deployment complete! ===")


if __name__ == "__main__":
    main()
