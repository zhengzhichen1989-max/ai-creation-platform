// ============================================================
// AI创作聚合平台 - 图片生成 Worker（真实API）
// ============================================================

import { GrsAIImageAdapter } from "../adapters/grsai-image.adapter.js";
import type { QueueJobData, QueueProcessor } from "./index.js";
import * as taskService from "../services/task.service.js";
import * as creditsService from "../services/credits.service.js";
import { downloadIfExternal } from "../utils/download.js";
import type { GenerateParams, AdapterResult, TaskStatusResult, ReferenceImage } from "../types/index.js";

/** 适配器注册表：按模型ID路由到对应适配器 */
const adapterMap: Record<string, (modelId: string) => GrsAIImageAdapter> = {
  'gpt-image-2': (modelId) => new GrsAIImageAdapter(modelId),
  'nano-banana-pro': (modelId) => new GrsAIImageAdapter(modelId),
  'nano-banana-fast': (modelId) => new GrsAIImageAdapter(modelId),
  'flux-pro': (modelId) => new GrsAIImageAdapter(modelId),
};

/** 图片生成处理器 */
export const imageProcessor: QueueProcessor = async (job: QueueJobData): Promise<void> => {
  const { taskId, modelId, prompt, params, referenceImages } = job;

  console.log(`[ImageWorker] 开始处理任务: ${taskId}, 模型: ${modelId}, 参考图: ${referenceImages?.length ?? 0}`);

  try {
    // 1. 更新任务状态为 processing
    taskService.updateTaskStatus(taskId, "processing", { progress: 10 });

    // 2. 获取适配器
    const adapterFactory = adapterMap[modelId];
    if (!adapterFactory) {
      throw new Error(`未找到模型适配器: ${modelId}`);
    }
    const adapter = adapterFactory(modelId);

    // 3. 调用适配器生成（将 referenceImages 注入 params）
    taskService.updateTaskStatus(taskId, "processing", { progress: 30 });
    const generateParams: GenerateParams = params ? JSON.parse(params) : {};
    if (referenceImages && referenceImages.length > 0) {
      generateParams.referenceImages = referenceImages;
    }
    const result = await adapter.generate(prompt, generateParams);

    // 4. GrsAI图片生成是异步的，需要轮询
    if (result.status === "completed") {
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().replace("T", " ").replace(/\.\d+Z$/, "");
      const localUrl = await downloadIfExternal(result.resultUrl, "image");
      const localThumbnail = await downloadIfExternal(result.thumbnailUrl, "image_thumb");
      taskService.updateTaskStatus(taskId, "completed", {
        resultUrl: localUrl,
        resultThumbnail: localThumbnail,
        progress: 100,
        expiresAt,
      });
      console.log(`[ImageWorker] 任务完成: ${taskId}`);
    } else {
      // 轮询等待结果
      let status: AdapterResult | TaskStatusResult = result;
      const maxPolls = 120; // 最多轮询120次（约4分钟）
      let pollCount = 0;

      while (status.status !== "completed" && status.status !== "failed" && pollCount < maxPolls) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        pollCount++;

        status = await adapter.checkStatus(result.taskId);
        const progress = status.progress ?? Math.min(30 + pollCount * 0.6, 95);
        taskService.updateTaskStatus(taskId, "processing", { progress: Math.floor(progress) });

        console.log(`[ImageWorker] 任务 ${taskId} 轮询 ${pollCount}/${maxPolls}, 状态: ${status.status}`);
      }

      if (status.status === "completed") {
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().replace("T", " ").replace(/\.\d+Z$/, "");
        const localUrl = await downloadIfExternal(status.resultUrl, "image");
        taskService.updateTaskStatus(taskId, "completed", {
          resultUrl: localUrl,
          progress: 100,
          expiresAt,
        });
        console.log(`[ImageWorker] 任务完成: ${taskId}`);
      } else if (status.status === "failed") {
        throw new Error(status.errorMessage || "图片生成失败");
      } else {
        throw new Error("图片生成超时");
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
