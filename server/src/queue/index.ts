// ============================================================
// AI创作聚合平台 - 队列初始化（BullMQ + 内存回退）
// ============================================================

import type { GenerationTaskInfo } from "../types/index.js";
import { config } from "../config/index.js";

/** 队列任务数据 */
export interface QueueJobData {
  taskId: string;
  userId: number;
  modelId: string;
  prompt: string;
  type: "image" | "video" | "text";
  params?: string;
}

/** 内存队列任务 */
interface MemoryJob {
  id: string;
  data: QueueJobData;
  status: "waiting" | "active" | "completed" | "failed";
  progress: number;
  result?: unknown;
  error?: string;
}

/** 适配器接口（用于队列Worker调用） */
export type QueueProcessor = (job: QueueJobData) => Promise<void>;

// BullMQ 队列实例（如果Redis可用）
let imageQueue: import("bullmq").Queue<QueueJobData> | null = null;
let videoQueue: import("bullmq").Queue<QueueJobData> | null = null;
let textQueue: import("bullmq").Queue<QueueJobData> | null = null;

// 内存回退队列
const memoryImageQueue: MemoryJob[] = [];
const memoryVideoQueue: MemoryJob[] = [];
const memoryTextQueue: MemoryJob[] = [];

// 处理器注册
let imageProcessor: QueueProcessor | null = null;
let videoProcessor: QueueProcessor | null = null;
let textProcessor: QueueProcessor | null = null;

/** Redis 是否可用 */
let redisAvailable = false;

/** 初始化队列 */
export async function initQueues(): Promise<void> {
  try {
    const { Queue } = await import("bullmq");
    const connection = {
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null, // 不重试
      lazyConnect: true,
      enableOfflineQueue: false,
    };

    // 测试 Redis 连接
    const Redis = (await import("ioredis")).default;
    const testConn = new Redis(connection);
    testConn.on("error", () => {}); // 抑制测试连接的错误日志
    await testConn.connect();
    await testConn.ping();
    await testConn.quit();

    imageQueue = new Queue<QueueJobData>("image-generation", { connection: { ...connection, maxRetriesPerRequest: null } });
    videoQueue = new Queue<QueueJobData>("video-generation", { connection: { ...connection, maxRetriesPerRequest: null } });
    textQueue = new Queue<QueueJobData>("text-generation", { connection: { ...connection, maxRetriesPerRequest: null } });

    redisAvailable = true;
    console.log("[Queue] BullMQ 队列初始化成功（Redis模式）");
  } catch (err) {
    redisAvailable = false;
    console.log("[Queue] Redis 不可用，使用内存队列回退");
    // 启动内存队列消费者
    startMemoryQueueConsumer("image");
    startMemoryQueueConsumer("video");
    startMemoryQueueConsumer("text");
  }
}

/** 将图片生成任务推入队列 */
export async function addImageJob(data: QueueJobData): Promise<string> {
  if (redisAvailable && imageQueue) {
    const job = await imageQueue.add("image-gen", data, {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
    });
    return job.id ?? data.taskId;
  }

  // 内存回退
  const job: MemoryJob = {
    id: data.taskId,
    data,
    status: "waiting",
    progress: 0,
  };
  memoryImageQueue.push(job);
  return data.taskId;
}

/** 将视频生成任务推入队列 */
export async function addVideoJob(data: QueueJobData): Promise<string> {
  if (redisAvailable && videoQueue) {
    const job = await videoQueue.add("video-gen", data, {
      attempts: 3,
      backoff: { type: "exponential", delay: 10000 },
    });
    return job.id ?? data.taskId;
  }

  // 内存回退
  const job: MemoryJob = {
    id: data.taskId,
    data,
    status: "waiting",
    progress: 0,
  };
  memoryVideoQueue.push(job);
  return data.taskId;
}

/** 将文案生成任务推入队列 */
export async function addTextJob(data: QueueJobData): Promise<string> {
  if (redisAvailable && textQueue) {
    const job = await textQueue.add("text-gen", data, {
      attempts: 3,
      backoff: { type: "exponential", delay: 3000 },
    });
    return job.id ?? data.taskId;
  }

  // 内存回退
  const job: MemoryJob = {
    id: data.taskId,
    data,
    status: "waiting",
    progress: 0,
  };
  memoryTextQueue.push(job);
  return data.taskId;
}

/** 注册图片队列处理器 */
export function registerImageProcessor(processor: QueueProcessor): void {
  imageProcessor = processor;

  if (redisAvailable && imageQueue) {
    // BullMQ Worker 在 worker 文件中自行注册
    return;
  }
}

/** 注册视频队列处理器 */
export function registerVideoProcessor(processor: QueueProcessor): void {
  videoProcessor = processor;

  if (redisAvailable && videoQueue) {
    return;
  }
}

/** 注册文案队列处理器 */
export function registerTextProcessor(processor: QueueProcessor): void {
  textProcessor = processor;

  if (redisAvailable && textQueue) {
    return;
  }
}

/** 获取 BullMQ 队列实例 */
export function getImageQueue(): import("bullmq").Queue<QueueJobData> | null {
  return imageQueue;
}

export function getVideoQueue(): import("bullmq").Queue<QueueJobData> | null {
  return videoQueue;
}

export function getTextQueue(): import("bullmq").Queue<QueueJobData> | null {
  return textQueue;
}

/** 是否使用 BullMQ */
export function isBullMQ(): boolean {
  return redisAvailable;
}

// ---- 内存队列消费者 ----

function startMemoryQueueConsumer(type: "image" | "video" | "text"): void {
  const interval = setInterval(async () => {
    const queue = type === "image" ? memoryImageQueue : type === "video" ? memoryVideoQueue : memoryTextQueue;
    const processor = type === "image" ? imageProcessor : type === "video" ? videoProcessor : textProcessor;

    if (!processor) return;

    const waitingJob = queue.find((j) => j.status === "waiting");
    if (!waitingJob) return;

    waitingJob.status = "active";
    try {
      await processor(waitingJob.data);
      waitingJob.status = "completed";
      waitingJob.progress = 100;

      // 从队列中移除已完成的任务
      const idx = queue.indexOf(waitingJob);
      if (idx > -1) queue.splice(idx, 1);
    } catch (err) {
      waitingJob.status = "failed";
      waitingJob.error = err instanceof Error ? err.message : String(err);

      // 从队列中移除失败的任务
      const idx = queue.indexOf(waitingJob);
      if (idx > -1) queue.splice(idx, 1);
    }
  }, 2000); // 每2秒检查一次

  // 防止进程退出时定时器泄漏
  if (interval.unref) {
    interval.unref();
  }
}
