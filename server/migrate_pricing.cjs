/**
 * 数据库定价迁移脚本 - 直接更新生产环境的模型积分消耗和积分套餐
 * 用法: node migrate_pricing.cjs
 */
const initSqlJs = require("sql.js");
const fs = require("fs");
const path = require("path");

async function main() {
  const SQL = await initSqlJs();
  const dbPath = path.resolve("data/ai-creation.db");
  const buf = fs.readFileSync(dbPath);
  const db = new SQL.Database(buf);

  console.log("=== 开始定价迁移 ===\n");

  // 1. 更新模型积分消耗和duration_pricing
  const modelUpdates = [
    { id: "gpt-image-2", cost_credits: 3, duration_pricing: null },
    { id: "nano-banana-pro", cost_credits: 6, duration_pricing: null },
    { id: "nano-banana-fast", cost_credits: 1, duration_pricing: null },
    { id: "flux-pro", cost_credits: 4, duration_pricing: null },
    { id: "doubao-seedance-2-0-260128", cost_credits: 10, duration_pricing: '{"5":10,"10":20,"15":30}' },
    { id: "doubao-seedance-2-0-fast-260128", cost_credits: 6, duration_pricing: '{"5":6,"10":12}' },
    { id: "sora-2", cost_credits: 20, duration_pricing: '{"4":20,"8":40,"12":60}' },
    { id: "kling-v3-video-generation", cost_credits: 5, duration_pricing: '{"5":5,"10":10}' },
    { id: "deepseek-chat", cost_credits: 1, duration_pricing: null },
    { id: "qwen-max", cost_credits: 2, duration_pricing: null },
  ];

  console.log("1. 更新模型积分消耗:");
  for (const m of modelUpdates) {
    db.run(
      "UPDATE ai_models SET cost_credits = ?, duration_pricing = ? WHERE id = ?",
      [m.cost_credits, m.duration_pricing, m.id]
    );
    console.log(`   ${m.id}: cost_credits=${m.cost_credits}, duration_pricing=${m.duration_pricing || 'null'}`);
  }

  // 2. 删除旧积分套餐（先禁用trial），插入新套餐
  console.log("\n2. 更新积分套餐:");
  
  // 先将旧套餐全部下架
  db.run("UPDATE credit_packages SET enabled = 0");
  console.log("   旧套餐已下架");

  // 删除旧套餐
  db.run("DELETE FROM credit_packages");
  console.log("   旧套餐已删除");

  // 插入新套餐
  const newPackages = [
    { id: "basic", name: "基础套餐", credits: 500, price_cents: 6800, unit_label: "约0.14元/积分", enabled: 1, sort_order: 1 },
    { id: "pro", name: "专业套餐", credits: 1300, price_cents: 15800, unit_label: "约0.12元/积分", enabled: 1, sort_order: 2 },
    { id: "ultimate", name: "旗舰套餐", credits: 2800, price_cents: 29900, unit_label: "约0.11元/积分", enabled: 1, sort_order: 3 },
  ];

  for (const p of newPackages) {
    db.run(
      "INSERT INTO credit_packages (id, name, credits, price_cents, unit_label, enabled, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [p.id, p.name, p.credits, p.price_cents, p.unit_label, p.enabled, p.sort_order]
    );
    console.log(`   ${p.name}: ${p.credits}积分 / ¥${(p.price_cents / 100).toFixed(0)} (${p.unit_label})`);
  }

  // 3. 保存数据库
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
  console.log("\n=== 数据库已保存 ===");

  // 4. 验证
  console.log("\n验证:");
  const models = db.exec("SELECT id, cost_credits, duration_pricing FROM ai_models ORDER BY sort_order");
  if (models.length > 0) {
    for (const row of models[0].values) {
      console.log(`   ${row[0]}: ${row[1]}积分 ${row[2] ? '(' + row[2] + ')' : ''}`);
    }
  }

  const packages = db.exec("SELECT id, name, credits, price_cents FROM credit_packages WHERE enabled = 1 ORDER BY sort_order");
  if (packages.length > 0) {
    for (const row of packages[0].values) {
      console.log(`   ${row[1]}: ${row[2]}积分 / ¥${(Number(row[3]) / 100).toFixed(0)}`);
    }
  }

  db.close();
  console.log("\n=== 迁移完成 ===");
}

main().catch(e => {
  console.error("迁移失败:", e.message);
  process.exit(1);
});
