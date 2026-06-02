// ============================================================
// AI创作聚合平台 - 管理员操作日志服务
// ============================================================

import { getDb, saveDatabase } from "../db/index.js";
import type { AdminOperationLog, AdminAction } from "../types/index.js";

/** 记录管理员操作日志 */
export function log(
  adminId: number,
  action: AdminAction | string,
  targetUserId: number | null,
  detail: Record<string, unknown>
): void {
  const db = getDb();

  const detailJson = Object.keys(detail).length > 0 ? JSON.stringify(detail) : null;

  db.run(
    "INSERT INTO admin_operation_logs (admin_id, target_user_id, action, detail) VALUES (?, ?, ?, ?)",
    [adminId, targetUserId, action, detailJson]
  );

  saveDatabase();
}

/** 查询操作日志列表（分页/筛选） */
export function listLogs(
  page: number = 1,
  pageSize: number = 20,
  action: string = "",
  adminId?: number
): { items: AdminOperationLog[]; total: number; page: number; pageSize: number } {
  const db = getDb();
  const offset = (page - 1) * pageSize;

  // 构建查询条件
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (action) {
    conditions.push("aol.action = ?");
    params.push(action);
  }

  if (adminId !== undefined) {
    conditions.push("aol.admin_id = ?");
    params.push(adminId);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // 查询总数
  const countSql = `SELECT COUNT(*) as cnt FROM admin_operation_logs aol ${whereClause}`;
  const countRows = db.exec(countSql, params);
  const total = countRows.length > 0 ? (countRows[0].values[0][0] as number) : 0;

  // 查询分页数据（JOIN users 表获取管理员邮箱）
  const dataSql = `
    SELECT aol.id, aol.admin_id, u.email, aol.target_user_id, aol.action, aol.detail, aol.created_at
    FROM admin_operation_logs aol
    LEFT JOIN users u ON aol.admin_id = u.id
    ${whereClause}
    ORDER BY aol.created_at DESC
    LIMIT ? OFFSET ?
  `;
  const dataRows = db.exec(dataSql, [...params, pageSize, offset]);

  const items: AdminOperationLog[] = [];
  if (dataRows.length > 0) {
    for (const row of dataRows[0].values) {
      items.push({
        id: row[0] as number,
        adminId: row[1] as number,
        adminEmail: row[2] as string,
        targetUserId: row[3] as number | null,
        action: row[4] as string,
        detail: row[5] as string | null,
        createdAt: row[6] as string,
      });
    }
  }

  return { items, total, page, pageSize };
}
