#!/usr/bin/env python3
"""
fix_resolution.py - 修复生产DB的分辨率字段 + 上传前端dist
用法: python3 fix_resolution.py
"""
import paramiko
import os
import json

# ============================================================
# 配置
# ============================================================
SERVER = {
    'host': '47.106.208.53',
    'user': 'root',
    'passwd': 'Czz@19890802',
}
DB_PATH = '/app/ai-creation-platform/data/ai-creation.db'
LOCAL_DIST = r'C:\Users\Administrator\WorkBuddy\2026-06-01-14-19-15\ai-creation-platform\client\dist'
REMOTE_DIST = '/app/ai-creation-platform/client/dist'

# 要更新的数据（注意ID必须完全匹配）
UPDATES = [
    {
        'id': 'doubao-seedance-2-0-260128',
        'resolution_options': '["720p","1080p"]',
        'resolution_pricing': '{"720p":{"5":0,"10":0,"15":0},"1080p":{"5":66,"10":127,"15":180}}',
    },
    {
        'id': 'doubao-seedance-2-0-fast-260128',
        'resolution_options': '["720p"]',
        'resolution_pricing': '{"720p":{"5":0,"10":0,"15":0}}',
    },
    {
        'id': 'sora-2',
        'resolution_options': '["720p"]',
        'resolution_pricing': '{"720p":{"4":0,"8":0,"12":0}}',
    },
    {
        'id': 'kling-v3-video-generation',
        'resolution_options': '["720p","1080p"]',
        'resolution_pricing': '{"720p":{"5":0,"10":0,"15":0},"1080p":{"5":11,"10":20,"15":29}}',
    },
]

# ============================================================
# 连接SSH
# ============================================================
print("[1/5] 连接服务器...")
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(SERVER['host'], username=SERVER['user'], password=SERVER['passwd'], timeout=15, allow_agent=False, look_for_keys=False)
print("  连接成功！")

# ============================================================
# 停止PM2
# ============================================================
print("[2/5] 停止 PM2...")
stdin, stdout, stderr = ssh.exec_command('cd /app/ai-creation-platform && pm2 stop ai-creation-api')
print("  ", stdout.read().decode().strip())

# ============================================================
# 修复DB
# ============================================================
print("[3/5] 修复数据库 resolution 字段...")

# 生成修复脚本内容
fix_js = "const fs = require('fs');\n"
fix_js += "const initSqlJs = require('sql.js');\n"
fix_js += "initSqlJs().then(SQL => {\n"
fix_js += "  const dbPath = '" + DB_PATH + "';\n"
fix_js += "  const buf = fs.readFileSync(dbPath);\n"
fix_js += "  const db = new SQL.Database(buf);\n"
fix_js += "  const updates = " + json.dumps(UPDATES) + ";\n"
fix_js += "  for (const u of updates) {\n"
fix_js += "    db.run('UPDATE ai_models SET resolution_options = ?, resolution_pricing = ? WHERE id = ?', [u.resolution_options, u.resolution_pricing, u.id]);\n"
fix_js += "    console.log('Updated: ' + u.id);\n"
fix_js += "  }\n"
fix_js += "  const data = db.export();\n"
fix_js += "  fs.writeFileSync(dbPath, Buffer.from(data));\n"
fix_js += "  db.close();\n"
fix_js += "  console.log('DB saved!');\n"
fix_js += "});\n"

# 上传修复脚本
sftp = ssh.open_sftp()
with sftp.open('/tmp/fix-res.js', 'w') as f:
    f.write(fix_js)
sftp.close()

# 执行修复脚本
stdin, stdout, stderr = ssh.exec_command('node /tmp/fix-res.js')
out = stdout.read().decode()
err = stderr.read().decode()
print("  DB修复输出:", out)
if err:
    print("  DB修复错误:", err)

# 验证
stdin, stdout, stderr = ssh.exec_command(
    "node -e \"const fs=require('fs');const i=require('sql.js');i().then(S=>{"
    "const d=new S.Database(fs.readFileSync('" + DB_PATH + "'));"
    "const r=d.exec('SELECT id,resolution_options,resolution_pricing FROM ai_models WHERE type=\\'video\\'');"
    "console.log(JSON.stringify(r));d.close();});\""
)
out = stdout.read().decode()
print("  验证结果:", out[:500])

# ============================================================
# 上传前端dist
# ============================================================
print("[4/5] 上传前端 dist/ ...")

def sftp_put_dir(sftp, local_dir, remote_dir):
    """递归上传目录"""
    if not os.path.exists(local_dir):
        print(f"  警告: 本地目录不存在: {local_dir}")
        return
    try:
        sftp.mkdir(remote_dir)
    except Exception:
        pass
    os.chdir(os.path.split(local_dir)[0])
    for item in os.listdir(local_dir):
        local_path = os.path.join(local_dir, item)
        remote_path = remote_dir + "/" + item
        if os.path.isfile(local_path):
            sftp.put(local_path, remote_path)
        else:
            sftp_put_dir(sftp, local_path, remote_path)

sftp = ssh.open_sftp()
sftp_put_dir(sftp, LOCAL_DIST, REMOTE_DIST)
sftp.close()
print("  前端上传完成！")

# ============================================================
# 重启PM2
# ============================================================
print("[5/5] 重启 PM2...")
stdin, stdout, stderr = ssh.exec_command('cd /app/ai-creation-platform && pm2 start ai-creation-api')
print("  ", stdout.read().decode().strip())

# 清理
ssh.exec_command('rm /tmp/fix-res.js')
ssh.close()

print("\n✅ 全部完成！请刷新浏览器 http://47.106.208.53 查看分辨率选项。")
