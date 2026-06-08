// ============================================================
// AI创作聚合平台 - 生成任务路由
// ============================================================

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import * as taskService from "../services/task.service.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { successResponse, paginatedResponse } from "../utils/helpers.js";
import { addImageJob, addVideoJob, addTextJob } from "../queue/index.js";
import type { ModelType, TaskStatus, GenerateParams, ReferenceImage } from "../types/index.js";

const createTaskSchema = z.object({
  modelId: z.string().min(1, "模型ID不能为空"),
  prompt: z.string().min(1, "提示词不能为空").max(2000, "提示词最多2000个字符"),
  params: z.record(z.unknown()).optional(),
  duration: z.number().int().positive().optional(),
  resolution: z.string().optional(),
  referenceImages: z.array(z.object({
    url: z.string().min(1),
    role: z.enum(["first_frame", "last_frame", "reference_image", "edit_source"]),
  })).optional(),
});

export async function tasksRoutes(app: FastifyInstance): Promise<void> {
  /** POST /api/v1/tasks - 创建生成任务（需认证） */
  app.post("/", { preHandler: authMiddleware }, async (request, reply) => {
    const body = createTaskSchema.parse(request.body);
    const userId = request.userId!;

    // 创建任务（含积分扣减）
    const duration = body.duration;
    const resolution = body.resolution;
    const task = taskService.createTask(userId, body.modelId, body.prompt, body.params as GenerateParams, duration, resolution);

    // 构建参考图数据
    const referenceImages: ReferenceImage[] | undefined = body.referenceImages?.map(img => ({
      url: img.url,
      role: img.role as ReferenceImage["role"],
    }));

    // 根据类型推入对应队列
    if (task.type === "image") {
      await addImageJob({
        taskId: task.id,
        userId,
        modelId: task.modelId,
        prompt: task.prompt,
        type: "image",
        params: task.params ?? undefined,
        referenceImages,
      });
    } else if (task.type === "video") {
      await addVideoJob({
        taskId: task.id,
        userId,
        modelId: task.modelId,
        prompt: task.prompt,
        type: "video",
        params: task.params ?? undefined,
        referenceImages,
      });
    } else if (task.type === "text") {
      await addTextJob({
        taskId: task.id,
        userId,
        modelId: task.modelId,
        prompt: task.prompt,
        type: "text",
        params: task.params ?? undefined,
        referenceImages,
      });
    }

    reply.status(201).send(successResponse({
      id: task.id,
      status: task.status,
      costCredits: task.costCredits,
      createdAt: task.createdAt,
    }, "ok", 201));
  });

  /** GET /api/v1/tasks/:id - 获取任务详情（需认证） */
  app.get("/:id", { preHandler: authMiddleware }, async (request, reply) => {
    const taskId = (request.params as { id: string }).id;
    const userId = request.userId!;
    const task = taskService.getTask(taskId, userId);
    reply.send(successResponse(task));
  });

  /** GET /api/v1/tasks - 获取任务列表（需认证） */
  app.get("/", { preHandler: authMiddleware }, async (request, reply) => {
    const userId = request.userId!;
    const query = request.query as Record<string, string>;
    const status = query.status as TaskStatus | undefined;
    const type = query.type as ModelType | undefined;
    const page = parseInt(query.page || "1", 10);
    const pageSize = parseInt(query.pageSize || "20", 10);

    const result = taskService.listTasks(userId, status, type, page, pageSize);
    reply.send(paginatedResponse(result.items, result.total, page, pageSize));
  });

  /** POST /api/v1/tasks/:id/cancel - 取消任务（需认证） */
  app.post("/:id/cancel", { preHandler: authMiddleware }, async (request, reply) => {
    const taskId = (request.params as { id: string }).id;
    const userId = request.userId!;
    taskService.cancelTask(taskId, userId);
    reply.send(successResponse(null));
  });
}
