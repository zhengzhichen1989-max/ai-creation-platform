// ============================================================
// AI创作聚合平台 - 视频生成 Worker（真实API）
// ============================================================

import { DMXAPIVideoAdapter } from "../adapters/dmxapi-video.adapter.js";
import type { QueueJobData, QueueProcessor } from "./index.js";
import * as taskService from "../services/task.service.js";
import * as creditsService from "../services/credits.service.js";
import type { GenerateParams, AdapterResult, TaskStatusResult, ReferenceImage } from "../types/index.js";

/** 适配器注册表：按模型ID路由到对应适配器（使用DMXAPI真实模型ID） */
const adapterMap: Record<string, (modelId: string) => DMXAPIVideoAdapter> = {
  'doubao-seedance-2-0-260128': (modelId) => new DMXAPIVideoAdapter(modelId),
  'doubao-seedance-2-0-fast-260128': (modelId) => new DMXAPIVideoAdapter(modelId),
  'sora-2': (modelId) => new DMXAPIVideoAdapter(modelId),
  'kling-v3-video-generation': (modelId) => new DMXAPIVideoAdapter(modelId),
};

/** 视频生成处理器 */
export const videoProcessor: QueueProcessor = async (job: QueueJobData): Promise<void> => {
  const { taskId, modelId, prompt, params, referenceImages } = job;

  console.log(`[VideoWorker] 开始处理任务: ${taskId}, 模型: ${modelId}, 参考图: ${referenceImages?.length ?? 0}`);

  try {
    // 1. 更新任务状态为 processing
    taskService.updateTaskStatus(taskId, "processing", { progress: 5 });

    // 2. 获取适配器
    const adapterFactory = adapterMap[modelId];
    if (!adapterFactory) {
      throw new Error(`未找到模型适配器: ${modelId}`);
    }
    const adapter = adapterFactory(modelId);

    // 3. 调用适配器生成（将 referenceImages 注入 params）
    taskService.updateTaskStatus(taskId, "processing", { progress: 15 });
    const generateParams: GenerateParams = params ? JSON.parse(params) : {};
    if (referenceImages && referenceImages.length > 0) {
      generateParams.referenceImages = referenceImages;
    }
    const result = await adapter.generate(prompt, generateParams);

    // 4. 视频生成通常是异步的，需要轮询
    let status: AdapterResult | TaskStatusResult = result;
    const maxPolls = 60; // 最多轮询60次（约10分钟）
    let pollCount = 0;

    while (status.status !== "completed" && status.status !== "failed" && pollCount < maxPolls) {
      await new Promise((resolve) => setTimeout(resolve, 10000)); // 每10秒轮询一次
      pollCount++;

      status = await adapter.checkStatus(result.taskId);

      // 更新进度
      const progress = status.progress ?? Math.min(15 + pollCount * 1.5, 95);
      taskService.updateTaskStatus(taskId, "processing", { progress: Math.floor(progress) });

      console.log(`[VideoWorker] 任务 ${taskId} 轮询 ${pollCount}/${maxPolls}, 状态: ${status.status}, 进度: ${progress}%`);
    }

    // 5. 处理结果
    if (status.status === "completed") {
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().replace("T", " ").replace(/\.\d+Z$/, "");
      taskService.updateTaskStatus(taskId, "completed", {
        resultUrl: status.resultUrl,
        progress: 100,
        expiresAt,
      });
      console.log(`[VideoWorker] 任务完成: ${taskId}`);
    } else if (status.status === "failed") {
      throw new Error(status.errorMessage || "视频生成失败");
    } else {
      throw new Error("视频生成超时");
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "视频生成失败";
    console.error(`[VideoWorker] 任务失败: ${taskId}, 错误: ${errorMessage}`);

    // 更新任务状态为失败
    taskService.updateTaskStatus(taskId, "failed", {
      errorMessage,
    });

    // 退还积分
    try {
      creditsService.refund(job.userId, taskService.getTask(taskId).costCredits, taskId, "视频生成失败退还积分");
    } catch (refundError) {
      console.error(`[VideoWorker] 退还积分失败: ${taskId}`, refundError);
    }
  }
};
