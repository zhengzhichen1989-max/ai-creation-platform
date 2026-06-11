// 临时脚本：给测试账号加积分
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import initSqlJs from "sql.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, "..", "data", "ai-creation.db");

async function main() {
  const SQL = await initSqlJs();

  // 加载现有数据库
  const fileBuffer = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(fileBuffer);

  // 查询测试账号
  const testEmail = "testfix@test.com";
  const userRows = db.exec("SELECT id, email FROM users WHERE email = ?", [testEmail]);
  if (userRows.length === 0 || userRows[0].values.length === 0) {
    console.log("未找到测试账号:", testEmail);
    process.exit(1);
  }

  const userId = userRows[0].values[0][0];
  console.log(`找到测试账号: ${testEmail}, userId=${userId}`);

  // 查询当前余额
  const balanceRows = db.exec("SELECT balance, version FROM credit_accounts WHERE user_id = ?", [userId]);
  let currentBalance = 0;
  let currentVersion = 0;

  if (balanceRows.length > 0 && balanceRows[0].values.length > 0) {
    currentBalance = balanceRows[0].values[0][0];
    currentVersion = balanceRows[0].values[0][1];
    console.log(`当前余额: ${currentBalance}, 版本: ${currentVersion}`);
  } else {
    console.log("积分账户不存在，将创建...");
    db.run(
      "INSERT INTO credit_accounts (user_id, balance, version, created_at, updated_at) VALUES (?, 0, 0, datetime('now'), datetime('now'))",
      [userId]
    );
  }

  const addAmount = 500;
  const newBalance = currentBalance + addAmount;
  const newVersion = currentVersion + 1;

  // 更新余额
  db.run(
    "UPDATE credit_accounts SET balance = ?, version = ?, updated_at = datetime('now') WHERE user_id = ?",
    [newBalance, newVersion, userId]
  );

  // 记录流水
  db.run(
    "INSERT INTO credit_transactions (user_id, type, amount, balance_after, reference_id, description) VALUES (?, 'recharge', ?, ?, ?, ?)",
    [userId, addAmount, newBalance, "manual-topup", "后台手动充值500积分"]
  );

  // 保存到文件
  const exportData = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(exportData));

  console.log(`✅ 成功给 ${testEmail} 添加 ${addAmount} 积分，当前余额: ${newBalance}`);
}

main().catch(err => {
  console.error("脚本执行失败:", err);
  process.exit(1);
});
