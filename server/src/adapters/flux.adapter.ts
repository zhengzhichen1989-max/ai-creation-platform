// ============================================================
// AI创作聚合平台 - Flux Pro 适配器
// ============================================================

import { BaseAdapter } from "./base.adapter.js";
import type { AdapterResult, GenerateParams, ModelInfo, TaskStatusResult } from "../types/index.js";
import { v4 as uuidv4 } from "uuid";

export class FluxAdapter extends BaseAdapter {
  generate(prompt: string, params?: GenerateParams): Promise<AdapterResult> {
    return this.simulateDelay(2000, 5000).then(() => {
      const taskId = uuidv4();
      return {
        taskId,
        status: "completed",
        resultUrl: `/uploads/mock/flux-${taskId}.png`,
        thumbnailUrl: `/uploads/mock/flux-${taskId}_thumb.png`,
        progress: 100,
      } as AdapterResult;
    });
  }

  checkStatus(taskId: string): Promise<TaskStatusResult> {
    return Promise.resolve({
      status: "completed",
      progress: 100,
      resultUrl: `/uploads/mock/flux-${taskId}.png`,
    });
  }

  getModelInfo(): ModelInfo {
    return {
      id: "flux-pro",
      name: "Flux Pro",
      type: "image",
      category: "advanced",
      costCredits: 6,
      durationOptions: null,
      durationPricing: null,
      resolutionOptions: null,
      resolutionPricing: null,
    };
  }
}
