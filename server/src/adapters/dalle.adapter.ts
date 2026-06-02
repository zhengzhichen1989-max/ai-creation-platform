// ============================================================
// AI创作聚合平台 - DALL-E 3 适配器
// ============================================================

import { BaseAdapter } from "./base.adapter.js";
import type { AdapterResult, GenerateParams, ModelInfo, TaskStatusResult } from "../types/index.js";
import { v4 as uuidv4 } from "uuid";

export class DallEAdapter extends BaseAdapter {
  generate(prompt: string, params?: GenerateParams): Promise<AdapterResult> {
    return this.simulateDelay(2000, 6000).then(() => {
      const taskId = uuidv4();
      return {
        taskId,
        status: "completed",
        resultUrl: `/uploads/mock/dalle-${taskId}.png`,
        thumbnailUrl: `/uploads/mock/dalle-${taskId}_thumb.png`,
        progress: 100,
      } as AdapterResult;
    });
  }

  checkStatus(taskId: string): Promise<TaskStatusResult> {
    return Promise.resolve({
      status: "completed",
      progress: 100,
      resultUrl: `/uploads/mock/dalle-${taskId}.png`,
    });
  }

  getModelInfo(): ModelInfo {
    return {
      id: "dall-e",
      name: "DALL-E 3",
      type: "image",
      category: "flagship",
      costCredits: 10,
      durationOptions: null,
      durationPricing: null,
    };
  }
}
