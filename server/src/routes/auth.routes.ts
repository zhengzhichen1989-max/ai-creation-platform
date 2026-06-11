// ============================================================
// AI创作聚合平台 - 认证路由
// ============================================================

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import * as authService from "../services/auth.service.js";
import { sendSmsCode, verifySmsCode, SmsRateLimitError, SmsSendError } from "../services/sms.service.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { successResponse } from "../utils/helpers.js";
import { SmsCodeError } from "../utils/errors.js";
import { config } from "../config/index.js";

const registerSchema = z.object({
  email: z.string().email("邮箱格式不正确"),
  password: z.string().min(8, "密码至少8位"),
  nickname: z.string().min(1, "昵称不能为空").max(50, "昵称最多50个字符"),
  phone: z.string().regex(/^1[3-9]\d{9}$/, "手机号格式不正确"),
  smsCode: z.string().length(6, "验证码为6位数字"),
});

const loginSchema = z.object({
  email: z.string().email("邮箱格式不正确"),
  password: z.string().min(1, "密码不能为空"),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, "刷新令牌不能为空"),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token不能为空"),
  newPassword: z.string().min(8, "密码至少8位").max(128),
});

const forgotPasswordSchema = z.object({
  email: z.string().email("邮箱格式不正确"),
});

const verifySecurityAnswerSchema = z.object({
  email: z.string().email(),
  answer: z.string().min(1, "请输入答案"),
});

const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, "旧密码不能为空"),
  newPassword: z.string().min(8, "新密码至少8位").max(128),
});

const securityQuestionSchema = z.object({
  question: z.string().min(1, "安全问题不能为空").max(200),
  answer: z.string().min(1, "答案不能为空").max(200),
});

const sendSmsCodeSchema = z.object({
  phone: z.string().regex(/^1[3-9]\d{9}$/, "手机号格式不正确"),
});

const phoneLoginSchema = z.object({
  phone: z.string().regex(/^1[3-9]\d{9}$/, "手机号格式不正确"),
  code: z.string().length(6, "验证码为6位数字"),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  /** POST /api/v1/auth/register - 用户注册（需手机验证码实名） */
  app.post("/register", async (request, reply) => {
    const body = registerSchema.parse(request.body);

    // 先验证短信验证码
    if (!verifySmsCode(body.phone, body.smsCode)) {
      throw new SmsCodeError("验证码错误或已过期");
    }

    const result = await authService.register(body.email, body.password, body.nickname, body.phone);
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

  /** POST /api/v1/auth/reset-password - 用户提交新密码（公开） */
  app.post("/reset-password", async (request, reply) => {
    const body = resetPasswordSchema.parse(request.body);
    await authService.resetPassword(body.token, body.newPassword);
    reply.send(successResponse({ message: "密码重置成功" }));
  });

  /** POST /api/v1/auth/forgot-password - 发送密码重置邮件（公开） */
  app.post("/forgot-password", async (request, reply) => {
    const body = forgotPasswordSchema.parse(request.body);
    await authService.forgotPassword(body.email);
    // 无论用户是否存在，均返回相同提示，防止用户枚举攻击
    reply.send(successResponse({ message: "如果该邮箱已注册，重置链接已发送，请查收邮件" }));
  });

  /** POST /api/v1/auth/verify-security-answer - 验证安全问题答案（公开） */
  app.post("/verify-security-answer", async (request, reply) => {
    const body = verifySecurityAnswerSchema.parse(request.body);
    const result = await authService.verifySecurityAnswer(body.email, body.answer);
    reply.send(successResponse(result));
  });

  /** PUT /api/v1/auth/change-password - 修改密码（需认证） */
  app.put("/change-password", { preHandler: authMiddleware }, async (request, reply) => {
    const body = changePasswordSchema.parse(request.body);
    const userId = request.userId!;
    await authService.changePassword(userId, body.oldPassword, body.newPassword);
    reply.send(successResponse({ message: "密码修改成功" }));
  });

  /** PUT /api/v1/auth/security-question - 设置安全问题（需认证） */
  app.put("/security-question", { preHandler: authMiddleware }, async (request, reply) => {
    const body = securityQuestionSchema.parse(request.body);
    const userId = request.userId!;
    await authService.setSecurityQuestion(userId, body.question, body.answer);
    reply.send(successResponse({ message: "安全问题设置成功" }));
  });

  // ============================================================
  // 手机验证码登录
  // ============================================================

  /** POST /api/v1/auth/send-sms-code - 发送短信验证码（公开） */
  app.post("/send-sms-code", async (request, reply) => {
    const body = sendSmsCodeSchema.parse(request.body);
    try {
      const code = await sendSmsCode(body.phone);
      // 开发环境返回验证码到前端，便于测试
      const devCode = config.isDev && code ? { devCode: code } : {};
      reply.send(successResponse({ message: "验证码已发送", ...devCode }));
    } catch (err) {
      if (err instanceof SmsRateLimitError) {
        reply.status(429).send({ code: 429, data: null, message: err.message });
      } else if (err instanceof SmsSendError) {
        reply.status(500).send({ code: 5000, data: null, message: err.message });
      } else {
        throw err;
      }
    }
  });

  /** POST /api/v1/auth/phone-login - 手机验证码登录（公开） */
  app.post("/phone-login", async (request, reply) => {
    const body = phoneLoginSchema.parse(request.body);
    const result = await authService.phoneLogin(body.phone, body.code);
    reply.send(successResponse(result));
  });
}
