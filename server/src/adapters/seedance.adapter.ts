// ============================================================
// AI创作聚合平台 - Seedance 适配器
// ============================================================

import { BaseAdapter } from "./base.adapter.js";
import type { AdapterResult, GenerateParams, ModelInfo, TaskStatusResult } from "../types/index.js";
import { v4 as uuidv4 } from "uuid";

export class SeedanceAdapter extends BaseAdapter {
  generate(prompt: string, params?: GenerateParams): Promise<AdapterResult> {
    return this.simulateDelay(6000, 12000).then(() => {
      const taskId = uuidv4();
      return {
        taskId,
        status: "processing",
        progress: 40,
      } as AdapterResult;
    });
  }

  checkStatus(taskId: string): Promise<TaskStatusResult> {
    const completed = Math.random() > 0.4;
    return Promise.resolve({
      status: completed ? "completed" : "processing",
      progress: completed ? 100 : Math.floor(Math.random() * 70 + 10),
      resultUrl: completed ? `/uploads/mock/seedance-${taskId}.mp4` : undefined,
    });
  }

  getModelInfo(): ModelInfo {
    return {
      id: "seedance",
      name: "Seedance",
      type: "video",
      category: "advanced",
      costCredits: 20,
      durationOptions: [5, 10, 15],
      durationPricing: { "5": 20, "10": 35, "15": 50 },
    };
  }
}
