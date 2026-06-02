// ============================================================
// AI创作聚合平台 - 文案生成 Worker（真实API）
// ============================================================

import { DMXAPITextAdapter } from "../adapters/dmxapi-text.adapter.js";
import type { QueueJobData, QueueProcessor } from "./index.js";
import * as taskService from "../services/task.service.js";
import * as creditsService from "../services/credits.service.js";
import type { GenerateParams } from "../types/index.js";

/** 适配器注册表：按模型ID路由到对应适配器（使用DMXAPI真实模型ID） */
const adapterMap: Record<string, (modelId: string) => DMXAPITextAdapter> = {
  'deepseek-chat': (modelId) => new DMXAPITextAdapter(modelId),
  'qwen-max': (modelId) => new DMXAPITextAdapter(modelId),
};

/** 文案生成处理器 */
export const textProcessor: QueueProcessor = async (job: QueueJobData): Promise<void> => {
  const { taskId, modelId, prompt, params, referenceImages } = job;

  console.log(`[TextWorker] 开始处理任务: ${taskId}, 模型: ${modelId}`);

  try {
    // 1. 更新任务状态为 processing
    taskService.updateTaskStatus(taskId, "processing", { progress: 20 });

    // 2. 获取适配器
    const adapterFactory = adapterMap[modelId];
    if (!adapterFactory) {
      throw new Error(`未找到模型适配器: ${modelId}`);
    }
    const adapter = adapterFactory(modelId);

    // 3. 调用适配器生成（文案是同步返回的）
    taskService.updateTaskStatus(taskId, "processing", { progress: 50 });
    const generateParams: GenerateParams = params ? JSON.parse(params) : {};
    // 将参考图注入生成参数
    if (referenceImages && referenceImages.length > 0) {
      generateParams.referenceImages = referenceImages;
    }
    const result = await adapter.generate(prompt, generateParams);

    // 4. 文案生成是同步的，直接处理结果
    if (result.status === "completed" && result.resultUrl) {
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().replace("T", " ").replace(/\.\d+Z$/, "");
      taskService.updateTaskStatus(taskId, "completed", {
        resultUrl: result.resultUrl,
        progress: 100,
        expiresAt,
      });
      console.log(`[TextWorker] 任务完成: ${taskId}`);
    } else {
      throw new Error(result.errorMessage || "文案生成失败");
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "文案生成失败";
    console.error(`[TextWorker] 任务失败: ${taskId}, 错误: ${errorMessage}`);

    // 更新任务状态为失败
    taskService.updateTaskStatus(taskId, "failed", {
      errorMessage,
    });

    // 退还积分
    try {
      creditsService.refund(job.userId, taskService.getTask(taskId).costCredits, taskId, "文案生成失败退还积分");
    } catch (refundError) {
      console.error(`[TextWorker] 退还积分失败: ${taskId}`, refundError);
    }
  }
};
