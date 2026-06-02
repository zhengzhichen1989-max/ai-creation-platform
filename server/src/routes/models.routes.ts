// ============================================================
// AI创作聚合平台 - 模型列表路由
// ============================================================

import type { FastifyInstance } from "fastify";
import * as modelService from "../services/model.service.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { successResponse } from "../utils/helpers.js";
import type { ModelType } from "../types/index.js";

export async function modelsRoutes(app: FastifyInstance): Promise<void> {
  /** GET /api/v1/models - 获取模型列表（需认证） */
  app.get("/", { preHandler: authMiddleware }, async (request, reply) => {
    const type = request.query.type as ModelType | undefined;
    const models = modelService.listModels(type);
    reply.send(successResponse(models));
  });
}
