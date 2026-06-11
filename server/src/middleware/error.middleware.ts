// ============================================================
// 智影工厂 - 统一错误处理中间件
// ============================================================

import type { FastifyError, FastifyRequest, FastifyReply } from "fastify";
import { ZodError } from "zod";
import { AppError, isAppError } from "../utils/errors.js";

/** 统一错误处理中间件 */
export function errorHandler(
  error: FastifyError | AppError | Error,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  // 记录错误日志（跳过 Zod 验证错误的完整 stack）
  request.log.error({
    error: {
      message: error.message,
      stack: error instanceof ZodError ? undefined : error.stack,
      name: error.name,
    },
    url: request.url,
    method: request.method,
  });

  // Zod 参数验证错误
  if (error instanceof ZodError) {
    const messages = error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    reply.status(400).send({
      code: 4003,
      data: null,
      message: `参数验证失败: ${messages}`,
    });
    return;
  }

  // 自定义应用错误
  if (isAppError(error)) {
    reply.status(error.statusCode).send({
      code: error.code,
      data: null,
      message: error.message,
    });
    return;
  }

  // Fastify 验证错误
  if ((error as FastifyError).validation) {
    reply.status(400).send({
      code: 4003,
      data: null,
      message: `参数验证失败: ${error.message}`,
    });
    return;
  }

  // 未知错误
  const statusCode = (error as FastifyError).statusCode || 500;
  reply.status(statusCode).send({
    code: 5000,
    data: null,
    message: statusCode === 500 ? "服务器内部错误" : error.message,
  });
}
