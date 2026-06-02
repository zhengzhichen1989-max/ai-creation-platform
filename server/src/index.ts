// ============================================================
// AI创作聚合平台 - 服务入口
// ============================================================

import { config } from "./config/index.js";
import { initDatabase, closeDatabase } from "./db/index.js";
import { runMigration } from "./db/migrate.js";
import { initQueues, registerImageProcessor, registerVideoProcessor } from "./queue/index.js";
import { imageProcessor } from "./queue/image.worker.js";
import { videoProcessor } from "./queue/video.worker.js";
import { buildApp } from "./app.js";
import * as expiryService from "./services/expiry.service.js";
import fs from "fs";
import path from "path";

async function main() {
  console.log("=== AI创作聚合平台 - 启动中 ===");
  console.log(`环境: ${config.nodeEnv}`);
  console.log(`端口: ${config.port}`);

  // 1. 确保必要目录存在
  const dataDir = path.dirname(config.databaseUrl);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(config.uploadDir)) {
    fs.mkdirSync(config.uploadDir, { recursive: true });
  }

  // 2. 初始化数据库
  console.log("[Init] 初始化数据库...");
  await initDatabase();
  await runMigration();

  // 3. 初始化队列
  console.log("[Init] 初始化任务队列...");
  await initQueues();
  registerImageProcessor(imageProcessor);
  registerVideoProcessor(videoProcessor);

  // 4. 构建 Fastify 应用
  console.log("[Init] 构建 Fastify 应用...");
  const app = await buildApp();

  // 5. 注册优雅退出
  const gracefulShutdown = async (signal: string) => {
    console.log(`\n收到 ${signal} 信号，正在优雅关闭...`);
    await app.close();
    closeDatabase();
    console.log("服务已关闭");
    process.exit(0);
  };

  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

  // 6. 启动 HTTP 服务
  try {
    await app.listen({ port: config.port, host: "0.0.0.0" });
    console.log(`=== 服务启动成功 ===`);
    console.log(`访问: http://localhost:${config.port}`);
    console.log(`健康检查: http://localhost:${config.port}/api/v1/health`);
    console.log(`API文档: http://localhost:${config.port}/api/v1`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  // 7. 注册过期清理定时任务
  setInterval(() => {
    const result = expiryService.cleanExpiredResults();
    if (result.cleaned > 0) {
      console.log(`[Expiry] 已清理 ${result.cleaned} 条过期结果`);
    }
  }, 60 * 60 * 1000); // 每小时检查一次

  // 启动时也执行一次
  const initialClean = expiryService.cleanExpiredResults();
  if (initialClean.cleaned > 0) {
    console.log(`[Expiry] 启动清理: 已清理 ${initialClean.cleaned} 条过期结果`);
  }
}

main().catch((err) => {
  console.error("服务启动失败:", err);
  process.exit(1);
});
