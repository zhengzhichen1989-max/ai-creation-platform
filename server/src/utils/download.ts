// ============================================================
// 媒体文件下载工具 - 将外部 URL 下载到本地 uploads 目录
// ============================================================

import fs from "fs";
import path from "path";
import { config } from "../config/index.js";

function getExtensionFromContentType(contentType: string): string | null {
  const ct = contentType.toLowerCase();
  if (ct.includes("image/png")) return ".png";
  if (ct.includes("image/jpeg") || ct.includes("image/jpg")) return ".jpg";
  if (ct.includes("image/webp")) return ".webp";
  if (ct.includes("image/gif")) return ".gif";
  if (ct.includes("video/mp4")) return ".mp4";
  if (ct.includes("video/webm")) return ".webm";
  if (ct.includes("text/plain")) return ".txt";
  return null;
}

function getExtensionFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const ext = path.extname(pathname).toLowerCase();
    if (ext) return ext;
  } catch {
    // ignore invalid URL
  }
  return "";
}

/**
 * 下载远程文件到本地 uploads 目录
 * @param url 远程文件 URL
 * @param prefix 文件名前缀，如 "image", "video"
 * @returns 本地访问路径，如 "/uploads/image_xxx.jpg"
 */
export async function downloadFile(url: string, prefix: string): Promise<string> {
  const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!response.ok) {
    throw new Error(`下载失败 (${response.status}): ${url}`);
  }

  const contentType = response.headers.get("content-type") || "";
  const extFromCt = getExtensionFromContentType(contentType);
  const extFromUrl = getExtensionFromUrl(url);
  const ext = extFromCt || extFromUrl || ".bin";

  const fileName = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 10)}${ext}`;
  const filePath = path.join(config.uploadDir, fileName);

  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(filePath, buffer);

  console.log(`[download] 已保存: ${fileName}, 大小: ${buffer.length} bytes, URL: ${url.substring(0, 60)}...`);
  return `/uploads/${fileName}`;
}

/**
 * 如果 URL 是外部地址，下载到本地；否则原样返回
 */
export async function downloadIfExternal(url: string | undefined, prefix: string): Promise<string | undefined> {
  if (!url) return undefined;
  if (url.startsWith("/uploads/") || url.startsWith("/")) {
    return url; // 已经是本地路径
  }
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return downloadFile(url, prefix);
  }
  return url;
}
