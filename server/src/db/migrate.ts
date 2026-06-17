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
      resolution_options TEXT,
      resolution_pricing TEXT,
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
      max_per_user INTEGER,
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
    sqlite.run("ALTER TABLE ai_models ADD COLUMN resolution_options TEXT");
    console.log("[Migration] 已为 ai_models 表添加 resolution_options 字段");
  } catch {
    console.log("[Migration] ai_models.resolution_options 字段已存在，跳过迁移");
  }
  try {
    sqlite.run("ALTER TABLE ai_models ADD COLUMN resolution_pricing TEXT");
    console.log("[Migration] 已为 ai_models 表添加 resolution_pricing 字段");
  } catch {
    console.log("[Migration] ai_models.resolution_pricing 字段已存在，跳过迁移");
  }
  try {
    sqlite.run("ALTER TABLE generation_tasks ADD COLUMN expires_at TEXT");
    console.log("[Migration] 已为 generation_tasks 表添加 expires_at 字段");
  } catch {
    console.log("[Migration] generation_tasks.expires_at 字段已存在，跳过迁移");
  }

  // 新增 provider 字段迁移
  try {
    sqlite.run("ALTER TABLE ai_models ADD COLUMN provider TEXT");
    console.log("[Migration] 已为 ai_models 表添加 provider 字段");
  } catch {
    console.log("[Migration] ai_models.provider 字段已存在，跳过迁移");
  }

  // 新增 fallback_model_id 字段（NULL表示无回退模型）
  try {
    sqlite.run("ALTER TABLE ai_models ADD COLUMN fallback_model_id TEXT");
    console.log("[Migration] 已为 ai_models 表添加 fallback_model_id 字段");
  } catch {
    console.log("[Migration] ai_models.fallback_model_id 字段已存在，跳过迁移");
  }

  // ============================================================
  // 管理员用户管理模块迁移
  // ============================================================

  // 新建 password_reset_tokens 表
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  console.log("[Migration] password_reset_tokens 表创建完成");

  // 新建 admin_operation_logs 表
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS admin_operation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER NOT NULL REFERENCES users(id),
      target_user_id INTEGER,
      action TEXT NOT NULL,
      detail TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  console.log("[Migration] admin_operation_logs 表创建完成");

  // 为 users 表添加 status 字段
  try {
    sqlite.run("ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'");
    console.log("[Migration] 已为 users 表添加 status 字段");
  } catch {
    console.log("[Migration] users.status 字段已存在，跳过迁移");
  }

  // 为 users 表添加 security_question 字段
  try {
    sqlite.run("ALTER TABLE users ADD COLUMN security_question TEXT");
    console.log("[Migration] 已为 users 表添加 security_question 字段");
  } catch {
    console.log("[Migration] users.security_question 字段已存在，跳过迁移");
  }

  // 为 users 表添加 security_answer_hash 字段
  try {
    sqlite.run("ALTER TABLE users ADD COLUMN security_answer_hash TEXT");
    console.log("[Migration] 已为 users 表添加 security_answer_hash 字段");
  } catch {
    console.log("[Migration] users.security_answer_hash 字段已存在，跳过迁移");
  }

  // 为 credit_packages 表添加 max_per_user 字段（NULL=无限，N=每人限购N次）
  try {
    sqlite.run("ALTER TABLE credit_packages ADD COLUMN max_per_user INTEGER");
    console.log("[Migration] 已为 credit_packages 表添加 max_per_user 字段");
  } catch {
    console.log("[Migration] credit_packages.max_per_user 字段已存在，跳过迁移");
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

  // 更新/插入模型数据（使用 UPSERT，不再 DELETE 全部，避免丢失关联数据）
  // 注意：模型 id 使用 DMXAPI/GrsAI 实际的模型ID，前端显示名保持友好名称
  const models = [
    // GrsAI 图片模型
    { id: "gpt-image-2-vip", name: "GPT Image 2 VIP", type: "image", category: "flagship", cost_credits: 3, adapter_class: "GrsAIImageAdapter", enabled: 1, config: JSON.stringify({ defaultWidth: 1024, defaultHeight: 1024 }), sort_order: 1, duration_options: null, duration_pricing: null, provider: "grsai", resolution_options: null, resolution_pricing: null, fallback_model_id: "gpt-image-2" },
    { id: "gpt-image-2", name: "GPT Image 2", type: "image", category: "flagship", cost_credits: 3, adapter_class: "GrsAIImageAdapter", enabled: 1, config: JSON.stringify({ defaultWidth: 1024, defaultHeight: 1024 }), sort_order: 99, duration_options: null, duration_pricing: null, provider: "grsai", resolution_options: null, resolution_pricing: null, fallback_model_id: null },
    { id: "nano-banana-pro", name: "Nano Banana Pro", type: "image", category: "advanced", cost_credits: 3, adapter_class: "GrsAIImageAdapter", enabled: 1, config: JSON.stringify({ defaultWidth: 1024, defaultHeight: 1024 }), sort_order: 2, duration_options: null, duration_pricing: null, provider: "grsai", resolution_options: null, resolution_pricing: null },
    { id: "nano-banana-fast", name: "Nano Banana Fast", type: "image", category: "starter", cost_credits: 2, adapter_class: "GrsAIImageAdapter", enabled: 1, config: JSON.stringify({ defaultWidth: 1024, defaultHeight: 1024 }), sort_order: 3, duration_options: null, duration_pricing: null, provider: "grsai", resolution_options: null, resolution_pricing: null },
    { id: "flux-pro", name: "Flux Pro", type: "image", category: "standard", cost_credits: 3, adapter_class: "GrsAIImageAdapter", enabled: 1, config: JSON.stringify({ defaultWidth: 1024, defaultHeight: 1024 }), sort_order: 4, duration_options: null, duration_pricing: null, provider: "grsai", resolution_options: null, resolution_pricing: null },
    // DMXAPI 视频模型（id使用真实模型ID，name保持前端友好显示名）
    // duration_pricing = 最低分辨率基础价，resolution_pricing = 更高分辨率的嵌套附加价
    // 图片模型定价不变，视频模型按新定价方案
    { id: "doubao-seedance-2-0-260128", name: "Seedance 2.0", type: "video", category: "flagship", cost_credits: 25, adapter_class: "DMXAPIVideoAdapter", enabled: 1, config: JSON.stringify({ defaultDuration: 5, defaultFps: 24 }), sort_order: 5, duration_options: "[5,10,15]", duration_pricing: '{"5":25,"10":50,"15":75}', provider: "dmxapi", resolution_options: "[\"480p\",\"720p\",\"1080p\"]", resolution_pricing: '{"480p":{"5":0,"10":0,"15":0},"720p":{"5":25,"10":50,"15":75},"1080p":{"5":100,"10":200,"15":300}}' },
    { id: "doubao-seedance-2-0-fast-260128", name: "Seedance 2.0 Fast", type: "video", category: "advanced", cost_credits: 20, adapter_class: "DMXAPIVideoAdapter", enabled: 1, config: JSON.stringify({ defaultDuration: 5, defaultFps: 24 }), sort_order: 6, duration_options: "[5,10,15]", duration_pricing: '{"5":20,"10":40,"15":60}', provider: "dmxapi", resolution_options: "[\"480p\",\"720p\"]", resolution_pricing: '{"480p":{"5":0,"10":0,"15":0},"720p":{"5":20,"10":40,"15":60}}' },
    { id: "sora-2", name: "Sora 2", type: "video", category: "flagship", cost_credits: 25, adapter_class: "DMXAPIVideoAdapter", enabled: 1, config: JSON.stringify({ defaultDuration: 4, defaultFps: 24 }), sort_order: 7, duration_options: "[4,8,12]", duration_pricing: '{"4":25,"8":47,"12":67}', provider: "dmxapi", resolution_options: "[\"720p\"]", resolution_pricing: '{"720p":{"4":0,"8":0,"12":0}}' },
    { id: "kling-v3-video-generation", name: "可灵 Kling 3.0", type: "video", category: "standard", cost_credits: 35, adapter_class: "DMXAPIVideoAdapter", enabled: 1, config: JSON.stringify({ defaultDuration: 5, defaultFps: 24 }), sort_order: 8, duration_options: "[5,10,15]", duration_pricing: '{"5":35,"10":70,"15":105}', provider: "dmxapi", resolution_options: "[\"720p\",\"1080p\"]", resolution_pricing: '{"720p":{"5":0,"10":0,"15":0},"1080p":{"5":15,"10":30,"15":45}}' },
    // DMXAPI 文案模型（id使用真实模型ID，name保持前端友好显示名）
    { id: "deepseek-chat", name: "DeepSeek V4", type: "text", category: "starter", cost_credits: 1, adapter_class: "DMXAPITextAdapter", enabled: 1, config: null, sort_order: 9, duration_options: null, duration_pricing: null, provider: "dmxapi", resolution_options: null, resolution_pricing: null },
    { id: "qwen-max", name: "Qwen3-Max", type: "text", category: "standard", cost_credits: 2, adapter_class: "DMXAPITextAdapter", enabled: 1, config: null, sort_order: 10, duration_options: null, duration_pricing: null, provider: "dmxapi", resolution_options: null, resolution_pricing: null },
  ];

  for (const m of models) {
    sqlite.run(
      `INSERT INTO ai_models (id, name, type, category, cost_credits, adapter_class, enabled, config, sort_order, duration_options, duration_pricing, provider, resolution_options, resolution_pricing, fallback_model_id) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET 
         name=excluded.name, type=excluded.type, category=excluded.category, 
         cost_credits=excluded.cost_credits, adapter_class=excluded.adapter_class, 
         config=excluded.config, sort_order=excluded.sort_order, 
         duration_options=excluded.duration_options, duration_pricing=excluded.duration_pricing, 
         provider=excluded.provider, resolution_options=excluded.resolution_options, 
         resolution_pricing=excluded.resolution_pricing, fallback_model_id=excluded.fallback_model_id`,
      [m.id, m.name, m.type, m.category, m.cost_credits, m.adapter_class, m.enabled, m.config, m.sort_order, m.duration_options, m.duration_pricing, m.provider, m.resolution_options ?? null, m.resolution_pricing ?? null, m.fallback_model_id ?? null]
    );
  }

  sqlite.run("PRAGMA foreign_keys = ON");
  console.log("[Migration] AI模型种子数据 UPSERT 完成（11条）");

  // 插入种子数据：积分包
  const packageCountResult = sqlite.exec("SELECT COUNT(*) as cnt FROM credit_packages");
  const packageCount = packageCountResult[0]?.values[0]?.[0] as number || 0;
  if (packageCount === 0) {
    const packages = [
      { id: "basic", name: "入门套餐", credits: 420, price_cents: 6900, unit_label: "约0.16元/积分", enabled: 1, sort_order: 1 },
      { id: "pro", name: "进阶套餐", credits: 1000, price_cents: 15700, unit_label: "约0.16元/积分", enabled: 1, sort_order: 2 },
      { id: "ultimate", name: "旗舰套餐", credits: 2000, price_cents: 29800, unit_label: "约0.15元/积分", enabled: 1, sort_order: 3 },
    ];

    for (const p of packages) {
      sqlite.run(
        "INSERT INTO credit_packages (id, name, credits, price_cents, unit_label, enabled, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [p.id, p.name, p.credits, p.price_cents, p.unit_label, p.enabled, p.sort_order]
      );
    }
    console.log("[Migration] 积分包种子数据插入完成（3条）");
  }

  // 确保「首充特惠」套餐存在（每人限购1次）
  sqlite.run(
    `INSERT OR REPLACE INTO credit_packages (id, name, credits, price_cents, unit_label, enabled, sort_order, max_per_user)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ["first_charge", "首充特惠", 100, 990, "约0.10元/积分，限购1次", 1, 0, 1]
  );
  console.log("[Migration] 首充特惠套餐 UPSERT 完成");

  // 新建 orders 表（微信支付订单表）
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      package_id TEXT NOT NULL,
      credits INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      transaction_id TEXT,
      paid_at TEXT,
      expired_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  console.log("[Migration] orders 表创建完成");

  // ============================================================
  // 手机号验证码登录模块迁移
  // ============================================================

  // users 表添加 phone 字段（可为空，兼容邮箱注册用户）
  try {
    sqlite.run("ALTER TABLE users ADD COLUMN phone TEXT");
    console.log("[Migration] 已为 users 表添加 phone 字段");
  } catch {
    console.log("[Migration] users.phone 字段已存在，跳过迁移");
  }

  // 新建 sms_codes 表
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS sms_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT NOT NULL,
      code TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  // 为 sms_codes 添加索引加速查询
  try {
    sqlite.run("CREATE INDEX IF NOT EXISTS idx_sms_codes_phone ON sms_codes(phone)");
  } catch {
    // 索引已存在
  }
  console.log("[Migration] sms_codes 表创建完成");

  // ============================================================
  // 服饰短片模块迁移
  // ============================================================

  // 新建 shouzuo_sessions 表
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS shouzuo_sessions (
      id                    TEXT    PRIMARY KEY,
      user_id               INTEGER NOT NULL REFERENCES users(id),
      style_template        TEXT    NOT NULL,
      video_model           TEXT    NOT NULL,
      video_duration        INTEGER NOT NULL DEFAULT 5,
      product_images        TEXT    NOT NULL,
      storyboard_task_ids   TEXT,
      storyboard_urls       TEXT,
      video_task_id         TEXT,
      video_url             TEXT,
      copywriting_task_id   TEXT,
      copywriting_urls      TEXT,
      status                TEXT    NOT NULL DEFAULT 'draft',
      total_cost            INTEGER NOT NULL DEFAULT 0,
      error_message         TEXT,
      created_at            TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at            TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);
  console.log("[Migration] shouzuo_sessions 表创建完成");

  // 为 shouzuo_sessions 添加索引
  try {
    sqlite.run("CREATE INDEX IF NOT EXISTS idx_shouzuo_sessions_user ON shouzuo_sessions(user_id)");
    sqlite.run("CREATE INDEX IF NOT EXISTS idx_shouzuo_sessions_status ON shouzuo_sessions(status)");
  } catch {
    // 索引已存在
  }
  console.log("[Migration] shouzuo_sessions 索引创建完成");

  // ============================================================
  // 服饰短片模块增量迁移 — 添加新列
  // ============================================================

  // 添加 product_info 列（JSON: ShouzuoProductInfo）
  try {
    sqlite.run("ALTER TABLE shouzuo_sessions ADD COLUMN product_info TEXT");
    console.log("[Migration] 已为 shouzuo_sessions 表添加 product_info 字段");
  } catch {
    console.log("[Migration] shouzuo_sessions.product_info 字段已存在，跳过迁移");
  }

  // 添加 image_analysis 列（JSON: ShouzuoImageAnalysis）
  try {
    sqlite.run("ALTER TABLE shouzuo_sessions ADD COLUMN image_analysis TEXT");
    console.log("[Migration] 已为 shouzuo_sessions 表添加 image_analysis 字段");
  } catch {
    console.log("[Migration] shouzuo_sessions.image_analysis 字段已存在，跳过迁移");
  }

  // 添加 showcase_task_ids 列（JSON array）
  try {
    sqlite.run("ALTER TABLE shouzuo_sessions ADD COLUMN showcase_task_ids TEXT");
    console.log("[Migration] 已为 shouzuo_sessions 表添加 showcase_task_ids 字段");
  } catch {
    console.log("[Migration] shouzuo_sessions.showcase_task_ids 字段已存在，跳过迁移");
  }

  // 添加 showcase_urls 列（JSON array）
  try {
    sqlite.run("ALTER TABLE shouzuo_sessions ADD COLUMN showcase_urls TEXT");
    console.log("[Migration] 已为 shouzuo_sessions 表添加 showcase_urls 字段");
  } catch {
    console.log("[Migration] shouzuo_sessions.showcase_urls 字段已存在，跳过迁移");
  }

  // 添加 frame_count 列
  try {
    sqlite.run("ALTER TABLE shouzuo_sessions ADD COLUMN frame_count INTEGER NOT NULL DEFAULT 5");
    console.log("[Migration] 已为 shouzuo_sessions 表添加 frame_count 字段");
  } catch {
    console.log("[Migration] shouzuo_sessions.frame_count 字段已存在，跳过迁移");
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
