// ============================================================
// AI创作聚合平台 - 图片生成 Worker
// ============================================================

import { FluxAdapter } from "../adapters/flux.adapter.js";
import { StableDiffusionAdapter } from "../adapters/stable-diffusion.adapter.js";
import { DallEAdapter } from "../adapters/dalle.adapter.js";
import type { IModelAdapter } from "../adapters/base.adapter.js";
import type { QueueJobData, QueueProcessor } from "./index.js";
import * as taskService from "../services/task.service.js";
import * as creditsService from "../services/credits.service.js";
import type { GenerateParams } from "../types/index.js";

/** 适配器注册表 */
const adapterMap: Record<string, () => IModelAdapter> = {
  FluxAdapter: () => new FluxAdapter(),
  StableDiffusionAdapter: () => new StableDiffusionAdapter(),
  DallEAdapter: () => new DallEAdapter(),
};

/** 图片生成处理器 */
export const imageProcessor: QueueProcessor = async (job: QueueJobData): Promise<void> => {
  const { taskId, modelId, prompt, params } = job;

  console.log(`[ImageWorker] 开始处理任务: ${taskId}, 模型: ${modelId}`);

  try {
    // 1. 更新任务状态为 processing
    taskService.updateTaskStatus(taskId, "processing", { progress: 10 });

    // 2. 获取适配器
    const model = await import("../services/model.service.js").then((m) => m.getModel(modelId));
    const adapterFactory = adapterMap[model.id] || adapterMap[model.id.replace(/-/g, "")];
    if (!adapterFactory) {
      throw new Error(`未找到模型适配器: ${modelId}`);
    }
    const adapter = adapterFactory();

    // 3. 调用适配器生成
    taskService.updateTaskStatus(taskId, "processing", { progress: 30 });
    const generateParams: GenerateParams = params ? JSON.parse(params) : {};
    const result = await adapter.generate(prompt, generateParams);

    // 4. 更新任务状态
    if (result.status === "completed") {
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().replace("T", " ").replace(/\.\d+Z$/, "");
      taskService.updateTaskStatus(taskId, "completed", {
        resultUrl: result.resultUrl,
        resultThumbnail: result.thumbnailUrl,
        progress: 100,
        expiresAt,
      });
      console.log(`[ImageWorker] 任务完成: ${taskId}`);
    } else {
      // 图片生成通常是同步完成的，如果未完成则持续轮询
      let status = result;
      while (status.status !== "completed" && status.status !== "failed") {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        status = await adapter.checkStatus(result.taskId);
        taskService.updateTaskStatus(taskId, "processing", {
          progress: status.progress,
        });
      }

      if (status.status === "completed") {
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().replace("T", " ").replace(/\.\d+Z$/, "");
        taskService.updateTaskStatus(taskId, "completed", {
          resultUrl: status.resultUrl,
          progress: 100,
          expiresAt,
        });
        console.log(`[ImageWorker] 任务完成: ${taskId}`);
      } else {
        throw new Error(status.errorMessage || "图片生成失败");
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "图片生成失败";
    console.error(`[ImageWorker] 任务失败: ${taskId}, 错误: ${errorMessage}`);

    // 更新任务状态为失败
    taskService.updateTaskStatus(taskId, "failed", {
      errorMessage,
    });

    // 退还积分
    try {
      creditsService.refund(job.userId, taskService.getTask(taskId).costCredits, taskId, "图片生成失败退还积分");
    } catch (refundError) {
      console.error(`[ImageWorker] 退还积分失败: ${taskId}`, refundError);
    }
  }
};
