// ============================================================
// 种草视频路由 API (6步工作流版)
// ============================================================

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { contentModerationMiddleware } from "../middleware/content-moderation.middleware.js";
import { successResponse, paginatedResponse } from "../utils/helpers.js";
import * as shouzuoService from "../services/shouzuo.service.js";
import * as creditsService from "../services/credits.service.js";
import { gptImageService } from "../services/gpt-image.service.js";
import { getDb } from "../db/index.js";

// ============================================================
// Schema 定义
// ============================================================

const startSessionSchema = z.object({
  images: z.array(z.string().min(1)).min(1).max(5),
  productInfo: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    sellingPoints: z.array(z.string()).max(5).optional(),
    price: z.string().optional(),
    targetAudience: z.string().optional(),
  }).optional(),
});

/** Step 2: 保存 AI 识别结果 */
const saveAiRecognitionSchema = z.object({
  sessionId: z.string().min(1),
  aiRecognition: z.object({
    clothing_type: z.string(),
    material: z.string(),
    season: z.array(z.string()),
    main_color: z.string(),
    style_tags: z.array(z.string()),
    recommendations: z.array(z.object({
      style_id: z.string(),
      confidence: z.number().min(0).max(1),
      reason: z.string(),
    })),
    raw_json: z.string().optional(),
  }),
  userEditedClothing: z.object({
    clothing_type: z.string(),
    material: z.string(),
    season: z.array(z.string()),
    main_color: z.string(),
    style_tags: z.array(z.string()),
  }).optional(),
});

/** Step 3: 确认视频参数 + 预扣积分 */
const confirmVideoParamsSchema = z.object({
  sessionId: z.string().min(1),
  videoParams: z.object({
    model: z.enum(["seedance-2.0", "kling-v3"]),
    duration: z.number().int().min(5).max(15),
    resolution: z.enum(["720p", "1080p"]),
    storyboard_count: z.number().int().min(1).max(6),
    kling_duration_splits: z.array(z.number()).optional(),
  }),
});

const selectStyleSchema = z.object({
  sessionId: z.string().min(1),
  styleId: z.string().min(1),
});

/** Step 4: 生成故事板 */
const generateStoryboardSchema = z.object({
  sessionId: z.string().min(1),
  storyboardCount: z.number().int().min(1).max(6),
  userEditedClothing: z.object({
    clothing_type: z.string(),
    material: z.string(),
    season: z.array(z.string()),
    main_color: z.string(),
    style_tags: z.array(z.string()),
  }).optional(),
});

const regenerateStoryboardSchema = z.object({
  sessionId: z.string().min(1),
  storyboardCount: z.number().int().min(1).max(6),
  feedback: z.string().optional(),
});

/** Step 5: 生成视频 */
const generateVideoSchema = z.object({
  sessionId: z.string().min(1),
  model: z.enum(["seedance-2.0", "kling-v3"]),
  resolution: z.enum(["720p", "1080p"]),
  storyboardFrames: z.array(z.object({
    seq: z.number(),
    name: z.string(),
    prompt: z.string(),
    imageUrl: z.string(),
  })),
  kling_duration_splits: z.array(z.number()).optional(),
});

/** Step 6: 生成文案 */
const generateCopywritingSchema = z.object({
  sessionId: z.string().min(1),
  userEditedClothing: z.object({
    clothing_type: z.string(),
    material: z.string(),
    season: z.array(z.string()),
    main_color: z.string(),
  }).optional(),
});

const generateProductDescriptionSchema = z.object({
  imageUrls: z.array(z.string().min(1)).min(1).max(5),
});

// ============================================================
// 路由定义 (6步工作流)
// ============================================================

export async function shouzuoRoutes(app: FastifyInstance): Promise<void> {
  // 确保表存在（自动迁移新字段）
  shouzuoService.ensureShouzuoTable();

  // ============================================================
  // 工具函数
  // ============================================================

  /** 积分扣减封装 */
  function chargeCredits(userId: number, amount: number, referenceId: string, description: string): void {
    try {
      creditsService.deduct(userId, amount, referenceId, description);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes("余额不足") || errMsg.includes("Insufficient")) {
        throw Object.assign(new Error("积分余额不足，请充值后重试"), { statusCode: 402 });
      }
      throw err;
    }
  }

  // ============================================================
  // 风格模板列表
  // ============================================================

  app.get("/styles", async (_request, reply) => {
    return reply.send(successResponse(shouzuoService.getStyleTemplates()));
  });

  // ============================================================
  // Step 1: 创建会话（上传产品图）
  // ============================================================

  app.post("/session", { preHandler: [authMiddleware, contentModerationMiddleware] }, async (request, reply) => {
    const body = startSessionSchema.parse(request.body);
    const userId = request.userId!;
    const session = shouzuoService.createSession(userId, body.images, body.productInfo);
    return reply.send(successResponse({
      sessionId: session.id,
      currentStep: "upload",
      uploadedImages: body.images,
      createdAt: session.created_at,
    }));
  });

  // ============================================================
  // Step 2: AI 识别产品图 + 风格推荐（必须在 /session/:id 之前注册！）
  // ============================================================

  app.get("/session/:id/analyze", { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.userId!;
    const session = shouzuoService.getSession(id);
    if (!session || session.user_id !== userId) {
      return reply.status(404).send({ message: "会话不存在" });
    }

    let uploadedImages: string[] = [];
    try { uploadedImages = JSON.parse(session.uploaded_images); } catch (_) { /* ignore */ }
    const productImageUrl = uploadedImages.length > 0 ? uploadedImages[0] : null;

    if (!productImageUrl) {
      const allStyles = shouzuoService.getStyleTemplates();
      return reply.send(successResponse({
        clothing_type: "未识别",
        material: "",
        season: [],
        main_color: "",
        style_tags: [],
        recommendations: allStyles.map((s) => ({ style_id: s.style_id, confidence: 0.5, reason: "请手动选择" })),
        analyzedByAI: false,
      }));
    }

    try {
      const { DMXAPITextAdapter } = await import("../adapters/dmxapi-text.adapter.js");
      const adapter = new DMXAPITextAdapter("gpt-4o");

      const prompt = `你是一个专业的服装/产品分析专家。请分析这张产品图片，以纯JSON格式返回（不要markdown代码块，只返回JSON对象）：
{
  "clothing_type": "服装品类（如：连衣裙、卫衣、西装外套、手袋、运动鞋）",
  "material": "主要材质（如：棉麻、真丝、牛仔、羊毛、合成革）",
  "season": ["适用季节，如：春、夏、秋、冬，可多个"],
  "main_color": "主色调（如：米白、黑色、酒红、卡其）",
  "style_tags": ["风格标签，如：日系、街头、高级感、通勤、剧情感，可多个"],
  "image_type": "图片类型：flat_lay=平铺图（服装单独摆放，无人穿着）、worn=穿着图（有人穿着该服装）、unknown=无法判断",
  "needs_preprocessing": "布尔值，当image_type为flat_lay时为true，否则为false"
}`;

      const result = await adapter.generate(prompt, {
        referenceImages: [{ url: productImageUrl, role: "reference_image" }],
      });

      const fs = await import("fs");
      const pathMod = await import("path");
      const { config: appConfig } = await import("../config/index.js");

      const localPath = result.resultUrl
        ? pathMod.default.join(appConfig.uploadDir, pathMod.default.basename(result.resultUrl))
        : null;

      let analysis: {
        clothing_type?: string;
        material?: string;
        season?: string[];
        main_color?: string;
        style_tags?: string[];
      } = {};

      if (localPath && fs.default.existsSync(localPath)) {
        const rawText = fs.default.readFileSync(localPath, "utf-8").trim();
        let jsonText = rawText;
        const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) jsonText = jsonMatch[1].trim();
        try {
          analysis = JSON.parse(jsonText);
        } catch {
          analysis = {
            clothing_type: rawText.match(/服装品类[：:]\s*(.+)/)?.[1] || "未识别",
            material: rawText.match(/主要材质[：:]\s*(.+)/)?.[1] || "",
            season: [],
            main_color: rawText.match(/主色调[：:]\s*(.+)/)?.[1] || "",
            style_tags: [],
          };
        }
      }

      // 构建风格推荐（根据识别结果匹配）
      const allStyles = shouzuoService.getStyleTemplates();
      const recommendations = allStyles.map((style) => {
        let confidence = 0.5;
        const tags = analysis.style_tags || [];
        const clothingType = analysis.clothing_type || "";
        const material = analysis.material || "";

        // 简单匹配逻辑
        if (style.style_id === "japanese-mori" && (tags.includes("日系") || tags.includes("森系") || material.includes("棉麻"))) confidence = 0.9;
        if (style.style_id === "street-urban" && (tags.includes("街头") || tags.includes("潮流") || clothingType.includes("卫衣"))) confidence = 0.9;
        if (style.style_id === "luxury-cinematic" && (tags.includes("高级感") || material.includes("真丝") || material.includes("羊绒"))) confidence = 0.9;
        if (style.style_id === "office-commute" && (tags.includes("通勤") || clothingType.includes("衬衫") || clothingType.includes("西装"))) confidence = 0.9;
        if (style.style_id === "story-lifestyle") confidence = 0.7; // 通用风格，中等推荐

        const reasons: Record<string, string> = {
          "japanese-mori": "识别到自然/文艺属性，适合日系森系风格",
          "street-urban": "识别到潮流/年轻属性，适合街头风格",
          "luxury-cinematic": "识别到高级/质感属性，适合高级质感风格",
          "office-commute": "识别到通勤/实用属性，适合职场通勤风格",
          "story-lifestyle": "通用剧情风格，适合任何服装的情景化展示",
        };

        return {
          style_id: style.style_id,
          confidence,
          reason: reasons[style.style_id] || "适合该服装展示",
        };
      });

      recommendations.sort((a, b) => b.confidence - a.confidence);

      const result2 = {
        clothing_type: analysis.clothing_type || "未识别",
        material: analysis.material || "",
        season: analysis.season || [],
        main_color: analysis.main_color || "",
        style_tags: analysis.style_tags || [],
        image_type: (analysis as Record<string, unknown>).image_type || "unknown",
        needs_preprocessing: (analysis as Record<string, unknown>).needs_preprocessing === true,
        recommendations,
        analyzedByAI: true,
      };

      return reply.send(successResponse(result2));
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[Shouzuo Analyze] 分析失败: ${errMsg}`);
      const allStyles = shouzuoService.getStyleTemplates();
      return reply.send(successResponse({
        clothing_type: "未识别",
        material: "",
        season: [],
        main_color: "",
        style_tags: [],
        image_type: "unknown",
        needs_preprocessing: false,
        recommendations: allStyles.map((s) => ({ style_id: s.style_id, confidence: 0.5, reason: "AI分析失败，请手动选择" })),
        analyzedByAI: false,
        aiError: errMsg,
      }));
    }
  });

  // ============================================================
  // POST /session/:id/preprocess — 服装预处理（平铺图 → 穿着效果图）
  // ============================================================

  app.post("/session/:id/preprocess", { preHandler: [authMiddleware, contentModerationMiddleware] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.userId!;
    const session = shouzuoService.getSession(id);
    if (!session || session.user_id !== userId) {
      return reply.status(404).send({ message: "会话不存在" });
    }

    // 注意：不在此处校验 needs_preprocessing，因为 analyze 结果未持久化到 DB
    // 前端已根据 analyze 返回值控制了预处理按钮的显示，直接信任客户端意图即可

    // 积分扣减：3 积分
    try {
      creditsService.deduct(userId, 3, id, "种草视频-服装预处理");
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes("余额不足") || errMsg.includes("Insufficient")) {
        return reply.status(402).send({ code: "INSUFFICIENT_CREDITS", message: "积分余额不足，请充值后重试" });
      }
      throw err;
    }

    // 获取产品图
    let uploadedImages: string[] = [];
    try { uploadedImages = JSON.parse(session.uploaded_images); } catch (_) { /* ignore */ }
    const productImageUrl = uploadedImages.length > 0 ? uploadedImages[0] : null;
    if (!productImageUrl) {
      return reply.status(400).send({ message: "未找到产品图片" });
    }

    const { config } = await import("../config/index.js");
    const fullProductImageUrl = productImageUrl.startsWith("http")
      ? productImageUrl
      : `${config.publicBaseUrl}${productImageUrl}`;

    // 标记预处理中
    shouzuoService.updatePreprocessingStatus(id, userId, "generating");

    try {
      // 调用 GPT-Image-2 edits API 生成穿着效果图
      const result = await gptImageService.editImage(
        fullProductImageUrl,
        "Generate a full-body photo of a model wearing this exact garment, standing in a natural relaxed pose, neutral light gray background, soft even studio lighting, the garment is the clear focus with all details visible, model in a half-profile pose with face naturally turned slightly away from camera, no hair or accessories covering the face, professional fashion photography style."
      );

      if (result.success && result.resultUrl) {
        shouzuoService.savePreprocessedImage(id, userId, result.resultUrl);
        return reply.send(successResponse({
          success: true,
          preprocessedImageUrl: result.resultUrl,
          status: "completed",
        }));
      } else {
        shouzuoService.updatePreprocessingStatus(id, userId, "failed");
        return reply.status(500).send({ message: result.errorMessage || "预处理生成失败" });
      }
    } catch (err: unknown) {
      shouzuoService.updatePreprocessingStatus(id, userId, "failed");
      const errMsg = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ message: `预处理生成失败: ${errMsg}` });
    }
  });

  // ============================================================
  // GET /session/:id/video — 查询视频任务状态（必须在 /session/:id 之前注册！）
  // ============================================================

  app.get("/session/:id/video", { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.userId!;
    const session = shouzuoService.getSession(id);
    if (!session || session.user_id !== userId) {
      return reply.status(404).send({ message: "会话不存在" });
    }

    // 如果已完成或失败，直接返回缓存
    if (session.video_status === "completed" || session.video_status === "failed") {
      return reply.send(successResponse({
        taskId: "",
        videoUrl: session.video_url,
        thumbnailUrl: session.video_url,
        status: session.video_status,
        duration: session.video_params_json ? JSON.parse(session.video_params_json).duration : 10,
        progress: session.video_status === "completed" ? 100 : 0,
        errorMessage: session.video_error,
      }));
    }

    // 检查是否有分段任务（Kling 多段模式）
    let segmentIds: string[] = [];
    try {
      if (session.video_segments_json) {
        const segments: shouzuoService.VideoSegment[] = JSON.parse(session.video_segments_json);
        segmentIds = segments.map((s) => s.task_id);
      }
    } catch { /* ignore */ }

    if (segmentIds.length > 0) {
      const { DMXAPIVideoAdapter } = await import("../adapters/dmxapi-video.adapter.js");
      const segments: shouzuoService.VideoSegment[] = JSON.parse(session.video_segments_json!);

      let completedCount = 0;
      let failedCount = 0;
      for (const seg of segments) {
        try {
          const adapter = new DMXAPIVideoAdapter("kling-v3-video-generation");
          const status = await adapter.checkStatus(seg.task_id);
          if (status.status === "completed") {
            seg.status = "completed";
            seg.video_url = status.resultUrl;
            completedCount++;
          } else if (status.status === "failed") {
            seg.status = "failed";
            seg.error = status.errorMessage;
            failedCount++;
          }
        } catch {
          seg.status = "failed";
          seg.error = "查询状态失败";
          failedCount++;
        }
      }

      if (completedCount === segments.length) {
        const urls = segments.map((s) => s.video_url!).filter(Boolean);
        const finalUrl = urls[0] || "";
        shouzuoService.saveFinalVideoResult(id, userId, { video_url: finalUrl, status: "completed" });
        return reply.send(successResponse({
          taskId: "",
          videoUrl: finalUrl,
          thumbnailUrl: finalUrl,
          status: "completed",
          duration: session.video_params_json ? JSON.parse(session.video_params_json).duration : 10,
          progress: 100,
        }));
      }

      if (failedCount > 0) {
        shouzuoService.saveFinalVideoResult(id, userId, { status: "failed", error: "部分视频段生成失败" });
        return reply.send(successResponse({
          taskId: "",
          videoUrl: null,
          thumbnailUrl: null,
          status: "failed",
          duration: 0,
          progress: 0,
          errorMessage: "部分视频段生成失败",
        }));
      }

      return reply.send(successResponse({
        taskId: "",
        videoUrl: null,
        thumbnailUrl: null,
        status: "processing",
        duration: session.video_params_json ? JSON.parse(session.video_params_json).duration : 10,
        progress: Math.round((completedCount / segments.length) * 90) + 5,
        segmentCount: segments.length,
        segmentCompleted: completedCount,
      }));
    }

    return reply.send(successResponse({
      taskId: "",
      videoUrl: null,
      thumbnailUrl: null,
      status: "processing",
      duration: session.video_params_json ? JSON.parse(session.video_params_json).duration : 10,
      progress: 50,
    }));
  });

  // ============================================================
  // 获取会话详情（必须在所有 /session/:id/xxx 具体路由之后！）
  // ============================================================

  app.get("/session/:id", { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.userId!;
    const session = shouzuoService.getSession(id);
    if (!session || session.user_id !== userId) {
      return reply.status(404).send({ message: "会话不存在" });
    }

    const selectedStyle = session.selected_style_id
      ? shouzuoService.getStyleTemplate(session.selected_style_id)
      : null;
    const storyboard = session.storyboard_json ? JSON.parse(session.storyboard_json) : null;
    const videoParams = session.video_params_json ? JSON.parse(session.video_params_json) : null;
    const copywriting = session.copywriting_json ? JSON.parse(session.copywriting_json) : null;
    const aiRecognition = session.ai_recognition_json ? JSON.parse(session.ai_recognition_json) : null;

    return reply.send(successResponse({
      sessionId: session.id,
      currentStep: session.current_step,
      uploadedImages: JSON.parse(session.uploaded_images),
      aiRecognition,
      selectedStyle,
      videoParams,
      storyboard,
      videoResult: session.video_status && ['processing','pending','completed','failed'].includes(session.video_status) ? {
        taskId: session.video_status === "processing" ? (session.video_segments_json ? JSON.parse(session.video_segments_json)[0]?.task_id || "" : "") : "",
        videoUrl: session.video_url || null,
        thumbnailUrl: session.video_url || null,
        status: session.video_status,
        duration: videoParams?.duration ?? 10,
        progress: session.video_status === "completed" ? 100 : session.video_status === "failed" ? 0 : 10,
        errorMessage: session.video_error || undefined,
      } : null,
      copywritingItems: copywriting ? [copywriting] : [],
      preDeductedCredits: session.pre_deducted_credits,
      preprocessed_image_url: session.preprocessed_image_url || undefined,
      preprocessing_status: session.preprocessing_status || undefined,
      createdAt: session.created_at,
    }));
  });

  /** POST /session/:id/ai-recognition — 保存 AI 识别结果（Step 2） */
  app.post("/session/:id/ai-recognition", { preHandler: authMiddleware }, async (request, reply) => {
    const body = saveAiRecognitionSchema.parse(request.body);
    const { id } = request.params as { id: string };
    const userId = request.userId!;
    const session = shouzuoService.getSession(id);
    if (!session || session.user_id !== userId) {
      return reply.status(404).send({ message: "会话不存在" });
    }

    const aiResult: shouzuoService.AiRecognitionResult = {
      clothing_type: body.aiRecognition.clothing_type,
      material: body.aiRecognition.material,
      season: body.aiRecognition.season,
      main_color: body.aiRecognition.main_color,
      style_tags: body.aiRecognition.style_tags,
      recommendations: body.aiRecognition.recommendations,
      raw_json: body.aiRecognition.raw_json,
    };

    shouzuoService.saveAiRecognition(id, userId, aiResult);

    // 如果用户编辑了服装信息，也保存
    if (body.userEditedClothing) {
      // 保存到 session 的 user_edited_clothing_json 字段（通过 service 函数）
      const db = getDb();
      db.run(
        "UPDATE shouzuo_sessions SET user_edited_clothing_json = ?, updated_at = ? WHERE id = ? AND user_id = ?",
        [JSON.stringify(body.userEditedClothing), new Date().toISOString(), id, userId]
      );
      shouzuoService.saveDatabase();
    }

    return reply.send(successResponse({ success: true, currentStep: "ai_recognize" }));
  });

  // ============================================================
  // 选择风格（手动选择，可选）
  // ============================================================

  app.post("/style/select", { preHandler: authMiddleware }, async (request, reply) => {
    const body = selectStyleSchema.parse(request.body);
    const userId = request.userId!;
    const style = shouzuoService.selectStyle(body.sessionId, body.styleId, userId);
    return reply.send(successResponse(style));
  });

  // ============================================================
  // Step 3: 确认视频参数 + 预扣积分
  // ============================================================

  app.post("/session/:id/confirm-params", { preHandler: authMiddleware }, async (request, reply) => {
    const body = confirmVideoParamsSchema.parse(request.body);
    const { id } = request.params as { id: string };
    const userId = request.userId!;
    const session = shouzuoService.getSession(id);
    if (!session || session.user_id !== userId) {
      return reply.status(404).send({ message: "会话不存在" });
    }

    // 保存视频参数（不再预扣积分，改为生成完成后按实际扣减）
    shouzuoService.confirmVideoParams(id, userId, body.videoParams as shouzuoService.VideoParams);

    return reply.send(successResponse({
      success: true,
      currentStep: "video_params",
      estimatedCredits: shouzuoService.calculateEstimatedCredits(
        session.selected_style_id || "japanese-mori",
        body.videoParams as shouzuoService.VideoParams,
      ),
      videoParams: body.videoParams,
    }));
  });

  // ============================================================
  // Step 4: 生成故事板（分镜图）
  // ============================================================

  app.post("/storyboard/generate", { preHandler: [authMiddleware, contentModerationMiddleware] }, async (request, reply) => {
    const body = generateStoryboardSchema.parse(request.body);
    const userId = request.userId!;
    const session = shouzuoService.getSession(body.sessionId);
    if (!session || session.user_id !== userId) {
      return reply.status(404).send({ message: "会话不存在" });
    }

    // 积分扣减：每帧 3 积分
    const storyboardCost = body.storyboardCount * 3;
    chargeCredits(userId, storyboardCost, body.sessionId, `种草视频-故事板生成(${body.storyboardCount}帧 × 3积分)`);
    console.log(`[Shouzuo Storyboard] 已扣减 ${storyboardCost} 积分 (userId=${userId})`);

    // 获取服装信息
    let clothingInfo: shouzuoService.ClothingInfo;
    if (body.userEditedClothing) {
      clothingInfo = body.userEditedClothing as shouzuoService.ClothingInfo;
    } else if (session.user_edited_clothing_json) {
      clothingInfo = JSON.parse(session.user_edited_clothing_json);
    } else if (session.ai_recognition_json) {
      const ai = JSON.parse(session.ai_recognition_json) as shouzuoService.AiRecognitionResult;
      clothingInfo = {
        clothing_type: ai.clothing_type,
        material: ai.material,
        season: ai.season,
        main_color: ai.main_color,
        style_tags: ai.style_tags,
      };
    } else {
      clothingInfo = {
        clothing_type: "服装",
        material: "",
        season: [],
        main_color: "",
        style_tags: [],
      };
    }

    // 获取风格模板
    const styleId = session.selected_style_id || "japanese-mori";
    const style = shouzuoService.getStyleTemplate(styleId);
    if (!style) {
      return reply.status(400).send({ message: "风格模板不存在" });
    }

    // 获取产品图
    let uploadedImages: string[] = [];
    try { uploadedImages = JSON.parse(session.uploaded_images); } catch (_) { /* ignore */ }
    const productImageUrl = uploadedImages.length > 0 ? uploadedImages[0] : null;
    if (!productImageUrl) {
      return reply.status(400).send({ message: "未找到产品图片，请先上传" });
    }

    const { config } = await import("../config/index.js");
    const fullProductImageUrl = productImageUrl.startsWith("http")
      ? productImageUrl
      : `${config.publicBaseUrl}${productImageUrl}`;

    // 优先使用预处理后的穿着效果图
    let editSourceUrl = fullProductImageUrl;
    if (session.preprocessed_image_url) {
      const preUrl = session.preprocessed_image_url;
      editSourceUrl = preUrl.startsWith("http")
        ? preUrl
        : `${config.publicBaseUrl}${preUrl}`;
    }

    const frames: shouzuoService.StoryboardFrame[] = [];
    const concurrency = 3;
    const maxRetries = 1;

    for (let i = 0; i < body.storyboardCount; i += concurrency) {
      const batch = [];
      for (let j = i; j < Math.min(i + concurrency, body.storyboardCount); j++) {
        const seq = j + 1;
        const promptResult = shouzuoService.buildStoryboardPrompt(styleId, seq, clothingInfo);
        if (!promptResult) continue;

        const generateFrame = async (): Promise<shouzuoService.StoryboardFrame & { _error?: string }> => {
          let lastError: string | undefined;
          for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
              const result = await gptImageService.editImage(editSourceUrl, promptResult.prompt);
              if (result.success && result.resultUrl) {
                return {
                  seq,
                  name: promptResult.name,
                  prompt: promptResult.prompt,
                  prompt_cn: style.storyboards.find((s) => s.seq === seq)?.prompt_cn || "",
                  imageUrl: result.resultUrl,
                  status: "completed",
                  retry_count: attempt,
                };
              }
              lastError = result.errorMessage || "未知错误";
            } catch (err: unknown) {
              lastError = err instanceof Error ? err.message : String(err);
            }
            if (attempt < maxRetries) await new Promise((r) => setTimeout(r, 2000));
          }
          return {
            seq,
            name: promptResult.name,
            prompt: promptResult.prompt,
            prompt_cn: style.storyboards.find((s) => s.seq === seq)?.prompt_cn || "",
            imageUrl: productImageUrl,
            status: "failed",
            retry_count: maxRetries + 1,
            _error: lastError,
          };
        };
        batch.push(generateFrame());
      }
      const batchResults = await Promise.all(batch);
      frames.push(...batchResults.map(({ _error, ...f }) => f));
    }

    frames.sort((a, b) => a.seq - b.seq);

    // 保存故事板
    const storyboardFrames = frames.map((f) => ({
      seq: f.seq,
      name: f.name,
      prompt: f.prompt,
      prompt_cn: f.prompt_cn || "",
      imageUrl: f.imageUrl,
      status: f.status,
      retry_count: f.retry_count,
    }));
    shouzuoService.saveStoryboard(body.sessionId, userId, storyboardFrames);

    const failedCount = frames.filter((f) => f.status === "failed").length;
    return reply.send(successResponse({
      frames: storyboardFrames,
      totalFrames: storyboardFrames.length,
      style: style.name,
      generatedAt: new Date().toISOString(),
      generatedByAI: true,
      failedFrames: failedCount,
    }));
  });

  /** 重新生成故事板（全部） */
  app.post("/storyboard/regenerate", { preHandler: [authMiddleware, contentModerationMiddleware] }, async (request, reply) => {
    return reply.status(501).send({ message: "请使用全部重新生成按钮" });
  });

  /** 换角度重新生成单帧分镜 */
  app.post("/storyboard/change-angle", { preHandler: [authMiddleware, contentModerationMiddleware] }, async (request, reply) => {
    const body = z.object({
      sessionId: z.string().min(1),
      frameIndex: z.number().int().min(0),   // 0-based index in frames array
    }).parse(request.body);

    const userId = request.userId!;
    const session = shouzuoService.getSession(body.sessionId, userId);
    if (!session) {
      return reply.status(404).send({ message: "会话不存在" });
    }

    // 读取当前 storyboard
    let frames: shouzuoService.StoryboardFrame[] = [];
    try {
      if (session.storyboard_json) {
        const parsed = JSON.parse(session.storyboard_json);
        frames = parsed.frames || parsed || [];
      }
    } catch (_) { /* ignore */ }

    if (body.frameIndex >= frames.length) {
      return reply.status(400).send({ message: "帧索引超出范围" });
    }

    const frame = frames[body.frameIndex];
    const seq = frame.seq;
    const styleId = session.selected_style_id;
    const clothingInfo = session.ai_recognition_json
      ? JSON.parse(session.ai_recognition_json)
      : {};

    // 构建新 prompt
    const promptResult = shouzuoService.buildStoryboardPrompt(styleId, seq, clothingInfo);
    if (!promptResult) {
      return reply.status(400).send({ message: "无法构建分镜提示词" });
    }

    // 确定编辑源（预处理图优先）
    const editSourceUrl = session.preprocessed_image_url || frame.imageUrl;
    if (!editSourceUrl) {
      return reply.status(400).send({ message: "无编辑源图片" });
    }

    // 扣积分
    try {
      creditsService.deduct(userId, 3, `重新生成分镜帧${seq}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "积分不足";
      return reply.status(402).send({ message: msg });
    }

    // 调用 GPT-Image-2 生成
    try {
      const result = await gptImageService.editImage(editSourceUrl, promptResult.prompt);
      if (result.success && result.resultUrl) {
        // 更新帧数据
        frames[body.frameIndex] = {
          ...frame,
          prompt: promptResult.prompt,
          imageUrl: result.resultUrl,
          status: "completed",
          retry_count: (frame.retry_count || 0) + 1,
        };

        // 保存回数据库
        shouzuoService.updateSessionStoryboard(body.sessionId, JSON.stringify({ frames }));

        return reply.send(successResponse({
          frame: frames[body.frameIndex],
        }));
      }

      // 生成失败，退回积分
      creditsService.refund(userId, 3, `重新生成分镜帧${seq}失败退回`);
      return reply.status(500).send({ message: result.errorMessage || "图片生成失败，积分已退回" });
    } catch (err: unknown) {
      // 异常也退回积分
      creditsService.refund(userId, 3, `重新生成分镜帧${seq}异常退回`);
      const msg = err instanceof Error ? err.message : "生成失败";
      return reply.status(500).send({ message: `${msg}，积分已退回` });
    }
  });

  // ============================================================
  // Step 5: 生成视频
  // ============================================================

  app.post("/video/generate", { preHandler: [authMiddleware, contentModerationMiddleware] }, async (request, reply) => {
    const body = generateVideoSchema.parse(request.body);
    const userId = request.userId!;
    const session = shouzuoService.getSession(body.sessionId);
    if (!session || session.user_id !== userId) {
      return reply.status(404).send({ message: "会话不存在" });
    }

    const styleId = session.selected_style_id || "japanese-mori";
    const videoParams: shouzuoService.VideoParams = session.video_params_json
      ? JSON.parse(session.video_params_json)
      : { model: body.model, duration: 10, resolution: body.resolution, storyboard_count: body.storyboardFrames.length };

    // 积分扣减（使用预扣的积分或直接扣减）
    const videoCost = shouzuoService.calculateEstimatedCredits(styleId, videoParams);
    if (!session.pre_deducted_credits) {
      chargeCredits(userId, videoCost, body.sessionId, `种草视频-视频生成(${body.model}, ${videoParams.duration}s, ${body.resolution})`);
    }

    // 标记 processing
    shouzuoService.saveVideoTask(body.sessionId, userId, "pending");

    // 更新 current_step 为 'video'，确保刷新页面后能恢复到视频步骤
    {
      const db = getDb();
      db.run(
        "UPDATE shouzuo_sessions SET current_step = 'video', updated_at = ? WHERE id = ?",
        [new Date().toISOString(), body.sessionId]
      );
      shouzuoService.saveDatabase();
    }

    if (body.model === "seedance-2.0") {
      // Seedance：单段模式，所有帧一起传入
      const videoPrompt = shouzuoService.getVideoPrompt(styleId, "seedance-2.0");
      if (!videoPrompt) {
        return reply.status(500).send({ message: "获取视频提示词失败" });
      }

      // 构建参考图列表（所有故事板帧）
      const referenceImages = body.storyboardFrames.map((f) => ({
        url: f.imageUrl,
        role: "reference_image" as const,
      }));

      // 解析分辨率
      let width: number, height: number;
      if (body.resolution === "1080p") { width = 1920; height = 1080; }
      else { width = 1280; height = 720; }

      try {
        const { DMXAPIVideoAdapter } = await import("../adapters/dmxapi-video.adapter.js");
        const adapter = new DMXAPIVideoAdapter("doubao-seedance-2-0-260128");
        const result = await adapter.generate(videoPrompt, {
          duration: videoParams.duration,
          resolution: body.resolution,
          width,
          height,
          referenceImages,
        });

        const taskId = String(result.taskId);
        shouzuoService.saveVideoTask(body.sessionId, userId, taskId);

        return reply.send(successResponse({
          taskId,
          videoUrl: null,
          thumbnailUrl: null,
          status: "processing",
          duration: videoParams.duration,
          progress: 5,
        }));
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);

        // 针对常见API错误返回更友好的提示
        if (errMsg.includes('PrivacyInformation') || errMsg.includes('real person')) {
          return reply.status(400).send({
            code: 'REAL_PERSON_DETECTED',
            message: '参考图片可能包含真实人物，视频生成API无法处理含真人面部的图片。建议：使用不含人物的产品图（仅展示服装/商品），或使用AI生成的模特图。',
          });
        }
        if (errMsg.includes('401') || errMsg.includes('Unauthorized') || errMsg.includes('invalid api key')) {
          return reply.status(502).send({ message: '视频生成服务认证失败，请联系管理员检查API密钥配置。' });
        }
        if (errMsg.includes('429') || errMsg.includes('rate limit') || errMsg.includes('too many')) {
          return reply.status(429).send({ message: '视频生成请求过于频繁，请等待1-2分钟后重试。' });
        }

        console.error('[shouzuo] 视频生成失败:', errMsg);
        return reply.status(500).send({ message: `视频生成失败，请稍后重试。如果问题持续，请更换参考图片或联系客服。` });
      }
    } else {
      // Kling：多段模式，每帧单独生成一段视频
      const { DMXAPIVideoAdapter } = await import("../adapters/dmxapi-video.adapter.js");
      const segmentIds: string[] = [];
      const segments: shouzuoService.VideoSegment[] = [];

      const perSegmentDuration = Math.max(3, Math.ceil(videoParams.duration / body.storyboardFrames.length));

      for (let i = 0; i < body.storyboardFrames.length; i++) {
        const frame = body.storyboardFrames[i];
        const klingPrompt = shouzuoService.getVideoPrompt(styleId, "kling-v3", frame.seq) || frame.prompt;

        try {
          const adapter = new DMXAPIVideoAdapter("kling-v3-video-generation");
          const result = await adapter.generate(klingPrompt, {
            duration: perSegmentDuration,
            resolution: body.resolution,
            referenceImages: [{ url: frame.imageUrl, role: "reference_image" }],
          });

          const taskId = String(result.taskId);
          segmentIds.push(taskId);
          segments.push({
            seq: i + 1,
            task_id: taskId,
            status: "processing",
            duration: perSegmentDuration,
          });
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);

          if (errMsg.includes('PrivacyInformation') || errMsg.includes('real person')) {
            return reply.status(400).send({
              code: 'REAL_PERSON_DETECTED',
              message: `参考图片可能包含真实人物（第${i + 1}帧），视频生成API无法处理含真人面部的图片。建议使用不含人物的产品图或AI模特图。`,
            });
          }
          console.error(`[shouzuo] Kling 视频段${i+1}生成失败:`, errMsg);
          return reply.status(500).send({ message: `第${i + 1}帧视频生成失败，请更换该帧图片后重试。` });
        }
      }

      // 保存所有分段 taskId
      const db = getDb();
      db.run(
        "UPDATE shouzuo_sessions SET video_segment_ids = ?, video_status = ?, updated_at = ? WHERE id = ?",
        [JSON.stringify(segments), "processing", new Date().toISOString(), body.sessionId]
      );
      shouzuoService.saveDatabase();

      return reply.send(successResponse({
        taskId: segmentIds[0],
        videoUrl: null,
        thumbnailUrl: null,
        status: "processing",
        duration: videoParams.duration,
        progress: 5,
        segmentCount: segmentIds.length,
        segmentCompleted: 0,
      }));
    }
  });

  // ============================================================
  // Step 6: 生成文案
  // ============================================================

  app.post("/copywriting/generate", { preHandler: [authMiddleware, contentModerationMiddleware] }, async (request, reply) => {
    const body = generateCopywritingSchema.parse(request.body);
    const userId = request.userId!;
    const session = shouzuoService.getSession(body.sessionId);
    if (!session || session.user_id !== userId) {
      return reply.status(404).send({ message: "会话不存在" });
    }

    // 积分扣减
    const COPYWRITING_COST = shouzuoService.getModelCost("deepseek-chat");
    chargeCredits(userId, COPYWRITING_COST, body.sessionId, "种草视频-AI文案生成");
    console.log(`[Shouzuo Copywriting] 已扣减 ${COPYWRITING_COST} 积分 (userId=${userId})`);

    // 获取服装信息
    let clothingInfo: shouzuoService.ClothingInfo;
    if (body.userEditedClothing) {
      clothingInfo = body.userEditedClothing as shouzuoService.ClothingInfo;
    } else if (session.user_edited_clothing_json) {
      clothingInfo = JSON.parse(session.user_edited_clothing_json);
    } else if (session.ai_recognition_json) {
      const ai = JSON.parse(session.ai_recognition_json) as shouzuoService.AiRecognitionResult;
      clothingInfo = {
        clothing_type: ai.clothing_type,
        material: ai.material,
        season: ai.season,
        main_color: ai.main_color,
        style_tags: ai.style_tags,
      };
    } else {
      clothingInfo = {
        clothing_type: "服装",
        material: "",
        season: [],
        main_color: "",
        style_tags: [],
      };
    }

    const styleId = session.selected_style_id || "japanese-mori";
    const copywritingPrompt = shouzuoService.getCopywritingPrompt(styleId, clothingInfo);
    if (!copywritingPrompt) {
      return reply.status(500).send({ message: "获取文案提示词失败" });
    }

    try {
      const { DMXAPITextAdapter } = await import("../adapters/dmxapi-text.adapter.js");
      const adapter = new DMXAPITextAdapter("deepseek-chat");
      const result = await adapter.generate(copywritingPrompt);

      const fs = await import("fs");
      const pathMod = await import("path");
      const { config: appConfig } = await import("../config/index.js");

      const localPath = result.resultUrl
        ? pathMod.default.join(appConfig.uploadDir, pathMod.default.basename(result.resultUrl))
        : null;

      let content = "";
      if (localPath && fs.default.existsSync(localPath)) {
        content = fs.default.readFileSync(localPath, "utf-8").trim();
      }

      const copywritingResult: shouzuoService.CopywritingResult = {
        title: content.split("\n")[0]?.replace(/^#+\s*/, "") || "种草好物",
        content: content || "快来试试吧~",
        tags: ["手作", "好物推荐", "种草"],
      };

      shouzuoService.saveCopywriting(body.sessionId, userId, copywritingResult);

      return reply.send(successResponse(copywritingResult));
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ message: `文案生成失败: ${errMsg}` });
    }
  });

  // ============================================================
  // 产品描述生成（辅助功能）
  // ============================================================

  app.post("/product-description/generate", { preHandler: authMiddleware }, async (request, reply) => {
    const body = generateProductDescriptionSchema.parse(request.body);
    const productImageUrl = body.imageUrls[0];
    if (!productImageUrl) {
      return reply.status(400).send({ message: "缺少产品图片" });
    }

    try {
      const { DMXAPITextAdapter } = await import("../adapters/dmxapi-text.adapter.js");
      const adapter = new DMXAPITextAdapter("gpt-4o");

      const prompt = `你是一个专业的电商产品文案专家。请仔细分析这张产品图片，以纯JSON格式返回（不要markdown代码块，只返回JSON对象）：
{
  "productName": "产品名称（简洁有力，10字以内）",
  "productDescription": "产品描述（50-100字）",
  "sellingPoints": ["核心卖点1", "核心卖点2", "核心卖点3"]
}`;

      const result = await adapter.generate(prompt, {
        referenceImages: [{ url: productImageUrl, role: "reference_image" }],
      });

      const fs = await import("fs");
      const pathMod = await import("path");
      const { config: appConfig } = await import("../config/index.js");

      const localPath = result.resultUrl
        ? pathMod.default.join(appConfig.uploadDir, pathMod.default.basename(result.resultUrl))
        : null;

      let generated: { productName?: string; productDescription?: string; sellingPoints?: string[] } = {};
      if (localPath && fs.default.existsSync(localPath)) {
        const rawText = fs.default.readFileSync(localPath, "utf-8").trim();
        let jsonText = rawText;
        const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) jsonText = jsonMatch[1].trim();
        try { generated = JSON.parse(jsonText); } catch { /* ignore */ }
      }

      return reply.send(successResponse({
        productName: generated.productName || "未识别产品",
        productDescription: generated.productDescription || "",
        sellingPoints: generated.sellingPoints?.slice(0, 5) || [],
      }));
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ message: `产品描述生成失败: ${errMsg}` });
    }
  });

  // ============================================================
  // 获取历史会话列表
  // ============================================================

  app.get("/sessions", { preHandler: authMiddleware }, async (request, reply) => {
    const userId = request.userId!;
    const query = request.query as { page?: string; limit?: string };
    const page = parseInt(query.page || "1", 10);
    const limit = parseInt(query.limit || "10", 10);

    const result = shouzuoService.listSessions(userId, page, limit);

    // 安全解析JSON（数据库中可能存储了非标准格式）
    const safeParse = (val: string | null) => {
      if (!val) return null;
      try { return JSON.parse(val); } catch { return val; }
    };

    const items = result.items.map((s) => ({
      sessionId: s.id,
      currentStep: s.current_step,
      uploadedImages: safeParse(s.uploaded_images),
      aiRecognition: safeParse(s.ai_recognition_json),
      selectedStyle: s.selected_style_id
        ? shouzuoService.getStyleTemplate(s.selected_style_id) ?? null
        : null,
      videoParams: safeParse(s.video_params_json),
      storyboard: safeParse(s.storyboard_json),
      videoResult: s.video_url
        ? { videoUrl: s.video_url, status: s.video_status, duration: (safeParse(s.video_params_json) as any)?.duration ?? 10 }
        : null,
      copywritingItems: s.copywriting_json ? [safeParse(s.copywriting_json)] : [],
      createdAt: s.created_at,
    }));

    return reply.send(paginatedResponse(items, result.total, page, limit));
  });
}
