// ============================================================
// AI创作聚合平台 - Stable Diffusion 适配器
// ============================================================

import { BaseAdapter } from "./base.adapter.js";
import type { AdapterResult, GenerateParams, ModelInfo, TaskStatusResult } from "../types/index.js";
import { v4 as uuidv4 } from "uuid";

export class StableDiffusionAdapter extends BaseAdapter {
  generate(prompt: string, params?: GenerateParams): Promise<AdapterResult> {
    return this.simulateDelay(1500, 4000).then(() => {
      const taskId = uuidv4();
      return {
        taskId,
        status: "completed",
        resultUrl: `/uploads/mock/sd-${taskId}.png`,
        thumbnailUrl: `/uploads/mock/sd-${taskId}_thumb.png`,
        progress: 100,
      } as AdapterResult;
    });
  }

  checkStatus(taskId: string): Promise<TaskStatusResult> {
    return Promise.resolve({
      status: "completed",
      progress: 100,
      resultUrl: `/uploads/mock/sd-${taskId}.png`,
    });
  }

  getModelInfo(): ModelInfo {
    return {
      id: "stable-diffusion",
      name: "Stable Diffusion XL",
      type: "image",
      category: "starter",
      costCredits: 3,
      durationOptions: null,
      durationPricing: null,
    };
  }
}
