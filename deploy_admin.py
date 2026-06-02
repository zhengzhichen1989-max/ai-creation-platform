#!/usr/bin/env python3
"""Deploy admin user management module to production server via SFTP"""

import paramiko
import os
import stat

HOST = "47.106.208.53"
USER = "root"
PASSWORD = "Czz@19890802"
REMOTE_BASE = "/app/ai-creation-platform"

LOCAL_BASE = r"C:\Users\Administrator\WorkBuddy\2026-06-01-14-19-15\ai-creation-platform"

# All files to deploy (relative to project root)
FILES = [
    # Server - modified
    "server/src/db/migrate.ts",
    "server/src/db/schema.ts",
    "server/src/types/index.ts",
    "server/src/utils/errors.ts",
    "server/src/middleware/auth.middleware.ts",
    "server/src/services/credits.service.ts",
    "server/src/services/auth.service.ts",
    "server/src/routes/admin.routes.ts",
    "server/src/routes/auth.routes.ts",
    # Server - new
    "server/src/services/admin-user.service.ts",
    "server/src/services/admin-operation-log.service.ts",
    # Client - modified
    "client/src/api/admin.ts",
    "client/src/api/auth.ts",
    "client/src/pages/AdminPage.tsx",
    "client/src/pages/RegisterPage.tsx",
    "client/src/router.tsx",
    # Client - new
    "client/src/pages/admin/UserListTab.tsx",
    "client/src/pages/admin/UserDetailDialog.tsx",
    "client/src/pages/admin/CreditTopupDialog.tsx",
    "client/src/pages/admin/ResetPasswordDialog.tsx",
    "client/src/pages/admin/TransactionListDialog.tsx",
    "client/src/pages/admin/BatchTopupDialog.tsx",
    "client/src/pages/admin/OperationLogTab.tsx",
    "client/src/pages/ResetPasswordPage.tsx",
    "client/src/pages/ForgotPasswordPage.tsx",
    # Also deploy previously modified files that may not be on server yet
    "client/src/components/ErrorBoundary.tsx",
    "client/src/components/ImageUpload/ImageUpload.tsx",
    "client/src/main.tsx",
    "client/src/pages/WorkspacePage.tsx",
    "server/src/adapters/dmxapi-text.adapter.ts",
    "server/src/queue/text.worker.ts",
]

# Build output
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


def deploy_source_files(sftp):
    """Deploy source files to server."""
    print("\n=== Deploying source files ===")
    for rel_path in FILES:
        local_path = os.path.join(LOCAL_BASE, rel_path.replace("/", os.sep))
        remote_path = f"{REMOTE_BASE}/{rel_path}"

        if not os.path.exists(local_path):
            print(f"  SKIP (not found): {rel_path}")
            continue

        # Ensure remote directory exists
        remote_dir = os.path.dirname(remote_path)
        ensure_remote_dir(sftp, remote_dir)

        sftp.put(local_path, remote_path)
        print(f"  OK: {rel_path}")

    print(f"\nDeployed {len(FILES)} source files")


def deploy_build_output(sftp):
    """Deploy client build output to server."""
    print("\n=== Deploying client build output ===")

    remote_dist = f"{REMOTE_BASE}/client/dist"
    # Ensure dist dirs exist
    ensure_remote_dir(sftp, remote_dist)
    ensure_remote_dir(sftp, f"{remote_dist}/assets")

    count = 0
    for root, dirs, files in os.walk(BUILD_DIR):
        for fname in files:
            local_path = os.path.join(root, fname)
            rel = os.path.relpath(local_path, BUILD_DIR).replace(os.sep, "/")
            remote_path = f"{remote_dist}/{rel}"

            # Ensure parent dir
            ensure_remote_dir(sftp, os.path.dirname(remote_path))

            sftp.put(local_path, remote_path)
            print(f"  OK: dist/{rel}")
            count += 1

    print(f"\nDeployed {count} build output files")


def rebuild_and_restart(ssh):
    """Rebuild server TypeScript and restart PM2."""
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

    # 1. Deploy source files
    deploy_source_files(sftp)

    # 2. Deploy build output
    deploy_build_output(sftp)

    # 3. Rebuild and restart
    rebuild_and_restart(ssh)

    sftp.close()
    ssh.close()
    print("\n=== Deployment complete! ===")


if __name__ == "__main__":
    main()
