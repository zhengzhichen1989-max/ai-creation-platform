import paramiko, os, sys

host = '47.106.208.53'
user = 'root'
password = 'Czz@19890802'
local_base = 'C:/Users/Administrator/WorkBuddy/2026-06-01-14-19-15/ai-creation-platform'
remote_base = '/app/ai-creation-platform'

transport = paramiko.Transport((host, 22))
transport.connect(username=user, password=password)
sftp = paramiko.SFTPClient.from_transport(transport)

def upload_dir(local_dir, remote_dir):
    """Recursively upload a local directory to remote"""
    for root, dirs, files in os.walk(local_dir):
        for f in files:
            local_path = os.path.join(root, f)
            rel_path = os.path.relpath(local_path, local_dir).replace('\\', '/')
            remote_path = f'{remote_dir}/{rel_path}'
            # ensure remote dir exists
            remote_parent = os.path.dirname(remote_path).replace('\\', '/')
            try:
                sftp.stat(remote_parent)
            except:
                parts = remote_parent.split('/')
                cur = ''
                for p in parts:
                    if not p: continue
                    cur += '/' + p
                    try:
                        sftp.stat(cur)
                    except:
                        sftp.mkdir(cur)
            try:
                sftp.put(local_path, remote_path)
            except Exception as e:
                print(f'  Error uploading {rel_path}: {e}')

# Upload server dist
print('Deploying server dist...')
upload_dir(f'{local_base}/server/dist', f'{remote_base}/server/dist')

# Upload server package.json (for dependency install)
sftp.put(f'{local_base}/server/package.json', f'{remote_base}/server/package.json')

# Upload client dist
print('Deploying client dist...')
upload_dir(f'{local_base}/client/dist', f'{remote_base}/client/dist')

sftp.close()
transport.close()

# SSH to install dependencies and restart
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, username=user, password=password)

print('\nInstalling server dependencies (including sharp)...')
stdin, stdout, stderr = client.exec_command('cd /app/ai-creation-platform/server && npm install 2>&1 | tail -5')
print(stdout.read().decode())

print('\nRestarting PM2...')
stdin, stdout, stderr = client.exec_command('pm2 restart ai-creation-api 2>&1 && pm2 status 2>&1')
print(stdout.read().decode())

client.close()
print('Deploy complete!')
