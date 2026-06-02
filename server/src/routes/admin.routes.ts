// ============================================================
// AI创作聚合平台 - 管理员路由（积分套餐 & AI模型 CRUD）
// ============================================================

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { adminMiddleware } from "../middleware/admin.middleware.js";
import { successResponse } from "../utils/helpers.js";
import { getDb, saveDatabase } from "../db/index.js";
import { nowISO } from "../utils/helpers.js";

// ---- Zod 校验 Schema ----

const packageIdSchema = z.object({
  id: z.string().min(1, "套餐ID不能为空"),
});

const packageCreateSchema = z.object({
  id: z.string().min(1, "套餐ID不能为空"),
  name: z.string().min(1, "套餐名称不能为空"),
  credits: z.number().int().positive("积分数量必须为正整数"),
  price_cents: z.number().int().nonnegative("价格不能为负数"),
  unit_label: z.string().optional().default(""),
  enabled: z.number().int().min(0).max(1).optional().default(1),
  sort_order: z.number().int().optional().default(0),
});

const packageUpdateSchema = z.object({
  name: z.string().min(1, "套餐名称不能为空").optional(),
  credits: z.number().int().positive("积分数量必须为正整数").optional(),
  price_cents: z.number().int().nonnegative("价格不能为负数").optional(),
  unit_label: z.string().optional(),
  enabled: z.number().int().min(0).max(1).optional(),
  sort_order: z.number().int().optional(),
});

const modelIdSchema = z.object({
  id: z.string().min(1, "模型ID不能为空"),
});

const modelCreateSchema = z.object({
  id: z.string().min(1, "模型ID不能为空"),
  name: z.string().min(1, "模型名称不能为空"),
  type: z.enum(["image", "video", "text"], { message: "模型类型必须是 image、video 或 text" }),
  category: z.enum(["starter", "standard", "advanced", "flagship"], { message: "定位无效" }),
  cost_credits: z.number().int().positive("消耗积分必须为正整数"),
  adapter_class: z.string().min(1, "适配器类名不能为空"),
  enabled: z.number().int().min(0).max(1).optional().default(1),
  config: z.string().optional().default("{}"),
  sort_order: z.number().int().optional().default(0),
  duration_options: z.string().optional().nullable(),
  duration_pricing: z.string().optional().nullable(),
});

const modelUpdateSchema = z.object({
  name: z.string().min(1, "模型名称不能为空").optional(),
  type: z.enum(["image", "video", "text"]).optional(),
  category: z.enum(["starter", "standard", "advanced", "flagship"]).optional(),
  cost_credits: z.number().int().positive("消耗积分必须为正整数").optional(),
  adapter_class: z.string().min(1, "适配器类名不能为空").optional(),
  enabled: z.number().int().min(0).max(1).optional(),
  config: z.string().optional(),
  sort_order: z.number().int().optional(),
  duration_options: z.string().optional().nullable(),
  duration_pricing: z.string().optional().nullable(),
});

// ---- 辅助函数 ----

/** 将 sql.js 行数据映射为积分套餐对象 */
function mapPackageRow(row: unknown[]): Record<string, unknown> {
  return {
    id: row[0] as string,
    name: row[1] as string,
    credits: row[2] as number,
    price_cents: row[3] as number,
    unit_label: row[4] as string | null,
    enabled: row[5] as number,
    sort_order: row[6] as number,
    created_at: row[7] as string,
  };
}

/** 将 sql.js 行数据映射为AI模型对象 */
function mapModelRow(row: unknown[]): Record<string, unknown> {
  return {
    id: row[0] as string,
    name: row[1] as string,
    type: row[2] as string,
    category: row[3] as string,
    cost_credits: row[4] as number,
    adapter_class: row[5] as string,
    enabled: row[6] as number,
    config: row[7] as string | null,
    sort_order: row[8] as number,
    duration_options: row[9] as string | null,
    duration_pricing: row[10] as string | null,
    created_at: row[11] as string,
    updated_at: row[12] as string,
  };
}

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  // 所有管理员路由需要认证 + 管理员权限
  app.addHook("preHandler", authMiddleware);
  app.addHook("preHandler", adminMiddleware);

  // ============================================================
  // 积分套餐管理 /api/v1/admin/packages
  // ============================================================

  /** GET / — 获取所有套餐（包括 enabled=0 的） */
  app.get("/packages", async (_request, reply) => {
    const db = getDb();
    const rows = db.exec(
      "SELECT id, name, credits, price_cents, unit_label, enabled, sort_order, created_at FROM credit_packages ORDER BY sort_order"
    );

    const packages: Record<string, unknown>[] = [];
    if (rows.length > 0) {
      for (const row of rows[0].values) {
        packages.push(mapPackageRow(row));
      }
    }

    reply.send(successResponse(packages));
  });

  /** POST / — 新增套餐 */
  app.post("/packages", async (request, reply) => {
    const body = packageCreateSchema.parse(request.body);
    const db = getDb();

    db.run(
      "INSERT INTO credit_packages (id, name, credits, price_cents, unit_label, enabled, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [body.id, body.name, body.credits, body.price_cents, body.unit_label, body.enabled, body.sort_order]
    );

    saveDatabase();

    const rows = db.exec(
      "SELECT id, name, credits, price_cents, unit_label, enabled, sort_order, created_at FROM credit_packages WHERE id = ?",
      [body.id]
    );

    const pkg = rows.length > 0 ? mapPackageRow(rows[0].values[0]) : null;
    reply.status(201).send(successResponse(pkg, "创建成功", 201));
  });

  /** PUT /:id — 更新套餐 */
  app.put("/packages/:id", async (request, reply) => {
    const params = packageIdSchema.parse(request.params);
    const body = packageUpdateSchema.parse(request.body);
    const db = getDb();

    // 检查套餐是否存在
    const existing = db.exec("SELECT id FROM credit_packages WHERE id = ?", [params.id]);
    if (existing.length === 0 || existing[0].values.length === 0) {
      reply.status(404).send({ code: 4001, data: null, message: `积分套餐不存在: ${params.id}` });
      return;
    }

    // 构建动态 UPDATE 语句
    const fields: string[] = [];
    const values: unknown[] = [];

    if (body.name !== undefined) { fields.push("name = ?"); values.push(body.name); }
    if (body.credits !== undefined) { fields.push("credits = ?"); values.push(body.credits); }
    if (body.price_cents !== undefined) { fields.push("price_cents = ?"); values.push(body.price_cents); }
    if (body.unit_label !== undefined) { fields.push("unit_label = ?"); values.push(body.unit_label); }
    if (body.enabled !== undefined) { fields.push("enabled = ?"); values.push(body.enabled); }
    if (body.sort_order !== undefined) { fields.push("sort_order = ?"); values.push(body.sort_order); }

    if (fields.length > 0) {
      values.push(params.id);
      db.run(`UPDATE credit_packages SET ${fields.join(", ")} WHERE id = ?`, values);
      saveDatabase();
    }

    const rows = db.exec(
      "SELECT id, name, credits, price_cents, unit_label, enabled, sort_order, created_at FROM credit_packages WHERE id = ?",
      [params.id]
    );

    const pkg = rows.length > 0 ? mapPackageRow(rows[0].values[0]) : null;
    reply.send(successResponse(pkg, "更新成功"));
  });

  /** DELETE /:id — 软删除（设 enabled=0） */
  app.delete("/packages/:id", async (request, reply) => {
    const params = packageIdSchema.parse(request.params);
    const db = getDb();

    const existing = db.exec("SELECT id FROM credit_packages WHERE id = ?", [params.id]);
    if (existing.length === 0 || existing[0].values.length === 0) {
      reply.status(404).send({ code: 4001, data: null, message: `积分套餐不存在: ${params.id}` });
      return;
    }

    db.run("UPDATE credit_packages SET enabled = 0 WHERE id = ?", [params.id]);
    saveDatabase();

    reply.send(successResponse(null, "已下架"));
  });

  // ============================================================
  // AI模型管理 /api/v1/admin/models
  // ============================================================

  /** GET / — 获取所有模型（包括 enabled=0 的） */
  app.get("/models", async (_request, reply) => {
    const db = getDb();
    const rows = db.exec(
      "SELECT id, name, type, category, cost_credits, adapter_class, enabled, config, sort_order, duration_options, duration_pricing, created_at, updated_at FROM ai_models ORDER BY sort_order"
    );

    const models: Record<string, unknown>[] = [];
    if (rows.length > 0) {
      for (const row of rows[0].values) {
        models.push(mapModelRow(row));
      }
    }

    reply.send(successResponse(models));
  });

  /** POST / — 新增模型 */
  app.post("/models", async (request, reply) => {
    const body = modelCreateSchema.parse(request.body);
    const db = getDb();
    const now = nowISO();

    db.run(
      "INSERT INTO ai_models (id, name, type, category, cost_credits, adapter_class, enabled, config, sort_order, duration_options, duration_pricing, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [body.id, body.name, body.type, body.category, body.cost_credits, body.adapter_class, body.enabled, body.config, body.sort_order, body.duration_options, body.duration_pricing, now, now]
    );

    saveDatabase();

    const rows = db.exec(
      "SELECT id, name, type, category, cost_credits, adapter_class, enabled, config, sort_order, duration_options, duration_pricing, created_at, updated_at FROM ai_models WHERE id = ?",
      [body.id]
    );

    const model = rows.length > 0 ? mapModelRow(rows[0].values[0]) : null;
    reply.status(201).send(successResponse(model, "创建成功", 201));
  });

  /** PUT /:id — 更新模型 */
  app.put("/models/:id", async (request, reply) => {
    const params = modelIdSchema.parse(request.params);
    const body = modelUpdateSchema.parse(request.body);
    const db = getDb();

    // 检查模型是否存在
    const existing = db.exec("SELECT id FROM ai_models WHERE id = ?", [params.id]);
    if (existing.length === 0 || existing[0].values.length === 0) {
      reply.status(404).send({ code: 4001, data: null, message: `AI模型不存在: ${params.id}` });
      return;
    }

    // 构建动态 UPDATE 语句
    const fields: string[] = [];
    const values: unknown[] = [];

    if (body.name !== undefined) { fields.push("name = ?"); values.push(body.name); }
    if (body.type !== undefined) { fields.push("type = ?"); values.push(body.type); }
    if (body.category !== undefined) { fields.push("category = ?"); values.push(body.category); }
    if (body.cost_credits !== undefined) { fields.push("cost_credits = ?"); values.push(body.cost_credits); }
    if (body.adapter_class !== undefined) { fields.push("adapter_class = ?"); values.push(body.adapter_class); }
    if (body.enabled !== undefined) { fields.push("enabled = ?"); values.push(body.enabled); }
    if (body.config !== undefined) { fields.push("config = ?"); values.push(body.config); }
    if (body.sort_order !== undefined) { fields.push("sort_order = ?"); values.push(body.sort_order); }
    if (body.duration_options !== undefined) { fields.push("duration_options = ?"); values.push(body.duration_options); }
    if (body.duration_pricing !== undefined) { fields.push("duration_pricing = ?"); values.push(body.duration_pricing); }

    if (fields.length > 0) {
      fields.push("updated_at = ?");
      values.push(nowISO());
      values.push(params.id);
      db.run(`UPDATE ai_models SET ${fields.join(", ")} WHERE id = ?`, values);
      saveDatabase();
    }

    const rows = db.exec(
      "SELECT id, name, type, category, cost_credits, adapter_class, enabled, config, sort_order, duration_options, duration_pricing, created_at, updated_at FROM ai_models WHERE id = ?",
      [params.id]
    );

    const model = rows.length > 0 ? mapModelRow(rows[0].values[0]) : null;
    reply.send(successResponse(model, "更新成功"));
  });

  /** DELETE /:id — 软删除（设 enabled=0） */
  app.delete("/models/:id", async (request, reply) => {
    const params = modelIdSchema.parse(request.params);
    const db = getDb();

    const existing = db.exec("SELECT id FROM ai_models WHERE id = ?", [params.id]);
    if (existing.length === 0 || existing[0].values.length === 0) {
      reply.status(404).send({ code: 4001, data: null, message: `AI模型不存在: ${params.id}` });
      return;
    }

    db.run("UPDATE ai_models SET enabled = 0, updated_at = ? WHERE id = ?", [nowISO(), params.id]);
    saveDatabase();

    reply.send(successResponse(null, "已下架"));
  });
}
