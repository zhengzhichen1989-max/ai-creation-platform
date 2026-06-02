// ============================================================
// AI创作聚合平台 - 可灵AI 适配器
// ============================================================

import { BaseAdapter } from "./base.adapter.js";
import type { AdapterResult, GenerateParams, ModelInfo, TaskStatusResult } from "../types/index.js";
import { v4 as uuidv4 } from "uuid";

export class KlingAdapter extends BaseAdapter {
  generate(prompt: string, params?: GenerateParams): Promise<AdapterResult> {
    // 视频生成需要更长时间
    return this.simulateDelay(5000, 10000).then(() => {
      const taskId = uuidv4();
      return {
        taskId,
        status: "processing",
        progress: 50,
      } as AdapterResult;
    });
  }

  checkStatus(taskId: string): Promise<TaskStatusResult> {
    // 模拟：50%概率已完成
    const completed = Math.random() > 0.5;
    return Promise.resolve({
      status: completed ? "completed" : "processing",
      progress: completed ? 100 : Math.floor(Math.random() * 80 + 10),
      resultUrl: completed ? `/uploads/mock/kling-${taskId}.mp4` : undefined,
    });
  }

  getModelInfo(): ModelInfo {
    return {
      id: "kling",
      name: "可灵AI",
      type: "video",
      category: "standard",
      costCredits: 15,
      durationOptions: [5, 10],
      durationPricing: { "5": 15, "10": 25 },
    };
  }
}
