// ============================================================
// AI创作聚合平台 - 任务服务（sql.js 原生SQL）
// ============================================================

import { v4 as uuidv4 } from "uuid";
import { getDb, saveDatabase } from "../db/index.js";
import type { GenerationTaskInfo, TaskStatus, ModelType, GenerateParams } from "../types/index.js";
import { ModelNotFoundError, TaskNotFoundError, InsufficientCreditsError, TaskCannotCancelError } from "../utils/errors.js";
import * as creditsService from "./credits.service.js";

/** 创建生成任务 */
export function createTask(
  userId: number,
  modelId: string,
  prompt: string,
  params?: GenerateParams,
  duration?: number
): GenerationTaskInfo {
  const db = getDb();

  // 1. 查询模型信息
  const modelRows = db.exec(
    "SELECT id, name, type, cost_credits, duration_options, duration_pricing FROM ai_models WHERE id = ? AND enabled = 1",
    [modelId]
  );
  if (modelRows.length === 0 || modelRows[0].values.length === 0) {
    throw new ModelNotFoundError(modelId);
  }

  const modelRow = modelRows[0].values[0];
  const modelType = modelRow[2] as string;
  let costCredits = modelRow[3] as number;

  // 如果是视频模型且传了 duration，根据时长定价覆盖积分
  if (modelType === "video" && duration !== undefined) {
    const durationPricingStr = modelRow[5] as string | null;
    if (durationPricingStr) {
      const durationPricing: Record<string, number> = JSON.parse(durationPricingStr);
      if (durationPricing[String(duration)] !== undefined) {
        costCredits = durationPricing[String(duration)];
      } else {
        throw new Error(`不支持的视频时长: ${duration}秒`);
      }
    }
  }

  // 2. 检查积分余额
  const balanceInfo = creditsService.getBalance(userId);
  if (balanceInfo.balance < costCredits) {
    throw new InsufficientCreditsError();
  }

  // 3. 生成任务ID
  const taskId = uuidv4();
  const paramsJson = params ? JSON.stringify(params) : null;
  const now = new Date().toISOString().replace("T", " ").replace(/\.\d+Z$/, "");

  // 4. 原子扣减积分 + 创建任务（事务）
  db.run("BEGIN TRANSACTION");
  try {
    // 读取积分账户
    const accountRows = db.exec(
      "SELECT balance, version FROM credit_accounts WHERE user_id = ?",
      [userId]
    );
    if (accountRows.length === 0 || accountRows[0].values.length === 0) {
      throw new InsufficientCreditsError("积分账户不存在");
    }

    const account = accountRows[0].values[0];
    const balance = account[0] as number;
    const version = account[1] as number;

    if (balance < costCredits) {
      throw new InsufficientCreditsError();
    }

    const newBalance = balance - costCredits;
    const newVersion = version + 1;

    // 乐观锁更新
    db.run(
      "UPDATE credit_accounts SET balance = ?, version = ?, updated_at = datetime('now') WHERE user_id = ? AND version = ?",
      [newBalance, newVersion, userId, version]
    );

    const changes = db.getRowsModified();
    if (changes === 0) {
      throw new InsufficientCreditsError("积分扣减失败，请重试");
    }

    // 记录流水
    db.run(
      "INSERT INTO credit_transactions (user_id, type, amount, balance_after, reference_id, description) VALUES (?, 'consume', ?, ?, ?, ?)",
      [userId, costCredits, newBalance, taskId, `${modelRow[1]}生成消费`]
    );

    // 创建任务
    db.run(
      "INSERT INTO generation_tasks (id, user_id, model_id, type, prompt, params, status, cost_credits, progress) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, 0)",
      [taskId, userId, modelId, modelType, prompt, paramsJson, costCredits]
    );

    db.run("COMMIT");
  } catch (err) {
    db.run("ROLLBACK");
    throw err;
  }

  saveDatabase();

  return {
    id: taskId,
    userId,
    modelId,
    type: modelType as ModelType,
    prompt,
    params: paramsJson,
    status: "pending",
    costCredits,
    resultUrl: null,
    resultThumbnail: null,
    errorMessage: null,
    progress: 0,
    startedAt: null,
    completedAt: null,
    expiresAt: null,
    createdAt: now,
  };
}

/** 获取任务详情 */
export function getTask(taskId: string, userId?: number): GenerationTaskInfo {
  const db = getDb();

  let sql = "SELECT id, user_id, model_id, type, prompt, params, status, cost_credits, result_url, result_thumbnail, error_message, progress, started_at, completed_at, expires_at, created_at FROM generation_tasks WHERE id = ?";
  const params: unknown[] = [taskId];

  if (userId) {
    sql += " AND user_id = ?";
    params.push(userId);
  }

  const rows = db.exec(sql, params);
  if (rows.length === 0 || rows[0].values.length === 0) {
    throw new TaskNotFoundError(taskId);
  }

  return rowToTaskInfo(rows[0].values[0]);
}

/** 获取任务列表 */
export function listTasks(
  userId: number,
  status?: TaskStatus,
  type?: ModelType,
  page: number = 1,
  pageSize: number = 20
): { items: GenerationTaskInfo[]; total: number } {
  const db = getDb();
  const offset = (page - 1) * pageSize;

  let sql = "SELECT id, user_id, model_id, type, prompt, params, status, cost_credits, result_url, result_thumbnail, error_message, progress, started_at, completed_at, expires_at, created_at FROM generation_tasks WHERE user_id = ?";
  const params: unknown[] = [userId];

  if (status) {
    sql += " AND status = ?";
    params.push(status);
  }
  if (type) {
    sql += " AND type = ?";
    params.push(type);
  }

  // 获取总数
  const countSql = sql.replace(
    "SELECT id, user_id, model_id, type, prompt, params, status, cost_credits, result_url, result_thumbnail, error_message, progress, started_at, completed_at, expires_at, created_at",
    "SELECT COUNT(*)"
  );
  const countRows = db.exec(countSql, params);
  const total = countRows.length > 0 ? (countRows[0].values[0][0] as number) : 0;

  // 获取分页数据
  sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
  const rows = db.exec(sql, [...params, pageSize, offset]);

  const items: GenerationTaskInfo[] = [];
  if (rows.length > 0) {
    for (const row of rows[0].values) {
      items.push(rowToTaskInfo(row));
    }
  }

  return { items, total };
}

/** 取消任务 */
export function cancelTask(taskId: string, userId: number): void {
  const db = getDb();

  const rows = db.exec(
    "SELECT status, cost_credits FROM generation_tasks WHERE id = ? AND user_id = ?",
    [taskId, userId]
  );

  if (rows.length === 0 || rows[0].values.length === 0) {
    throw new TaskNotFoundError(taskId);
  }

  const task = rows[0].values[0];
  const status = task[0] as string;
  const costCredits = task[1] as number;

  // 只有 pending 状态可以取消
  if (status !== "pending") {
    throw new TaskCannotCancelError("只有等待中的任务可以取消");
  }

  // 更新状态 + 退还积分（事务）
  db.run("BEGIN TRANSACTION");
  try {
    db.run("UPDATE generation_tasks SET status = 'cancelled' WHERE id = ?", [taskId]);

    // 读取积分账户
    const accountRows = db.exec("SELECT balance, version FROM credit_accounts WHERE user_id = ?", [userId]);
    if (accountRows.length > 0 && accountRows[0].values.length > 0) {
      const account = accountRows[0].values[0];
      const balance = account[0] as number;
      const version = account[1] as number;

      const newBalance = balance + costCredits;
      const newVersion = version + 1;

      db.run(
        "UPDATE credit_accounts SET balance = ?, version = ?, updated_at = datetime('now') WHERE user_id = ? AND version = ?",
        [newBalance, newVersion, userId, version]
      );

      db.run(
        "INSERT INTO credit_transactions (user_id, type, amount, balance_after, reference_id, description) VALUES (?, 'refund', ?, ?, ?, '取消任务退还积分')",
        [userId, costCredits, newBalance, taskId]
      );
    }

    db.run("COMMIT");
  } catch (err) {
    db.run("ROLLBACK");
    throw err;
  }

  saveDatabase();
}

/** 更新任务状态 */
export function updateTaskStatus(
  taskId: string,
  status: TaskStatus,
  updates?: {
    resultUrl?: string;
    resultThumbnail?: string;
    errorMessage?: string;
    progress?: number;
    expiresAt?: string;
  }
): void {
  const db = getDb();

  const setClauses: string[] = ["status = ?"];
  const params: unknown[] = [status];

  if (updates?.resultUrl !== undefined) {
    setClauses.push("result_url = ?");
    params.push(updates.resultUrl);
  }
  if (updates?.resultThumbnail !== undefined) {
    setClauses.push("result_thumbnail = ?");
    params.push(updates.resultThumbnail);
  }
  if (updates?.errorMessage !== undefined) {
    setClauses.push("error_message = ?");
    params.push(updates.errorMessage);
  }
  if (updates?.progress !== undefined) {
    setClauses.push("progress = ?");
    params.push(updates.progress);
  }
  if (updates?.expiresAt !== undefined) {
    setClauses.push("expires_at = ?");
    params.push(updates.expiresAt);
  }

  if (status === "processing") {
    setClauses.push("started_at = datetime('now')");
  }
  if (status === "completed" || status === "failed") {
    setClauses.push("completed_at = datetime('now')");
  }

  params.push(taskId);

  db.run(
    `UPDATE generation_tasks SET ${setClauses.join(", ")} WHERE id = ?`,
    params
  );

  saveDatabase();
}

// ---- 内部辅助函数 ----

function rowToTaskInfo(row: (string | number | null | Uint8Array)[]): GenerationTaskInfo {
  return {
    id: row[0] as string,
    userId: row[1] as number,
    modelId: row[2] as string,
    type: row[3] as ModelType,
    prompt: row[4] as string,
    params: row[5] as string | null,
    status: row[6] as TaskStatus,
    costCredits: row[7] as number,
    resultUrl: row[8] as string | null,
    resultThumbnail: row[9] as string | null,
    errorMessage: row[10] as string | null,
    progress: (row[11] as number) ?? 0,
    startedAt: row[12] as string | null,
    completedAt: row[13] as string | null,
    expiresAt: row[14] as string | null,
    createdAt: row[15] as string,
  };
}
