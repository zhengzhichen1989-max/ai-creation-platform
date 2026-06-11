"""
部署脚本：更新客服微信二维码
只上传 dist/ 静态文件，无需重启 PM2
"""
import paramiko
import os

HOST = "47.106.208.53"
PORT = 22
USER = "root"
PASS = "Czz@19890802"

LOCAL_DIST = "C:/Users/Administrator/WorkBuddy/2026-06-01-14-19-15/ai-creation-platform/client/dist"
REMOTE_DIST = "/app/ai-creation-platform/client/dist"

def upload_dir(sftp, local_dir, remote_dir):
    """递归上传目录"""
    try:
        sftp.stat(remote_dir)
    except FileNotFoundError:
        sftp.mkdir(remote_dir)

    for item in os.listdir(local_dir):
        local_path = os.path.join(local_dir, item)
        remote_path = remote_dir + "/" + item
        if os.path.isdir(local_path):
            upload_dir(sftp, local_path, remote_path)
        else:
            sftp.put(local_path, remote_path)
            print(f"  上传: {remote_path}")

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, PORT, USER, PASS)
sftp = client.open_sftp()

print("上传 dist/ ...")
upload_dir(sftp, LOCAL_DIST, REMOTE_DIST)

sftp.close()
client.close()
print("\n✅ 部署完成！二维码已更新")
