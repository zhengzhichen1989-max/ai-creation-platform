// ============================================================
// AI创作聚合平台 - JWT认证中间件
// ============================================================

import type { FastifyRequest, FastifyReply } from "fastify";
import { AuthenticationError } from "../utils/errors.js";
import { getDb } from "../db/index.js";

/** 扩展 FastifyRequest 以支持 user 属性 */
declare module "fastify" {
  interface FastifyRequest {
    userId?: number;
    userEmail?: string;
    userRole?: string;
  }
}

/** JWT 认证中间件 */
export async function authMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new AuthenticationError("未提供认证令牌");
    }

    const token = authHeader.substring(7); // 去掉 "Bearer "

    // 简化 JWT 验证：解码 payload
    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new AuthenticationError("无效的令牌格式");
    }

    let payload: { userId?: number; email?: string; role?: string; type?: string; exp?: number };
    try {
      payload = JSON.parse(atob(parts[1]));
    } catch {
      throw new AuthenticationError("无效的令牌");
    }

    // 检查 token 类型
    if (payload.type !== "access") {
      throw new AuthenticationError("不是访问令牌");
    }

    // 检查过期时间
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      throw new AuthenticationError("令牌已过期");
    }

    // 检查必要字段
    if (!payload.userId || !payload.email) {
      throw new AuthenticationError("无效的令牌内容");
    }

    // 将用户信息挂载到 request 对象
    request.userId = payload.userId;
    request.userEmail = payload.email;

    // 从数据库查询用户角色（确保角色始终是最新的）
    const db = getDb();
    const roleRows = db.exec("SELECT role FROM users WHERE id = ?", [payload.userId]);
    if (roleRows.length > 0 && roleRows[0].values.length > 0) {
      request.userRole = roleRows[0].values[0][0] as string;
    } else {
      request.userRole = "user";
    }
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }
    throw new AuthenticationError("令牌验证失败");
  }
}
