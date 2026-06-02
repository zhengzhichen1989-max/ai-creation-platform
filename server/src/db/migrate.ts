// ============================================================
// AI创作聚合平台 - 迁移执行器（含种子数据）
// ============================================================

import { getDb, saveDatabase } from "./index.js";
import bcrypt from "bcryptjs";

/** 执行数据库建表和种子数据插入 */
export async function runMigration(): Promise<void> {
  const sqlite = getDb();

  console.log("[Migration] 开始执行数据库迁移...");

  // 建表 SQL
  const createTablesSQL = `
    -- 用户表
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      nickname TEXT NOT NULL,
      avatar_url TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 积分账户表
    CREATE TABLE IF NOT EXISTS credit_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
      balance INTEGER NOT NULL DEFAULT 0,
      version INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 积分流水表
    CREATE TABLE IF NOT EXISTS credit_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      reference_id TEXT,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- AI模型表
    CREATE TABLE IF NOT EXISTS ai_models (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      category TEXT NOT NULL,
      cost_credits INTEGER NOT NULL,
      adapter_class TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      config TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      duration_options TEXT,
      duration_pricing TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 生成任务表
    CREATE TABLE IF NOT EXISTS generation_tasks (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      model_id TEXT NOT NULL REFERENCES ai_models(id),
      type TEXT NOT NULL,
      prompt TEXT NOT NULL,
      params TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      cost_credits INTEGER NOT NULL,
      result_url TEXT,
      result_thumbnail TEXT,
      error_message TEXT,
      progress INTEGER DEFAULT 0,
      started_at TEXT,
      completed_at TEXT,
      expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 积分商品包表
    CREATE TABLE IF NOT EXISTS credit_packages (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      credits INTEGER NOT NULL,
      price_cents INTEGER NOT NULL,
      unit_label TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `;

  // 逐条执行建表语句
  const statements = createTablesSQL
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    sqlite.run(stmt);
  }

  console.log("[Migration] 数据表创建完成");

  // 迁移：为已有 users 表添加 role 字段（防重复执行）
  try {
    sqlite.run("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
    console.log("[Migration] 已为 users 表添加 role 字段");
  } catch {
    // 字段已存在则忽略
    console.log("[Migration] users.role 字段已存在，跳过迁移");
  }

  try {
    sqlite.run("ALTER TABLE ai_models ADD COLUMN duration_options TEXT");
    console.log("[Migration] 已为 ai_models 表添加 duration_options 字段");
  } catch {
    console.log("[Migration] ai_models.duration_options 字段已存在，跳过迁移");
  }
  try {
    sqlite.run("ALTER TABLE ai_models ADD COLUMN duration_pricing TEXT");
    console.log("[Migration] 已为 ai_models 表添加 duration_pricing 字段");
  } catch {
    console.log("[Migration] ai_models.duration_pricing 字段已存在，跳过迁移");
  }
  try {
    sqlite.run("ALTER TABLE generation_tasks ADD COLUMN expires_at TEXT");
    console.log("[Migration] 已为 generation_tasks 表添加 expires_at 字段");
  } catch {
    console.log("[Migration] generation_tasks.expires_at 字段已存在，跳过迁移");
  }

  // 插入种子数据：管理员账户
  const adminCountResult = sqlite.exec("SELECT COUNT(*) as cnt FROM users WHERE email = ?", ["admin@aicreation.com"]);
  const adminCount = adminCountResult[0]?.values[0]?.[0] as number || 0;
  if (adminCount === 0) {
    const adminPasswordHash = await bcrypt.hash("admin123", 10);
    sqlite.run(
      "INSERT INTO users (email, password_hash, nickname, role) VALUES (?, ?, ?, ?)",
      ["admin@aicreation.com", adminPasswordHash, "管理员", "admin"]
    );
    console.log("[Migration] 管理员种子账户插入完成");
  }

  // 插入种子数据：AI模型
  const modelCountResult = sqlite.exec("SELECT COUNT(*) as cnt FROM ai_models");
  const modelCount = modelCountResult[0]?.values[0]?.[0] as number || 0;
  if (modelCount === 0) {
    const models = [
      { id: "flux-pro", name: "Flux Pro", type: "image", category: "advanced", cost_credits: 6, adapter_class: "FluxAdapter", enabled: 1, config: JSON.stringify({ defaultWidth: 1024, defaultHeight: 1024 }), sort_order: 1, duration_options: null, duration_pricing: null },
      { id: "stable-diffusion", name: "Stable Diffusion XL", type: "image", category: "starter", cost_credits: 3, adapter_class: "StableDiffusionAdapter", enabled: 1, config: JSON.stringify({ defaultWidth: 1024, defaultHeight: 1024 }), sort_order: 2, duration_options: null, duration_pricing: null },
      { id: "dall-e", name: "DALL-E 3", type: "image", category: "flagship", cost_credits: 10, adapter_class: "DallEAdapter", enabled: 1, config: JSON.stringify({ defaultWidth: 1024, defaultHeight: 1024 }), sort_order: 3, duration_options: null, duration_pricing: null },
      { id: "kling", name: "可灵AI", type: "video", category: "standard", cost_credits: 15, adapter_class: "KlingAdapter", enabled: 1, config: JSON.stringify({ defaultDuration: 5, defaultFps: 24 }), sort_order: 4, duration_options: "[5,10]", duration_pricing: '{"5":15,"10":25}' },
      { id: "seedance", name: "Seedance", type: "video", category: "advanced", cost_credits: 20, adapter_class: "SeedanceAdapter", enabled: 1, config: JSON.stringify({ defaultDuration: 5, defaultFps: 24 }), sort_order: 5, duration_options: "[5,10,15]", duration_pricing: '{"5":20,"10":35,"15":50}' },
      { id: "sora", name: "Sora", type: "video", category: "flagship", cost_credits: 30, adapter_class: "SoraAdapter", enabled: 1, config: JSON.stringify({ defaultDuration: 10, defaultFps: 24 }), sort_order: 6, duration_options: "[5,10,15]", duration_pricing: '{"5":20,"10":30,"15":45}' },
    ];

    for (const m of models) {
      sqlite.run(
        "INSERT INTO ai_models (id, name, type, category, cost_credits, adapter_class, enabled, config, sort_order, duration_options, duration_pricing) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [m.id, m.name, m.type, m.category, m.cost_credits, m.adapter_class, m.enabled, m.config, m.sort_order, m.duration_options, m.duration_pricing]
      );
    }
    console.log("[Migration] AI模型种子数据插入完成（6条）");
  }

  // 插入种子数据：积分包
  const packageCountResult = sqlite.exec("SELECT COUNT(*) as cnt FROM credit_packages");
  const packageCount = packageCountResult[0]?.values[0]?.[0] as number || 0;
  if (packageCount === 0) {
    const packages = [
      { id: "trial", name: "体验包", credits: 50, price_cents: 490, unit_label: "约0.10元/积分", enabled: 1, sort_order: 1 },
      { id: "standard", name: "标准包", credits: 200, price_cents: 1590, unit_label: "约0.08元/积分", enabled: 1, sort_order: 2 },
      { id: "professional", name: "专业包", credits: 600, price_cents: 3990, unit_label: "约0.07元/积分", enabled: 1, sort_order: 3 },
      { id: "team", name: "团队包", credits: 2000, price_cents: 9990, unit_label: "约0.05元/积分", enabled: 1, sort_order: 4 },
    ];

    for (const p of packages) {
      sqlite.run(
        "INSERT INTO credit_packages (id, name, credits, price_cents, unit_label, enabled, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [p.id, p.name, p.credits, p.price_cents, p.unit_label, p.enabled, p.sort_order]
      );
    }
    console.log("[Migration] 积分包种子数据插入完成（4条）");
  }

  // 保存到文件
  saveDatabase();

  console.log("[Migration] 数据库迁移完成！");
}

// 如果直接运行此文件，则执行迁移
if (process.argv[1]?.endsWith("migrate.ts") || process.argv[1]?.endsWith("migrate.js")) {
  // 需要先初始化数据库
  import("./index.js").then(async ({ initDatabase, closeDatabase }) => {
    await initDatabase();
    await runMigration();
    closeDatabase();
    console.log("迁移脚本执行成功");
    process.exit(0);
  }).catch((err) => {
    console.error("迁移脚本执行失败:", err);
    process.exit(1);
  });
}
