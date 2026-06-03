// ============================================================
// AI创作聚合平台 - 订单服务
// ============================================================

import { getDb, saveDatabase } from "../db/index.js";
import * as wechatPayService from "./wechat-pay.service.js";
import * as creditsService from "./credits.service.js";
import { config } from "../config/index.js";
import type { OrderInfo, OrderStatus } from "../types/index.js";

/** 订单过期时间（毫秒）: 30分钟 */
const ORDER_EXPIRE_MS = 30 * 60 * 1000;

/**
 * 生成订单号
 * 格式: ORD + 年月日时分秒 + 4位随机数
 * 例如: ORD202606031435001234
 */
function generateOrderId(): string {
  const now = new Date();
  const pad = (n: number, len: number = 2): string => String(n).padStart(len, "0");

  const dateStr =
    now.getFullYear().toString() +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    pad(now.getSeconds());

  const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");

  return `ORD${dateStr}${random}`;
}

/**
 * 创建订单 + 调微信下单 + 返回orderId+codeUrl
 * @param userId - 用户ID
 * @param packageId - 积分包ID
 * @returns orderId 和 codeUrl
 */
export async function createOrder(
  userId: number,
  packageId: string
): Promise<{ orderId: string; codeUrl: string }> {
  const db = getDb();

  // 1. 查找积分包信息
  const pkgRows = db.exec(
    "SELECT id, name, credits, price_cents FROM credit_packages WHERE id = ? AND enabled = 1",
    [packageId]
  );

  if (pkgRows.length === 0 || pkgRows[0].values.length === 0) {
    throw new Error(`积分包不存在或已下架: ${packageId}`);
  }

  const pkgRow = pkgRows[0].values[0];
  const pkgName = pkgRow[1] as string;
  const pkgCredits = pkgRow[2] as number;
  const pkgPriceCents = pkgRow[3] as number;

  // 2. 检查用户是否有未过期的同积分包pending订单，避免重复创建
  const existingRows = db.exec(
    "SELECT id FROM orders WHERE user_id = ? AND package_id = ? AND status = 'pending'",
    [userId, packageId]
  );

  if (existingRows.length > 0 && existingRows[0].values.length > 0) {
    // 有未支付订单，检查是否已过期
    const existingOrderId = existingRows[0].values[0][0] as string;
    const existingOrder = getOrderById(existingOrderId);
    if (existingOrder && existingOrder.status === "pending") {
      // 订单未过期，直接返回该订单的codeUrl（需要重新调用微信下单获取新的codeUrl）
      const notifyUrl = config.wechatPay.notifyUrl || "https://zhiyingworks.cn/api/v1/payment/notify";
      try {
        const result = await wechatPayService.createNativeOrder(
          existingOrderId,
          `购买${pkgName}`,
          pkgPriceCents,
          notifyUrl
        );
        return { orderId: existingOrderId, codeUrl: result.codeUrl };
      } catch {
        // 重新下单失败，标记旧订单为failed而非删除，保留对账记录
        db.run("UPDATE orders SET status = 'failed', updated_at = datetime('now') WHERE id = ?", [existingOrderId]);
      }
    }
  }

  // 3. 生成订单号
  const orderId = generateOrderId();

  // 4. 计算过期时间
  const expiredAt = new Date(Date.now() + ORDER_EXPIRE_MS)
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d+Z$/, "");

  // 5. 插入订单记录
  db.run(
    `INSERT INTO orders (id, user_id, package_id, credits, amount, status, expired_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
    [orderId, userId, packageId, pkgCredits, pkgPriceCents, expiredAt]
  );

  saveDatabase();

  // 6. 调用微信Native下单
  const notifyUrl = config.wechatPay.notifyUrl || "https://zhiyingworks.cn/api/v1/payment/notify";
  try {
    const result = await wechatPayService.createNativeOrder(
      orderId,
      `购买${pkgName}`,
      pkgPriceCents,
      notifyUrl
    );
    return { orderId, codeUrl: result.codeUrl };
  } catch (error) {
    // 微信下单失败，标记订单为failed
    db.run(
      "UPDATE orders SET status = 'failed', updated_at = datetime('now') WHERE id = ?",
      [orderId]
    );
    saveDatabase();
    throw new Error(`微信下单失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 根据订单号查询订单
 * @param orderId - 订单号
 * @returns 订单信息或null
 */
export function getOrderById(orderId: string): OrderInfo | null {
  const db = getDb();

  const rows = db.exec(
    `SELECT id, user_id, package_id, credits, amount, status, transaction_id, paid_at, expired_at, created_at, updated_at
     FROM orders WHERE id = ?`,
    [orderId]
  );

  if (rows.length === 0 || rows[0].values.length === 0) {
    return null;
  }

  const row = rows[0].values[0];
  return mapRowToOrderInfo(row);
}

/**
 * 处理支付成功：更新订单状态 + 充值积分
 * @param orderId - 订单号
 * @param transactionId - 微信支付交易号
 */
export function handlePaymentSuccess(orderId: string, transactionId: string): void {
  const db = getDb();

  // 1. 查询订单
  const order = getOrderById(orderId);
  if (!order) {
    console.error(`[OrderService] 订单不存在: ${orderId}`);
    return;
  }

  // 2. 检查订单状态，防止重复处理
  if (order.status === "paid") {
    console.log(`[OrderService] 订单已支付，忽略重复通知: ${orderId}`);
    return;
  }

  if (order.status !== "pending") {
    console.warn(`[OrderService] 订单状态非pending，无法处理支付: ${orderId}, status=${order.status}`);
    return;
  }

  // 3. 更新订单状态为paid
  const paidAt = new Date().toISOString().replace("T", " ").replace(/\.\d+Z$/, "");
  db.run(
    `UPDATE orders SET status = 'paid', transaction_id = ?, paid_at = ?, updated_at = datetime('now')
     WHERE id = ? AND status = 'pending'`,
    [transactionId, paidAt, orderId]
  );

  const changesResult = db.getRowsModified();
  if (changesResult === 0) {
    // 并发冲突，可能已被其他请求处理
    console.warn(`[OrderService] 订单状态更新冲突: ${orderId}`);
    return;
  }

  // 4. 充值积分（使用credits.service.ts的topUp函数）
  try {
    creditsService.topUp(
      order.userId,
      order.credits,
      orderId,
      `购买积分包(${order.packageId})-微信支付`
    );
    console.log(`[OrderService] 订单支付成功，积分充值完成: orderId=${orderId}, userId=${order.userId}, credits=${order.credits}`);
  } catch (error) {
    console.error(`[OrderService] 积分充值失败: orderId=${orderId}`, error);
    // 积分充值失败，但订单已标记为paid，后续可通过手动或定时任务补单
  }

  saveDatabase();
}

/**
 * 获取用户订单列表（分页）
 * @param userId - 用户ID
 * @param page - 页码
 * @param pageSize - 每页数量
 * @returns 分页订单列表
 */
export function getOrdersByUserId(
  userId: number,
  page: number = 1,
  pageSize: number = 10
): { items: OrderInfo[]; total: number } {
  const db = getDb();
  const offset = (page - 1) * pageSize;

  // 查询总数
  const countRows = db.exec(
    "SELECT COUNT(*) as cnt FROM orders WHERE user_id = ?",
    [userId]
  );
  const total = countRows.length > 0 ? (countRows[0].values[0][0] as number) : 0;

  // 查询分页数据
  const rows = db.exec(
    `SELECT id, user_id, package_id, credits, amount, status, transaction_id, paid_at, expired_at, created_at, updated_at
     FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [userId, pageSize, offset]
  );

  const items: OrderInfo[] = [];
  if (rows.length > 0) {
    for (const row of rows[0].values) {
      items.push(mapRowToOrderInfo(row));
    }
  }

  return { items, total };
}

/**
 * 检查并过期超时未支付的订单
 * 批量将超过expired_at且状态为pending的订单标记为expired
 */
export function expireOrders(): number {
  const db = getDb();

  db.run(
    `UPDATE orders SET status = 'expired', updated_at = datetime('now')
     WHERE status = 'pending' AND expired_at < datetime('now')`
  );

  const expiredCount = db.getRowsModified();
  if (expiredCount > 0) {
    saveDatabase();
    console.log(`[OrderService] 已过期 ${expiredCount} 个超时未支付订单`);
  }

  return expiredCount;
}

/**
 * 将数据库行映射为OrderInfo对象
 */
function mapRowToOrderInfo(row: unknown[]): OrderInfo {
  return {
    id: row[0] as string,
    userId: row[1] as number,
    packageId: row[2] as string,
    credits: row[3] as number,
    amount: row[4] as number,
    status: row[5] as OrderStatus,
    transactionId: row[6] as string | null,
    paidAt: row[7] as string | null,
    expiredAt: row[8] as string,
    createdAt: row[9] as string,
    updatedAt: row[10] as string,
  };
}
