// ============================================================
// AI创作聚合平台 - 图片上传路由
// ============================================================

import type { FastifyInstance } from "fastify";
import fs from "fs";
import path from "path";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { successResponse } from "../utils/helpers.js";
import { config } from "../config/index.js";

/** 支持的图片格式及其MIME类型映射 */
const ALLOWED_MIME_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** 最大文件大小：10MB */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function uploadRoutes(app: FastifyInstance): Promise<void> {
  /** POST /api/v1/upload/image - 上传参考图（需认证，multipart/form-data） */
  app.post("/image", { preHandler: authMiddleware }, async (request, reply) => {
    const data = await request.file({
      limits: {
        fileSize: MAX_FILE_SIZE,
      },
    });

    if (!data) {
      return reply.status(400).send({
        code: 400,
        data: null,
        message: "未找到上传文件",
      });
    }

    // 验证文件类型
    const ext = ALLOWED_MIME_TYPES[data.mimetype];
    if (!ext) {
      return reply.status(400).send({
        code: 400,
        data: null,
        message: `不支持的图片格式: ${data.mimetype}，仅支持 jpg/jpeg/png/webp`,
      });
    }

    // 确保上传目录存在
    const refImagesDir = path.join(config.uploadDir, "ref_images");
    if (!fs.existsSync(refImagesDir)) {
      fs.mkdirSync(refImagesDir, { recursive: true });
    }

    // 生成文件名: ref_{timestamp}_{random}.{ext}
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const fileName = `ref_${timestamp}_${random}.${ext}`;
    const filePath = path.join(refImagesDir, fileName);

    // 将文件流写入磁盘
    const buffer = await data.toBuffer();
    fs.writeFileSync(filePath, buffer);

    const url = `/uploads/ref_images/${fileName}`;

    console.log(`[Upload] 参考图已保存: ${fileName}, 大小: ${buffer.length} bytes, 用户: ${request.userId}`);

    reply.send(successResponse({ url }, "上传成功"));
  });

  /** POST /api/v1/upload/images - 批量上传图片（最多10张，需认证，multipart/form-data） */
  app.post("/images", { preHandler: authMiddleware }, async (request, reply) => {
    const parts = request.files({
      limits: {
        fileSize: MAX_FILE_SIZE,
        files: 10,
      },
    });

    const refImagesDir = path.join(config.uploadDir, "ref_images");
    if (!fs.existsSync(refImagesDir)) {
      fs.mkdirSync(refImagesDir, { recursive: true });
    }

    const urls: string[] = [];

    for await (const data of parts) {
      // 验证文件类型
      const ext = ALLOWED_MIME_TYPES[data.mimetype];
      if (!ext) {
        return reply.status(400).send({
          code: 400,
          data: null,
          message: `不支持的图片格式: ${data.mimetype}，仅支持 jpg/jpeg/png/webp`,
        });
      }

      // 生成文件名
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 8);
      const fileName = `ref_${timestamp}_${random}.${ext}`;
      const filePath = path.join(refImagesDir, fileName);

      const buffer = await data.toBuffer();
      fs.writeFileSync(filePath, buffer);

      const url = `/uploads/ref_images/${fileName}`;
      urls.push(url);

      console.log(`[Upload] 批量上传图片已保存: ${fileName}, 大小: ${buffer.length} bytes, 用户: ${request.userId}`);
    }

    if (urls.length === 0) {
      return reply.status(400).send({
        code: 400,
        data: null,
        message: "未找到上传文件",
      });
    }

    reply.send(successResponse({ urls }, `成功上传 ${urls.length} 张图片`));
  });
}
