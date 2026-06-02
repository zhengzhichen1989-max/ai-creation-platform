// ============================================================
// AI创作聚合平台 - 适配器抽象基类
// ============================================================

import type { AdapterConfig, AdapterResult, GenerateParams, ModelInfo, TaskStatusResult } from "../types/index.js";

/** 模型适配器接口 */
export interface IModelAdapter {
  /** 发起生成请求 */
  generate(prompt: string, params?: GenerateParams): Promise<AdapterResult>;

  /** 检查生成状态 */
  checkStatus(taskId: string): Promise<TaskStatusResult>;

  /** 获取模型信息 */
  getModelInfo(): ModelInfo;
}

/** 适配器抽象基类 */
export abstract class BaseAdapter implements IModelAdapter {
  protected config: AdapterConfig;

  constructor(config: AdapterConfig = {}) {
    this.config = config;
  }

  /** 抽象方法：子类必须实现生成逻辑 */
  abstract generate(prompt: string, params?: GenerateParams): Promise<AdapterResult>;

  /** 抽象方法：子类必须实现状态查询逻辑 */
  abstract checkStatus(taskId: string): Promise<TaskStatusResult>;

  /** 获取模型信息 */
  abstract getModelInfo(): ModelInfo;

  /** 统一错误处理 */
  protected handleError(error: unknown): never {
    const message = error instanceof Error ? error.message : "Unknown adapter error";
    throw new Error(`[Adapter Error] ${message}`);
  }

  /** 模拟延迟（MVP阶段使用） */
  protected async simulateDelay(minMs: number = 1000, maxMs: number = 3000): Promise<void> {
    const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    return new Promise((resolve) => setTimeout(resolve, delay));
  }
}
