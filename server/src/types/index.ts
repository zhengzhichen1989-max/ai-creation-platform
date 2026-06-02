// ============================================================
// AI创作聚合平台 - 共享类型定义
// ============================================================

/** API统一响应格式 */
export interface ApiResponse<T = unknown> {
  code: number;
  data: T;
  message: string;
}

/** 分页请求参数 */
export interface PaginationParams {
  page: number;
  pageSize: number;
}

/** 分页响应数据 */
export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** 认证结果 */
export interface AuthResult {
  user: UserInfo;
  accessToken: string;
  refreshToken: string;
}

/** 用户信息（不含密码） */
export interface UserInfo {
  id: number;
  email: string;
  nickname: string;
  avatarUrl: string | null;
  role: string;
}

/** JWT Token Payload */
export interface JwtPayload {
  userId: number;
  email: string;
  role?: string;
}

/** 模型类型 */
export type ModelType = "image" | "video" | "text";

/** 模型定位 */
export type ModelCategory = "starter" | "standard" | "advanced" | "flagship";

/** 任务状态 */
export type TaskStatus = "pending" | "processing" | "completed" | "failed" | "cancelled";

/** 流水类型 */
export type TransactionType = "purchase" | "consume" | "refund";

/** 参考图类型 */
export type ReferenceImageRole = "first_frame" | "last_frame" | "reference_image" | "edit_source";

/** 参考图信息 */
export interface ReferenceImage {
  url: string;        // 图片URL（服务器本地路径）
  role: ReferenceImageRole;
}

/** 生成参数 */
export interface GenerateParams {
  width?: number;
  height?: number;
  steps?: number;
  seed?: number;
  duration?: number;
  fps?: number;
  max_tokens?: number;
  referenceImages?: ReferenceImage[];
  [key: string]: unknown;
}

/** 适配器生成结果 */
export interface AdapterResult {
  taskId: string;
  status: TaskStatus;
  resultUrl?: string;
  thumbnailUrl?: string;
  progress?: number;
  errorMessage?: string;
}

/** 任务状态查询结果 */
export interface TaskStatusResult {
  status: TaskStatus;
  progress: number;
  resultUrl?: string;
  errorMessage?: string;
}

/** 模型信息 */
export interface ModelInfo {
  id: string;
  name: string;
  type: ModelType;
  category: ModelCategory;
  costCredits: number;
  durationOptions: number[] | null;
  durationPricing: Record<string, number> | null;
}

/** 适配器配置 */
export interface AdapterConfig {
  apiKey?: string;
  apiBaseUrl?: string;
  timeout?: number;
  [key: string]: unknown;
}

/** 注册请求 */
export interface RegisterRequest {
  email: string;
  password: string;
  nickname: string;
}

/** 登录请求 */
export interface LoginRequest {
  email: string;
  password: string;
}

/** 刷新Token请求 */
export interface RefreshTokenRequest {
  refreshToken: string;
}

/** 创建任务请求 */
export interface CreateTaskRequest {
  modelId: string;
  prompt: string;
  params?: GenerateParams;
  duration?: number;
  referenceImages?: ReferenceImage[];
}

/** 积分购买请求 */
export interface PurchaseCreditsRequest {
  packageId: string;
}

/** 积分余额 */
export interface CreditsBalance {
  userId: number;
  balance: number;
}

/** 积分包 */
export interface CreditsPackageInfo {
  id: string;
  name: string;
  credits: number;
  priceCents: number;
  unitLabel: string | null;
}

/** 积分流水 */
export interface CreditTransactionInfo {
  id: number;
  userId: number;
  type: TransactionType;
  amount: number;
  balanceAfter: number;
  referenceId: string | null;
  description: string | null;
  createdAt: string;
}

/** 生成任务 */
export interface GenerationTaskInfo {
  id: string;
  userId: number;
  modelId: string;
  type: ModelType;
  prompt: string;
  params: string | null;
  status: TaskStatus;
  costCredits: number;
  resultUrl: string | null;
  resultThumbnail: string | null;
  errorMessage: string | null;
  progress: number;
  startedAt: string | null;
  completedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

/** 生成历史项 */
export interface GenerationHistoryItem {
  id: string;
  modelId: string;
  modelName: string;
  type: ModelType;
  prompt: string;
  resultUrl: string | null;
  resultThumbnail: string | null;
  costCredits: number;
  status: TaskStatus;
  expiresAt: string | null;
  createdAt: string;
}

/** 模型列表项 */
export interface ModelListItem {
  id: string;
  name: string;
  type: ModelType;
  category: ModelCategory;
  costCredits: number;
  config: string | null;
  durationOptions: number[] | null;
  durationPricing: Record<string, number> | null;
}
