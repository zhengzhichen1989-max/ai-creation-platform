// ============================================================
// AI创作聚合平台 - 数据库连接初始化（sql.js 纯JS实现）
// ============================================================

import initSqlJs, { type Database as SqlJsDatabase } from "sql.js";
import { config } from "../config/index.js";
import fs from "fs";
import path from "path";

let sqlJsDb: SqlJsDatabase | null = null;
let saveTimer: ReturnType<typeof setInterval> | null = null;
let savePending = false;

const DB_PATH = config.databaseUrl;

/** 获取 sql.js 数据库实例 */
export function getDb(): SqlJsDatabase {
  if (sqlJsDb) return sqlJsDb;
  throw new Error("数据库尚未初始化，请先调用 initDatabase()");
}

/** 初始化数据库 */
export async function initDatabase(): Promise<void> {
  if (sqlJsDb) return;

  // 确保数据目录存在
  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // 初始化 sql.js
  const SQL = await initSqlJs();

  // 尝试从文件加载已有数据库
  let dbData: Uint8Array | undefined;
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    dbData = new Uint8Array(fileBuffer);
  }

  sqlJsDb = new SQL.Database(dbData);

  // [调试] 打印加载数据库后的 test001 积分
  try {
    const rows = sqlJsDb.exec("SELECT users.email, ca.balance FROM users LEFT JOIN credit_accounts ca ON users.id = ca.user_id WHERE users.email = 'test001@zhiyingworks.cn'");
    if (rows.length > 0 && rows[0].values!.length > 0) {
      console.log(`[DB Init] test001 积分: ${rows[0].values![0][1]}`);
    }
  } catch (e: any) {
    console.log(`[DB Init] 查询 test001 积分失败: ${e.message}`);
  }


  // 启用外键约束
  sqlJsDb.run("PRAGMA foreign_keys = ON;");

  // 定期保存数据库到文件（sql.js 是内存数据库）
  saveTimer = setInterval(() => {
    saveDatabase();
  }, 5000);

  // 防止进程退出时定时器阻止退出
  if (saveTimer.unref) {
    saveTimer.unref();
  }

  console.log("[DB] 数据库初始化完成（sql.js 模式）");
}

/** 将内存数据库保存到文件（异步非阻塞，避免阻塞事件循环） */
export function saveDatabase(): void {
  if (!sqlJsDb || savePending) return;
  savePending = true;

  setImmediate(() => {
    try {
      const data = sqlJsDb!.export();
      const buffer = Buffer.from(data);
      fs.writeFile(DB_PATH, buffer, (err) => {
        if (err) console.error("[DB] 异步保存失败:", err);
      });
    } catch (err) {
      console.error("[DB] 导出数据库失败:", err);
    } finally {
      savePending = false;
    }
  });
}

/** 关闭数据库 —— 同步强制保存确保数据不丢失 */
export function closeDatabase(): void {
  if (saveTimer) {
    clearInterval(saveTimer);
    saveTimer = null;
  }
  if (sqlJsDb) {
    try {
      const data = sqlJsDb.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(DB_PATH, buffer);
      console.log("[DB] 关闭前已同步保存");
    } catch (err) {
      console.error("[DB] 关闭前保存失败:", err);
    }
    sqlJsDb.close();
    sqlJsDb = null;
  }
}
