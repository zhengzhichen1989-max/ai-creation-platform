// ============================================================
// AI创作聚合平台 - 统一错误处理中间件
// ============================================================

import type { FastifyError, FastifyRequest, FastifyReply } from "fastify";
import { AppError, isAppError } from "../utils/errors.js";

/** 统一错误处理中间件 */
export function errorHandler(
  error: FastifyError | AppError | Error,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  // 记录错误日志
  request.log.error({
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name,
    },
    url: request.url,
    method: request.method,
  });

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
  if (error.validation) {
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
