// ============================================================
// AI创作聚合平台 - 过期清理服务
// ============================================================

import { getDb, saveDatabase } from "../db/index.js";

/** 清理过期的生成结果（将 result_url 和 result_thumbnail 清空） */
export function cleanExpiredResults(): { cleaned: number } {
  const db = getDb();
  const now = new Date().toISOString().replace("T", " ").replace(/\.\d+Z$/, "");

  db.run(
    `UPDATE generation_tasks
     SET result_url = NULL, result_thumbnail = NULL
     WHERE expires_at IS NOT NULL
       AND expires_at < ?
       AND result_url IS NOT NULL`,
    [now]
  );

  const cleaned = db.getRowsModified();
  if (cleaned > 0) {
    saveDatabase();
  }

  return { cleaned };
}
