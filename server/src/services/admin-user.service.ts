// ============================================================
// AI创作聚合平台 - 管理员用户管理服务
// ============================================================

import { getDb, saveDatabase } from "../db/index.js";
import type { AdminUserListItem, AdminUserDetail, BatchTopupResult } from "../types/index.js";
import { UserNotFoundError, ValidationError } from "../utils/errors.js";
import { v4 as uuidv4 } from "uuid";
import * as adminOperationLogService from "./admin-operation-log.service.js";
import * as creditsService from "./credits.service.js";

/** 获取用户列表（分页/搜索/筛选） */
export function listUsers(
  page: number = 1,
  pageSize: number = 20,
  search: string = "",
  status: string = "",
  role: string = ""
): { items: AdminUserListItem[]; total: number; page: number; pageSize: number } {
  const db = getDb();
  const offset = (page - 1) * pageSize;

  // 构建查询条件
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (search) {
    conditions.push("(u.email LIKE ? OR u.nickname LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }

  if (status) {
    conditions.push("u.status = ?");
    params.push(status);
  }

  if (role) {
    conditions.push("u.role = ?");
    params.push(role);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // 查询总数
  const countSql = `SELECT COUNT(*) as cnt FROM users u ${whereClause}`;
  const countRows = db.exec(countSql, params);
  const total = countRows.length > 0 ? (countRows[0].values[0][0] as number) : 0;

  // 查询分页数据（LEFT JOIN 积分账户获取余额）
  const dataSql = `
    SELECT u.id, u.email, u.nickname, u.avatar_url, u.role, u.status,
           COALESCE(ca.balance, 0) as credit_balance, u.created_at
    FROM users u
    LEFT JOIN credit_accounts ca ON u.id = ca.user_id
    ${whereClause}
    ORDER BY u.created_at DESC
    LIMIT ? OFFSET ?
  `;
  const dataRows = db.exec(dataSql, [...params, pageSize, offset]);

  const items: AdminUserListItem[] = [];
  if (dataRows.length > 0) {
    for (const row of dataRows[0].values) {
      items.push({
        id: row[0] as number,
        email: row[1] as string,
        nickname: row[2] as string,
        avatarUrl: row[3] as string | null,
        role: row[4] as string,
        status: row[5] as string,
        creditBalance: row[6] as number,
        createdAt: row[7] as string,
      });
    }
  }

  return { items, total, page, pageSize };
}

/** 获取用户详情 */
export function getUserDetail(userId: number): AdminUserDetail {
  const db = getDb();

  const rows = db.exec(
    `SELECT u.id, u.email, u.nickname, u.avatar_url, u.role, u.status,
            u.security_question, COALESCE(ca.balance, 0), COALESCE(ca.version, 0),
            u.created_at, u.updated_at
     FROM users u
     LEFT JOIN credit_accounts ca ON u.id = ca.user_id
     WHERE u.id = ?`,
    [userId]
  );

  if (rows.length === 0 || rows[0].values.length === 0) {
    throw new UserNotFoundError(userId);
  }

  const row = rows[0].values[0];
  return {
    id: row[0] as number,
    email: row[1] as string,
    nickname: row[2] as string,
    avatarUrl: row[3] as string | null,
    role: row[4] as string,
    status: row[5] as string,
    securityQuestion: row[6] as string | null,
    creditBalance: row[7] as number,
    creditVersion: row[8] as number,
    createdAt: row[9] as string,
    updatedAt: row[10] as string,
  };
}

/** 更新用户状态（禁用/启用） */
export function updateUserStatus(userId: number, status: string, adminId: number): AdminUserDetail {
  const db = getDb();

  // 检查用户是否存在
  const userRows = db.exec("SELECT id, role FROM users WHERE id = ?", [userId]);
  if (userRows.length === 0 || userRows[0].values.length === 0) {
    throw new UserNotFoundError(userId);
  }

  const userRole = userRows[0].values[0][1] as string;

  // 不允许禁用管理员账户
  if (userRole === "admin" && status === "disabled") {
    throw new ValidationError("不能禁用管理员账户");
  }

  // 更新状态
  db.run("UPDATE users SET status = ?, updated_at = datetime('now') WHERE id = ?", [status, userId]);
  saveDatabase();

  // 记录操作日志
  const action = status === "disabled" ? "disable_user" : "enable_user";
  adminOperationLogService.log(adminId, action, userId, { status });

  return getUserDetail(userId);
}

/** 生成密码重置Token */
export function generateResetToken(userId: number, adminId: number): { token: string; resetUrl: string } {
  const db = getDb();

  // 检查用户是否存在
  const userRows = db.exec("SELECT id, email FROM users WHERE id = ?", [userId]);
  if (userRows.length === 0 || userRows[0].values.length === 0) {
    throw new UserNotFoundError(userId);
  }

  const token = uuidv4();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000)
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d+Z$/, "");

  db.run(
    "INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
    [userId, token, expiresAt]
  );

  saveDatabase();

  // 记录操作日志
  adminOperationLogService.log(adminId, "reset_password", userId, {});

  const resetUrl = `/reset-password?token=${token}`;
  return { token, resetUrl };
}

/** 批量充值 */
export function batchTopup(
  userIds: number[],
  amount: number,
  description: string,
  adminId: number,
  adminEmail: string
): BatchTopupResult {
  let successCount = 0;
  let failCount = 0;

  for (const userId of userIds) {
    try {
      // 检查用户是否存在且状态正常
      const userRows = db_getUserStatus(userId);
      if (!userRows) {
        failCount++;
        continue;
      }

      creditsService.adminTopup(userId, amount, description, adminEmail);
      adminOperationLogService.log(adminId, "batch_topup", userId, { amount, description });
      successCount++;
    } catch {
      failCount++;
    }
  }

  return { successCount, failCount };
}

/** 删除用户账号及关联数据 */
export function deleteUser(userId: number, adminId: number): void {
  const db = getDb();

  // 检查用户是否存在
  const userRows = db.exec("SELECT id, role, email FROM users WHERE id = ?", [userId]);
  if (userRows.length === 0 || userRows[0].values.length === 0) {
    throw new UserNotFoundError(userId);
  }

  const userRole = userRows[0].values[0][1] as string;
  const userEmail = userRows[0].values[0][2] as string;

  // 不允许删除管理员账户（自我保护）
  if (userRole === "admin") {
    throw new ValidationError("不能删除管理员账户");
  }

  // 临时关闭外键约束，以便按任意顺序删除关联数据
  db.run("PRAGMA foreign_keys = OFF");

  try {
    // 删除关联数据（按照依赖关系，先删除引用 users 的子表记录）
    db.run("DELETE FROM credit_transactions WHERE user_id = ?", [userId]);
    db.run("DELETE FROM credit_accounts WHERE user_id = ?", [userId]);
    db.run("DELETE FROM generation_tasks WHERE user_id = ?", [userId]);
    db.run("DELETE FROM password_reset_tokens WHERE user_id = ?", [userId]);
    db.run("DELETE FROM shouzuo_sessions WHERE user_id = ?", [userId]);
    db.run("DELETE FROM orders WHERE user_id = ?", [userId]);
    // 操作日志中 target_user_id 引用该用户，置为 NULL 保留日志
    db.run("UPDATE admin_operation_logs SET target_user_id = NULL WHERE target_user_id = ?", [userId]);
    // 最后删除用户本身
    db.run("DELETE FROM users WHERE id = ?", [userId]);
  } finally {
    // 恢复外键约束
    db.run("PRAGMA foreign_keys = ON");
  }

  saveDatabase();

  // 记录操作日志（在用户删除之后，adminId 仍然存在）
  adminOperationLogService.log(adminId, "delete_user", null, {
    deletedUserId: userId,
    deletedUserEmail: userEmail,
  });
}

/** 内部辅助：检查用户是否存在 */
function db_getUserStatus(userId: number): boolean {
  const db = getDb();
  const rows = db.exec("SELECT id FROM users WHERE id = ?", [userId]);
  return rows.length > 0 && rows[0].values.length > 0;
}
