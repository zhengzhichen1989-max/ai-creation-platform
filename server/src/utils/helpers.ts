// ============================================================
// AI创作聚合平台 - 工具函数
// ============================================================

import type { ApiResponse } from "../types/index.js";

/** 创建成功响应 */
export function successResponse<T>(data: T, message: string = "ok", code: number = 200): ApiResponse<T> {
  return { code, data, message };
}

/** 创建分页响应 */
export function paginatedResponse<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
  message: string = "ok"
): ApiResponse<{ items: T[]; total: number; page: number; pageSize: number }> {
  return {
    code: 200,
    data: { items, total, page, pageSize },
    message,
  };
}

/** 安全解析 JSON 字符串 */
export function safeJsonParse<T>(jsonString: string | null, fallback: T): T {
  if (!jsonString) return fallback;
  try {
    return JSON.parse(jsonString) as T;
  } catch {
    return fallback;
  }
}

/** 延迟指定毫秒数 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 生成当前时间的 ISO 字符串 */
export function nowISO(): string {
  return new Date().toISOString().replace("T", " ").replace(/\.\d+Z$/, "");
}

/** 验证邮箱格式 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/** 截断字符串到指定长度 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "...";
}
