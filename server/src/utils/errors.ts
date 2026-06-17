// ============================================================
// AI创作聚合平台 - 自定义错误类
// ============================================================

/** 应用基础错误 */
export class AppError extends Error {
  public readonly code: number;
  public readonly statusCode: number;

  constructor(message: string, code: number, statusCode: number = 400) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

/** 认证错误（未登录或Token过期） */
export class AuthenticationError extends AppError {
  constructor(message: string = "未登录或Token已过期") {
    super(message, 4010, 401);
    this.name = "AuthenticationError";
  }
}

/** 积分余额不足 */
export class InsufficientCreditsError extends AppError {
  constructor(message: string = "积分余额不足") {
    super(message, 4002, 400);
    this.name = "InsufficientCreditsError";
  }
}

/** 模型不存在 */
export class ModelNotFoundError extends AppError {
  constructor(modelId: string) {
    super(`模型不存在: ${modelId}`, 4001, 404);
    this.name = "ModelNotFoundError";
  }
}

/** 任务不存在 */
export class TaskNotFoundError extends AppError {
  constructor(taskId: string) {
    super(`任务不存在: ${taskId}`, 4001, 404);
    this.name = "TaskNotFoundError";
  }
}

/** 参数验证失败 */
export class ValidationError extends AppError {
  constructor(message: string = "参数验证失败") {
    super(message, 4003, 400);
    this.name = "ValidationError";
  }
}

/** 用户已存在 */
export class UserExistsError extends AppError {
  constructor(email: string) {
    super(`邮箱已被注册: ${email}`, 4004, 409);
    this.name = "UserExistsError";
  }
}

/** 用户不存在或密码错误 */
export class InvalidCredentialsError extends AppError {
  constructor(message: string = "邮箱或密码错误") {
    super(message, 4005, 401);
    this.name = "InvalidCredentialsError";
  }
}

/** 任务无法取消 */
export class TaskCannotCancelError extends AppError {
  constructor(message: string = "当前任务状态无法取消") {
    super(message, 4006, 400);
    this.name = "TaskCannotCancelError";
  }
}

/** 积分包不存在 */
export class PackageNotFoundError extends AppError {
  constructor(packageId: string) {
    super(`积分包不存在: ${packageId}`, 4001, 404);
    this.name = "PackageNotFoundError";
  }
}

/** 权限不足（非管理员） */
export class ForbiddenError extends AppError {
  constructor(message: string = "权限不足，需要管理员权限") {
    super(message, 4030, 403);
    this.name = "ForbiddenError";
  }
}

/** 乐观锁冲突 */
export class OptimisticLockError extends AppError {
  constructor(message: string = "操作冲突，请重试") {
    super(message, 4007, 409);
    this.name = "OptimisticLockError";
  }
}

/** 用户不存在 */
export class UserNotFoundError extends AppError {
  constructor(userId?: number | string) {
    super(userId ? `用户不存在: ${userId}` : "用户不存在", 4041, 404);
    this.name = "UserNotFoundError";
  }
}

/** 用户已被禁用 */
export class UserDisabledError extends AppError {
  constructor(message: string = "账户已被禁用") {
    super(message, 4012, 401);
    this.name = "UserDisabledError";
  }
}

/** 密码重置Token无效或过期 */
export class InvalidResetTokenError extends AppError {
  constructor(message: string = "重置链接无效或已过期") {
    super(message, 4011, 401);
    this.name = "InvalidResetTokenError";
  }
}

/** 安全问题验证失败 */
export class SecurityQuestionError extends AppError {
  constructor(message: string = "安全问题答案错误") {
    super(message, 4013, 401);
    this.name = "SecurityQuestionError";
  }
}

/** 短信验证码错误 */
export class SmsCodeError extends AppError {
  constructor(message: string = "验证码错误或已过期") {
    super(message, 4014, 400);
    this.name = "SmsCodeError";
  }
}

/** 手机号已被注册 */
export class PhoneExistsError extends AppError {
  constructor(phone: string) {
    super(`手机号已被注册: ${phone}`, 4008, 409);
    this.name = "PhoneExistsError";
  }
}

/** 服饰短片会话不存在 */
export class ShouzuoSessionNotFoundError extends AppError {
  constructor(sessionId: string) {
    super(`会话不存在: ${sessionId}`, 4001, 404);
    this.name = "ShouzuoSessionNotFoundError";
  }
}

/** 服饰短片会话状态不允许操作 */
export class ShouzuoSessionStateError extends AppError {
  constructor(message: string = "当前会话状态不允许此操作") {
    super(message, 4009, 400);
    this.name = "ShouzuoSessionStateError";
  }
}

/** 判断是否为自定义应用错误 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * 将上游 API 原始错误码翻译为用户可读的中文提示
 * 用于 GrsAI / DMXAPI 等上游返回的原始错误码（如 output_moderation）
 */
const ERROR_TRANSLATIONS: Record<string, string> = {
  output_moderation: "内容不符合安全规范，请修改描述后重试",
  input_moderation: "输入内容触发安全审核，请修改后重试",
  content_filter: "内容被安全策略拦截，请调整描述",
  content_policy_violation: "内容违反使用政策，请修改后重试",
  safety_system: "系统安全审核未通过，请调整内容",
  insufficient_credits: "上游服务额度不足，请联系客服",
  rate_limit: "请求太频繁，请稍后重试",
  timeout: "生成超时，请稍后重试",
};

export function translateError(raw: string): string {
  // 精确匹配
  if (ERROR_TRANSLATIONS[raw]) return ERROR_TRANSLATIONS[raw];
  // 模糊匹配（raw 中可能包含错误码）
  const lower = raw.toLowerCase();
  for (const [key, val] of Object.entries(ERROR_TRANSLATIONS)) {
    if (lower.includes(key)) return val;
  }
  return raw;
}
