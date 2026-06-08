/**
 * fix-resolution.js
 * 修复生产DB：写入视频模型的 resolution_options & resolution_pricing
 * 用法: node -e "require('fs'); const db=require('sql.js').Database; ..."
 * 更简单: 直接在服务器上用 node 跑这段
 */

// 直接用 sql.js 操作生产数据库
const path = require('path');
const fs = require('fs');

// sql.js 需要初始化
const initSqlJs = require('sql.js');

(async () => {
  const SQL = await initSqlJs();
  
  // 生产数据库绝对路径
  const dbPath = '/app/ai-creation-platform/data/ai-creation.db';
  
  if (!fs.existsSync(dbPath)) {
    console.error('DB file not found:', dbPath);
    process.exit(1);
  }
  
  const buf = fs.readFileSync(dbPath);
  const db = new SQL.Database(buf);
  
  const updates = [
    {
      id: 'doubao-seedance-2-0-260128',
      resolution_options: '["720p","1080p"]',
      resolution_pricing: '{"720p":{"5":0,"10":0,"15":0},"1080p":{"5":66,"10":127,"15":180}}',
    },
    {
      id: 'doubao-seedance-2-0-fast-260128',
      resolution_options: '["720p"]',
      resolution_pricing: '{"720p":{"5":0,"10":0,"15":0}}',
    },
    {
      id: 'sora-2',
      resolution_options: '["720p"]',
      resolution_pricing: '{"720p":{"4":0,"8":0,"12":0}}',
    },
    {
      id: 'kling-v3-video-generation',
      resolution_options: '["720p","1080p"]',
      resolution_pricing: '{"720p":{"5":0,"10":0,"15":0},"1080p":{"5":11,"10":20,"15":29}}',
    },
  ];
  
  console.log('[Fix] 开始更新 resolution_options / resolution_pricing ...');
  
  for (const u of updates) {
    const stmt = db.prepare('UPDATE ai_models SET resolution_options = ?, resolution_pricing = ? WHERE id = ?');
    stmt.run([u.resolution_options, u.resolution_pricing, u.id]);
    stmt.free();
    console.log(`[Fix] ${u.id}: OK`);
  }
  
  // 保存
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
  
  db.close();
  console.log('[Fix] 完成！数据库已保存到', dbPath);
})();
