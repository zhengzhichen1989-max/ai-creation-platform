// ============================================================
// AI创作聚合平台 - Fastify 应用实例
// ============================================================

import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fs from "fs";
import { registerRoutes } from "./routes/index.js";
import { errorHandler } from "./middleware/error.middleware.js";
import { config } from "./config/index.js";
import path from "path";

/** MIME 类型映射 */
const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".txt": "text/plain",
};

/** 创建 Fastify 应用实例 */
export async function buildApp() {
  const app = Fastify({
    logger: {
      level: config.isDev ? "info" : "warn",
    },
  });

  // 保留原始JSON body用于微信回调签名验证
  // Fastify默认将JSON body解析为对象，JSON.stringify重新序列化后字段顺序可能与微信原始请求不同
  // 因此需要自定义content type parser来保留原始body字符串
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    try {
      const json = JSON.parse(body as string);
      // 将原始字符串挂到request上供后续使用
      (req as any).rawBody = body as string;
      done(null, json);
    } catch (err: any) {
      err.statusCode = 400;
      done(err);
    }
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

  // 注册静态文件服务 — 使用自定义通配路由代替 @fastify/static
  // config.uploadDir 已在 config/index.ts 中通过 process.cwd() 解析为绝对路径
  const uploadsDir = config.uploadDir;

  app.get("/uploads/*", async (request, reply) => {
    const relativePath = (request.params as { "*": string })["*"];
    // 安全检查：防止路径遍历
    const safePath = relativePath.replace(/\.\./g, "").replace(/\/\//g, "");
    const filePath = path.join(uploadsDir, safePath);

    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      return reply.status(404).send({ code: 404, message: "文件不存在" });
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    const stream = fs.createReadStream(filePath);

    reply.header("Content-Type", contentType);
    reply.header("Cache-Control", "public, max-age=86400"); // 缓存1天
    return reply.send(stream);
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
