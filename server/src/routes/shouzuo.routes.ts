// ============================================================
// V2 种草视频路由 API
// ============================================================

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { contentModerationMiddleware } from "../middleware/content-moderation.middleware.js";
import { successResponse, paginatedResponse } from "../utils/helpers.js";
import * as shouzuoService from "../services/shouzuo.service.js";
import * as creditsService from "../services/credits.service.js";
import { gptImageService } from "../services/gpt-image.service.js";
import { createGridImage, toPublicUrl } from "../utils/grid-image.js";
import { getDb } from "../db/index.js";

/** 从 ai_models 表查询模型积分消耗 */
function getModelCost(modelId: string, duration?: number): number {
  const db = getDb();
  const rows = db.exec(
    "SELECT cost_credits, duration_pricing FROM ai_models WHERE id = ? AND enabled = 1",
    [modelId]
  );
  if (rows.length === 0 || rows[0].values.length === 0) {
    throw new Error(`模型不存在或已禁用: ${modelId}`);
  }
  const row = rows[0].values[0];
  let cost = row[0] as number;
  if (duration !== undefined && row[1]) {
    const pricing: Record<string, number> = JSON.parse(row[1] as string);
    if (pricing[String(duration)] !== undefined) {
      cost = pricing[String(duration)];
    }
  }
  return cost;
}

/** 积分扣减（封装 creditsService.deduct + 余额不足时返回友好错误） */
function chargeCredits(userId: number, amount: number, referenceId: string, description: string) {
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

const selectStyleSchema = z.object({
  sessionId: z.string().min(1),
  styleId: z.string().min(1),
});

const generateStoryboardSchema = z.object({
  sessionId: z.string().min(1),
  styleId: z.string().min(1),
  styleName: z.string().min(1),
  frameCount: z.number().int().min(4).max(8),
  productDescription: z.string().optional(),
});

const regenerateStoryboardSchema = z.object({
  sessionId: z.string().min(1),
  styleId: z.string().min(1),
  styleName: z.string().min(1),
  frameCount: z.number().int().min(4).max(8),
  feedback: z.string().optional(),
});

const generateVideoSchema = z.object({
  sessionId: z.string().min(1),
  storyboardFrames: z.array(z.object({
    index: z.number(),
    description: z.string(),
    imageUrl: z.string(),
    prompt: z.string(),
  })),
  styleName: z.string().min(1),
  modelId: z.enum(["kling-v3", "seedance-2-0"]).default("kling-v3"),
  duration: z.number().int().min(5).max(15).optional(),
});

const generateCopywritingSchema = z.object({
  sessionId: z.string().min(1),
  videoUrl: z.string().min(1),
  styleName: z.string().min(1),
  productDescription: z.string().optional(),
});

const generateProductDescriptionSchema = z.object({
  imageUrls: z.array(z.string().min(1)).min(1).max(5),
});

export async function shouzuoRoutes(app: FastifyInstance): Promise<void> {
  // 确保表存在
  shouzuoService.ensureShouzuoTable();

  /** GET /api/v1/shouzuo/styles — 获取风格模板列表 */
  app.get("/styles", async (_request, reply) => {
    const styles = shouzuoService.getStyleTemplates();
    return reply.send(successResponse(styles));
  });

  /** POST /api/v1/shouzuo/session — 创建会话 + 上传图片 */
  app.post("/session", { preHandler: [authMiddleware, contentModerationMiddleware] }, async (request, reply) => {
    const body = startSessionSchema.parse(request.body);
    const userId = request.userId!;

    const session = shouzuoService.createSession(userId, body.images, body.productInfo);

    // 返回全部 5 个风格模板（AI 分析将在 GET /analyze 中异步完成）
    const analysisStyles = shouzuoService.getStyleTemplates();

    return reply.send(successResponse({
      sessionId: session.id,
      currentStep: "select_style",
      uploadedImages: body.images,
      recommendedStyles: analysisStyles,
      createdAt: session.created_at,
    }));
  });

  /** GET /api/v1/shouzuo/session/:id — 获取会话详情 */
  app.get("/session/:id", { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.userId!;

    const session = shouzuoService.getSession(id);
    if (!session || session.user_id !== userId) {
      return reply.status(404).send({ message: "会话不存在" });
    }

    const style = shouzuoService.getStyleTemplates().find((s) => s.id === session.style_id);
    const storyboard = session.storyboard_json ? JSON.parse(session.storyboard_json) : null;
    const copywriting = session.copywriting_json ? JSON.parse(session.copywriting_json) : [];

    return reply.send(successResponse({
      sessionId: session.id,
      currentStep: session.current_step,
      uploadedImages: JSON.parse(session.uploaded_images),
      selectedStyle: style ?? null,
      storyboard,
      videoResult: session.video_url ? {
        taskId: session.video_task_id,
        videoUrl: session.video_url,
        thumbnailUrl: session.video_thumbnail,
        status: session.video_status,
        duration: session.video_duration,
        progress: session.video_status === "completed" ? 100 : 50,
      } : null,
      copywritingItems: copywriting,
      createdAt: session.created_at,
    }));
  });

  /** GET /api/v1/shouzuo/session/:id/analyze — 图片分析（GPT-4o Vision，返回风格推荐） */
  app.get("/session/:id/analyze", { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.userId!;

    const session = shouzuoService.getSession(id);
    if (!session || session.user_id !== userId) {
      return reply.status(404).send({ message: "会话不存在" });
    }

    // 获取产品图URL
    let uploadedImages: string[] = [];
    try { uploadedImages = JSON.parse(session.uploaded_images); } catch (_) { /* ignore */ }
    const productImageUrl = uploadedImages.length > 0 ? uploadedImages[0] : null;

    // 所有5个风格模板
    const allStyles = shouzuoService.getStyleTemplates();

    if (!productImageUrl) {
      // 无图片时，返回全部风格 + 默认分析结果
      return reply.send(successResponse({
        category: "未识别",
        colors: [],
        materials: [],
        style: "请手动选择",
        recommendedStyles: allStyles,
        analyzedByAI: false,
      }));
    }

    try {
      // 调用 GPT-4o Vision 分析产品图（DMXAPI 上支持多模态视觉）
      const { DMXAPITextAdapter } = await import("../adapters/dmxapi-text.adapter.js");
      const adapter = new DMXAPITextAdapter("gpt-4o");

      const prompt = `你是一个专业的产品摄影分析专家。请分析这张产品图片，以纯JSON格式返回（不要markdown代码块，只返回JSON对象）：
{
  "category": "产品品类（如：手工服装、手工饰品、手工皮具、手工陶瓷等）",
  "colors": ["主色调列表，如：自然色系、暖色调、冷色调等"],
  "materials": ["材质列表，如：棉麻、丝绸、皮革、陶瓷等"],
  "style": "最匹配的风格，从以下选择最合适的1个：森系、日系、复古、极简、氛围感",
  "styleReason": "推荐该风格的一句理由"
}`;

      const result = await adapter.generate(prompt, {
        referenceImages: [{ url: productImageUrl, role: "reference_image" }],
      });

      // 读取生成的文本文件
      const fs = await import("fs");
      const path = await import("path");
      const { config: appConfig } = await import("../config/index.js");

      const localPath = result.resultUrl
        ? path.default.join(appConfig.uploadDir, path.default.basename(result.resultUrl))
        : null;

      let analysis: {
        category?: string;
        colors?: string[];
        materials?: string[];
        style?: string;
        styleReason?: string;
      } = {};

      if (localPath && fs.default.existsSync(localPath)) {
        const rawText = fs.default.readFileSync(localPath, "utf-8").trim();
        console.log(`[GPT-4o Analyze] 原始返回: ${rawText.substring(0, 200)}`);

        // 尝试解析 JSON（可能被 markdown 代码块包裹）
        let jsonText = rawText;
        const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          jsonText = jsonMatch[1].trim();
        }
        try {
          analysis = JSON.parse(jsonText);
        } catch {
          console.warn("[GPT-4o Analyze] JSON解析失败，使用原始文本");
          // 尝试用正则提取关键信息
          analysis = {
            category: rawText.match(/品类[：:]\s*(.+)/)?.[1] || "未识别",
            style: rawText.match(/风格[：:]\s*(.+)/)?.[1] || "",
            styleReason: rawText.substring(0, 200),
          };
        }
      }

      console.log(`[GPT-4o Analyze] 分析完成: category=${analysis.category}, style=${analysis.style}`);

      return reply.send(successResponse({
        category: analysis.category || "未识别",
        colors: analysis.colors || [],
        materials: analysis.materials || [],
        style: analysis.style || "",
        styleReason: analysis.styleReason || "",
        recommendedStyles: allStyles,
        analyzedByAI: true,
      }));
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[GPT-4o Analyze] 分析失败: ${errMsg}`);
      // 失败时返回全部风格 + 默认分析结果，不阻断流程
      return reply.send(successResponse({
        category: "未识别",
        colors: [],
        materials: [],
        style: "请手动选择",
        recommendedStyles: allStyles,
        analyzedByAI: false,
        aiError: errMsg,
      }));
    }
  });

  /** POST /api/v1/shouzuo/product-description/generate — AI 生成产品描述（GPT-4o Vision） */
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
  "productName": "产品名称（简洁有力，10字以内，准确反映品类和核心特征）",
  "productDescription": "产品描述（50-100字，描述材质、用途、风格特点、适合人群等）",
  "sellingPoints": ["核心卖点1", "核心卖点2", "核心卖点3", "核心卖点4"]
}`;

      const result = await adapter.generate(prompt, {
        referenceImages: [{ url: productImageUrl, role: "reference_image" }],
      });

      const fs = await import("fs");
      const path = await import("path");
      const { config: appConfig } = await import("../config/index.js");

      const localPath = result.resultUrl
        ? path.default.join(appConfig.uploadDir, path.default.basename(result.resultUrl))
        : null;

      let generated: {
        productName?: string;
        productDescription?: string;
        sellingPoints?: string[];
      } = {};

      if (localPath && fs.default.existsSync(localPath)) {
        const rawText = fs.default.readFileSync(localPath, "utf-8").trim();
        console.log(`[GPT-4o ProductDesc] 原始返回: ${rawText.substring(0, 200)}`);

        let jsonText = rawText;
        const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          jsonText = jsonMatch[1].trim();
        }
        try {
          generated = JSON.parse(jsonText);
        } catch {
          console.warn("[GPT-4o ProductDesc] JSON解析失败");
          // 降级：用原始文本作为描述
          generated = {
            productName: rawText.substring(0, 20).replace(/\n/g, " "),
            productDescription: rawText.substring(0, 200),
            sellingPoints: [],
          };
        }
      }

      const productName = generated.productName || "未识别产品";
      const productDescription = generated.productDescription || "";
      const sellingPoints = generated.sellingPoints?.slice(0, 5) || [];

      console.log(`[GPT-4o ProductDesc] 完成: name=${productName}, points=${sellingPoints.length}`);

      return reply.send(successResponse({
        productName,
        productDescription,
        sellingPoints,
      }));
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[GPT-4o ProductDesc] 生成失败: ${errMsg}`);
      return reply.status(500).send({ message: `产品描述生成失败: ${errMsg}` });
    }
  });

  /** POST /api/v1/shouzuo/style/select — 选择风格 */
  app.post("/style/select", { preHandler: authMiddleware }, async (request, reply) => {
    const body = selectStyleSchema.parse(request.body);
    const userId = request.userId!;

    const style = shouzuoService.selectStyle(body.sessionId, body.styleId, userId);
    return reply.send(successResponse(style));
  });

  /** POST /api/v1/shouzuo/storyboard/generate — 生成故事板 */
  app.post("/storyboard/generate", { preHandler: [authMiddleware, contentModerationMiddleware] }, async (request, reply) => {
    const body = generateStoryboardSchema.parse(request.body);
    const userId = request.userId!;

    const session = shouzuoService.getSession(body.sessionId);
    if (!session || session.user_id !== userId) {
      return reply.status(404).send({ message: "会话不存在" });
    }

    // 积分扣减：每帧 1 次 GPT-Image-2 编辑，模型单价 3 积分
    const STORYBOARD_MODEL_ID = "gpt-image-2";
    const perFrameCost = getModelCost(STORYBOARD_MODEL_ID);
    const totalCost = perFrameCost * body.frameCount;
    chargeCredits(userId, totalCost, body.sessionId,
      `种草视频-故事板生成(${body.frameCount}帧 × ${perFrameCost}积分)`);
    console.log(`[Storyboard] 已扣减 ${totalCost} 积分 (userId=${userId}, session=${body.sessionId})`);

    // 获取产品信息
    const productInfo = session.product_info_json ? JSON.parse(session.product_info_json) : null;
    const productName = productInfo?.name || "产品";
    const productDesc = productInfo?.description || "";
    const sellingPoints = productInfo?.sellingPoints || [];
    const price = productInfo?.price || "";

    // 获取用户上传的产品图（作为 GPT-Image-2 编辑的参考图）
    let uploadedImages: string[] = [];
    try { uploadedImages = JSON.parse(session.uploaded_images); } catch (_) { /* ignore */ }
    const productImageUrl = uploadedImages.length > 0 ? uploadedImages[0] : null;

    if (!productImageUrl) {
      return reply.status(400).send({ message: "未找到产品图片，请先上传" });
    }

    // 查找风格模板
    const style = shouzuoService.getStyleTemplates().find((s) => s.id === body.styleId);
    const stylePrefix = style?.promptPrefix || "";

    // 构建文字覆盖卖点指令
    const sellingPointsStr = sellingPoints.length > 0 
      ? `, with elegant Chinese text overlay of the key selling points: ${sellingPoints.slice(0, 3).join(", ")}` 
      : "";
    const priceStr = price ? `, with subtle price tag text showing "${price}"` : "";

    // 分镜描述模板（融入产品信息 + 风格前缀 + 文字卖点）
    const frameTemplates = [
      {
        desc: `产品全景展示 - ${productName}完整展示，突出整体设计和款式`,
        prompt: `${stylePrefix}, full product shot of ${productName}, complete view showing overall design and style, modern product photography, soft natural lighting${sellingPointsStr}${priceStr}`,
      },
      {
        desc: `材质特写 - ${productName}的面料/材质细节，展示${sellingPoints[0] || "工艺细节"}`,
        prompt: `${stylePrefix}, close-up texture shot of ${productName}, focusing on material quality and craftsmanship details, macro photography style${sellingPoints.length > 0 ? `, with text overlay showing "${sellingPoints[0]}"` : ""}`,
      },
      {
        desc: `使用场景 - ${productName}在实际使用/穿着场景中的效果${productDesc ? `，${productDesc.slice(0, 30)}` : ""}`,
        prompt: `${stylePrefix}, lifestyle shot of ${productName} in real use scenario, showing real-world application and context, warm atmosphere${priceStr}`,
      },
      {
        desc: `创意构图 - ${productName}的独特拍摄角度，营造视觉记忆点`,
        prompt: `${stylePrefix}, creative angle shot of ${productName}, unique perspective for visual impact and memorability, artistic composition${sellingPoints.length > 1 ? `, with text overlay showing "${sellingPoints[1]}"` : ""}`,
      },
      {
        desc: `细节展示 - ${productName}的特色设计细节${sellingPoints[1] ? `，${sellingPoints[1]}` : ""}`,
        prompt: `${stylePrefix}, detail shot highlighting the unique design features of ${productName}, premium product photography${sellingPoints.length > 2 ? `, with text overlay showing "${sellingPoints[2]}"` : ""}`,
      },
      {
        desc: `搭配效果 - ${productName}的搭配展示，呈现整体造型感`,
        prompt: `${stylePrefix}, styling shot showing ${productName} incorporated into a complete look, fashion editorial style${sellingPointsStr}`,
      },
      {
        desc: `品牌/产品故事 - ${productName}的理念传递${price ? `，价格${price}` : ""}`,
        prompt: `${stylePrefix}, brand story shot for ${productName}, conveying the product philosophy and craft heritage, storytelling composition${price ? `, with subtle price tag "${price}"` : ""}${sellingPoints.length > 0 ? `, with text highlighting "${sellingPoints[0]}"` : ""}`,
      },
      {
        desc: `行动号召 - ${productName}的购买引导${sellingPoints.length > 0 ? `，核心卖点：${sellingPoints.join("、")}` : ""}`,
        prompt: `${stylePrefix}, call-to-action promotional shot for ${productName}, e-commerce style with urgency, encouraging purchase${sellingPoints.length > 0 ? `, with bold text overlay showing "${sellingPoints.slice(0, 2).join(" | ")}"` : ""}${priceStr}`,
      },
    ];

    // 构建产品图完整URL（GPT-Image-2 需要公网可访问的URL）
    const { config } = await import("../config/index.js");
    const fullProductImageUrl = productImageUrl.startsWith("http")
      ? productImageUrl
      : `${config.publicBaseUrl}${productImageUrl}`;

    console.log(`[Storyboard] 开始生成 ${body.frameCount} 帧，参考图: ${fullProductImageUrl}`);

    // 并发生成所有帧（最多3个并行），单帧失败自动重试1次
    const frames: shouzuoService.StoryboardFrame[] = [];
    const concurrency = 3;
    const maxRetries = 1; // 每帧失败后重试1次
    
    for (let i = 0; i < body.frameCount; i += concurrency) {
      const batch = [];
      for (let j = i; j < Math.min(i + concurrency, body.frameCount); j++) {
        const template = frameTemplates[j] || frameTemplates[0];
        const frameIndex = j + 1;
        
        const generateFrame = async (): Promise<shouzuoService.StoryboardFrame & { _error?: string }> => {
          let lastError: string | undefined;
          
          for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
              const result = await gptImageService.editImage(fullProductImageUrl, template.prompt);
              
              if (result.success && result.resultUrl) {
                if (attempt > 0) {
                  console.log(`[Storyboard] 帧${frameIndex} 重试成功 (第${attempt + 1}次)`);
                }
                return {
                  index: frameIndex,
                  description: template.desc,
                  prompt: `${body.styleName} style storyboard frame ${frameIndex}: ${template.prompt}`,
                  imageUrl: result.resultUrl,
                };
              }
              
              lastError = result.errorMessage || "未知错误";
              console.warn(`[Storyboard] 帧${frameIndex} 第${attempt + 1}次尝试失败: ${lastError}`);
              
            } catch (err: unknown) {
              lastError = err instanceof Error ? err.message : String(err);
              console.error(`[Storyboard] 帧${frameIndex} 第${attempt + 1}次尝试异常: ${lastError}`);
            }
            
            // 重试前等待 2 秒
            if (attempt < maxRetries) {
              await new Promise((resolve) => setTimeout(resolve, 2000));
            }
          }
          
          // 全部尝试失败，回退到原产品图
          console.error(`[Storyboard] 帧${frameIndex} 全部尝试失败，回退到原图。最后错误: ${lastError}`);
          return {
            index: frameIndex,
            description: template.desc,
            prompt: `${body.styleName} style storyboard frame ${frameIndex}: ${template.prompt}`,
            imageUrl: productImageUrl,
            _error: lastError,
          };
        };
        
        batch.push(generateFrame());
      }
      
      const batchResults = await Promise.all(batch);
      for (const r of batchResults) {
        if (r._error) {
          console.warn(`[Storyboard] 帧${r.index} 生成失败（已回退）: ${r._error}`);
        } else {
          console.log(`[Storyboard] 帧${r.index} 生成完成`);
        }
      }
      frames.push(...batchResults.map(({ _error, ...f }) => f));
    }

    // 按索引排序
    frames.sort((a, b) => a.index - b.index);

    // 保存到数据库
    shouzuoService.saveStoryboard(body.sessionId, userId, frames, body.styleName);

    const failedCount = frames.filter((f) => f.imageUrl === productImageUrl).length;
    console.log(`[Storyboard] 完成: ${frames.length}帧, ${failedCount}帧失败/回退`);

    return reply.send(successResponse({
      frames,
      totalFrames: frames.length,
      style: body.styleName,
      generatedAt: new Date().toISOString(),
      generatedByAI: true,
      failedFrames: failedCount,
    }));
  });

  /** POST /api/v1/shouzuo/storyboard/regenerate — 重新生成故事板 */
  app.post("/storyboard/regenerate", { preHandler: [authMiddleware, contentModerationMiddleware] }, async (request, reply) => {
    const body = regenerateStoryboardSchema.parse(request.body);
    const userId = request.userId!;

    const session = shouzuoService.getSession(body.sessionId);
    if (!session || session.user_id !== userId) {
      return reply.status(404).send({ message: "会话不存在" });
    }

    // 积分扣减
    const STORYBOARD_MODEL_ID = "gpt-image-2";
    const perFrameCost = getModelCost(STORYBOARD_MODEL_ID);
    const totalCost = perFrameCost * body.frameCount;
    chargeCredits(userId, totalCost, body.sessionId,
      `种草视频-重新生成故事板(${body.frameCount}帧 × ${perFrameCost}积分)`);
    console.log(`[Storyboard Regenerate] 已扣减 ${totalCost} 积分 (userId=${userId})`);

    // 获取用户上传的产品图
    let uploadedImages: string[] = [];
    try { uploadedImages = JSON.parse(session.uploaded_images); } catch (_) { /* ignore */ }
    const productImageUrl = uploadedImages.length > 0 ? uploadedImages[0] : null;

    if (!productImageUrl) {
      return reply.status(400).send({ message: "未找到产品图片" });
    }

    // 构建产品图完整URL
    const { config } = await import("../config/index.js");
    const fullProductImageUrl = productImageUrl.startsWith("http")
      ? productImageUrl
      : `${config.publicBaseUrl}${productImageUrl}`;

    const feedbackText = body.feedback ? `, revision notes: ${body.feedback}` : "";

    console.log(`[Storyboard] 重新生成 ${body.frameCount} 帧...`);

    // 并发生成所有帧（最多3个并行），单帧失败自动重试1次
    const frames: shouzuoService.StoryboardFrame[] = [];
    const concurrency = 3;
    const maxRetries = 1;

    for (let i = 0; i < body.frameCount; i += concurrency) {
      const batch = [];
      for (let j = i; j < Math.min(i + concurrency, body.frameCount); j++) {
        const frameIndex = j + 1;
        const prompt = `${body.styleName} style revised storyboard frame ${frameIndex}${feedbackText}`;

        const generateFrame = async (): Promise<shouzuoService.StoryboardFrame & { _error?: string }> => {
          let lastError: string | undefined;

          for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
              const result = await gptImageService.editImage(fullProductImageUrl, prompt);
              if (result.success && result.resultUrl) {
                if (attempt > 0) {
                  console.log(`[Storyboard] 帧${frameIndex} 重试成功 (第${attempt + 1}次)`);
                }
                return {
                  index: frameIndex,
                  description: `分镜 ${frameIndex} (修订版${feedbackText ? `：${body.feedback}` : ""})`,
                  prompt,
                  imageUrl: result.resultUrl,
                };
              }
              lastError = result.errorMessage || "未知错误";
            } catch (err: unknown) {
              lastError = err instanceof Error ? err.message : String(err);
            }
            if (attempt < maxRetries) {
              await new Promise((resolve) => setTimeout(resolve, 2000));
            }
          }
          
          console.warn(`[Storyboard] 帧${frameIndex} 重新生成全部失败，回退到原图。最后错误: ${lastError}`);
          return {
            index: frameIndex,
            description: `分镜 ${frameIndex} (修订版${feedbackText ? `：${body.feedback}` : ""})`,
            prompt,
            imageUrl: productImageUrl,
            _error: lastError,
          };
        };

        batch.push(generateFrame());
      }

      const batchResults = await Promise.all(batch);
      for (const r of batchResults) {
        if (r._error) console.warn(`[Storyboard] 帧${r.index} 重新生成失败（已回退）: ${r._error}`);
      }
      frames.push(...batchResults.map(({ _error, ...f }) => f));
    }

    frames.sort((a, b) => a.index - b.index);

    shouzuoService.saveStoryboard(body.sessionId, userId, frames, body.styleName);

    return reply.send(successResponse({
      frames,
      totalFrames: frames.length,
      style: body.styleName,
      generatedAt: new Date().toISOString(),
      generatedByAI: true,
    }));
  });

  /** POST /api/v1/shouzuo/storyboard/frame/regenerate — 重新生成单个分镜帧 */
  const regenerateSingleFrameSchema = z.object({
    sessionId: z.string().min(1),
    styleId: z.string().min(1),
    styleName: z.string().min(1),
    frameIndex: z.number().int().min(1),
    feedback: z.string().optional(),
  });

  app.post("/storyboard/frame/regenerate", { preHandler: [authMiddleware, contentModerationMiddleware] }, async (request, reply) => {
    const body = regenerateSingleFrameSchema.parse(request.body);
    const userId = request.userId!;

    const session = shouzuoService.getSession(body.sessionId);
    if (!session || session.user_id !== userId) {
      return reply.status(404).send({ message: "会话不存在" });
    }

    // 积分扣减：单帧 = 1 次 GPT-Image-2 编辑
    const SINGLE_FRAME_COST = getModelCost("gpt-image-2");
    chargeCredits(userId, SINGLE_FRAME_COST, body.sessionId,
      `种草视频-重新生成分镜${body.frameIndex}`);

    if (!session.storyboard_json) {
      return reply.status(400).send({ message: "尚未生成故事板" });
    }

    const existingStoryboard = JSON.parse(session.storyboard_json);
    const existingFrames: shouzuoService.StoryboardFrame[] = existingStoryboard.frames;

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

    const originalFrame = existingFrames.find((f: shouzuoService.StoryboardFrame) => f.index === body.frameIndex);
    // 复用原始帧的 prompt 作为基础，追加用户 feedback
    const originalPrompt = originalFrame?.prompt || `${body.styleName} style storyboard frame ${body.frameIndex}`;
    const feedbackText = body.feedback ? ` — revision: ${body.feedback}` : "";
    const prompt = `${originalPrompt}${feedbackText}`;
    const feedbackNote = body.feedback ? `：${body.feedback}` : "";
    const baseDesc = (originalFrame?.description || `分镜 ${body.frameIndex}`).replace(/（修订版.*?）$/, "");
    const description = `${baseDesc}（修订版${feedbackNote}）`;

    console.log(`[Storyboard] 重新生成单帧 ${body.frameIndex}, 原prompt: "${originalPrompt.substring(0, 80)}..."`);

    const result = await gptImageService.editImage(fullProductImageUrl, prompt);

    const fallbackFrame = existingFrames.find((f: shouzuoService.StoryboardFrame) => f.index === body.frameIndex);
    const newFrame: shouzuoService.StoryboardFrame = result.success && result.resultUrl
      ? {
          index: body.frameIndex,
          description,
          prompt,
          imageUrl: result.resultUrl,
        }
      : {
          index: body.frameIndex,
          description,
          prompt,
          imageUrl: fallbackFrame?.imageUrl || productImageUrl,
        };

    const updatedFrames = existingFrames.map((f: shouzuoService.StoryboardFrame) =>
      f.index === body.frameIndex ? newFrame : f
    );

    shouzuoService.saveStoryboard(body.sessionId, userId, updatedFrames, body.styleName);

    return reply.send(successResponse({
      frames: updatedFrames,
      totalFrames: updatedFrames.length,
      style: body.styleName,
      generatedAt: new Date().toISOString(),
      generatedByAI: true,
    }));
  });

  /** GET /api/v1/shouzuo/session/:id/storyboard — 获取故事板 */
  app.get("/session/:id/storyboard", { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.userId!;

    const session = shouzuoService.getSession(id);
    if (!session || session.user_id !== userId) {
      return reply.status(404).send({ message: "会话不存在" });
    }

    if (!session.storyboard_json) {
      return reply.status(404).send({ message: "故事板未生成" });
    }

    return reply.send(successResponse(JSON.parse(session.storyboard_json)));
  });

  // modelId 映射表：前端用户选择的模型ID → DMXAPI 内部模型ID
  const VIDEO_MODEL_MAP: Record<string, string> = {
    "kling-v3": "kling-v3-video-generation",
    "seedance-2-0": "doubao-seedance-2-0-fast-260128",
  };

  /** 从分镜帧构造视频生成 prompt */
  function buildVideoPrompt(styleName: string, frames: Array<{ index: number; description: string; prompt: string }>): string {
    const sorted = [...frames].sort((a, b) => a.index - b.index);
    const sceneDescriptions = sorted.map((f, i) => `镜头${i + 1}：${f.description || f.prompt}`).join(" ");
    const prompt = `${styleName}风格种草视频，${sceneDescriptions}。柔光自然光线，专业产品摄影质感，平滑镜头过渡，突出产品细节和材质，适合社交媒体传播。`;
    // 截断到合理长度（视频模型通常限制 prompt 长度）
    return prompt.length > 800 ? prompt.substring(0, 800) : prompt;
  }

  /** POST /api/v1/shouzuo/video/generate — 生成种草视频（DMXAPI Seedance 2.0 / Kling 3.0） */
  app.post("/video/generate", { preHandler: [authMiddleware, contentModerationMiddleware] }, async (request, reply) => {
    const body = generateVideoSchema.parse(request.body);
    const userId = request.userId!;

    const session = shouzuoService.getSession(body.sessionId);
    if (!session || session.user_id !== userId) {
      return reply.status(404).send({ message: "会话不存在" });
    }

    if (!body.storyboardFrames || body.storyboardFrames.length === 0) {
      return reply.status(400).send({ message: "缺少故事板分镜数据" });
    }

    const dmxModelId = VIDEO_MODEL_MAP[body.modelId];
    if (!dmxModelId) {
      return reply.status(400).send({ message: `不支持的视频模型: ${body.modelId}` });
    }

    const duration = body.duration ?? 10;

    // 积分扣减：根据模型和时长查 ai_models 表
    const videoCost = getModelCost(dmxModelId, duration);
    chargeCredits(userId, videoCost, body.sessionId,
      `种草视频-视频生成(${body.modelId}, ${duration}s)`);
    console.log(`[Shouzuo Video] 已扣减 ${videoCost} 积分 (model=${dmxModelId}, duration=${duration}s)`);

    console.log(`[Shouzuo Video] 开始生成: model=${body.modelId}(${dmxModelId}), session=${body.sessionId}, frames=${body.storyboardFrames.length}, duration=${duration}s`);

    // 先标记为 processing
    shouzuoService.saveVideoResult(body.sessionId, userId, "pending", "processing");

    try {
      // 动态导入 DMXAPI 适配器
      const { DMXAPIVideoAdapter } = await import("../adapters/dmxapi-video.adapter.js");
      const adapter = new DMXAPIVideoAdapter(dmxModelId);

      // 构造视频 prompt
      const prompt = buildVideoPrompt(body.styleName, body.storyboardFrames);

      // 将所有分镜帧合成一张宫格图作为视频视觉参考
      console.log(`[Shouzuo Video] 合成宫格图 (${body.storyboardFrames.length} 帧)...`);
      const gridLocalPath = await createGridImage(
        body.storyboardFrames.map((f) => ({ imageUrl: f.imageUrl, index: f.index })),
        body.sessionId,
      );
      const gridPublicUrl = toPublicUrl(gridLocalPath);
      console.log(`[Shouzuo Video] 宫格图公网URL: ${gridPublicUrl}`);

      // 用宫格图作为首帧参考
      const referenceImages = [{ url: gridPublicUrl, role: "first_frame" as const }];

      console.log(`[Shouzuo Video] prompt=${prompt.substring(0, 120)}..., gridImage=${gridLocalPath}`);

      // 调用真实 API 提交任务
      const result = await adapter.generate(prompt, {
        duration,
        resolution: "720p",
        width: 720,
        height: 1280,  // 竖屏 9:16
        referenceImages,
      });

      const taskId = String(result.taskId);
      console.log(`[Shouzuo Video] 任务已提交: taskId=${taskId}, status=${result.status}`);

      // 保存真实 taskId
      shouzuoService.saveVideoResult(body.sessionId, userId, taskId, result.status);

      return reply.send(successResponse({
        taskId,
        videoUrl: null,
        thumbnailUrl: null,
        status: "processing",
        duration,
        progress: 5,
      }));
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[Shouzuo Video] 生成失败: ${errMsg}`);
      shouzuoService.saveVideoResult(body.sessionId, userId, "failed", "failed", undefined, undefined, undefined, errMsg);
      return reply.status(500).send({ message: `视频生成失败: ${errMsg}` });
    }
  });

  /** GET /api/v1/shouzuo/session/:id/video — 查询视频任务状态（实时查询 DMXAPI） */
  app.get("/session/:id/video", { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = request.userId!;

    const session = shouzuoService.getSession(id);
    if (!session || session.user_id !== userId) {
      return reply.status(404).send({ message: "会话不存在" });
    }

    const taskId = session.video_task_id;
    if (!taskId || taskId === "pending" || taskId === "failed") {
      // 初始状态或失败状态，直接返回缓存
      return reply.send(successResponse({
        taskId: taskId ?? "",
        videoUrl: session.video_url,
        thumbnailUrl: session.video_thumbnail,
        status: session.video_status ?? "pending",
        duration: session.video_duration ?? 10,
        progress: session.video_status === "completed" ? 100 : (session.video_status === "failed" ? 0 : 5),
        errorMessage: session.video_error,
      }));
    }

    // 如果已完成或失败，直接返回缓存（避免重复查询 API）
    if (session.video_status === "completed" || session.video_status === "failed") {
      return reply.send(successResponse({
        taskId,
        videoUrl: session.video_url,
        thumbnailUrl: session.video_thumbnail,
        status: session.video_status,
        duration: session.video_duration ?? 10,
        progress: session.video_status === "completed" ? 100 : 0,
        errorMessage: session.video_error,
      }));
    }

    try {
      // 根据 taskId 推断使用的模型（从 session 中获取 modelId）
      // taskId 格式取决于具体模型，通过尝试两种模型查询
      const { DMXAPIVideoAdapter } = await import("../adapters/dmxapi-video.adapter.js");

      // 尝试用 Kling 适配器查询
      let statusResult;
      try {
        const adapter = new DMXAPIVideoAdapter("kling-v3-video-generation");
        statusResult = await adapter.checkStatus(taskId);
        if (statusResult.status === "processing" && statusResult.progress < 10) {
          // 可能不是 Kling 任务，尝试 Seedance
          const seedanceAdapter = new DMXAPIVideoAdapter("doubao-seedance-2-0-fast-260128");
          statusResult = await seedanceAdapter.checkStatus(taskId);
        }
      } catch {
        // Kling 查询失败，尝试 Seedance
        const seedanceAdapter = new DMXAPIVideoAdapter("doubao-seedance-2-0-fast-260128");
        statusResult = await seedanceAdapter.checkStatus(taskId);
      }

      console.log(`[Shouzuo Video Poll] taskId=${taskId}, status=${statusResult.status}, progress=${statusResult.progress}`);

      // 更新 session 状态
      if (statusResult.status === "completed" && statusResult.resultUrl) {
        shouzuoService.saveVideoResult(
          id, userId, taskId, "completed",
          statusResult.resultUrl,
          statusResult.resultUrl, // thumbnail 暂时用 videoUrl
          session.video_duration ?? 10,
        );
      } else if (statusResult.status === "failed") {
        shouzuoService.saveVideoResult(
          id, userId, taskId, "failed",
          undefined, undefined, undefined,
          statusResult.errorMessage ?? "视频生成失败",
        );
      } else {
        // 仍在处理中，直接返回查询结果（不修改 DB，进度不持久化）
      }

      return reply.send(successResponse({
        taskId,
        videoUrl: statusResult.resultUrl ?? session.video_url,
        thumbnailUrl: statusResult.resultUrl ?? session.video_thumbnail,
        status: statusResult.status,
        duration: session.video_duration ?? 10,
        progress: statusResult.progress ?? 50,
        errorMessage: statusResult.errorMessage,
      }));
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[Shouzuo Video Poll] 查询失败: ${errMsg}`);
      // 查询失败时返回缓存状态
      return reply.send(successResponse({
        taskId,
        videoUrl: session.video_url,
        thumbnailUrl: session.video_thumbnail,
        status: session.video_status ?? "processing",
        duration: session.video_duration ?? 10,
        progress: 50,
      }));
    }
  });

  /** POST /api/v1/shouzuo/copywriting/generate — 生成文案（DeepSeek V4） */
  app.post("/copywriting/generate", { preHandler: [authMiddleware, contentModerationMiddleware] }, async (request, reply) => {
    const body = generateCopywritingSchema.parse(request.body);
    const userId = request.userId!;

    const session = shouzuoService.getSession(body.sessionId);
    if (!session || session.user_id !== userId) {
      return reply.status(404).send({ message: "会话不存在" });
    }

    // 积分扣减：DeepSeek V4 文案生成
    const COPYWRITING_COST = getModelCost("deepseek-chat");
    chargeCredits(userId, COPYWRITING_COST, body.sessionId,
      `种草视频-AI文案生成`);
    console.log(`[Copywriting] 已扣减 ${COPYWRITING_COST} 积分 (userId=${userId})`);

    try {
      // 获取产品信息丰富prompt
      const productInfo = session.product_info_json ? JSON.parse(session.product_info_json) : null;
      const productName = productInfo?.name || "手工作品";
      const productDesc = productInfo?.description || "";
      const sellingPoints = productInfo?.sellingPoints || [];
      const price = productInfo?.price || "";
      const targetAudience = productInfo?.targetAudience || "";

      const sellingPointsText = sellingPoints.length > 0
        ? `核心卖点：${sellingPoints.join("、")}`
        : "";
      const priceText = price ? `价格：${price}` : "";
      const audienceText = targetAudience ? `目标人群：${targetAudience}` : "";

      const contextParts = [
        `产品名称：${productName}`,
        productDesc ? `产品描述：${productDesc}` : "",
        sellingPointsText,
        priceText,
        audienceText,
        `风格：${body.styleName}`,
        body.productDescription ? `用户补充描述：${body.productDescription}` : "",
      ].filter(Boolean).join("\n");

      const prompt = `你是一个专业的社交媒体种草文案写手。请根据以下产品信息，生成3条种草文案。

${contextParts}

要求：
1. 第1条：小红书风格，emoji丰富，口语化，适合年轻女性，突出手工的温度和独特性
2. 第2条：小红书干货风格，分享制作/使用心得，有信息增量，适合收藏
3. 第3条：抖音快节奏风格，简短有力，用符号和emoji制造视觉冲击，适合短视频配文

每条文案必须包含：标题(title)、正文(body)、话题标签(hashtags数组，5-8个)、平台(platform：xiaohongshu或douyin)。

以纯JSON数组格式返回（不要markdown代码块，只返回JSON数组）：
[
  {
    "index": 1,
    "title": "...",
    "body": "...",
    "hashtags": ["标签1", "标签2", ...],
    "platform": "xiaohongshu"
  },
  ...
]`;

      // 调用 DeepSeek V4
      const { DMXAPITextAdapter } = await import("../adapters/dmxapi-text.adapter.js");
      const adapter = new DMXAPITextAdapter("deepseek-chat");
      const result = await adapter.generate(prompt);

      // 读取生成的文本文件
      const fs = await import("fs");
      const path = await import("path");
      const { config: appConfig } = await import("../config/index.js");

      const localPath = result.resultUrl
        ? path.default.join(appConfig.uploadDir, path.default.basename(result.resultUrl))
        : null;

      let items: shouzuoService.CopywritingItem[] = [];

      if (localPath && fs.default.existsSync(localPath)) {
        const rawText = fs.default.readFileSync(localPath, "utf-8").trim();
        console.log(`[DeepSeek Copywriting] 原始返回长度: ${rawText.length}`);

        // 尝试解析 JSON
        let jsonText = rawText;
        const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          jsonText = jsonMatch[1].trim();
        }

        try {
          const parsed = JSON.parse(jsonText);
          if (Array.isArray(parsed)) {
            items = parsed.map((item: Record<string, unknown>, idx: number) => ({
              index: (item.index as number) || idx + 1,
              title: String(item.title || "种草好物"),
              body: String(item.body || "快来试试吧~"),
              hashtags: Array.isArray(item.hashtags) ? item.hashtags.map(String) : ["手作", "好物推荐"],
              platform: String(item.platform || "xiaohongshu"),
              selected: false,
            }));
          }
        } catch {
          console.warn("[DeepSeek Copywriting] JSON解析失败，使用原始文本拆分");
          // 降级：将文本按双换行拆分为3条
          const segments = rawText.split(/\n\n\n+/).filter((s) => s.trim().length > 10);
          items = segments.slice(0, 3).map((seg, idx) => {
            const lines = seg.trim().split("\n");
            return {
              index: idx + 1,
              title: lines[0]?.replace(/^#+\s*/, "").trim() || "好物分享",
              body: lines.slice(1).join("\n").trim() || seg.trim(),
              hashtags: ["手作", "好物推荐", "种草"],
              platform: idx === 2 ? "douyin" : "xiaohongshu",
              selected: false,
            };
          });
        }
      }

      if (items.length === 0) {
        throw new Error("DeepSeek 未返回有效文案");
      }

      console.log(`[DeepSeek Copywriting] 生成${items.length}条文案`);

      shouzuoService.saveCopywriting(body.sessionId, userId, items);
      return reply.send(successResponse(items));
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[DeepSeek Copywriting] 生成失败: ${errMsg}`);
      return reply.status(500).send({ message: `文案生成失败: ${errMsg}` });
    }
  });

  /** GET /api/v1/shouzuo/sessions — 获取历史会话列表 */
  app.get("/sessions", { preHandler: authMiddleware }, async (request, reply) => {
    const userId = request.userId!;
    const query = request.query as { page?: string; limit?: string };
    const page = parseInt(query.page || "1", 10);
    const limit = parseInt(query.limit || "10", 10);

    const result = shouzuoService.listSessions(userId, page, limit);

    // 转换为前端格式
    const items = result.items.map((s) => ({
      sessionId: s.id,
      currentStep: s.current_step,
      uploadedImages: JSON.parse(s.uploaded_images),
      selectedStyle: s.style_id
        ? shouzuoService.getStyleTemplates().find((t) => t.id === s.style_id) ?? null
        : null,
      storyboard: s.storyboard_json ? JSON.parse(s.storyboard_json) : null,
      videoResult: s.video_url
        ? { taskId: s.video_task_id, videoUrl: s.video_url, status: s.video_status, duration: s.video_duration }
        : null,
      copywritingItems: s.copywriting_json ? JSON.parse(s.copywriting_json) : [],
      createdAt: s.created_at,
    }));

    return reply.send(paginatedResponse(items, result.total, page, limit));
  });
}
