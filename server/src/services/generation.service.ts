// ============================================================
// AI创作聚合平台 - 生成历史服务（sql.js 原生SQL）
// ============================================================

import { getDb } from "../db/index.js";
import type { GenerationHistoryItem, ModelType, TaskStatus } from "../types/index.js";
import { TaskNotFoundError } from "../utils/errors.js";

/** 获取生成历史列表 */
export function listGenerations(
  userId: number,
  type?: ModelType,
  modelId?: string,
  page: number = 1,
  pageSize: number = 20
): { items: GenerationHistoryItem[]; total: number } {
  const db = getDb();
  const offset = (page - 1) * pageSize;

  let sql = `SELECT gt.id, gt.model_id, am.name as model_name, gt.type, gt.prompt, gt.result_url, gt.result_thumbnail, gt.cost_credits, gt.status, gt.expires_at, gt.created_at
    FROM generation_tasks gt
    LEFT JOIN ai_models am ON gt.model_id = am.id
    WHERE gt.user_id = ?`;
  const params: unknown[] = [userId];

  if (type) {
    sql += " AND gt.type = ?";
    params.push(type);
  }
  if (modelId) {
    sql += " AND gt.model_id = ?";
    params.push(modelId);
  }

  // 获取总数
  const countSql = sql.replace(
    /SELECT .+ FROM/,
    "SELECT COUNT(*) FROM"
  );
  const countRows = db.exec(countSql, params);
  const total = countRows.length > 0 ? (countRows[0].values[0][0] as number) : 0;

  // 获取分页数据
  sql += " ORDER BY gt.created_at DESC LIMIT ? OFFSET ?";
  const rows = db.exec(sql, [...params, pageSize, offset]);

  const items: GenerationHistoryItem[] = [];
  if (rows.length > 0) {
    for (const row of rows[0].values) {
      items.push({
        id: row[0] as string,
        modelId: row[1] as string,
        modelName: (row[2] as string) || (row[1] as string),
        type: row[3] as ModelType,
        prompt: row[4] as string,
        resultUrl: row[5] as string | null,
        resultThumbnail: row[6] as string | null,
        costCredits: row[7] as number,
        status: row[8] as TaskStatus,
        expiresAt: row[9] as string | null,
        createdAt: row[10] as string,
      });
    }
  }

  return { items, total };
}

/** 获取单条生成详情 */
export function getGeneration(taskId: string, userId: number): GenerationHistoryItem {
  const db = getDb();

  const rows = db.exec(
    `SELECT gt.id, gt.model_id, am.name as model_name, gt.type, gt.prompt, gt.result_url, gt.result_thumbnail, gt.cost_credits, gt.status, gt.expires_at, gt.created_at
    FROM generation_tasks gt
    LEFT JOIN ai_models am ON gt.model_id = am.id
    WHERE gt.id = ? AND gt.user_id = ?`,
    [taskId, userId]
  );

  if (rows.length === 0 || rows[0].values.length === 0) {
    throw new TaskNotFoundError(taskId);
  }

  const row = rows[0].values[0];
  return {
    id: row[0] as string,
    modelId: row[1] as string,
    modelName: (row[2] as string) || (row[1] as string),
    type: row[3] as ModelType,
    prompt: row[4] as string,
    resultUrl: row[5] as string | null,
    resultThumbnail: row[6] as string | null,
    costCredits: row[7] as number,
    status: row[8] as TaskStatus,
    expiresAt: row[9] as string | null,
    createdAt: row[10] as string,
  };
}
