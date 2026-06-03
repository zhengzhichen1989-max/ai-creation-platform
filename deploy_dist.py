#!/usr/bin/env python3
"""Deploy frontend dist to production server via SFTP"""

import paramiko
import os
import stat

HOST = "47.106.208.53"
USER = "root"
PASSWORD = "Czz@19890802"
REMOTE_BASE = "/app/ai-creation-platform"

LOCAL_BASE = r"C:\Users\Administrator\WorkBuddy\2026-06-01-14-19-15\ai-creation-platform"
BUILD_DIR = os.path.join(LOCAL_BASE, "client", "dist")


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


def deploy_dist(sftp):
    """Deploy client build output to server."""
    print("\n=== Deploying client/dist ===")

    remote_dist = f"{REMOTE_BASE}/client/dist"
    ensure_remote_dir(sftp, remote_dist)

    count = 0
    for root, dirs, files in os.walk(BUILD_DIR):
        for fname in files:
            local_path = os.path.join(root, fname)
            rel = os.path.relpath(local_path, BUILD_DIR).replace(os.sep, "/")
            remote_path = f"{remote_dist}/{rel}"

            ensure_remote_dir(sftp, os.path.dirname(remote_path))

            sftp.put(local_path, remote_path)
            count += 1

    print(f"\nDeployed {count} files to {remote_dist}")


def main():
    print(f"Connecting to {HOST}...")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=30)
    print("Connected!")

    sftp = ssh.open_sftp()
    deploy_dist(sftp)

    sftp.close()
    ssh.close()
    print("\n=== Deployment complete! ===")


if __name__ == "__main__":
    main()
