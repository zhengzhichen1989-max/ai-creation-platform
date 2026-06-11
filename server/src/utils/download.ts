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
  // 注意: 不再从 text/plain 推断扩展名，因为很多CDN对图片返回 text/plain
  // 优先使用 URL 扩展名
  return null;
}

/** 已知的媒体文件扩展名（URL中有这些扩展名时优先使用） */
const KNOWN_MEDIA_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".mp4", ".webm", ".mov", ".avi"]);

function getExtensionFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const ext = path.extname(pathname).toLowerCase();
    if (ext && KNOWN_MEDIA_EXTENSIONS.has(ext)) return ext;
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
  console.log(`[download] 开始下载: ${url.substring(0, 80)}...`);
  const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!response.ok) {
    throw new Error(`下载失败 (${response.status}): ${url}`);
  }

  const contentType = response.headers.get("content-type") || "";
  console.log(`[download] 响应 Content-Type: ${contentType}, status: ${response.status}`);
  const extFromCt = getExtensionFromContentType(contentType);
  const extFromUrl = getExtensionFromUrl(url);
  const ext = extFromUrl || extFromCt || ".bin";

  const fileName = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 10)}${ext}`;
  const filePath = path.join(config.uploadDir, fileName);

  const buffer = Buffer.from(await response.arrayBuffer());

  // 检查 body 是否为空（有些CDN返回200但body为0字节）
  if (buffer.length === 0) {
    throw new Error(`下载的文件为空 (0 bytes): ${url}`);
  }

  // 额外校验: 如果 URL 扩展名是图片/视频，但实际内容看起来不像（太小或不是二进制），发出警告
  const isMediaUrl = KNOWN_MEDIA_EXTENSIONS.has(ext);
  if (isMediaUrl && buffer.length < 100) {
    const preview = buffer.toString('utf8').substring(0, 50);
    console.warn(`[download] 警告: 媒体文件异常小 (${buffer.length} bytes), 内容预览: ${preview}`);
  }

  fs.writeFileSync(filePath, buffer);

  console.log(`[download] 已保存: ${fileName}, 大小: ${buffer.length} bytes, ext=${ext} (fromUrl=${extFromUrl}, fromCt=${extFromCt})`);
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
