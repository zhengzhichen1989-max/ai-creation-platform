// ============================================================
// AI创作聚合平台 - Fastify 应用实例
// ============================================================

import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { registerRoutes } from "./routes/index.js";
import { errorHandler } from "./middleware/error.middleware.js";
import { config } from "./config/index.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** 创建 Fastify 应用实例 */
export async function buildApp() {
  const app = Fastify({
    logger: {
      level: config.isDev ? "info" : "warn",
    },
  });

  // 注册 CORS 插件
  await app.register(cors, {
    origin: true, // 开发环境允许所有来源
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  });

  // 注册 multipart 插件（用于图片上传）
  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
    },
  });

  // 注册静态文件服务（/uploads 目录）
  // @fastify/static 要求 root 必须是绝对路径
  const uploadsDir = path.isAbsolute(config.uploadDir)
    ? config.uploadDir
    : path.resolve(__dirname, "../../", config.uploadDir);
  await app.register(fastifyStatic, {
    root: uploadsDir,
    prefix: "/uploads/",
    decorateReply: false,
  });

  // 注册路由
  await registerRoutes(app);

  // 注册统一错误处理
  app.setErrorHandler(errorHandler);

  // 健康检查
  app.get("/api/v1/health", async () => {
    return { code: 200, data: { status: "ok", timestamp: new Date().toISOString() }, message: "ok" };
  });

  return app;
}
