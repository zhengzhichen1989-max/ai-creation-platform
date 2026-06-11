// ============================================================
// 宫格图合成工具 — 将多张分镜帧拼成一张宫格图
// ============================================================

import fs from "fs";
import path from "path";
import sharp from "sharp";
import { config } from "../config/index.js";

export interface GridFrameInput {
  imageUrl: string;
  index: number;
}

/**
 * 将图片 URL/本地路径转换为 Buffer
 */
async function fetchImageBuffer(url: string): Promise<Buffer> {
  if (url.startsWith("/uploads/") || url.startsWith("/")) {
    // 本地文件
    const localPath = path.join(config.uploadDir, url.replace("/uploads/", ""));
    if (!fs.existsSync(localPath)) {
      throw new Error(`本地图片不存在: ${localPath}`);
    }
    return fs.readFileSync(localPath);
  }
  // 远程 URL
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) {
    throw new Error(`下载图片失败 (${response.status}): ${url.substring(0, 80)}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

/**
 * 确定宫格布局
 * @returns { cols, rows }
 */
function getGridLayout(frameCount: number): { cols: number; rows: number } {
  if (frameCount <= 4) return { cols: 2, rows: 2 };
  if (frameCount <= 6) return { cols: 3, rows: 2 };
  // 7-8 帧
  return { cols: 4, rows: 2 };
}

/**
 * 将多张分镜帧合成一张宫格图（2K-4K 分辨率）
 *
 * @param frames 分镜帧列表 [{imageUrl, index}]
 * @param sessionId 会话 ID（用于文件名）
 * @returns 本地路径 /uploads/grid_xxx.jpg
 */
export async function createGridImage(
  frames: GridFrameInput[],
  sessionId: string,
): Promise<string> {
  const sorted = [...frames].sort((a, b) => a.index - b.index);
  const { cols, rows } = getGridLayout(sorted.length);

  // 每个格子的目标尺寸：1024px 宽
  const cellWidth = 1024;
  const cellHeight = 1024;

  console.log(
    `[GridImage] 开始合成 ${sorted.length} 帧 → ${cols}x${rows} 宫格, 每格 ${cellWidth}x${cellHeight}px`,
  );

  // 并行下载所有帧图片
  const buffers: (Buffer | null)[] = [];
  for (const frame of sorted) {
    try {
      const buf = await fetchImageBuffer(frame.imageUrl);
      buffers.push(buf);
    } catch (err) {
      console.warn(`[GridImage] 帧${frame.index} 下载失败，跳过: ${err}`);
      buffers.push(null);
    }
  }

  // 为每个有效帧生成 cell
  const composites: sharp.OverlayOptions[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const buf = buffers[i];
    if (!buf) continue;

    const row = Math.floor(i / cols);
    const col = i % cols;

    // 将图片 resize 到 cell 尺寸（cover 模式，居中裁剪）
    const cellBuffer = await sharp(buf)
      .resize(cellWidth, cellHeight, { fit: "cover", position: "center" })
      .jpeg({ quality: 90 })
      .toBuffer();

    composites.push({
      input: cellBuffer,
      top: row * cellHeight,
      left: col * cellWidth,
    });
  }

  // 创建空白底图（白色背景）
  const canvasWidth = cols * cellWidth;
  const canvasHeight = rows * cellHeight;

  const gridBuffer = await sharp({
    create: {
      width: canvasWidth,
      height: canvasHeight,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite(composites)
    .jpeg({ quality: 92 })
    .toBuffer();

  // 保存到 uploads 目录
  const gridDir = path.join(config.uploadDir, "grid_images");
  if (!fs.existsSync(gridDir)) {
    fs.mkdirSync(gridDir, { recursive: true });
  }

  const fileName = `grid_${sessionId}_${Date.now()}.jpg`;
  const filePath = path.join(gridDir, fileName);
  fs.writeFileSync(filePath, gridBuffer);

  const localUrl = `/uploads/grid_images/${fileName}`;
  console.log(
    `[GridImage] 宫格图已保存: ${localUrl}, 尺寸: ${canvasWidth}x${canvasHeight}, 大小: ${(gridBuffer.length / 1024).toFixed(1)}KB`,
  );

  return localUrl;
}

/**
 * 将本地路径转为完整公网 URL（用于传给第三方 API）
 */
export function toPublicUrl(localPath: string): string {
  if (!localPath.startsWith("/")) return localPath;
  const base = config.publicBaseUrl.replace(/\/+$/, "");
  return `${base}${localPath}`;
}
