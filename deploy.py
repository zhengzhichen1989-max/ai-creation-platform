import paramiko

host = '47.106.208.53'
user = 'root'
password = 'Czz@19890802'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, username=user, password=password, timeout=30)
sftp = client.open_sftp()

print('[1/2] Uploading shouzuo.routes.ts (Prompt电影级升级)...')
sftp.put('server/src/routes/shouzuo.routes.ts', '/app/ai-creation-platform/server/src/routes/shouzuo.routes.ts')
print('  -> OK')

print('[2/2] Restarting ai-creation-api...')
stdin, stdout, stderr = client.exec_command('pm2 restart ai-creation-api --update-env 2>&1', timeout=30)
print('  ->', stdout.read().decode().strip())

stdin, stdout, stderr = client.exec_command('pm2 list 2>&1', timeout=10)
print(stdout.read().decode())

sftp.close()
client.close()
