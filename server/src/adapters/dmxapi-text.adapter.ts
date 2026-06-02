// ============================================================
// AI创作聚合平台 - DMXAPI 文案适配器
// 支持 deepseek-chat / qwen-max
// 使用 POST /v1/chat/completions 端点
// ============================================================

import fs from "fs";
import path from "path";
import type { AdapterResult, GenerateParams, TaskStatusResult } from "../types/index.js";
import { config } from "../config/index.js";

/** 模型名称别名映射：前端显示名 → DMXAPI实际模型名（按优先级排序） */
const MODEL_ALIAS_MAP: Record<string, string[]> = {
  "deepseek-chat": ["deepseek-chat", "deepseek-v3", "deepseek-v3.1", "deepseek-v4-flash"],
  "qwen-max": ["qwen-max", "qwen3-max", "qwen-plus"],
};

/** DMXAPI 文案适配器，支持 deepseek-chat / qwen-max */
export class DMXAPITextAdapter {
  private modelId: string;
  private baseUrl: string;
  private apiKey: string;

  constructor(modelId: string) {
    this.modelId = modelId;
    this.baseUrl = config.providers.dmxapi.baseUrl; // https://www.dmxapi.cn/v1
    this.apiKey = config.providers.dmxapi.apiKey;
  }

  /** 尝试用不同模型名发起请求，直到成功 */
  private async tryWithModelNames(body: Omit<Record<string, unknown>, "model">): Promise<{
    data: Record<string, unknown>;
    usedModel: string;
  }> {
    // 首先尝试原始模型名
    const candidates = MODEL_ALIAS_MAP[this.modelId] ?? [this.modelId];

    let lastError: Error | null = null;

    for (const modelName of candidates) {
      const requestBody = { ...body, model: modelName };
      console.log(`[DMXAPITextAdapter] 尝试模型名: ${modelName}`);

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const data = await response.json() as Record<string, unknown>;
        return { data, usedModel: modelName };
      }

      const errorText = await response.text();
      lastError = new Error(`模型 ${modelName} 请求失败 (${response.status}): ${errorText}`);
      console.warn(`[DMXAPITextAdapter] ${lastError.message}`);

      // 如果是 401/403 认证错误，不要重试其他模型名
      if (response.status === 401 || response.status === 403) {
        throw lastError;
      }

      // 如果是 404 模型不存在，继续尝试下一个
      if (response.status === 404) {
        continue;
      }

      // 其他错误（如 400 参数错误），继续尝试
      continue;
    }

    throw lastError ?? new Error(`DMXAPI 文案生成所有模型名尝试均失败`);
  }

  /** 发起文案生成请求（同步返回） */
  async generate(prompt: string, params?: GenerateParams): Promise<AdapterResult> {
    console.log(`[DMXAPITextAdapter] 发起文案生成: model=${this.modelId}`);

    const body: Omit<Record<string, unknown>, "model"> = {
      messages: [
        { role: "user", content: prompt },
      ],
      max_tokens: params?.max_tokens ?? 4096,
    };

    const { data, usedModel } = await this.tryWithModelNames(body);

    // 提取文本内容 - OpenAI 兼容格式
    const choices = data.choices as Array<Record<string, unknown>> | undefined;
    const message = choices?.[0]?.message as Record<string, unknown> | undefined;
    const content = (message?.content as string) ?? "";

    if (!content) {
      throw new Error(`DMXAPI 文案生成未返回文本内容: ${JSON.stringify(data)}`);
    }

    // 保存文本到文件
    const uploadDir = config.uploadDir;
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const fileName = `text_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.txt`;
    const filePath = path.join(uploadDir, fileName);
    fs.writeFileSync(filePath, content, "utf-8");

    const resultUrl = `/uploads/${fileName}`;

    console.log(`[DMXAPITextAdapter] 文案生成完成, 使用模型: ${usedModel}, 文件: ${fileName}, 长度: ${content.length}`);

    return {
      taskId: `text_${Date.now()}`,
      status: "completed",
      resultUrl,
      progress: 100,
    };
  }

  /** 文案生成是同步的，不需要轮询 */
  async checkStatus(_taskId: string): Promise<TaskStatusResult> {
    throw new Error("文案生成是同步操作，不需要轮询状态");
  }
}
