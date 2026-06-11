// ============================================================
// AI创作聚合平台 - 积分服务（乐观锁扣减，sql.js 原生SQL）
// ============================================================

import { getDb, saveDatabase } from "../db/index.js";
import type { CreditsBalance, CreditTransactionInfo, TransactionType } from "../types/index.js";
import { InsufficientCreditsError, OptimisticLockError } from "../utils/errors.js";

/** 乐观锁最大重试次数 */
const MAX_RETRIES = 3;

/** 获取用户积分余额 */
export function getBalance(userId: number): CreditsBalance {
  const db = getDb();
  const rows = db.exec("SELECT user_id, balance FROM credit_accounts WHERE user_id = ?", [userId]);
  if (rows.length === 0 || rows[0].values.length === 0) {
    return { userId, balance: 0 };
  }
  const row = rows[0].values[0];
  return { userId: row[0] as number, balance: row[1] as number };
}

/** 积分扣减（乐观锁，原子操作） */
export function deduct(
  userId: number,
  amount: number,
  referenceId: string,
  description: string
): CreditTransactionInfo {
  if (amount <= 0) {
    throw new Error("扣减金额必须为正数");
  }

  const db = getDb();

  for (let retry = 0; retry < MAX_RETRIES; retry++) {
    // 1. 读取当前余额和版本号
    const rows = db.exec("SELECT balance, version FROM credit_accounts WHERE user_id = ?", [userId]);
    if (rows.length === 0 || rows[0].values.length === 0) {
      throw new InsufficientCreditsError("积分账户不存在");
    }

    const account = rows[0].values[0];
    const balance = account[0] as number;
    const version = account[1] as number;

    // 2. 检查余额是否充足
    if (balance < amount) {
      throw new InsufficientCreditsError();
    }

    const newBalance = balance - amount;
    const newVersion = version + 1;

    // 3. 使用乐观锁更新（WHERE version = 旧版本号）
    db.run(
      "UPDATE credit_accounts SET balance = ?, version = ?, updated_at = datetime('now') WHERE user_id = ? AND version = ?",
      [newBalance, newVersion, userId, version]
    );

    // 检查是否更新成功
    const changesResult = db.getRowsModified();
    if (changesResult === 0) {
      // 乐观锁冲突，重试
      continue;
    }

    // 4. 记录流水
    db.run(
      "INSERT INTO credit_transactions (user_id, type, amount, balance_after, reference_id, description) VALUES (?, 'consume', ?, ?, ?, ?)",
      [userId, amount, newBalance, referenceId, description]
    );

    // 获取最后插入ID
    const lastIdResult = db.exec("SELECT last_insert_rowid()");
    const lastId = lastIdResult[0].values[0][0] as number;

    saveDatabase();

    return {
      id: lastId,
      userId,
      type: "consume",
      amount,
      balanceAfter: newBalance,
      referenceId,
      description,
      createdAt: new Date().toISOString(),
    };
  }

  throw new OptimisticLockError("积分扣减冲突，请重试");
}

/** 积分充值（乐观锁，原子操作） */
export function topUp(
  userId: number,
  amount: number,
  referenceId: string,
  description: string
): CreditTransactionInfo {
  if (amount <= 0) {
    throw new Error("充值金额必须为正数");
  }

  const db = getDb();

  for (let retry = 0; retry < MAX_RETRIES; retry++) {
    const rows = db.exec("SELECT balance, version FROM credit_accounts WHERE user_id = ?", [userId]);
    if (rows.length === 0 || rows[0].values.length === 0) {
      throw new Error("积分账户不存在");
    }

    const account = rows[0].values[0];
    const balance = account[0] as number;
    const version = account[1] as number;

    const newBalance = balance + amount;
    const newVersion = version + 1;

    db.run(
      "UPDATE credit_accounts SET balance = ?, version = ?, updated_at = datetime('now') WHERE user_id = ? AND version = ?",
      [newBalance, newVersion, userId, version]
    );

    const changesResult = db.getRowsModified();
    if (changesResult === 0) {
      continue;
    }

    db.run(
      "INSERT INTO credit_transactions (user_id, type, amount, balance_after, reference_id, description) VALUES (?, 'purchase', ?, ?, ?, ?)",
      [userId, amount, newBalance, referenceId, description]
    );

    const lastIdResult = db.exec("SELECT last_insert_rowid()");
    const lastId = lastIdResult[0].values[0][0] as number;

    saveDatabase();

    return {
      id: lastId,
      userId,
      type: "purchase",
      amount,
      balanceAfter: newBalance,
      referenceId,
      description,
      createdAt: new Date().toISOString(),
    };
  }

  throw new OptimisticLockError("积分充值冲突，请重试");
}

/** 积分退还（乐观锁，原子操作） */
export function refund(
  userId: number,
  amount: number,
  referenceId: string,
  description: string
): CreditTransactionInfo {
  if (amount <= 0) {
    throw new Error("退还金额必须为正数");
  }

  const db = getDb();

  for (let retry = 0; retry < MAX_RETRIES; retry++) {
    const rows = db.exec("SELECT balance, version FROM credit_accounts WHERE user_id = ?", [userId]);
    if (rows.length === 0 || rows[0].values.length === 0) {
      throw new Error("积分账户不存在");
    }

    const account = rows[0].values[0];
    const balance = account[0] as number;
    const version = account[1] as number;

    const newBalance = balance + amount;
    const newVersion = version + 1;

    db.run(
      "UPDATE credit_accounts SET balance = ?, version = ?, updated_at = datetime('now') WHERE user_id = ? AND version = ?",
      [newBalance, newVersion, userId, version]
    );

    const changesResult = db.getRowsModified();
    if (changesResult === 0) {
      continue;
    }

    db.run(
      "INSERT INTO credit_transactions (user_id, type, amount, balance_after, reference_id, description) VALUES (?, 'refund', ?, ?, ?, ?)",
      [userId, amount, newBalance, referenceId, description]
    );

    const lastIdResult = db.exec("SELECT last_insert_rowid()");
    const lastId = lastIdResult[0].values[0][0] as number;

    saveDatabase();

    return {
      id: lastId,
      userId,
      type: "refund",
      amount,
      balanceAfter: newBalance,
      referenceId,
      description,
      createdAt: new Date().toISOString(),
    };
  }

  throw new OptimisticLockError("积分退还冲突，请重试");
}

/** 管理员手动充值（乐观锁，原子操作） */
export function adminTopup(
  userId: number,
  amount: number,
  description: string,
  adminEmail: string
): CreditTransactionInfo {
  if (amount <= 0) {
    throw new Error("充值金额必须为正数");
  }

  if (amount > 100000) {
    throw new Error("单次充值上限100,000积分");
  }

  const db = getDb();
  const fullDescription = `管理员充值: ${adminEmail} - ${description}`;

  // 检查用户是否存在对应的积分账户；若不存在则自动创建
  const accountRows = db.exec("SELECT balance, version FROM credit_accounts WHERE user_id = ?", [userId]);
  if (accountRows.length === 0 || accountRows[0].values.length === 0) {
    db.run(
      "INSERT INTO credit_accounts (user_id, balance, version, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now'))",
      [userId, amount, 1]
    );
    db.run(
      "INSERT INTO credit_transactions (user_id, type, amount, balance_after, reference_id, description) VALUES (?, 'admin_topup', ?, ?, ?, ?)",
      [userId, amount, amount, null, fullDescription]
    );
    const lastIdResult = db.exec("SELECT last_insert_rowid()");
    const lastId = lastIdResult[0].values[0][0] as number;

    saveDatabase();

    return {
      id: lastId,
      userId,
      type: "admin_topup",
      amount,
      balanceAfter: amount,
      referenceId: null,
      description: fullDescription,
      createdAt: new Date().toISOString(),
    };
  }

  for (let retry = 0; retry < MAX_RETRIES; retry++) {
    const account = accountRows[0].values[0];
    const balance = account[0] as number;
    const version = account[1] as number;

    const newBalance = balance + amount;
    const newVersion = version + 1;

    db.run(
      "UPDATE credit_accounts SET balance = ?, version = ?, updated_at = datetime('now') WHERE user_id = ? AND version = ?",
      [newBalance, newVersion, userId, version]
    );

    const changesResult = db.getRowsModified();
    if (changesResult === 0) {
      continue;
    }

    db.run(
      "INSERT INTO credit_transactions (user_id, type, amount, balance_after, reference_id, description) VALUES (?, 'admin_topup', ?, ?, ?, ?)",
      [userId, amount, newBalance, null, fullDescription]
    );

    const lastIdResult = db.exec("SELECT last_insert_rowid()");
    const lastId = lastIdResult[0].values[0][0] as number;

    saveDatabase();

    return {
      id: lastId,
      userId,
      type: "admin_topup",
      amount,
      balanceAfter: newBalance,
      referenceId: null,
      description: fullDescription,
      createdAt: new Date().toISOString(),
    };
  }

  throw new OptimisticLockError("管理员充值冲突，请重试");
}

/** 获取积分流水列表 */
export function getTransactions(
  userId: number,
  type?: TransactionType,
  page: number = 1,
  pageSize: number = 20
): { items: CreditTransactionInfo[]; total: number } {
  const db = getDb();
  const offset = (page - 1) * pageSize;

  let sql: string;
  let params: unknown[];

  if (type) {
    sql = "SELECT id, user_id, type, amount, balance_after, reference_id, description, created_at FROM credit_transactions WHERE user_id = ? AND type = ? ORDER BY created_at DESC";
    params = [userId, type];
  } else {
    sql = "SELECT id, user_id, type, amount, balance_after, reference_id, description, created_at FROM credit_transactions WHERE user_id = ? ORDER BY created_at DESC";
    params = [userId];
  }

  const allRows = db.exec(sql, params);
  const total = allRows.length > 0 ? allRows[0].values.length : 0;

  // 获取分页数据
  const paginatedSql = sql + " LIMIT ? OFFSET ?";
  const paginatedRows = db.exec(paginatedSql, [...params, pageSize, offset]);

  const items: CreditTransactionInfo[] = [];
  if (paginatedRows.length > 0) {
    for (const row of paginatedRows[0].values) {
      items.push({
        id: row[0] as number,
        userId: row[1] as number,
        type: row[2] as TransactionType,
        amount: row[3] as number,
        balanceAfter: row[4] as number,
        referenceId: row[5] as string | null,
        description: row[6] as string | null,
        createdAt: row[7] as string,
      });
    }
  }

  return { items, total };
}
