// ============================================================
// AI创作聚合平台 - DMXAPI 视频适配器
// 支持 sora-2 / doubao-seedance-2-0-fast-260128 / kling-v3-video-generation
// sora-2: POST /v1/videos (multipart/form-data)
// seedance/kling: POST /v1/responses (JSON)
// 支持参考图：Seedance(首帧/末帧/参考图)、Kling(首帧/末帧)、Sora-2(不支持)
// ============================================================

import fs from "fs";
import path from "path";
import type { AdapterResult, GenerateParams, ReferenceImage, TaskStatusResult } from "../types/index.js";
import { config } from "../config/index.js";

/** DMXAPI 视频适配器，支持 sora-2 / doubao-seedance-2-0-260128 / doubao-seedance-2-0-fast-260128 / kling-v3-video-generation */
export class DMXAPIVideoAdapter {
  private modelId: string;
  private baseUrl: string;    // https://www.dmxapi.cn/v1
  private apiKey: string;

  constructor(modelId: string) {
    this.modelId = modelId;
    this.baseUrl = config.providers.dmxapi.baseUrl;
    this.apiKey = config.providers.dmxapi.apiKey;
  }

  /** 根据 resolution 字符串获取宽高 (16:9 横屏默认) */
  private getResolutionSize(resolution?: string): { width: number; height: number } {
    if (resolution === "1080p") {
      return { width: 1920, height: 1080 };
    }
    // 默认 720p
    return { width: 1280, height: 720 };
  }

  /** 将本地路径（如 /uploads/ref_images/xxx.jpg）转为完整URL */
  private toFullUrl(localPath: string): string {
    if (localPath.startsWith("http://") || localPath.startsWith("https://")) {
      return localPath;
    }
    return `${config.publicBaseUrl}${localPath}`;
  }

  /** 从提交响应中提取 taskId，兼容两种返回格式 */
  private extractTaskId(data: Record<string, unknown>): string {
    // 格式1 (Seedance): { "id": "cgt-xxx" }
    if (data.id && typeof data.id === "string") {
      return data.id;
    }
    // 格式2 (Kling): { "output": [{ "content": [{ "text": "{\"task_id\":\"xxx\"}" }] }] }
    const output = data.output as Array<Record<string, unknown>> | undefined;
    if (output && Array.isArray(output)) {
      for (const item of output) {
        const content = item.content as Array<Record<string, unknown>> | undefined;
        if (content && Array.isArray(content)) {
          for (const c of content) {
            if (c.type === "output_text" && typeof c.text === "string") {
              try {
                const parsed = JSON.parse(c.text as string);
                if (parsed.task_id) {
                  return String(parsed.task_id);
                }
              } catch {
                // text 不是 JSON，继续尝试
              }
            }
          }
        }
      }
    }
    return "";
  }

  /** 构建 Seedance 2.0 提交请求体 (input是数组格式，标准版和Fast版共用) */
  private buildSeedanceBody(prompt: string, params?: GenerateParams, referenceImages?: ReferenceImage[]): Record<string, unknown> {
    const duration = params?.duration ?? 5;
    const clampedDuration = Math.max(4, Math.min(15, duration));
    const resolution = (params?.resolution as string) || "720p";
    const resSize = this.getResolutionSize(resolution);
    const width = params?.width ?? resSize.width;
    const height = params?.height ?? resSize.height;
    let ratio = "16:9";
    if (height > width) {
      ratio = "9:16";
    } else if (width === height) {
      ratio = "1:1";
    }

    // 构建 input 数组，先添加文本项
    const input: Array<Record<string, unknown>> = [{ type: "text", text: prompt }];

    // 添加参考图项
    if (referenceImages && referenceImages.length > 0) {
      for (const img of referenceImages) {
        const fullUrl = this.toFullUrl(img.url);
        input.push({
          type: "image_url",
          image_url: { url: fullUrl },
          role: img.role,  // "first_frame" / "last_frame" / "reference_image"
        });
      }
    }

    return {
      model: this.modelId,  // 使用实际传入的 modelId（标准版或Fast版）
      input,
      duration: clampedDuration,
      ratio,
      resolution,
      generate_audio: true,
    };
  }

  /** 构建 Kling V3 提交请求体 (input是对象格式)
   *  Kling V3 分辨率与 mode 映射：
   *    720p → mode: "std"（标准模式）
   *    1080p → mode: "pro"（高清模式）
   */
  private buildKlingBody(prompt: string, params?: GenerateParams, referenceImages?: ReferenceImage[]): Record<string, unknown> {
    const duration = params?.duration ?? 5;
    const clampedDuration = Math.max(3, Math.min(15, duration));
    const resolution = (params?.resolution as string) || "720p";
    const resSize = this.getResolutionSize(resolution);
    const width = params?.width ?? resSize.width;
    const height = params?.height ?? resSize.height;
    let aspectRatio = "16:9";
    if (height > width) {
      aspectRatio = "9:16";
    } else if (width === height) {
      aspectRatio = "1:1";
    }

    // resolution → mode 映射：720p→std, 1080p→pro
    const mode = resolution === "1080p" ? "pro" : "std";

    // 构建 input 对象
    const inputObj: Record<string, unknown> = { prompt };

    // 添加参考图到 media 数组
    if (referenceImages && referenceImages.length > 0) {
      const media: Array<Record<string, string>> = [];
      for (const img of referenceImages) {
        const fullUrl = this.toFullUrl(img.url);
        // Kling 使用 "first_frame" / "last_frame" 作为 type
        if (img.role === "first_frame" || img.role === "last_frame") {
          media.push({ type: img.role, url: fullUrl });
        } else if (img.role === "reference_image") {
          // reference_image 在 Kling 中映射为 first_frame
          media.push({ type: "first_frame", url: fullUrl });
        }
      }
      if (media.length > 0) {
        inputObj.media = media;
      }
    }

    return {
      model: "kling-v3-video-generation",
      input: inputObj,
      parameters: {
        duration: clampedDuration,
        mode,
        aspect_ratio: aspectRatio,
        audio: true,
      },
    };
  }

  /** 构建 Sora-2 multipart/form-data 请求 (POST /v1/videos)
   *  Sora-2 仅支持 720P：size 参数只接受 "1280x720"(横屏) 或 "720x1280"(竖屏)
   *  不支持 1080P，忽略 resolution 参数中的 1080p
   */
  private async submitSoraTask(prompt: string, params?: GenerateParams): Promise<AdapterResult> {
    const duration = params?.duration ?? 4;
    const seconds = [4, 8, 12].includes(duration) ? String(duration) : "4";
    // Sora-2 只支持720P，size 只接受 "1280x720" 或 "720x1280"
    const width = params?.width ?? 1280;
    const height = params?.height ?? 720;
    // 确保不超过720P范围
    const size = width >= height ? "1280x720" : "720x1280";

    // 构建 multipart/form-data
    const boundary = "----DMXAPIFormBoundary" + Date.now();
    const parts = [
      `--${boundary}\r\nContent-Disposition: form-data; name="prompt"\r\n\r\n${prompt}`,
      `--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nsora-2`,
      `--${boundary}\r\nContent-Disposition: form-data; name="seconds"\r\n\r\n${seconds}`,
      `--${boundary}\r\nContent-Disposition: form-data; name="size"\r\n\r\n${size}`,
      `--${boundary}--`,
    ];
    const body = parts.join("\r\n");

    const url = `${this.baseUrl}/videos`;  // /v1/videos
    console.log(`[DMXAPIVideoAdapter] Sora-2 提交: url=${url}`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Authorization": this.apiKey,  // Sora用不带Bearer的格式
      },
      body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DMXAPI Sora-2 视频生成请求失败 (${response.status}): ${errorText}`);
    }

    const data = await response.json() as Record<string, unknown>;
    const taskId = (data.id as string) ?? "";

    if (!taskId) {
      throw new Error(`DMXAPI Sora-2 视频生成未返回任务ID: ${JSON.stringify(data)}`);
    }

    console.log(`[DMXAPIVideoAdapter] Sora-2 任务已提交, taskId=${taskId}`);
    return { taskId, status: "processing", progress: 5 };
  }

  /** 获取查询模型名（用于 checkStatus） */
  private getQueryModel(): string {
    switch (this.modelId) {
      case "sora-2":
        return "sora-get";
      case "doubao-seedance-2-0-fast-260128":
      case "doubao-seedance-2-0-260128":
        return "seedance-2-0-get";
      case "kling-v3-video-generation":
        return "kling-v3-get";
      default:
        return `${this.modelId}-get`;
    }
  }

  /** 发起视频生成请求 */
  async generate(prompt: string, params?: GenerateParams): Promise<AdapterResult> {
    // Sora-2 使用独立的 multipart 提交流程（不支持参考图）
    if (this.modelId === "sora-2") {
      return this.submitSoraTask(prompt, params);
    }

    // 获取 referenceImages
    const referenceImages = params?.referenceImages as ReferenceImage[] | undefined;

    // Seedance / Kling 使用 JSON + /v1/responses
    const url = `${this.baseUrl}/responses`;

    let body: Record<string, unknown>;
    switch (this.modelId) {
      case "doubao-seedance-2-0-fast-260128":
      case "doubao-seedance-2-0-260128":
        body = this.buildSeedanceBody(prompt, params, referenceImages);
        break;
      case "kling-v3-video-generation":
        body = this.buildKlingBody(prompt, params, referenceImages);
        break;
      default:
        throw new Error(`DMXAPI 视频适配器不支持的模型: ${this.modelId}`);
    }

    console.log(`[DMXAPIVideoAdapter] 发起视频生成: model=${this.modelId}, url=${url}, referenceImages=${referenceImages?.length ?? 0}`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": this.apiKey,  // 提交任务不带Bearer
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DMXAPI 视频生成请求失败 (${response.status}): ${errorText}`);
    }

    const data = await response.json() as Record<string, unknown>;
    const taskId = this.extractTaskId(data);

    if (!taskId) {
      throw new Error(`DMXAPI 视频生成未返回任务ID: ${JSON.stringify(data)}`);
    }

    console.log(`[DMXAPIVideoAdapter] 任务已提交, taskId=${taskId}`);
    return { taskId: String(taskId), status: "processing", progress: 5 };
  }

  /** 查询任务状态（使用 POST /v1/responses + 查询模型名） */
  async checkStatus(taskId: string): Promise<TaskStatusResult> {
    const url = `${this.baseUrl}/responses`;
    const queryModel = this.getQueryModel();

    const body = {
      model: queryModel,
      input: taskId,
    };

    console.log(`[DMXAPIVideoAdapter] 查询状态: model=${queryModel}, taskId=${taskId}`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,  // 查询用Bearer
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DMXAPI 视频状态查询失败 (${response.status}): ${errorText}`);
    }

    const data = await response.json() as Record<string, unknown>;
    return this.parseStatusResult(data, taskId);
  }

  /** 解析查询结果 */
  private parseStatusResult(data: Record<string, unknown>, taskId: string): TaskStatusResult {
    // 尝试从 output 中提取结果文本
    const output = data.output as Array<Record<string, unknown>> | undefined;
    let resultText = "";

    if (output && Array.isArray(output)) {
      for (const item of output) {
        const content = item.content as Array<Record<string, unknown>> | undefined;
        if (content && Array.isArray(content)) {
          for (const c of content) {
            if (c.type === "output_text" && typeof c.text === "string") {
              resultText = c.text as string;
            }
          }
        }
      }
    }

    // 如果有 resultText，尝试解析
    if (resultText) {
      try {
        const parsed = JSON.parse(resultText);
        return this.handleParsedResult(parsed, taskId);
      } catch {
        // 不是 JSON，检查是否是 base64（Sora-2）
        if (this.modelId === "sora-2") {
          return this.handleSoraBase64(data, resultText);
        }
      }
    }

    // 检查 Sora-2 的 video_base64 字段
    if (this.modelId === "sora-2" && data.video_base64) {
      return this.handleSoraBase64(data, data.video_base64 as string);
    }

    // 检查是否仍在处理中
    const statusStr = String(data.status ?? "").toLowerCase();
    if (statusStr === "processing" || statusStr === "pending" || statusStr === "running" || statusStr === "queued") {
      const progress = typeof data.progress === "number" ? data.progress as number : 50;
      return { status: "processing", progress };
    }

    if (statusStr === "failed" || statusStr === "error") {
      return {
        status: "failed",
        progress: 0,
        errorMessage: String(data.error ?? "视频生成失败"),
      };
    }

    if (statusStr === "succeeded" || statusStr === "success" || statusStr === "completed") {
      // Seedance 返回格式: result.output[0].content[0].text -> JSON -> content.video_url
      return this.handleParsedResult({ status: "success", video_url: "" }, taskId);
    }

    // 默认仍在处理中
    return { status: "processing", progress: 50 };
  }

  /** 处理解析后的结果 JSON */
  private handleParsedResult(parsed: Record<string, unknown>, _taskId: string): TaskStatusResult {
    const taskStatus = String(parsed.task_status ?? parsed.status ?? "").toLowerCase();

    // 任务仍在处理中
    if (["processing", "pending", "running", "in_progress", "queued"].includes(taskStatus)) {
      const progress = typeof parsed.progress === "number" ? (parsed.progress as number) : 50;
      return { status: "processing", progress };
    }

    // 任务失败
    if (["failed", "error", "expired"].includes(taskStatus)) {
      return {
        status: "failed",
        progress: 0,
        errorMessage: String(parsed.error ?? parsed.message ?? "视频生成失败"),
      };
    }

    // 任务完成
    if (["success", "succeeded", "completed", "complete"].includes(taskStatus)) {
      // Seedance / Kling: 从 content.video_url 获取
      const content = parsed.content as Record<string, unknown> | undefined;
      const videoUrl = (content?.video_url as string)
        ?? (parsed.video_url as string)
        ?? (parsed.url as string)
        ?? "";

      if (videoUrl) {
        return { status: "completed", progress: 100, resultUrl: videoUrl };
      }

      // Sora-2: 可能有 video_base64
      if (parsed.video_base64) {
        return this.handleSoraBase64(parsed, parsed.video_base64 as string);
      }

      return {
        status: "failed",
        progress: 0,
        errorMessage: "视频生成完成但未返回视频地址",
      };
    }

    // 未知状态，视为处理中
    return { status: "processing", progress: 50 };
  }

  /** 处理 Sora-2 返回的 base64 视频 */
  private handleSoraBase64(data: Record<string, unknown>, base64Str: string): TaskStatusResult {
    try {
      const uploadDir = config.uploadDir;
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const fileName = `video_sora_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.mp4`;
      const filePath = path.join(uploadDir, fileName);
      const buffer = Buffer.from(base64Str, "base64");
      fs.writeFileSync(filePath, buffer);

      const resultUrl = `/uploads/${fileName}`;
      console.log(`[DMXAPIVideoAdapter] Sora-2 base64视频已保存: ${fileName}, 大小: ${buffer.length} bytes`);

      return { status: "completed", progress: 100, resultUrl };
    } catch (err) {
      console.error("[DMXAPIVideoAdapter] Sora-2 base64解码保存失败:", err);
      return {
        status: "failed",
        progress: 0,
        errorMessage: "Sora-2 视频base64解码保存失败",
      };
    }
  }
}
