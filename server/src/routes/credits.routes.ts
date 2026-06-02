// ============================================================
// AI创作聚合平台 - 积分路由
// ============================================================

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import * as creditsService from "../services/credits.service.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { successResponse, paginatedResponse } from "../utils/helpers.js";
import { PackageNotFoundError } from "../utils/errors.js";
import { getDb, saveDatabase } from "../db/index.js";
import type { TransactionType, CreditsPackageInfo } from "../types/index.js";
import { v4 as uuidv4 } from "uuid";

const purchaseSchema = z.object({
  packageId: z.string().min(1, "积分包ID不能为空"),
});

export async function creditsRoutes(app: FastifyInstance): Promise<void> {
  /** GET /api/v1/credits/balance - 获取积分余额（需认证） */
  app.get("/balance", { preHandler: authMiddleware }, async (request, reply) => {
    const userId = request.userId!;
    const balance = creditsService.getBalance(userId);
    reply.send(successResponse(balance));
  });

  /** GET /api/v1/credits/packages - 获取积分包列表（需认证） */
  app.get("/packages", { preHandler: authMiddleware }, async (request, reply) => {
    const db = getDb();
    const rows = db.exec(
      "SELECT id, name, credits, price_cents, unit_label FROM credit_packages WHERE enabled = 1 ORDER BY sort_order"
    );

    const packages: CreditsPackageInfo[] = [];
    if (rows.length > 0) {
      for (const row of rows[0].values) {
        packages.push({
          id: row[0] as string,
          name: row[1] as string,
          credits: row[2] as number,
          priceCents: row[3] as number,
          unitLabel: row[4] as string | null,
        });
      }
    }

    reply.send(successResponse(packages));
  });

  /** POST /api/v1/credits/purchase - 购买积分包（需认证，MVP模拟充值） */
  app.post("/purchase", { preHandler: authMiddleware }, async (request, reply) => {
    const body = purchaseSchema.parse(request.body);
    const userId = request.userId!;

    // 查找积分包
    const db = getDb();
    const rows = db.exec(
      "SELECT id, name, credits FROM credit_packages WHERE id = ?",
      [body.packageId]
    );

    if (rows.length === 0 || rows[0].values.length === 0) {
      throw new PackageNotFoundError(body.packageId);
    }

    const pkg = rows[0].values[0];
    const credits = pkg[2] as number;

    // MVP: 模拟充值，直接增加积分
    const orderId = `order-${uuidv4()}`;
    const transaction = creditsService.topUp(
      userId,
      credits,
      orderId,
      `购买${pkg[1]}`
    );

    const balance = creditsService.getBalance(userId);

    reply.send(successResponse({
      balance: balance.balance,
      transactionId: transaction.id,
    }));
  });

  /** GET /api/v1/credits/transactions - 获取积分流水（需认证） */
  app.get("/transactions", { preHandler: authMiddleware }, async (request, reply) => {
    const userId = request.userId!;
    const query = request.query as Record<string, string>;
    const type = query.type as TransactionType | undefined;
    const page = parseInt(query.page || "1", 10);
    const pageSize = parseInt(query.pageSize || "20", 10);

    const result = creditsService.getTransactions(userId, type, page, pageSize);
    reply.send(paginatedResponse(result.items, result.total, page, pageSize));
  });
}
