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

/** 判断是否为自定义应用错误 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
