/**
 * 修复生产DB：写入视频模型的 resolution_options & resolution_pricing
 * 用法: pm2 stop ai-creation-api && npx tsx server/src/db/fix-resolution.ts && pm2 start ai-creation-api
 */
import { getDb, saveDatabase } from "../db/index.js";

const db = getDb();

const updates = [
  {
    id: "doubao-seedance-2-0-260128",
    resolution_options: '["720p","1080p"]',
    resolution_pricing: '{"720p":{"5":0,"10":0,"15":0},"1080p":{"5":66,"10":127,"15":180}}',
  },
  {
    id: "doubao-seedance-2-0-fast-260128",
    resolution_options: '["720p"]',
    resolution_pricing: '{"720p":{"5":0,"10":0,"15":0}}',
  },
  {
    id: "sora-2",
    resolution_options: '["720p"]',
    resolution_pricing: '{"720p":{"4":0,"8":0,"12":0}}',
  },
  {
    id: "kling-v3-video-generation",
    resolution_options: '["720p","1080p"]',
    resolution_pricing: '{"720p":{"5":0,"10":0,"15":0},"1080p":{"5":11,"10":20,"15":29}}',
  },
];

console.log("[Fix] 开始更新 resolution_options / resolution_pricing ...");

for (const u of updates) {
  const result = db.run(
    "UPDATE ai_models SET resolution_options = ?, resolution_pricing = ? WHERE id = ?",
    [u.resolution_options, u.resolution_pricing, u.id]
  );
  console.log(`[Fix] ${u.id}: ${JSON.stringify(result)}`);
}

saveDatabase();
console.log("[Fix] 完成！数据库已保存。");
