// ============================================================
// AI创作聚合平台 - 管理员权限中间件
// ============================================================

import type { FastifyRequest, FastifyReply } from "fastify";
import { ForbiddenError } from "../utils/errors.js";

/** 管理员权限中间件（需在 authMiddleware 之后使用） */
export async function adminMiddleware(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  if (request.userRole !== "admin") {
    throw new ForbiddenError();
  }
}
