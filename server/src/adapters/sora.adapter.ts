// ============================================================
// AI创作聚合平台 - Sora 适配器
// ============================================================

import { BaseAdapter } from "./base.adapter.js";
import type { AdapterResult, GenerateParams, ModelInfo, TaskStatusResult } from "../types/index.js";
import { v4 as uuidv4 } from "uuid";

export class SoraAdapter extends BaseAdapter {
  generate(prompt: string, params?: GenerateParams): Promise<AdapterResult> {
    return this.simulateDelay(8000, 15000).then(() => {
      const taskId = uuidv4();
      return {
        taskId,
        status: "processing",
        progress: 30,
      } as AdapterResult;
    });
  }

  checkStatus(taskId: string): Promise<TaskStatusResult> {
    const completed = Math.random() > 0.3;
    return Promise.resolve({
      status: completed ? "completed" : "processing",
      progress: completed ? 100 : Math.floor(Math.random() * 60 + 10),
      resultUrl: completed ? `/uploads/mock/sora-${taskId}.mp4` : undefined,
    });
  }

  getModelInfo(): ModelInfo {
    return {
      id: "sora",
      name: "Sora",
      type: "video",
      category: "flagship",
      costCredits: 30,
      durationOptions: [5, 10, 15],
      durationPricing: { "5": 20, "10": 30, "15": 45 },
      resolutionOptions: null,
      resolutionPricing: null,
    };
  }
}
