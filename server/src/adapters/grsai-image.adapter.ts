// ============================================================
// AI创作聚合平台 - GrsAI 图片适配器
// SSE 流式响应，等待最终结果直接返回
// 支持图生图（gpt-image-2）通过 /v1/images/edits 端点
// ============================================================

import type { AdapterResult, GenerateParams, ReferenceImage } from "../types/index.js";
import { config } from "../config/index.js";
import { MODEL_PROVIDER_MAP } from "../config/providers.js";
import fs from "fs";
import path from "path";

/** GrsAI 图片适配器，支持 /v1/draw/completions 和 /v1/draw/nano-banana 两种端点，以及 /v1/images/edits 图生图端点 */
export class GrsAIImageAdapter {
  private modelId: string;
  private baseUrl: string;
  private apiKey: string;

  constructor(modelId: string) {
    this.modelId = modelId;
    this.baseUrl = config.providers.grsai.baseUrl;
    this.apiKey = config.providers.grsai.apiKey;
  }

  /**
   * 发起图片生成请求
   * 如果 referenceImages 包含 edit_source 角色，走 edit（图生图）流程
   * 如果 referenceImages 包含 reference_image 角色（nano-banana/flux-pro 参考图），
   *   将参考图传入 textToImage 通过 urls 参数发送
   * 否则走原 generate 流程
   */
  async generate(prompt: string, params?: GenerateParams): Promise<AdapterResult> {
    const referenceImages = params?.referenceImages as ReferenceImage[] | undefined;
    const editSource = referenceImages?.find(img => img.role === "edit_source");

    if (editSource) {
      return this.edit(editSource.url, prompt, params);
    }

    // 提取 reference_image 角色的参考图（nano-banana/flux-pro 图生图）
    const refImages = referenceImages?.filter(img => img.role === "reference_image") ?? [];

    return this.textToImage(prompt, params, refImages.length > 0 ? refImages : undefined);
  }

  /**
   * 文生图：标准生成流程
   * @param referenceImages 参考图列表（nano-banana/flux-pro 图生图），将图片URL转为完整URL后加入 body.urls
   */
  private async textToImage(prompt: string, params?: GenerateParams, referenceImages?: ReferenceImage[]): Promise<AdapterResult> {
    const providerConfig = MODEL_PROVIDER_MAP[this.modelId];
    if (!providerConfig) {
      throw new Error(`未找到模型 ${this.modelId} 的 provider 配置`);
    }

    const url = `${this.baseUrl}${providerConfig.endpoint}`;
    const size = params?.width && params?.height
      ? `${params.width}x${params.height}`
      : "1024x1024";

    const body: Record<string, unknown> = {
      model: this.modelId,
      prompt,
      size,
    };

    // 如果有参考图，将URL转为完整URL后加入 body.urls
    if (referenceImages && referenceImages.length > 0) {
      const urls = referenceImages.map(img => this.toFullUrl(img.url));
      body.urls = urls;
      console.log(`[GrsAIImageAdapter] 参考图数量: ${urls.length}, 模型: ${this.modelId}`);
    }

    console.log(`[GrsAIImageAdapter] 发起图片生成: model=${this.modelId}, endpoint=${providerConfig.endpoint}`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(300000), // 5分钟超时（图片生成可能需要1-2分钟）
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GrsAI API 请求失败 (${response.status}): ${errorText}`);
    }

    // 解析 SSE 响应，等待最终结果
    return this.parseSSEResponse(response);
  }

  /**
   * 图生图：使用 /v1/images/edits 端点（gpt-image-2 only）
   * 注意: GrsAI 的 edits 端点必须使用 multipart/form-data 上传图片文件，
   *       不支持 JSON + URL 格式（会返回 400 "Parameter data type error"）
   */
  async edit(imageUrl: string, prompt: string, params?: GenerateParams): Promise<AdapterResult> {
    const url = `${this.baseUrl}/v1/images/edits`;
    const size = params?.width && params?.height
      ? `${params.width}x${params.height}`
      : "1024x1024";

    // 构建 multipart/form-data 请求体
    const formData = new FormData();
    formData.append("model", "gpt-image-2");
    formData.append("prompt", prompt);
    formData.append("size", size);

    // 获取图片 Blob：本地文件优先，否则下载远程 URL
    const imageBlob = await this.getImageBlob(imageUrl);
    formData.append("image", imageBlob, "image.jpg");

    console.log(`[GrsAIImageAdapter] 发起图生图编辑(multipart): model=gpt-image-2`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        // 不设置 Content-Type，让 fetch 自动设置 multipart/form-data + boundary
      },
      body: formData,
      signal: AbortSignal.timeout(300000), // 5分钟超时
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GrsAI Edit API 请求失败 (${response.status}): ${errorText}`);
    }

    // edits 端点返回 JSON（非 SSE）
    return this.parseEditResponse(response);
  }

  /**
   * 获取图片 Blob（用于 multipart 上传）
   * 优先从本地文件系统读取（上传的参考图），否则下载远程 URL
   */
  private async getImageBlob(imageUrl: string): Promise<Blob> {
    if (imageUrl.startsWith("/uploads/")) {
      // 本地文件路径
      const localPath = path.join(config.uploadDir, imageUrl.replace("/uploads/", ""));
      if (!fs.existsSync(localPath)) {
        throw new Error(`参考图文件不存在: ${localPath}`);
      }
      const buffer = fs.readFileSync(localPath);
      const ext = path.extname(localPath).toLowerCase();
      const mimeType = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
      return new Blob([buffer], { type: mimeType });
    }

    if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
      // 远程 URL，下载图片
      const resp = await fetch(imageUrl);
      if (!resp.ok) {
        throw new Error(`无法下载参考图 (${resp.status}): ${imageUrl}`);
      }
      return resp.blob();
    }

    throw new Error(`不支持的参考图路径格式: ${imageUrl}`);
  }

  /**
   * 解析 OpenAI 图片编辑响应（JSON 格式，非 SSE）
   * 格式: { created, data: [{ url }], usage }
   */
  private async parseEditResponse(response: Response): Promise<AdapterResult> {
    const data = await response.json() as Record<string, unknown>;

    // OpenAI 图片编辑响应格式
    const dataArray = data.data as Array<Record<string, unknown>> | undefined;
    if (dataArray && dataArray.length > 0 && dataArray[0].url) {
      return {
        taskId: String(data.created ?? ""),
        status: "completed",
        progress: 100,
        resultUrl: String(dataArray[0].url),
      };
    }

    // 备选: 尝试通用提取
    const imageUrl = this.extractImageUrl(data);
    if (imageUrl) {
      return {
        taskId: String(data.created ?? ""),
        status: "completed",
        progress: 100,
        resultUrl: imageUrl,
      };
    }

    throw new Error(`GrsAI Edit API 返回格式异常: ${JSON.stringify(data).substring(0, 200)}`);
  }

  /**
   * 将本地路径（如 /uploads/ref_images/xxx.jpg）转为完整URL
   */
  private toFullUrl(localPath: string): string {
    if (localPath.startsWith("http://") || localPath.startsWith("https://")) {
      return localPath;
    }
    return `${config.publicBaseUrl}${localPath}`;
  }

  /**
   * 解析 SSE 响应，等待 succeeded 状态并提取图片 URL
   * 
   * GrsAI SSE 格式:
   * data: {"id":"xxx","status":"running","progress":10,...}
   * data: {"id":"xxx","status":"running","progress":50,...}
   * data: {"id":"xxx","status":"succeeded","progress":100,"results":[{"url":"https://..."}],...}
   * 
   * 错误响应格式（非SSE）:
   * {"code":-1,"data":null,"msg":"insufficient credits"}
   */
  private async parseSSEResponse(response: Response): Promise<AdapterResult> {
    // 直接读取完整响应文本
    const fullText = await response.text();

    // 先检查是否为非SSE错误响应（如余额不足）
    const trimmedText = fullText.trim();
    if (trimmedText.startsWith("{") && !trimmedText.startsWith("{\"id\"")) {
      try {
        const errorData = JSON.parse(trimmedText) as Record<string, unknown>;
        if (errorData.code === -1 || errorData.msg) {
          const errorMsg = String(errorData.msg ?? errorData.message ?? "GrsAI API错误");
          console.error(`[GrsAIImageAdapter] API错误: ${errorMsg}`);
          throw new Error(`GrsAI: ${errorMsg}`);
        }
        // 可能是直接返回的JSON结果（非SSE）
        const statusStr = String(errorData.status ?? "").toLowerCase();
        if (statusStr === "succeeded" || statusStr === "completed" || statusStr === "success") {
          const imageUrl = this.extractImageUrl(errorData);
          return { taskId: String(errorData.id ?? ""), status: "completed", progress: 100, resultUrl: imageUrl };
        }
      } catch (e) {
        if (e instanceof Error && e.message.startsWith("GrsAI:")) throw e;
        // 解析失败，继续尝试SSE解析
      }
    }

    // 按行解析SSE数据
    const lines = fullText.split("\n").filter(l => l.trim().startsWith("data: ") && l.trim() !== "data: [DONE]");
    
    console.log(`[GrsAIImageAdapter] 收到 ${lines.length} 条SSE事件`);

    let lastProgress = 10;
    let taskId = "";

    // 从后往前遍历，找到最终状态
    for (let i = lines.length - 1; i >= 0; i--) {
      const jsonStr = lines[i].trim().substring(6); // 去掉 "data: " 前缀
      try {
        const sseData = JSON.parse(jsonStr) as Record<string, unknown>;
        const statusStr = String(sseData.status ?? "").toLowerCase();
        lastProgress = typeof sseData.progress === "number" ? sseData.progress : lastProgress;
        taskId = String(sseData.id ?? taskId);

        // 检查是否已完成
        if (statusStr === "succeeded" || statusStr === "completed" || statusStr === "success") {
          const imageUrl = this.extractImageUrl(sseData);
          console.log(`[GrsAIImageAdapter] 图片生成完成, url=${imageUrl?.substring(0, 80)}...`);
          return {
            taskId: String(sseData.id ?? ""),
            status: "completed",
            progress: 100,
            resultUrl: imageUrl,
          };
        }

        // 检查是否失败
        if (statusStr === "failed" || statusStr === "error") {
          const errorMsg = String(sseData.failure_reason ?? sseData.error ?? "图片生成失败");
          console.error(`[GrsAIImageAdapter] 图片生成失败: ${errorMsg}`);
          return {
            taskId: String(sseData.id ?? ""),
            status: "failed",
            progress: 0,
            errorMessage: errorMsg,
          };
        }
      } catch {
        // 非JSON数据行，跳过
      }
    }

    // 如果SSE流完成但没有找到最终状态，返回taskId让worker轮询
    if (taskId) {
      console.log(`[GrsAIImageAdapter] SSE未返回最终结果，taskId=${taskId}，将轮询`);
      return {
        taskId,
        status: "processing",
        progress: lastProgress,
      };
    }

    throw new Error("GrsAI SSE流结束但未收到有效结果");
  }

  /**
   * 从响应数据中提取图片URL
   * 格式: results[0].url 或 url 字段
   */
  private extractImageUrl(data: Record<string, unknown>): string {
    // 优先从 results 数组提取
    const results = data.results as Array<Record<string, unknown>> | undefined;
    if (results && results.length > 0 && results[0].url) {
      return String(results[0].url);
    }

    // 备选: 从 data 对象提取
    const dataObj = data.data as Record<string, unknown> | undefined;
    if (dataObj?.url) {
      return String(dataObj.url);
    }

    // 备选: 顶层 url 字段
    if (data.url) {
      return String(data.url);
    }

    return "";
  }

  /**
   * 查询任务状态（SSE方式通常不需要轮询，但保留作为备用）
   * 注意: GrsAI的/v1/draw/result端点可能不可用，此方法仅作为fallback
   */
  async checkStatus(taskId: string): Promise<{
    status: "processing" | "completed" | "failed";
    progress: number;
    resultUrl?: string;
    errorMessage?: string;
  }> {
    const url = `${this.baseUrl}/v1/draw/result`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ id: taskId }),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        // 轮询端点不可用时，返回processing让worker继续等待
        console.warn(`[GrsAIImageAdapter] 轮询端点返回 ${response.status}，继续等待`);
        return { status: "processing", progress: 50 };
      }

      const data = await response.json() as Record<string, unknown>;
      const statusStr = String(data.status ?? "").toLowerCase();

      if (statusStr === "succeeded" || statusStr === "completed" || statusStr === "success") {
        const imageUrl = this.extractImageUrl(data);
        return { status: "completed", progress: 100, resultUrl: imageUrl };
      }

      if (statusStr === "failed" || statusStr === "error") {
        return {
          status: "failed",
          progress: 0,
          errorMessage: String(data.failure_reason ?? data.error ?? "图片生成失败"),
        };
      }

      const progress = typeof data.progress === "number" ? data.progress : 50;
      return { status: "processing", progress };
    } catch (error) {
      console.warn(`[GrsAIImageAdapter] 轮询出错: ${error}，继续等待`);
      return { status: "processing", progress: 50 };
    }
  }
}
