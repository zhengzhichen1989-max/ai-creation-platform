// ============================================================
// AI创作聚合平台 - 视频生成 Worker
// ============================================================

import { KlingAdapter } from "../adapters/kling.adapter.js";
import { SeedanceAdapter } from "../adapters/seedance.adapter.js";
import { SoraAdapter } from "../adapters/sora.adapter.js";
import type { IModelAdapter } from "../adapters/base.adapter.js";
import type { QueueJobData, QueueProcessor } from "./index.js";
import * as taskService from "../services/task.service.js";
import * as creditsService from "../services/credits.service.js";
import type { GenerateParams } from "../types/index.js";

/** 适配器注册表 */
const adapterMap: Record<string, () => IModelAdapter> = {
  KlingAdapter: () => new KlingAdapter(),
  SeedanceAdapter: () => new SeedanceAdapter(),
  SoraAdapter: () => new SoraAdapter(),
};

/** 视频生成处理器 */
export const videoProcessor: QueueProcessor = async (job: QueueJobData): Promise<void> => {
  const { taskId, modelId, prompt, params } = job;

  console.log(`[VideoWorker] 开始处理任务: ${taskId}, 模型: ${modelId}`);

  try {
    // 1. 更新任务状态为 processing
    taskService.updateTaskStatus(taskId, "processing", { progress: 5 });

    // 2. 获取适配器
    const model = await import("../services/model.service.js").then((m) => m.getModel(modelId));
    const adapterFactory = adapterMap[model.id] || adapterMap[model.id.replace(/-/g, "")];
    if (!adapterFactory) {
      throw new Error(`未找到模型适配器: ${modelId}`);
    }
    const adapter = adapterFactory();

    // 3. 调用适配器生成
    taskService.updateTaskStatus(taskId, "processing", { progress: 15 });
    const generateParams: GenerateParams = params ? JSON.parse(params) : {};
    const result = await adapter.generate(prompt, generateParams);

    // 4. 视频生成通常是异步的，需要轮询
    let status = result;
    const maxPolls = 60; // 最多轮询60次
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
