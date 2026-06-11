// ============================================================
// AI创作聚合平台 - 图片生成 Worker（真实API）
// ============================================================

import { GrsAIImageAdapter } from "../adapters/grsai-image.adapter.js";
import type { QueueJobData, QueueProcessor } from "./index.js";
import * as taskService from "../services/task.service.js";
import * as creditsService from "../services/credits.service.js";
import { downloadIfExternal } from "../utils/download.js";
import { assertPromptSafe } from "../services/content-moderation.service.js";
import { translateError } from "../utils/errors.js";
import type { GenerateParams, AdapterResult, TaskStatusResult, ReferenceImage } from "../types/index.js";

/** 适配器注册表：按模型ID路由到对应适配器 */
const adapterMap: Record<string, (modelId: string) => GrsAIImageAdapter> = {
  'gpt-image-2-vip': (modelId) => new GrsAIImageAdapter(modelId),
  'gpt-image-2': (modelId) => new GrsAIImageAdapter(modelId),
  'nano-banana-pro': (modelId) => new GrsAIImageAdapter(modelId),
  'nano-banana-fast': (modelId) => new GrsAIImageAdapter(modelId),
  'flux-pro': (modelId) => new GrsAIImageAdapter(modelId),
};

/** 模型回退映射：主模型失败时自动切换 */
const fallbackModelMap: Record<string, string> = {
  'gpt-image-2-vip': 'gpt-image-2',
};

/** 图片生成处理器 */
export const imageProcessor: QueueProcessor = async (job: QueueJobData): Promise<void> => {
  const { taskId, modelId, prompt, params, referenceImages } = job;

  console.log(`[ImageWorker] 开始处理任务: ${taskId}, 模型: ${modelId}, 参考图: ${referenceImages?.length ?? 0}`);

  // 0. 内容安全审核（最后防线，仅执行一次）
  await assertPromptSafe(prompt);

  // 执行生成（含模型回退），最终失败才退款
  await generateWithFallback(taskId, modelId, prompt, params, referenceImages, false, job);
};

/** 带模型回退的生成逻辑 */
async function generateWithFallback(
  taskId: string,
  modelId: string,
  prompt: string,
  params: string | undefined,
  referenceImages: ReferenceImage[] | undefined,
  isFallback: boolean,
  job: QueueJobData,
): Promise<void> {
  const effectiveModelId = modelId;

  if (isFallback) {
    console.log(`[ImageWorker] 回退模式 — 使用替补模型: ${modelId}`);
  }

  try {
    // 更新任务状态为 processing
    const progressBase = isFallback ? 5 : 10;
    taskService.updateTaskStatus(taskId, "processing", { progress: progressBase });

    // 获取适配器
    const adapterFactory = adapterMap[effectiveModelId];
    if (!adapterFactory) {
      throw new Error(`未找到模型适配器: ${effectiveModelId}`);
    }
    const adapter = adapterFactory(effectiveModelId);

    // 调用适配器生成（将 referenceImages 注入 params）
    taskService.updateTaskStatus(taskId, "processing", { progress: isFallback ? 15 : 30 });
    const generateParams: GenerateParams = params ? JSON.parse(params) : {};
    if (referenceImages && referenceImages.length > 0) {
      generateParams.referenceImages = referenceImages;
    }
    const result = await adapter.generate(prompt, generateParams);

    // GrsAI图片生成是异步的，需要轮询
    if (result.status === "completed") {
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().replace("T", " ").replace(/\.\d+Z$/, "");
      let localUrl = result.resultUrl;
      try {
        localUrl = await downloadIfExternal(result.resultUrl, "image");
      } catch (dlErr) {
        console.warn(`[ImageWorker] 下载结果图失败，保留外部URL: ${result.resultUrl?.substring(0, 60)}`, dlErr instanceof Error ? dlErr.message : dlErr);
      }
      let localThumbnail = result.thumbnailUrl;
      try {
        localThumbnail = await downloadIfExternal(result.thumbnailUrl, "image_thumb");
      } catch (dlErr) {
        console.warn(`[ImageWorker] 下载缩略图失败，保留外部URL: ${result.thumbnailUrl?.substring(0, 60)}`, dlErr instanceof Error ? dlErr.message : dlErr);
      }
      taskService.updateTaskStatus(taskId, "completed", {
        resultUrl: localUrl,
        resultThumbnail: localThumbnail,
        progress: 100,
        expiresAt,
      });
      const tag = isFallback ? "[回退]" : "";
      console.log(`[ImageWorker] 任务完成${tag}: ${taskId} (模型: ${effectiveModelId})`);
    } else {
      // 轮询等待结果
      let status: AdapterResult | TaskStatusResult = result;
      const maxPolls = 120;
      let pollCount = 0;

      while (status.status !== "completed" && status.status !== "failed" && pollCount < maxPolls) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        pollCount++;
        status = await adapter.checkStatus(result.taskId);
        const progress = status.progress ?? Math.min(30 + pollCount * 0.6, 95);
        taskService.updateTaskStatus(taskId, "processing", { progress: Math.floor(progress) });
      }

      if (status.status === "completed") {
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().replace("T", " ").replace(/\.\d+Z$/, "");
        let localUrl = status.resultUrl;
        try {
          localUrl = await downloadIfExternal(status.resultUrl, "image");
        } catch (dlErr) {
          console.warn(`[ImageWorker] 下载结果图失败，保留外部URL: ${status.resultUrl?.substring(0, 60)}`, dlErr instanceof Error ? dlErr.message : dlErr);
        }
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
    // 如果不是回退模式且有回退模型，尝试切换
    if (!isFallback && fallbackModelMap[modelId]) {
      const fallbackModelId = fallbackModelMap[modelId];
      const rawError = error instanceof Error ? error.message : "图片生成失败";
      console.warn(`[ImageWorker] 主模型 ${modelId} 失败: ${rawError}，自动切换到回退模型: ${fallbackModelId}`);
      return generateWithFallback(taskId, fallbackModelId, prompt, params, referenceImages, true, job);
    }

    // 最终失败处理（主模型无回退 或 回退也失败了）
    const rawError = error instanceof Error ? error.message : "图片生成失败";
    const errorMessage = translateError(rawError);
    const tag = isFallback ? "[回退也失败]" : "";
    console.error(`[ImageWorker] 任务最终失败${tag}: ${taskId}, 模型: ${modelId}, 错误: ${rawError}${rawError !== errorMessage ? ` → ${errorMessage}` : ""}`);

    taskService.updateTaskStatus(taskId, "failed", { errorMessage });

    // 退还积分
    try {
      creditsService.refund(job.userId, taskService.getTask(taskId).costCredits, taskId, "图片生成失败退还积分");
    } catch (refundError) {
      console.error(`[ImageWorker] 退还积分失败: ${taskId}`, refundError);
    }
  }
}
