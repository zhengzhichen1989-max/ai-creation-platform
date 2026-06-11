"""Deploy V1 frontend (without shouzuo video module) to production server."""
import paramiko
import os

HOST = '47.106.208.53'
USER = 'root'
PASSWORD = 'Czz@19890802'
REMOTE_DIR = '/app/ai-creation-platform/client/dist'
LOCAL_DIST = 'client/dist'

def upload_dir(sftp, local_dir, remote_dir):
    for root, dirs, files in os.walk(local_dir):
        for f in files:
            local_path = os.path.join(root, f)
            rel_path = os.path.relpath(local_path, local_dir).replace('\\', '/')
            remote_path = f'{remote_dir}/{rel_path}'
            remote_dirname = os.path.dirname(remote_path).replace('\\', '/')
            # ensure dirs
            parts = remote_dirname.split('/')
            for i in range(1, len(parts)):
                d = '/'.join(parts[:i+1])
                if d:
                    try:
                        sftp.mkdir(d)
                    except:
                        pass
            sftp.putfo(open(local_path, 'rb'), remote_path)
            print(f'  Uploaded: {rel_path}')

# Clean old assets on server
def clean_old_assets(ssh):
    stdin, stdout, stderr = ssh.exec_command(
        'cd /app/ai-creation-platform/client/dist/assets && ls *.js *.css 2>/dev/null'
    )
    old = stdout.read().decode().strip().split('\n')
    new_files = ['index-BbOkJgZs.js', 'index-9Ma2CBPZ.css']
    removed = [f for f in old if f and f not in new_files]
    for f in removed:
        ssh.exec_command(f'rm -f /app/ai-creation-platform/client/dist/assets/{f}')
        print(f'  Removed old: {f}')

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=30)

    print('=== Uploading V1 frontend (cleaned) ===')
    sftp = ssh.open_sftp()
    upload_dir(sftp, LOCAL_DIST, REMOTE_DIR)
    sftp.close()

    print('\n=== Cleaning old assets ===')
    clean_old_assets(ssh)

    print('\n=== Reloading Nginx ===')
    stdin, stdout, stderr = ssh.exec_command('nginx -s reload 2>&1')
    print(stdout.read().decode()[:500])

    # Also remove old server-side shouzuo frontend references if any
    stdin, stdout, stderr = ssh.exec_command(
        'ls /app/ai-creation-platform/client/dist/assets/ 2>&1'
    )
    print('\n=== Dist contents ===')
    print(stdout.read().decode()[:500])

    ssh.close()
    print('\n=== Deploy complete ===')

if __name__ == '__main__':
    main()
