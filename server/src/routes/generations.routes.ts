// ============================================================
// AI创作聚合平台 - 生成历史路由
// ============================================================

import type { FastifyInstance } from "fastify";
import * as generationService from "../services/generation.service.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { successResponse, paginatedResponse } from "../utils/helpers.js";
import type { ModelType } from "../types/index.js";

export async function generationsRoutes(app: FastifyInstance): Promise<void> {
  /** GET /api/v1/generations - 获取生成历史列表（需认证） */
  app.get("/", { preHandler: authMiddleware }, async (request, reply) => {
    const userId = request.userId!;
    const query = request.query as Record<string, string>;
    const type = query.type as ModelType | undefined;
    const modelId = query.modelId as string | undefined;
    const page = parseInt(query.page || "1", 10);
    const pageSize = parseInt(query.pageSize || "20", 10);

    const result = generationService.listGenerations(userId, type, modelId, page, pageSize);
    reply.send(paginatedResponse(result.items, result.total, page, pageSize));
  });

  /** GET /api/v1/generations/:id - 获取单条生成详情（需认证） */
  app.get("/:id", { preHandler: authMiddleware }, async (request, reply) => {
    const taskId = (request.params as { id: string }).id;
    const userId = request.userId!;
    const generation = generationService.getGeneration(taskId, userId);
    reply.send(successResponse(generation));
  });
}
