// ============================================================
// AI创作聚合平台 - 认证路由
// ============================================================

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import * as authService from "../services/auth.service.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { successResponse } from "../utils/helpers.js";

const registerSchema = z.object({
  email: z.string().email("邮箱格式不正确"),
  password: z.string().min(8, "密码至少8位"),
  nickname: z.string().min(1, "昵称不能为空").max(50, "昵称最多50个字符"),
});

const loginSchema = z.object({
  email: z.string().email("邮箱格式不正确"),
  password: z.string().min(1, "密码不能为空"),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, "刷新令牌不能为空"),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  /** POST /api/v1/auth/register - 用户注册 */
  app.post("/register", async (request, reply) => {
    const body = registerSchema.parse(request.body);
    const result = await authService.register(body.email, body.password, body.nickname);
    reply.status(201).send(successResponse(result, "ok", 201));
  });

  /** POST /api/v1/auth/login - 用户登录 */
  app.post("/login", async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const result = await authService.login(body.email, body.password);
    reply.send(successResponse(result));
  });

  /** POST /api/v1/auth/refresh - 刷新Token */
  app.post("/refresh", async (request, reply) => {
    const body = refreshSchema.parse(request.body);
    const tokens = authService.refreshTokens(body.refreshToken);
    reply.send(successResponse(tokens));
  });

  /** GET /api/v1/auth/me - 获取当前用户信息（需认证） */
  app.get("/me", { preHandler: authMiddleware }, async (request, reply) => {
    const userId = request.userId!;
    const user = await authService.getUserById(userId);
    reply.send(successResponse(user));
  });
}
