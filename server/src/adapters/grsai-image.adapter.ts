// ============================================================
// AI创作聚合平台 - GrsAI 图片适配器
// SSE 流式响应，等待最终结果直接返回
// ============================================================

import type { AdapterResult, GenerateParams } from "../types/index.js";
import { config } from "../config/index.js";
import { MODEL_PROVIDER_MAP } from "../config/providers.js";

/** GrsAI 图片适配器，支持 /v1/draw/completions 和 /v1/draw/nano-banana 两种端点 */
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
   * GrsAI返回SSE流，整个流包含从running→succeeded的完整过程
   * 我们等待到succeeded状态，直接返回结果URL
   */
  async generate(prompt: string, params?: GenerateParams): Promise<AdapterResult> {
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
