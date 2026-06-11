// ============================================================
// AI创作聚合平台 - 内容审核中间件
// 在路由 preHandler 阶段检查 prompt，拦截违规内容
// ============================================================

import type { FastifyRequest, FastifyReply } from "fastify";
import { checkPrompt, type ModerationResult } from "../services/content-moderation.service.js";

/** 需要审核的字段名列表 */
const PROMPT_FIELDS = ["prompt", "content", "description", "feedback"] as const;

/** 从请求 body 中提取所有需要检查的文本字段 */
function extractTextFields(body: unknown): string[] {
  const texts: string[] = [];
  if (!body || typeof body !== "object") return texts;

  const obj = body as Record<string, unknown>;

  for (const field of PROMPT_FIELDS) {
    if (typeof obj[field] === "string" && obj[field]) {
      texts.push(obj[field] as string);
    }
  }

  return texts;
}

/** Fastify preHandler 钩子 */
export async function contentModerationMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const texts = extractTextFields(request.body);

  if (texts.length === 0) {
    return;
  }

  const violations: ModerationResult[] = [];

  for (const text of texts) {
    const result = await checkPrompt(text);
    if (!result.safe) {
      violations.push(result);
    }
  }

  if (violations.length > 0) {
    // 取第一个违规原因返回
    const violation = violations[0];
    const msg = violation.reason || "内容不符合安全规范";
    reply.code(400).send({
      success: false,
      message: msg,
      error: msg,
      errorCode: "CONTENT_MODERATION_FAILED",
    });
  }
}
