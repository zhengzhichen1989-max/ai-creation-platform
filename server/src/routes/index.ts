// ============================================================
// AI创作聚合平台 - 路由注册汇总
// ============================================================

import type { FastifyInstance } from "fastify";
import { authRoutes } from "./auth.routes.js";
import { modelsRoutes } from "./models.routes.js";
import { tasksRoutes } from "./tasks.routes.js";
import { creditsRoutes } from "./credits.routes.js";
import { generationsRoutes } from "./generations.routes.js";
import { adminRoutes } from "./admin.routes.js";
import { uploadRoutes } from "./upload.routes.js";
import { proxyRoutes } from "./proxy.routes.js";
import { paymentRoutes } from "./payment.routes.js";
import { shouzuoRoutes } from "./shouzuo.routes.js";
import toyVideoRoutes from "./toy-video.routes.js";
// 临时使用最小化版本恢复服务
import smartVideoRoutes from "./smart-video-minimal.js";

/** 注册所有路由 */
export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.register(authRoutes, { prefix: "/api/v1/auth" });
  app.register(modelsRoutes, { prefix: "/api/v1/models" });
  app.register(tasksRoutes, { prefix: "/api/v1/tasks" });
  app.register(creditsRoutes, { prefix: "/api/v1/credits" });
  app.register(generationsRoutes, { prefix: "/api/v1/generations" });
  app.register(adminRoutes, { prefix: "/api/v1/admin" });
  app.register(uploadRoutes, { prefix: "/api/v1/upload" });
  app.register(proxyRoutes, { prefix: "/api/v1/proxy" });
  app.register(paymentRoutes, { prefix: "/api/v1/payment" });
  app.register(shouzuoRoutes, { prefix: "/api/v1/shouzuo" });
  app.register(toyVideoRoutes, { prefix: "/api/v1/toy-video" });
  app.register(smartVideoRoutes, { prefix: "/api/v1/smart-video" });
}
