// ============================================================
// V2 GPT-Image-2 图片生成服务
// 封装 GrsAI /v1/images/edits 调用，支持图生图
// ============================================================

import { config } from "../config/index.js";
import fs from "fs";
import path from "path";

export interface GenerateResult {
  success: boolean;
  resultUrl?: string;
  errorMessage?: string;
}

/** GPT-Image-2 图片生成服务 */
export class GptImageService {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = config.providers.grsai.baseUrl;
    this.apiKey = config.providers.grsai.apiKey;
  }

  /**
   * 图生图编辑：将参考图 + prompt 发送给 GPT-Image-2，返回生成的图片URL
   * 使用 /v1/images/edits 端点（multipart/form-data）
   */
  async editImage(referenceImageUrl: string, prompt: string, size = "1024x1024"): Promise<GenerateResult> {
    const apiUrl = `${this.baseUrl}/v1/images/edits`;

    try {
      // 获取参考图 Blob
      const imageBlob = await this.getImageBlob(referenceImageUrl);

      // 构建 multipart/form-data
      const formData = new FormData();
      formData.append("model", "gpt-image-2");
      formData.append("prompt", prompt);
      formData.append("size", size);

      // 推断文件名
      const ext = this.getExtension(referenceImageUrl);
      formData.append("image", imageBlob, `product.${ext}`);

      console.log(`[GptImageService] 调用 GPT-Image-2 edits: prompt=${prompt.substring(0, 60)}...`);

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
        },
        body: formData,
        signal: AbortSignal.timeout(180000), // 3分钟超时
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[GptImageService] API 错误 (${response.status}): ${errorText.substring(0, 200)}`);
        return { success: false, errorMessage: `GPT-Image-2 API 错误: ${errorText.substring(0, 100)}` };
      }

      // 解析响应（JSON格式，非SSE）
      const data = await response.json() as Record<string, unknown>;
      const dataArray = data.data as Array<Record<string, unknown>> | undefined;

      if (dataArray && dataArray.length > 0) {
        const resultUrl = (dataArray[0].url || dataArray[0].b64_json) as string | undefined;
        if (resultUrl) {
          // 如果是 b64_json，保存到本地文件
          if (resultUrl.startsWith("data:") || !resultUrl.startsWith("http")) {
            console.log(`[GptImageService] 收到 b64_json，保存到本地...`);
            const localPath = this.saveBase64Image(resultUrl);
            return { success: true, resultUrl: localPath };
          }

          // 如果是远程URL，下载到本地（避免外部URL过期）
          console.log(`[GptImageService] 收到远程URL，下载到本地...`);
          const localPath = await this.downloadToLocal(resultUrl);
          return { success: true, resultUrl: localPath };
        }
      }

      // 备选：可能直接在顶层
      const url = data.url as string | undefined;
      if (url) {
        const localPath = await this.downloadToLocal(url);
        return { success: true, resultUrl: localPath };
      }

      console.error(`[GptImageService] 响应格式异常: ${JSON.stringify(data).substring(0, 200)}`);
      return { success: false, errorMessage: "GPT-Image-2 返回格式异常" };

    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[GptImageService] 异常: ${msg}`);
      return { success: false, errorMessage: msg };
    }
  }

  /** 获取图片 Blob（支持本地文件、公网URL映射、远程URL） */
  private async getImageBlob(imageUrl: string): Promise<Blob> {
    // 1) 直接的本地路径: /uploads/ref_images/xxx.png
    if (imageUrl.startsWith("/uploads/")) {
      return this.readLocalImage(imageUrl);
    }

    // 2) 公网URL映射到本地路径（服务器无法通过公网IP访问自己）
    //    如 http://47.106.208.53/uploads/ref_images/xxx.png → 本地读取
    //    如 http://127.0.0.1:3000/uploads/ref_images/xxx.png → 本地读取
    const uploadsIndex = imageUrl.indexOf("/uploads/");
    if (uploadsIndex >= 0) {
      const relativePath = imageUrl.substring(uploadsIndex); // /uploads/ref_images/xxx.png
      return this.readLocalImage(relativePath);
    }

    // 3) 真正的远程URL
    console.log(`[GptImageService] 下载远程参考图: ${imageUrl}`);
    const resp = await fetch(imageUrl);
    if (!resp.ok) {
      throw new Error(`无法下载参考图 (${resp.status}): ${imageUrl}`);
    }
    return resp.blob();
  }

  /** 从本地文件系统读取图片 */
  private readLocalImage(relativePath: string): Blob {
    const localPath = path.join(config.uploadDir, relativePath.replace(/^\/uploads\//, ""));
    console.log(`[GptImageService] 读取本地图片: ${localPath}`);
    if (!fs.existsSync(localPath)) {
      throw new Error(`参考图文件不存在: ${localPath}`);
    }
    const buffer = fs.readFileSync(localPath);
    const ext = path.extname(localPath).toLowerCase();
    const mimeType = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
    return new Blob([buffer], { type: mimeType });
  }

  /** 获取图片扩展名 */
  private getExtension(imageUrl: string): string {
    if (imageUrl.includes(".png")) return "png";
    if (imageUrl.includes(".webp")) return "webp";
    return "jpg";
  }

  /** 下载远程图片到本地 */
  private async downloadToLocal(remoteUrl: string): Promise<string> {
    const resp = await fetch(remoteUrl, {
      signal: AbortSignal.timeout(60000),
    });
    if (!resp.ok) {
      throw new Error(`下载生成图片失败 (${resp.status})`);
    }

    const buffer = Buffer.from(await resp.arrayBuffer());
    const ext = this.getExtension(remoteUrl);
    const fileName = `storyboard_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;

    const storyboardDir = path.join(config.uploadDir, "storyboard");
    if (!fs.existsSync(storyboardDir)) {
      fs.mkdirSync(storyboardDir, { recursive: true });
    }

    const filePath = path.join(storyboardDir, fileName);
    fs.writeFileSync(filePath, buffer);

    const publicPath = `/uploads/storyboard/${fileName}`;
    console.log(`[GptImageService] 图片已保存: ${publicPath}`);
    return publicPath;
  }

  /** 保存 base64 图片到本地 */
  private saveBase64Image(base64Data: string): string {
    let buffer: Buffer;

    if (base64Data.startsWith("data:")) {
      // data:image/png;base64,xxxx
      const parts = base64Data.split(",");
      buffer = Buffer.from(parts[1], "base64");
    } else {
      buffer = Buffer.from(base64Data, "base64");
    }

    const fileName = `storyboard_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.png`;
    const storyboardDir = path.join(config.uploadDir, "storyboard");
    if (!fs.existsSync(storyboardDir)) {
      fs.mkdirSync(storyboardDir, { recursive: true });
    }

    const filePath = path.join(storyboardDir, fileName);
    fs.writeFileSync(filePath, buffer);
    return `/uploads/storyboard/${fileName}`;
  }
}

export const gptImageService = new GptImageService();
