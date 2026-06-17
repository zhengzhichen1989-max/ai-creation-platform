// ============================================================
// 服饰短片 - 商品锁定工具（Phase 1: A+C 方案）
// 使用 GPT-4o Vision 检测商品位置 + sharp 裁剪商品区域
// ============================================================

import sharp from "sharp";
import fs from "fs";
import path from "path";
import { config } from "../config/index.js";
import { DMXAPITextAdapter } from "../adapters/dmxapi-text.adapter.js";

/** 商品类别 */
export type ItemCategory = "上衣" | "下装" | "包包" | "鞋子" | "配饰";

/** 商品检测裁剪结果 */
export interface ItemDetectResult {
  croppedImageUrl: string;    // 裁剪后的商品图URL（相对路径，如 /uploads/item_crop_xxx.png）
  itemDescription: string;    // GPT-4o 对该商品的文字描述
  boundingBox: {              // 检测到的边界框（归一化百分比）
    x: number;                // 左上角 x（0-1）
    y: number;                // 左上角 y（0-1）
    width: number;            // 宽度（0-1）
    height: number;           // 高度（0-1）
  };
}

/** GPT-4o Vision 返回的检测 JSON 格式 */
interface GPT4oDetectResult {
  items: Array<{
    category: string;
    description: string;
    boundingBox: { x: number; y: number; width: number; height: number };
  }>;
}

/** 类别中英文映射 */
const CATEGORY_MAP: Record<ItemCategory, string[]> = {
  "上衣": ["上衣", "top", "shirt", "blouse", "jacket", "coat", "sweater", "hoodie", "cardigan", "上衣/外套"],
  "下装": ["下装", "bottom", "pants", "skirt", "jeans", "trousers", "shorts", "leggings", "dress"],
  "包包": ["包包", "bag", "handbag", "purse", "tote", "backpack", "clutch", "手袋", "挎包"],
  "鞋子": ["鞋子", "shoes", "heels", "sneakers", "boots", "sandals", "flats", "loafers"],
  "配饰": ["配饰", "accessory", "hat", "scarf", "belt", "jewelry", "necklace", "bracelet", "ring", "earrings", "watch", "glasses"],
};

/**
 * 使用 GPT-4o Vision 检测产品图中指定类别的商品位置和描述
 * @param imageUrl 产品图URL（公网可访问）
 * @param itemCategory 要检测的商品类别
 * @returns 检测结果（裁剪图URL + 描述 + 边界框）
 */
export async function detectAndCropItem(
  imageUrl: string,
  itemCategory: ItemCategory,
): Promise<ItemDetectResult> {
  const adapter = new DMXAPITextAdapter("gpt-4o");

  // 构建检测 prompt
  const categoryKeywords = CATEGORY_MAP[itemCategory];
  const prompt = `你是一个专业的产品图像分析专家。请仔细观察这张产品图片，找到其中的${itemCategory}(${categoryKeywords.join("/")})。

以纯JSON格式返回（不要markdown代码块，只返回JSON对象）：
{
  "items": [
    {
      "category": "商品类别名称",
      "description": "对${itemCategory}的详细描述，包括颜色、材质、款式、图案等视觉特征（50字以内）",
      "boundingBox": {
        "x": "左上角x坐标占图片宽度的比例（0-1之间的小数）",
        "y": "左上角y坐标占图片高度的比例（0-1之间的小数）",
        "width": "边界框宽度占图片宽度的比例（0-1之间的小数）",
        "height": "边界框高度占图片高度的比例（0-1之间的小数）"
      }
    }
  ]
}

注意：
1. boundingBox 的所有值必须是0到1之间的小数，表示相对位置和大小
2. 如果图片中有多个${itemCategory}，只返回最主要/最突出的一个
3. 如果图片中没有${itemCategory}，返回空的items数组
4. 裁剪区域要包含完整商品，适当留一点边距`;

  console.log(`[ItemLock] 开始检测: category=${itemCategory}, imageUrl=${imageUrl.substring(0, 80)}...`);

  // 调用 GPT-4o Vision
  const result = await adapter.generate(prompt, {
    referenceImages: [{ url: imageUrl, role: "reference_image" }],
  });

  // 读取返回的文本
  let detectResult: GPT4oDetectResult = { items: [] };

  if (result.status === "completed" && result.resultUrl) {
    const textPath = result.resultUrl.startsWith("/")
      ? path.join(config.uploadDir, path.basename(result.resultUrl))
      : result.resultUrl;

    if (fs.existsSync(textPath)) {
      const rawText = fs.readFileSync(textPath, "utf-8").trim();
      console.log(`[ItemLock] GPT-4o 原始返回: ${rawText.substring(0, 300)}...`);

      let jsonText = rawText;
      const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1].trim();
      }
      try {
        detectResult = JSON.parse(jsonText);
      } catch {
        console.warn("[ItemLock] JSON解析失败，尝试正则提取");
        // 降级：尝试从原始文本中提取 boundingBox
        const bboxMatch = rawText.match(/boundingBox[^}]*"x"\s*:\s*(\d+\.?\d*)[^}]*"y"\s*:\s*(\d+\.?\d*)[^}]*"width"\s*:\s*(\d+\.?\d*)[^}]*"height"\s*:\s*(\d+\.?\d*)/);
        if (bboxMatch) {
          detectResult = {
            items: [{
              category: itemCategory,
              description: rawText.substring(0, 100),
              boundingBox: {
                x: parseFloat(bboxMatch[1]),
                y: parseFloat(bboxMatch[2]),
                width: parseFloat(bboxMatch[3]),
                height: parseFloat(bboxMatch[4]),
              },
            }],
          };
        }
      }
    }
  }

  // 检查是否检测到目标类别
  const targetItem = detectResult.items?.[0];
  if (!targetItem || !targetItem.boundingBox) {
    console.warn(`[ItemLock] 未检测到 ${itemCategory}，返回默认裁剪（居中50%区域）`);
    // 回退：裁剪图片中央 50% 区域作为兜底
    return fallbackCrop(imageUrl, itemCategory);
  }

  // 确保 boundingBox 值在合理范围内
  const bbox = {
    x: Math.max(0, Math.min(0.95, targetItem.boundingBox.x)),
    y: Math.max(0, Math.min(0.95, targetItem.boundingBox.y)),
    width: Math.max(0.05, Math.min(1, targetItem.boundingBox.width)),
    height: Math.max(0.05, Math.min(1, targetItem.boundingBox.height)),
  };

  // 添加 20% padding（每边 10%）
  const padFraction = 0.10;
  const cropX = Math.max(0, bbox.x - padFraction);
  const cropY = Math.max(0, bbox.y - padFraction);
  const cropW = Math.min(1 - cropX, bbox.width + 2 * padFraction);
  const cropH = Math.min(1 - cropY, bbox.height + 2 * padFraction);
  const cropBox = { x: cropX, y: cropY, width: cropW, height: cropH };

  console.log(`[ItemLock] 检测到 ${itemCategory}: desc="${targetItem.description}", bbox=${JSON.stringify(bbox)}, cropBox=${JSON.stringify(cropBox)}`);

  // 用 sharp 裁剪商品区域
  return cropItemImage(imageUrl, cropBox, targetItem.description);
}

/**
 * 用 sharp 裁剪图片中的指定区域
 * @param imageUrl 图片URL或本地路径
 * @param cropBox 裁剪区域（归一化百分比）
 * @param itemDescription 商品描述
 */
async function cropItemImage(
  imageUrl: string,
  cropBox: { x: number; y: number; width: number; height: number },
  itemDescription: string,
): Promise<ItemDetectResult> {
  // 获取图片的本地文件路径
  const localPath = resolveLocalPath(imageUrl);

  if (!localPath || !fs.existsSync(localPath)) {
    console.warn(`[ItemLock] 本地文件不存在: ${localPath}，使用回退裁剪`);
    return fallbackCrop(imageUrl, itemDescription as ItemCategory);
  }

  try {
    // 读取图片并获取元数据
    const imageBuffer = fs.readFileSync(localPath);
    const metadata = await sharp(imageBuffer).metadata();
    const imgWidth = metadata.width ?? 800;
    const imgHeight = metadata.height ?? 800;

    // 归一化坐标 → 像素坐标
    const left = Math.round(cropBox.x * imgWidth);
    const top = Math.round(cropBox.y * imgHeight);
    const width = Math.round(cropBox.width * imgWidth);
    const height = Math.round(cropBox.height * imgHeight);

    // 确保裁剪区域不超过图片边界
    const clampedLeft = Math.max(0, Math.min(left, imgWidth - 1));
    const clampedTop = Math.max(0, Math.min(top, imgHeight - 1));
    const clampedWidth = Math.max(10, Math.min(width, imgWidth - clampedLeft));
    const clampedHeight = Math.max(10, Math.min(height, imgHeight - clampedTop));

    console.log(`[ItemLock] sharp裁剪: original=${imgWidth}x${imgHeight}, crop=${clampedLeft},${clampedTop},${clampedWidth},${clampedHeight}`);

    // 裁剪 + 输出为 PNG
    const croppedBuffer = await sharp(imageBuffer)
      .extract({ left: clampedLeft, top: clampedTop, width: clampedWidth, height: clampedHeight })
      .png()
      .toBuffer();

    // 保存裁剪图到 uploads 目录
    const fileName = `item_crop_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.png`;
    const outputPath = path.join(config.uploadDir, fileName);
    fs.writeFileSync(outputPath, croppedBuffer);

    const croppedImageUrl = `/uploads/${fileName}`;
    console.log(`[ItemLock] 裁剪图已保存: ${fileName}, 大小: ${croppedBuffer.length} bytes`);

    return {
      croppedImageUrl,
      itemDescription,
      boundingBox: cropBox,
    };
  } catch (err) {
    console.error(`[ItemLock] sharp裁剪失败:`, err);
    return fallbackCrop(imageUrl, itemDescription as ItemCategory);
  }
}

/**
 * 回退裁剪方案：当GPT-4o检测失败或sharp裁剪出错时，
 * 裁剪图片中央50%区域作为兜底参考图
 */
async function fallbackCrop(
  imageUrl: string,
  itemCategory: ItemCategory,
): Promise<ItemDetectResult> {
  const localPath = resolveLocalPath(imageUrl);

  if (!localPath || !fs.existsSync(localPath)) {
    // 完全无法裁剪时，返回原图作为参考（降级到纯prompt锁定方案）
    console.warn(`[ItemLock] 完全无法裁剪，使用原图作为参考: ${imageUrl}`);
    return {
      croppedImageUrl: imageUrl,
      itemDescription: `${itemCategory}（未精确检测，使用原图参考）`,
      boundingBox: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 },
    };
  }

  try {
    const imageBuffer = fs.readFileSync(localPath);
    const metadata = await sharp(imageBuffer).metadata();
    const imgWidth = metadata.width ?? 800;
    const imgHeight = metadata.height ?? 800;

    // 裁剪中央 50% 区域
    const left = Math.round(imgWidth * 0.25);
    const top = Math.round(imgHeight * 0.25);
    const width = Math.round(imgWidth * 0.5);
    const height = Math.round(imgHeight * 0.5);

    const croppedBuffer = await sharp(imageBuffer)
      .extract({ left, top, width, height })
      .png()
      .toBuffer();

    const fileName = `item_crop_fallback_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.png`;
    const outputPath = path.join(config.uploadDir, fileName);
    fs.writeFileSync(outputPath, croppedBuffer);

    return {
      croppedImageUrl: `/uploads/${fileName}`,
      itemDescription: `${itemCategory}（中心区域参考）`,
      boundingBox: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 },
    };
  } catch (err) {
    console.error(`[ItemLock] fallback裁剪也失败:`, err);
    // 最终降级：返回原图
    return {
      croppedImageUrl: imageUrl,
      itemDescription: `${itemCategory}（原图参考）`,
      boundingBox: { x: 0, y: 0, width: 1, height: 1 },
    };
  }
}

/**
 * 将图片URL转为本地文件路径
 * 支持格式：/uploads/xxx.png 或 http://xxx/xxx.png
 */
function resolveLocalPath(imageUrl: string): string | null {
  if (imageUrl.startsWith("/uploads/")) {
    return path.join(config.uploadDir, imageUrl.replace("/uploads/", ""));
  }
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    // 公网URL：尝试从 publicBaseUrl 推断本地路径
    if (imageUrl.startsWith(config.publicBaseUrl)) {
      const relativePath = imageUrl.replace(config.publicBaseUrl, "");
      if (relativePath.startsWith("/uploads/")) {
        return path.join(config.uploadDir, relativePath.replace("/uploads/", ""));
      }
    }
    // 无法推断本地路径
    return null;
  }
  // 其他格式尝试直接作为路径
  return imageUrl;
}

/**
 * 构建锁定商品的 prompt 注入文本
 * 用于 buildVideoPromptWithFrames 中增强视频生成 prompt
 * @param lockedItems 锁定的商品列表
 * @returns 注入到 prompt 的锁定指令文本
 */
export function buildLockPromptInjection(
  lockedItems: Array<{ category: ItemCategory; itemDescription?: string }>,
): string {
  if (!lockedItems || lockedItems.length === 0) return "";

  const lockLines = lockedItems.map((item) => {
    const desc = item.itemDescription || item.category;
    return `The ${desc} MUST remain EXACTLY the same throughout the entire video — same color, same style, same design, same texture, same pattern. Do NOT modify, change, alter, or replace this item in any frame. This is a CRITICAL consistency requirement.`;
  });

  return `\n\n[ITEM LOCK - CRITICAL]\n${lockLines.join("\n")}\n[/ITEM LOCK]`;
}

/**
 * 为 Seedance 模型构建锁定商品的额外参考图
 * @param lockedItems 锁定的商品列表（含裁剪图URL）
 * @returns 额外的 reference_image 数组
 */
export function buildLockReferenceImages(
  lockedItems: Array<{ croppedImageUrl?: string; category: ItemCategory; locked: boolean }>,
): Array<{ url: string; role: "reference_image" }> {
  return lockedItems
    .filter((item) => item.locked && item.croppedImageUrl)
    .map((item) => ({
      url: item.croppedImageUrl!,
      role: "reference_image" as const,
    }));
}