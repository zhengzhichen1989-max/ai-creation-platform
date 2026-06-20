// ===========================================================
// 服装带货视频生成器 - 会话管理、故事板、视频生成、文案生成
// 版本：2.0.0（6步工作流）
// ===========================================================

import { getDb, saveDatabase } from "../db/index.js";
import { v4 as uuidv4 } from "uuid";

// --- 类型定义 ---

export interface VideoParams {
  model: "seedance-2.0" | "kling-v3";
  duration: number;       // 5-15秒
  resolution: "720p" | "1080p";
  storyboard_count: number; // 1-6
  kling_duration_splits?: number[]; // 仅 Kling 模式，每段时长分配
}

export interface ClothingInfo {
  clothing_type: string;
  material: string;
  season: string[];
  main_color: string;
  style_tags: string[];
  edited?: boolean; // 用户是否编辑过
}

export interface StyleRecommendation {
  style_id: string;
  confidence: number; // 0-1
  reason: string;
}

export interface AiRecognitionResult {
  clothing_type: string;
  material: string;
  season: string[];
  main_color: string;
  style_tags: string[];
  recommendations: StyleRecommendation[];
  raw_json?: string; // GPT-4o 原始返回
}

export interface StoryboardFrame {
  seq: number;
  name: string;
  prompt: string;      // 英文提示词（传入模型）
  prompt_cn: string;  // 中文说明（仅展示）
  imageUrl?: string;
  status: "pending" | "generating" | "completed" | "failed";
  retry_count: number;
}

export interface VideoSegment {
  seq: number;
  task_id: string;
  video_url?: string;
  status: "pending" | "processing" | "completed" | "failed";
  duration: number; // 该段时长（秒）
  error?: string;
}

export interface CopywritingResult {
  title: string;
  content: string;
  tags: string[];
}

export interface ShouzuoSessionRow {
  id: string;
  user_id: number;
  status: string;
  current_step: string;       // "upload"|"ai_recognize"|"video_params"|"storyboard"|"video"|"copywriting"
  uploaded_images: string;      // JSON string[]
  ai_recognition_json: string | null;  // JSON - AiRecognitionResult
  user_edited_clothing_json: string | null; // JSON - ClothingInfo (用户编辑后)
  selected_style_id: string | null;
  video_params_json: string | null;  // JSON - VideoParams
  storyboard_json: string | null;  // JSON - StoryboardFrame[]
  video_status: string | null;      // "pending"|"processing"|"completed"|"failed"
  video_url: string | null;
  video_segments_json: string | null; // JSON - VideoSegment[]
  video_error: string | null;
  copywriting_json: string | null;  // JSON - CopywritingResult
  pre_deducted_credits: number;  // Step 3 预扣积分
  created_at: string;
  updated_at: string;
}

// --- 新风格模板（5款，来自规格文档） ---

export interface StyleStoryboardTemplate {
  seq: number;
  name: string;
  purpose: string;
  prompt: string;
  prompt_cn: string;
  negative_prompt?: string;  // 反向提示词，抑制"复制原图"倾向
}

export interface StyleVideoPrompts {
  seedance: string;
  seedance_cn: string;
  kling_per_frame: { seq: number; prompt: string; prompt_cn: string }[];
}

export interface StyleTemplate {
  style_id: string;
  name: string;
  emoji: string;
  tagline: string;
  description: string;
  applicable_clothing_types: string[];
  applicable_materials: string[];
  applicable_seasons: string[];
  applicable_colors: string[];
  recommended_model: "seedance-2.0" | "kling-v3";
  fallback_model: "seedance-2.0" | "kling-v3";
  default_resolution: "720p" | "1080p";
  default_storyboard_count: number;
  cost_hint: string;
  storyboards: StyleStoryboardTemplate[];
  video_prompts: StyleVideoPrompts;
  copywriting_prompt: string;
}

const STYLE_TEMPLATES: StyleTemplate[] = [
  {
    style_id: "japanese-mori",
    name: "日系森系",
    emoji: "🌿",
    tagline: "自然生活感，治愈系穿搭",
    description: "柔和自然光、低饱和暖调、户外草地或木质场景，适合棉麻/钩针/文艺风服装。镜头分配：1=产品特写(不露脸) | 2=半身侧面(不露脸) | 3=氛围侧影(轻微露脸·正身侧脸) | 4=半身背面(不露脸)",
    applicable_clothing_types: ["连衣裙", "开衫", "披肩", "围巾", "上装", "半裙", "手作编织"],
    applicable_materials: ["棉麻", "钩针", "羊毛", "棉", "亚麻", "蕾丝"],
    applicable_seasons: ["春", "秋"],
    applicable_colors: ["米白", "燕麦色", "浅绿", "卡其", "奶茶色", "浅灰"],
    recommended_model: "seedance-2.0",
    fallback_model: "kling-v3",
    default_resolution: "720p",
    default_storyboard_count: 4,
    cost_hint: "分镜图12积分 + 视频约45-85积分（视时长分辨率）",
    storyboards: [
      {
        seq: 1, name: "产品特写", purpose: "开场聚焦服装本体，阳光洒落展示材质质感",
        prompt: "Based on the product image, generate a pure product showcase with no person in frame. The garment laid flat on a weathered wooden bench or gently draped over a natural wood hanger against a sunlit garden backdrop, morning sunlight filtering through leaves creating soft dappled shadows across the fabric surface. Extreme detail on texture — visible weave, stitching, and material grain. Shallow depth of field, blurred green foliage background, warm off-white and gentle green low-saturation color palette, peaceful and healing atmosphere.",
        prompt_cn: "基于产品图，生成纯产品展示图，画面中无人物。服装平铺在旧木长椅上或轻搭在自然木衣架上，背景是阳光花园，清晨阳光透过树叶在面料表面形成柔和斑驳光影。极致展示纹理细节。浅景深，模糊绿色植物背景，暖米白+柔和绿低饱和色调，宁静治愈氛围。"
      },
      {
        seq: 2, name: "半身侧面", purpose: "侧面半身展示服装版型和上身效果，上衣占画面主体，面部朝向侧面不露脸",
        prompt: "Based on the product image, generate a half-body side-profile outfit shot from waist up. The person in three-quarter side view, body turned so the face is directed away from camera and not visible, wearing the garment with relaxed natural posture. The garment — especially the upper body portion — occupies about 70% of the frame, its silhouette, fabric drape, and fit clearly visible in soft morning side-light. Shallow depth of field, low-saturation warm tones, the clothing is the clear visual focus.",
        prompt_cn: "基于产品图，生成腰部以上半身侧面穿搭图。人物呈四分之三侧面，面部朝离镜头方向不可见，穿着该服装姿态松弛自然。服装——尤其是上身部分——占画面约70%，轮廓、面料垂感和版型清晰可见。浅景深，低饱和暖色调，服装是明确的视觉焦点。"
      },
      {
        seq: 3, name: "氛围侧影", purpose: "唯一轻微露脸镜头，正身侧脸能看清服装正面版型，同时建立情感连接",
        prompt: "Based on the product image, generate an atmospheric portrait with body front-facing but face in side profile, shot from waist up. The person's body and the full front of the garment clearly visible to camera, but the face is turned to the side so facial features are only partially visible — loose wispy strands of hair gently drifting across the cheek, naturally veiling most facial features so the eyes and mouth are not clearly identifiable. Expression serene and contemplative. The garment occupies about 60% of the frame and remains the visual focus. Soft diffused natural light, shallow depth of field, warm muted tones. This is the only shot where partial face is visible — body faces camera but face never does.",
        prompt_cn: "基于产品图，生成身体正面但脸侧面的氛围肖像图，腰部以上。人物身体和服装正面完整朝镜头可见，但脸转向侧面使面部特征仅部分可见——碎发轻拂面颊，自然遮挡大部分面部特征。表情宁静沉思。服装占画面约60%并保持视觉焦点。柔和自然光，浅景深，暖色调低饱和。这是唯一面部部分可见的镜头——身体朝镜头但脸绝不正对。"
      },
      {
        seq: 4, name: "半身背面", purpose: "半身背面展示服装轮廓和背部细节，唯一背面镜头，服装占画面主体",
        prompt: "Based on the product image, generate a half-body back-view shot from waist up. The person facing away from camera, the garment's back silhouette, shoulder line, and fabric drape clearly visible and occupying about 70% of the frame. Hair falling naturally down the back, strands swaying gently. Soft morning light falling on the shoulders and upper back, shallow depth of field, low-saturation warm tones. The clothing is the clear visual focus — not a distant tiny figure, a close composed shot.",
        prompt_cn: "基于产品图，生成腰部以上半身背面图。人物背对镜头，服装的背面轮廓、肩线和面料垂感清晰可见，占画面约70%。头发自然垂于背后，发丝轻飘。清晨柔和光线落在肩膀和上背部，浅景深，低饱和暖色调。服装是明确的视觉焦点——不是远处的渺小身影，而是近距离构图。"
      },
    ],
    video_prompts: {
      seedance: "Japanese mori-style fashion showcase, natural light, outdoor setting. Shot 1: pure product focus no face, morning dappled light, extreme texture detail. Shot 2: half-body side-profile from waist up, face directed away from camera, garment occupying most of frame. Shot 3: atmospheric portrait with body front-facing but face in side profile, hair gently veiling partially visible face for emotional connection, never front-facing, garment remains visual focus. Shot 4: half-body back-view from waist up, shoulder line and back silhouette clearly visible. Slow push-and-pull camera, low-saturation warm tones, healing atmosphere.",
      seedance_cn: "日系森系服装展示。第1镜：纯产品聚焦不露脸，晨光斑驳 | 第2镜：半身侧面腰部以上，面部朝离镜头方向，服装占画面主体 | 第3镜：正身侧脸氛围肖像，发丝轻遮部分可见脸建立情感连接，绝不正对镜头，服装保持视觉焦点 | 第4镜：半身背面腰部以上，肩线和背部轮廓清晰。镜头缓慢推拉，低饱和暖色调，治愈氛围。",
      kling_per_frame: [
        { seq: 1, prompt: "Camera slowly pushes in on the garment product, soft dappled light, no person in frame", prompt_cn: "镜头缓慢推近服装产品，柔和斑驳光，画面无人物" },
        { seq: 2, prompt: "Camera slowly pans around the half-body side-profile figure, waist-up framing, garment occupying most of frame", prompt_cn: "镜头缓慢环绕半身侧面人物，腰部以上构图，服装占画面主体" },
        { seq: 3, prompt: "Camera slowly pushes to half-body, body front-facing but face in side profile, hair gently drifting across partially visible face", prompt_cn: "镜头缓慢推近半身，身体正面但脸侧面，发丝轻拂过部分可见的脸" },
        { seq: 4, prompt: "Camera slightly pulls back from half-body back-view, shoulder line and back silhouette clearly visible", prompt_cn: "镜头从半身背面缓慢微拉，肩线和背部轮廓清晰可见" },
      ],
    },
    copywriting_prompt: "你是一位小红书日系森系风格的博主，请为以下服装撰写一篇种草笔记。要求：标题含emoji、正文口语化亲切温柔、突出面料质感和自然生活感、多用\"治愈\"\"温柔\"\"氛围感\"等词汇、结尾加话题标签。服装信息：{clothing_info}",
  },
  {
    style_id: "street-urban",
    name: "潮流街头",
    emoji: "🔥",
    tagline: "节奏卡点，态度穿搭",
    description: "硬光高对比、城市水泥/霓虹场景、快节奏剪辑感，适合潮牌/运动装/年轻化服饰。镜头分配：1=产品特写(不露脸) | 2=半身侧面(不露脸) | 3=半身背面(不露脸) | 4=氛围侧影(轻微露脸·正身侧脸) | 5=设计细节(不露脸) | 6=半身定格(不露脸)",
    applicable_clothing_types: ["卫衣", "夹克", "T恤", "短裤", "运动套装", "潮牌联名"],
    applicable_materials: ["牛仔", "尼龙", "涤纶", "棉", "科技面料"],
    applicable_seasons: ["春", "夏", "秋"],
    applicable_colors: ["黑色", "白色", "荧光色", "撞色", "迷彩"],
    recommended_model: "kling-v3",
    fallback_model: "seedance-2.0",
    default_resolution: "1080p",
    default_storyboard_count: 6,
    cost_hint: "分镜图18积分 + 视频约90-210积分（6段拼接，视时长分辨率）",
    storyboards: [
      {
        seq: 1, name: "产品特写", purpose: "开场聚焦服装本体，硬光高对比展示设计细节",
        prompt: "Based on the product image, generate a pure product showcase with no person in frame. The garment hanging on a metal clothing rack or laid on a concrete surface under hard directional side-lighting, strong shadows and high-contrast lighting revealing prints, logos, stitching and fabric texture. Urban concrete wall or dark gradient background. Macro detail visible, saturated colors, edgy street atmosphere.",
        prompt_cn: "基于产品图，生成纯产品展示图，画面中无人物。服装挂在金属衣架上或平铺在水泥地面上，硬光定向侧光照射，强烈阴影和高对比光影展示印花、logo、缝线和面料纹理。城市水泥墙或暗色渐变背景。微距细节可见，色彩饱和，粗犷街头氛围。"
      },
      {
        seq: 2, name: "半身侧面", purpose: "侧面半身展示服装版型和上身效果，上衣占画面主体，面部朝向侧面不露脸",
        prompt: "Based on the product image, generate a half-body street-style shot in side profile from waist up. The person standing against a graffiti wall, body turned so face is directed away from camera and not visible, wearing the garment with confident urban attitude. The garment occupies about 70% of the frame, its silhouette, prints and fabric texture clearly visible. Hard side-lighting, colorful graffiti or neon reflections, high-contrast, saturated colors.",
        prompt_cn: "基于产品图，生成腰部以上半身侧面街头穿搭图。人物靠在涂鸦墙边，身体转向使面部朝离镜头方向不可见，穿着该服装姿态自信街头感。服装占画面约70%，轮廓、印花和面料纹理清晰可见。硬光侧光，周围有彩色涂鸦或霓虹反射，高对比，色彩饱和。"
      },
      {
        seq: 3, name: "半身背面", purpose: "半身背面展示服装轮廓和背部设计，唯一背面镜头，服装占画面主体",
        prompt: "Based on the product image, generate a half-body back-view shot from waist up. The person facing away from camera, wearing the garment, the back silhouette, shoulder line, and any back design details clearly visible and occupying about 70% of the frame. Hard lighting from the side creating rim light on the garment edges, urban concrete or dark background. The clothing is the clear visual focus.",
        prompt_cn: "基于产品图，生成腰部以上半身背面穿搭图。人物背对镜头，穿着该服装，背面轮廓、肩线和任何背部设计细节清晰可见，占画面约70%。硬光从侧面打入在服装边缘形成轮廓光，城市水泥或暗色背景。服装是明确的视觉焦点。"
      },
      {
        seq: 4, name: "氛围侧影", purpose: "唯一轻微露脸镜头，正身侧脸能看清服装正面版型，同时建立情感连接",
        prompt: "Based on the product image, generate an atmospheric urban portrait with body front-facing but face in side profile, shot from waist up. The person's body and the full front of the garment clearly visible to camera, but the face is turned to the side so facial features are only partially visible — messy hair blown across the face by urban wind, strands partially covering the eyes and cheeks so they are not clearly identifiable. Raw edgy attitude. The garment occupies about 60% of the frame and remains the visual focus. This is the only shot where partial face is visible — body faces camera but face never does.",
        prompt_cn: "基于产品图，生成身体正面但脸侧面的氛围感城市肖像图，腰部以上。人物身体和服装正面完整朝镜头可见，但脸转向侧面使面部特征仅部分可见——凌乱发丝被城市的风吹过面部，碎发半遮双眼和面颊。粗犷街头态度。服装占画面约60%并保持视觉焦点。这是唯一面部部分可见的镜头——身体朝镜头但脸绝不正对。"
      },
      {
        seq: 5, name: "设计细节", purpose: "快速闪切展示设计细节，不露脸",
        prompt: "Based on the product image, generate a close-up detail shot of the garment's design highlights. Focus on prints, logos, zippers, tags, or unique design elements, artificial studio lighting with metallic reflections, dark background to isolate the subject. No person in frame — pure product and detail focus. Macro perspective, high sharpness, saturated colors.",
        prompt_cn: "基于产品图，生成服装设计亮点的近景细节图。聚焦印花、logo、拉链、标签或独特设计元素，人工打光金属质感反光，暗色背景突出主体。画面中无人物——纯粹产品和细节聚焦。微距视角，锐度高，色彩饱和。"
      },
      {
        seq: 6, name: "半身定格", purpose: "结尾定格，半身侧面展示，服装占画面主体，留出版式空间",
        prompt: "Based on the product image, generate a freeze-frame ending shot from waist up. Half-body side-profile against a simplified urban background with spotlight effect, person perfectly still, garment fully displayed occupying about 70% of the frame. Generous negative space on one side reserved for text overlay, composed like a magazine cover freeze-frame. High-contrast lighting, saturated tones.",
        prompt_cn: "基于产品图，生成腰部以上定格结尾图。半身侧面轮廓，简化城市背景加聚光灯效果，人物完全静止，服装完整展示占画面约70%，色调统一。一侧大量留白空间用于加文字，构图如杂志封面定格。高对比光影，饱和色调。"
      },
    ],
    video_prompts: {
      seedance: "Street-style fashion showcase. Shot 1: pure product focus no face, hard directional lighting, high-contrast. Shot 2: half-body side-profile from waist up, face away from camera, garment occupying most of frame. Shot 3: half-body back-view from waist up, only back-view shot, rim light on garment edges. Shot 4: atmospheric portrait with body front-facing but face in side profile, hair blown across partially visible face for emotional connection, never front-facing, garment remains visual focus. Shot 5: detail close-up, no face. Shot 6: freeze-frame half-body side silhouette, text overlay space. Fast pace, beat-driven rhythm, confident attitude.",
      seedance_cn: "潮流街头服装展示。第1镜：纯产品聚焦不露脸，硬光高对比 | 第2镜：半身侧面腰部以上，面部朝离镜头方向，服装占画面主体 | 第3镜：半身背面腰部以上，唯一背面镜头，服装边缘轮廓光 | 第4镜：正身侧脸氛围肖像，发丝吹过部分可见的脸建立情感连接，绝不正对镜头，服装保持视觉焦点 | 第5镜：细节特写，不露脸 | 第6镜：半身侧面定格，留文案空间。快节奏，卡点律动，自信态度。",
      kling_per_frame: [
        { seq: 1, prompt: "Fast push-in to product hanging or laid flat, hard-cut style, high contrast, no person", prompt_cn: "快速推近到悬挂或平铺的产品，硬切风格，高对比，无人物" },
        { seq: 2, prompt: "Camera pans to half-body side-profile, waist-up framing, garment occupying most of frame, hard side-lighting", prompt_cn: "镜头横移到半身侧面，腰部以上构图，服装占画面主体，硬光侧光" },
        { seq: 3, prompt: "Camera on half-body back-view, waist-up framing, rim light on garment edges, shoulder line clearly visible", prompt_cn: "镜头对半身背面，腰部以上构图，服装边缘轮廓光，肩线清晰可见" },
        { seq: 4, prompt: "Camera pushes to half-body, body front-facing but face in side profile, hair blown across partially visible face", prompt_cn: "镜头推近到半身，身体正面但脸侧面，风吹发丝过部分可见的脸" },
        { seq: 5, prompt: "Quick flash-cut to design detail close-up, slight camera shake for energy, no face", prompt_cn: "快速闪切到设计细节特写，镜头微晃增加动感，不露脸" },
        { seq: 6, prompt: "Camera freezes on half-body side-profile, waist-up framing, leaving space for text overlay", prompt_cn: "镜头定格在半身侧面，腰部以上构图，留出版式空间" },
      ],
    },
    copywriting_prompt: "你是一位小红书潮流穿搭博主，请为以下服装撰写一篇种草笔记。要求：标题含emoji、正文语气酷飒自信、突出设计态度和穿搭气场、多用\"绝了\"\"炸街\"\"氛围感拉满\"等词汇、结尾加话题标签。服装信息：{clothing_info}",
  },
  {
    style_id: "luxury-cinematic",
    name: "高级质感",
    emoji: "✨",
    tagline: "静谧大片，质感至上",
    description: "电影感单一光源、极简背景、浅景深留白，适合高端女装/礼服/设计师品牌/高级面料。镜头分配：1=产品特写(不露脸) | 2=氛围侧影(轻微露脸·正身侧脸) | 3=细节光影(不露脸)",
    applicable_clothing_types: ["礼服", "连衣裙", "西装外套", "风衣", "设计师款"],
    applicable_materials: ["真丝", "羊绒", "羊毛", "蕾丝", "缎面", "天鹅绒"],
    applicable_seasons: ["秋", "冬"],
    applicable_colors: ["黑", "白", "驼色", "酒红", "深蓝", "香槟金"],
    recommended_model: "seedance-2.0",
    fallback_model: "kling-v3",
    default_resolution: "1080p",
    default_storyboard_count: 3,
    cost_hint: "分镜图9积分 + 视频约70-130积分（视时长分辨率）",
    storyboards: [
      {
        seq: 1, name: "产品特写", purpose: "开场极简聚焦服装本体，单一强光源展示面料高级质感",
        prompt: "Based on the product image, generate a pure product showcase with no person in frame. The garment elegantly displayed on a minimalist solid background — dark gray, off-white, or pure black — a single strong directional light from the side or behind creating a distinct rim light on the fabric edges. Extreme detail on material sheen, drape, and texture. High-end editorial product photography, shallow depth of field, monochromatic background, cinematic lighting.",
        prompt_cn: "基于产品图，生成纯产品展示图，画面中无人物。服装在极简纯色背景上优雅展示，单一强定向光在面料边缘形成明显轮廓光。极致展示材质光泽、垂感和纹理。高端杂志产品摄影感，浅景深，单色背景，电影感打光。"
      },
      {
        seq: 2, name: "氛围侧影", purpose: "唯一轻微露脸镜头，正身侧脸能看清服装正面版型，同时建立情感连接",
        prompt: "Based on the product image, generate an atmospheric luxury portrait with body front-facing but face in side profile, shot from waist up. The person's body and the full front of the garment clearly visible to camera, but the face is turned to the side so facial features are only partially visible — elegant loose hair swept by a gentle wind across one side of the face, delicately veiling the eyes and facial features. Single soft directional light — Rembrandt or butterfly lighting — creating sophisticated shadows. Garment occupies about 60% of frame, shallow depth of field, high-end fashion editorial style, low-saturation monochromatic gradient tones. This is the only shot where partial face is visible — body faces camera but face never does.",
        prompt_cn: "基于产品图，生成身体正面但脸侧面的高级氛围肖像图，腰部以上。人物身体和服装正面完整朝镜头可见，但脸转向侧面使面部特征仅部分可见——优雅散发被柔风拂过脸的一侧，精致地轻遮眼睛和面部特征。单一柔和定向光源形成高级阴影。服装在画面中约占60%，极浅景深，高端时尚杂志风格。这是唯一面部部分可见的镜头——身体朝镜头但脸绝不正对。"
      },
      {
        seq: 3, name: "细节光影", purpose: "结尾细节展示，面料在特殊光线下的质感，不露脸",
        prompt: "Based on the product image, generate a close-up of the fabric under dramatic lighting with no person in frame. Strong side-light or top-light reveals the texture of silk, wool, or lace, creating smooth gradients of highlight and shadow across the fabric surface. Dark or pure black background to emphasize the fabric's natural sheen and weave detail. Macro or close-up shot, precise focus, cinematic lighting, quiet and powerful ending.",
        prompt_cn: "基于产品图，生成面料在特殊光线下的细节特写图，画面中无人物。强侧光或顶光照射面料，展示丝绸、羊毛或蕾丝等纹理，光影在服装表面形成渐变。暗色或纯黑背景突出面料本身的光泽感和编织细节。微距或近景，焦点精确，电影感打光，安静有力量感的结尾。"
      },
    ],
    video_prompts: {
      seedance: "Luxury cinematic fashion showcase, minimalist background. Shot 1: pure product focus no face, single strong directional light, extreme fabric detail. Shot 2: atmospheric portrait with body front-facing but face in side profile, hair gently sweeping across partially visible face for emotional connection but never front-facing, Rembrandt lighting, garment occupying most of frame, extremely slow camera. Shot 3: fabric detail close-up under dramatic lighting, no face, cinematic ending. Shallow depth of field, low-saturation monochromatic gradient tones, high-end editorial style.",
      seedance_cn: "高级质感服装展示，极简背景。第1镜：纯产品聚焦不露脸，单一强定向光，极致面料细节 | 第2镜：正身侧脸氛围肖像，优雅发丝轻拂过部分可见的脸建立情感连接但绝不正对镜头，伦勃朗光，服装占画面主体，镜头极缓 | 第3镜：面料细节近景特殊光线下质感，不露脸，电影感结尾。浅景深，低饱和同色系渐变色调，高端杂志风格。",
      kling_per_frame: [
        { seq: 1, prompt: "Camera extremely slowly pushes in on the garment product, single strong directional light, fabric sheen and texture in extreme detail, no person", prompt_cn: "镜头极缓慢推近服装产品，单一强定向光，面料光泽和纹理极致细节，无人物" },
        { seq: 2, prompt: "Camera slowly pushes to half-body, body front-facing but face turned to side, hair drifting across partially visible face, serene expression, garment fully visible", prompt_cn: "镜头缓慢推近到半身，身体正面但脸转向侧面，发丝飘过部分可见的脸，宁静表情，服装完整可见" },
        { seq: 3, prompt: "Camera slowly pans across the fabric light-and-shadow detail, maintaining macro focus, cinematic ending", prompt_cn: "镜头缓慢横移扫过面料光影细节，保持微距焦点，电影感结尾" },
      ],
    },
    copywriting_prompt: "你是一位小红书高级感穿搭博主，请为以下服装撰写一篇种草笔记。要求：标题含emoji、正文语言克制有品位、突出面料质感和剪裁工艺、多用\"质感\"\"高级\"\"一衣多穿\"等词汇、避免过度感叹、结尾加话题标签。服装信息：{clothing_info}",
  },
  {
    style_id: "office-commute",
    name: "职场通勤",
    emoji: "💼",
    tagline: "实用种草，日常得体",
    description: "明亮均匀光、办公室/咖啡厅场景、信息展示优先，适合职业装/衬衫/西装/日常通勤服饰。镜头分配：1=产品特写(不露脸) | 2=半身正面(不露脸·正面朝镜头) | 3=氛围侧影(轻微露脸·正身侧脸) | 4=细节实用(不露脸)",
    applicable_clothing_types: ["衬衫", "西装", "烟管裤", "一步裙", "风衣", "通勤连衣裙"],
    applicable_materials: ["棉", "涤纶", "混纺", "雪纺", "羊毛"],
    applicable_seasons: ["春", "秋", "冬"],
    applicable_colors: ["白", "蓝", "灰", "米", "黑", "卡其"],
    recommended_model: "seedance-2.0",
    fallback_model: "kling-v3",
    default_resolution: "720p",
    default_storyboard_count: 4,
    cost_hint: "分镜图12积分 + 视频约45-85积分（视时长分辨率）",
    storyboards: [
      {
        seq: 1, name: "产品特写", purpose: "开场聚焦服装本体，明亮均匀光展示版型和细节",
        prompt: "Based on the product image, generate a pure product showcase with no person in frame. The garment neatly laid flat on a clean white or light wood surface in a bright well-lit setting, or hanging on a minimalist hanger against a clean solid background. Bright even lighting from a large window or softbox, accurate color reproduction. Full garment visible with clear view of collar, buttons, waistline and other design details. Professional product photography style, clean and informative.",
        prompt_cn: "基于产品图，生成纯产品展示图，画面中无人物。服装整齐平铺在干净白色或浅木色表面上，明亮光照充足的环境，或挂在极简衣架上背景纯色干净。明亮均匀光线，色彩还原准确。完整服装可见，领口、纽扣、腰线等设计细节清晰展示。专业产品摄影风格，干净信息量大。"
      },
      {
        seq: 2, name: "半身正面", purpose: "正面展示服装完整版型，身体正面朝镜头，面部被手/文件/咖啡杯遮挡不露脸",
        prompt: "Based on the product image, generate a half-body front-facing outfit shot from waist up. The person facing the camera front-on, body and garment fully visible from the front, but the face is completely hidden — looking down at a phone, coffee cup, or document held in hands, or a hand naturally near the face area. Bright even office or cafe lighting, the garment occupies about 70% of the frame, its front silhouette, collar, and fit clearly visible. Professional atmosphere, accurate color reproduction.",
        prompt_cn: "基于产品图，生成腰部以上正面穿搭图。人物正面朝镜头，身体和服装从正面完整可见，但面部完全被遮挡——低头看手机、咖啡杯或手中文件，或一只手自然在面部附近。明亮均匀办公室或咖啡厅光线，服装占画面约70%，其正面轮廓、领口和版型清晰可见。职场氛围，色彩还原准确。"
      },
      {
        seq: 3, name: "氛围侧影", purpose: "唯一轻微露脸镜头，正身侧脸能看清服装正面版型，同时建立情感连接",
        prompt: "Based on the product image, generate an atmospheric portrait with body front-facing but face in side profile, shot from waist up. The person's body and the full front of the garment clearly visible to camera, but the face is turned to the side so facial features are only partially visible — loose strands of hair naturally falling across the cheek, partially concealing the eye and facial features so they are not clearly identifiable. Bright even office natural light or warm cafe light, professional and approachable expression, garment occupies about 60% of frame and is the visual focus. This is the only shot where partial face is visible — body faces camera but face never does.",
        prompt_cn: "基于产品图，生成身体正面但脸侧面的氛围肖像图，腰部以上。人物身体和服装正面完整朝镜头可见，但脸转向侧面使面部特征仅部分可见——碎发自然垂落面颊，轻遮眼睛和面部特征。明亮均匀办公室自然光或咖啡厅暖光，专业亲和表情，服装占画面约60%并为视觉焦点。这是唯一面部部分可见的镜头——身体朝镜头但脸绝不正对。"
      },
      {
        seq: 4, name: "细节实用", purpose: "展示领口/袖口/腰线等设计细节，强化实穿信任感，不露脸",
        prompt: "Based on the product image, generate a styling detail shot with no face visible. Focus on collar, cuffs, waistline, buttons, or fabric drape — key design highlights — with a hand adjusting the collar or sleeve to draw attention. Light concentrated on the detail area, background slightly darkened. Medium close-up, high information density, professional atmosphere.",
        prompt_cn: "基于产品图，生成不露脸的穿搭细节图。聚焦领口、袖口、腰线、纽扣或面料垂感等设计亮点，手部配合整理领口或袖口吸引注意力。光线聚焦在细节处，背景适度暗化。中近景，信息密度高，专业氛围。"
      },
    ],
    video_prompts: {
      seedance: "Professional commuter fashion showcase, bright and clear. Shot 1: pure product focus no face, bright even lighting, accurate color reproduction. Shot 2: half-body front-facing from waist up, face hidden by looking down or hand near face area, front silhouette and garment fully visible. Shot 3: atmospheric shot with body front-facing but face in side profile, hair gently falling across partially visible face for subtle emotional connection, garment remains visual focus, never front-facing. Shot 4: detail close-up of collar, cuffs or waistline, no face, practical and informative. Steady camera, natural light, information-first presentation.",
      seedance_cn: "职场通勤服装展示，明亮清晰。第1镜：纯产品聚焦不露脸，明亮均匀光，色彩还原准确 | 第2镜：半身正面腰部以上，面部被低头或手部遮挡，正面轮廓和服装完整可见 | 第3镜：身体正面但脸侧面，发丝轻垂过部分可见的脸建立微妙情感连接，服装保持视觉焦点，绝不正对镜头 | 第4镜：领口/袖口/腰线细节特写，不露脸，实用信息。平稳镜头，自然光，信息展示优先。",
      kling_per_frame: [
        { seq: 1, prompt: "Camera slowly pushes in on the garment laid flat or on hanger, bright even lighting, accurate color, no person", prompt_cn: "镜头缓慢推近平铺或衣架上的服装，明亮均匀光，色彩准确，无人物" },
        { seq: 2, prompt: "Camera in front of half-body figure, waist-up framing, face hidden by looking down, front silhouette and garment fully visible", prompt_cn: "镜头在半身人物正前方，腰部以上构图，面部被低头遮挡，正面轮廓和服装完整可见" },
        { seq: 3, prompt: "Camera slowly pushes to half-body, body front-facing but face turned to side, hair gently falling across partially visible face", prompt_cn: "镜头缓慢推近到半身，身体正面但脸转向侧面，发丝轻垂过部分可见的脸" },
        { seq: 4, prompt: "Camera pushes in to detail close-up of collar or cuffs, focus on design highlights, no face visible", prompt_cn: "镜头推近到领口或袖口细节特写，焦点在设计亮点，不露脸" },
      ],
    },
    copywriting_prompt: "你是一位小红书职场穿搭博主，请为以下服装撰写一篇种草笔记。要求：标题含emoji、正文实用接地气、突出版型和实穿性、多用\"显瘦\"\"百搭\"\"上班穿\"等词汇、可加入搭配建议、结尾加话题标签。服装信息：{clothing_info}",
  },
  {
    style_id: "story-lifestyle",
    name: "剧情植入",
    emoji: "🎬",
    tagline: "故事带入，情绪种草",
    description: "叙事驱动的场景切换、从犹豫到自信的情绪弧线、真实生活场景，适合任何服装的情景化展示。镜头分配：1=产品特写(不露脸) | 2=半身正面(不露脸·正面朝镜头) | 3=半身背面(不露脸) | 4=氛围侧影(轻微露脸·正身侧脸) | 5=细节互动(不露脸)",
    applicable_clothing_types: ["连衣裙", "上装", "外套", "套装", "半裙", "任何服装"],
    applicable_materials: ["不限"],
    applicable_seasons: ["不限"],
    applicable_colors: ["不限"],
    recommended_model: "kling-v3",
    fallback_model: "seedance-2.0",
    default_resolution: "1080p",
    default_storyboard_count: 5,
    cost_hint: "分镜图15积分 + 视频约75-175积分（5段拼接，视时长分辨率）",
    storyboards: [
      {
        seq: 1, name: "产品特写", purpose: "开场聚焦服装本体，从衣柜或穿衣场景自然引入产品",
        prompt: "Based on the product image, generate a natural product showcase with no person's face visible. The garment hanging in an open wardrobe or laid on a bed alongside accessories — a bag, shoes, or jewelry — as if getting ready for the day. Warm indoor natural light from a window, authentic bedroom or dressing area background, soft shadows. Pure product and styling context focus, no face in frame, candid lifestyle atmosphere.",
        prompt_cn: "基于产品图，生成自然产品展示图，画面中无脸。服装挂在打开的衣柜里或平铺在床上，旁边搭配配饰——包、鞋子或首饰——仿佛正在准备出门。室内温暖自然光，真实卧室或更衣区背景，柔和阴影。纯粹产品和搭配情境聚焦，自然生活感瞬间。"
      },
      {
        seq: 2, name: "半身正面", purpose: "正面展示服装完整版型，身体正面朝镜头，面部被镜子/手机遮挡不露脸",
        prompt: "Based on the product image, generate a half-body front-facing lifestyle shot from waist up. The person facing the camera front-on, body and garment fully visible from the front, but the face is completely hidden — reflected in the mirror at an angle that shows the back or side, or looking down at a phone, or a hand near the face. Soft indoor natural light, authentic home background, candid getting-ready atmosphere. The garment occupies about 70% of the frame, its front silhouette clearly visible.",
        prompt_cn: "基于产品图，生成腰部以上正面生活化场景图。人物在镜子前正面朝镜头，身体和服装从正面完整可见，但面部完全被遮挡——镜中倒影角度只显示背面或侧面，或低头看手机，或一只手在面部附近。柔和室内自然光，真实家中背景，自然准备出门氛围。服装占画面约70%，其正面轮廓清晰可见。"
      },
      {
        seq: 3, name: "半身背面", purpose: "半身背面展示服装轮廓和背部设计，唯一背面镜头，服装占画面主体",
        prompt: "Based on the product image, generate a half-body back-view shot from waist up. The person facing away from camera, the garment's back silhouette, shoulder line, and any back design details clearly visible and occupying about 70% of the frame. Natural indoor or outdoor lighting, authentic surroundings. The clothing is the clear visual focus — not a distant tiny figure, a close composed half-body shot.",
        prompt_cn: "基于产品图，生成腰部以上半身背面图。人物背对镜头，服装的背面轮廓、肩线和任何背部设计细节清晰可见，占画面约70%。自然室内或户外光线，真实周围环境。服装是明确的视觉焦点——不是远处的渺小身影，而是近距离半身构图。"
      },
      {
        seq: 4, name: "氛围侧影", purpose: "唯一轻微露脸镜头，正身侧脸能看清服装正面版型，同时建立情感连接",
        prompt: "Based on the product image, generate an emotional storytelling portrait with body front-facing but face in side profile, shot from waist up. The person's body and the full front of the garment clearly visible to camera, but the face is turned to the side so facial features are only partially visible — hair catching the wind and softly sweeping across the face, strands partially concealing the eyes and facial features. Natural outdoor or cafe lighting, authentic surroundings, confident relaxed expression. Garment occupies about 60% of frame and is the visual focus. This is the only shot where partial face is visible — body faces camera but face never does, candid and unposed.",
        prompt_cn: "基于产品图，生成身体正面但脸侧面的情绪化故事肖像图，腰部以上。人物身体和服装正面完整朝镜头可见，但脸转向侧面使面部特征仅部分可见——发丝随风轻扫面部，碎发半遮双眼和面部特征。自然户外或咖啡厅光线，真实周围环境，自信松弛表情。服装占画面约60%并为视觉焦点。这是唯一面部部分可见以建立情感连接的镜头——身体朝镜头但脸绝不正对，自然非摆拍。"
      },
      {
        seq: 5, name: "细节互动", purpose: "展示手部与服装互动的细节，强化真实感和代入感，不露脸",
        prompt: "Based on the product image, generate a detail shot of hands interacting with the garment. Adjusting a collar, buttoning up, pulling a zipper, or smoothing the fabric — a captured action moment. Hands clearly in motion, focused on the clothing detail. Medium close-up, no face visible, focus on the action and garment design. Authentic and practical feel, natural lighting.",
        prompt_cn: "基于产品图，生成手部与服装互动的细节图。整理衣领、系扣子、拉拉链或抚平面料等动作瞬间。手部动作清晰，聚焦服装细节。中近景，面部不可见，焦点在动作和服装设计。真实实用感，自然光线。"
      },
    ],
    video_prompts: {
      seedance: "Narrative fashion showcase, lifestyle setting. Shot 1: product focus in wardrobe or bedside scene, no face. Shot 2: half-body front-facing from waist up, face hidden by mirror angle or looking down, front silhouette and garment fully visible. Shot 3: half-body back-view from waist up, only back-view shot, narrative pacing. Shot 4: atmospheric shot with body front-facing but face in side profile, hair softly sweeping across partially visible face for emotional connection, never front-facing, garment remains visual focus. Shot 5: hand-action detail close-up, no face. Handheld shooting feel, storytelling rhythm, authentic colors.",
      seedance_cn: "剧情式服装展示，生活化场景。第1镜：衣柜或床边场景产品聚焦，不露脸 | 第2镜：半身正面腰部以上，面部被镜中角度或低头遮挡，正面轮廓和服装完整可见 | 第3镜：半身背面腰部以上，唯一背面镜头，叙事节奏 | 第4镜：身体正面但脸侧面的氛围肖像，发丝轻拂过部分可见的脸建立情感连接但绝不正对镜头，服装保持视觉焦点 | 第5镜：手部动作细节特写，不露脸。手持拍摄感，叙事节奏，真实色彩。",
      kling_per_frame: [
        { seq: 1, prompt: "Handheld camera subtle shake, simulating authentic wardrobe or getting-ready scene, indoor natural light, no face", prompt_cn: "手持镜头轻微晃动，模拟真实衣柜或准备出门场景，室内自然光，不露脸" },
        { seq: 2, prompt: "Camera in front of half-body figure, waist-up framing, face hidden by mirror angle or looking down, front silhouette fully visible", prompt_cn: "镜头在半身人物正前方，腰部以上构图，面部被镜中角度或低头遮挡，正面轮廓完整可见" },
        { seq: 3, prompt: "Camera on half-body back-view, waist-up framing, shoulder line and back silhouette clearly visible, natural background", prompt_cn: "镜头对半身背面，腰部以上构图，肩线和背部轮廓清晰可见，自然背景" },
        { seq: 4, prompt: "Camera slowly pushes to half-body, body front-facing but face turned to side, hair softly sweeping across partially visible face, emotional turning point", prompt_cn: "镜头缓慢推近到半身，身体正面但脸转向侧面，发丝轻拂过部分可见的脸，情绪转折点" },
        { seq: 5, prompt: "Camera pushes in to hand-action close-up, adjusting collar or buttoning up, no face, practical ending", prompt_cn: "镜头推近到手部动作特写，整理领口或系扣子，不露脸，实用感结尾" },
      ],
    },
    copywriting_prompt: "你是一位小红书生活方式博主，请为以下服装撰写一篇剧情式种草笔记。要求：标题含emoji、正文以\"今天穿什么\"的故事开头、突出穿上后的自信转变、多用\"出门被夸\"\"男友视角\"\"上班第一天\"等场景化词汇、结尾加话题标签。服装信息：{clothing_info}",
  },
];

// ===========================================================
// 数据库表初始化
// ===========================================================

/** 初始化 shouzuo_sessions 表（6步工作流新版） */
export function ensureShouzuoTable(): void {
  const db = getDb();
  db.run(`
    CREATE TABLE IF NOT EXISTS shouzuo_sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      current_step TEXT NOT NULL DEFAULT 'upload',
      uploaded_images TEXT NOT NULL DEFAULT '[]',
      ai_recognition_json TEXT,
      user_edited_clothing_json TEXT,
      selected_style_id TEXT,
      video_params_json TEXT,
      storyboard_json TEXT,
      video_status TEXT,
      video_url TEXT,
      video_segments_json TEXT,
      video_error TEXT,
      copywriting_json TEXT,
      pre_deducted_credits INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  // 兼容：旧版本可能没有某些字段
  try { db.run("ALTER TABLE shouzuo_sessions ADD COLUMN ai_recognition_json TEXT"); } catch (_) { /* ignore */ }
  try { db.run("ALTER TABLE shouzuo_sessions ADD COLUMN user_edited_clothing_json TEXT"); } catch (_) { /* ignore */ }
  try { db.run("ALTER TABLE shouzuo_sessions ADD COLUMN selected_style_id TEXT"); } catch (_) { /* ignore */ }
  try { db.run("ALTER TABLE shouzuo_sessions ADD COLUMN video_params_json TEXT"); } catch (_) { /* ignore */ }
  try { db.run("ALTER TABLE shouzuo_sessions ADD COLUMN video_segments_json TEXT"); } catch (_) { /* ignore */ }
  try { db.run("ALTER TABLE shouzuo_sessions ADD COLUMN pre_deducted_credits INTEGER DEFAULT 0"); } catch (_) { /* ignore */ }
  // 清理旧字段（如果存在）
  try { db.run("ALTER TABLE shouzuo_sessions DROP COLUMN style_id"); } catch (_) { /* ignore */ }
  try { db.run("ALTER TABLE shouzuo_sessions DROP COLUMN style_name"); } catch (_) { /* ignore */ }
  try { db.run("ALTER TABLE shouzuo_sessions DROP COLUMN video_thumbnail"); } catch (_) { /* ignore */ }
  try { db.run("ALTER TABLE shouzuo_sessions DROP COLUMN locked_items_json"); } catch (_) { /* ignore */ }
}

// ===========================================================
// 风格模板查询
// ===========================================================

/** 获取所有风格模板 */
export function getStyleTemplates(): StyleTemplate[] {
  return STYLE_TEMPLATES;
}

/** 获取单个风格模板 */
export function getStyleTemplate(styleId: string): StyleTemplate | undefined {
  return STYLE_TEMPLATES.find((s) => s.style_id === styleId);
}

// ===========================================================
// 工具函数
// ===========================================================

/** 获取模型单次调用成本（积分）*/
export function getModelCost(modelId: string): number {
  const db = getDb();
  const rows = db.exec("SELECT cost_credits FROM ai_models WHERE id = ?", [modelId]);
  if (rows.length === 0 || rows[0].values.length === 0) {
    return 1; // 默认1积分
  }
  return rows[0].values[0][0] as number;
}

// ===========================================================
// 会话 CRUD
// ===========================================================

const SESSION_COLUMNS = [
  "id", "user_id", "status", "current_step",
  "uploaded_images", "ai_recognition_json", "user_edited_clothing_json",
  "selected_style_id", "video_params_json", "storyboard_json",
  "video_status", "video_url", "video_segments_json",
  "video_error", "copywriting_json", "pre_deducted_credits",
  "created_at", "updated_at",
];

function mapRowToSession(row: unknown[]): ShouzuoSessionRow {
  return {
    id: row[0] as string,
    user_id: row[1] as number,
    status: row[2] as string,
    current_step: row[3] as string,
    uploaded_images: row[4] as string,
    ai_recognition_json: row[5] as string | null,
    user_edited_clothing_json: row[6] as string | null,
    selected_style_id: row[7] as string | null,
    video_params_json: row[8] as string | null,
    storyboard_json: row[9] as string | null,
    video_status: row[10] as string | null,
    video_url: row[11] as string | null,
    video_segments_json: row[12] as string | null,
    video_error: row[13] as string | null,
    copywriting_json: row[14] as string | null,
    pre_deducted_credits: (row[15] as number) ?? 0,
    created_at: row[16] as string,
    updated_at: row[17] as string,
  };
}

/** 创建种草视频会话（Step 1：仅上传图片） */
export function createSession(
  userId: number,
  imageUrls: string[],
): ShouzuoSessionRow {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

  db.run(
    `INSERT INTO shouzuo_sessions (id, user_id, status, current_step, uploaded_images, created_at, updated_at)
     VALUES (?, ?, 'active', 'upload', ?, ?, ?)`,
    [id, userId, JSON.stringify(imageUrls), now, now]
  );

  saveDatabase();
  return getSession(id)!;
}

/** 获取会话 */
export function getSession(sessionId: string): ShouzuoSessionRow | null {
  const db = getDb();
  const stmt = db.prepare("SELECT * FROM shouzuo_sessions WHERE id = ?");
  stmt.bind([sessionId]);
  if (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    return {
      id: row["id"] as string,
      user_id: row["user_id"] as number,
      status: row["status"] as string,
      current_step: row["current_step"] as string,
      uploaded_images: row["uploaded_images"] as string,
      ai_recognition_json: row["ai_recognition_json"] as string | null,
      user_edited_clothing_json: row["user_edited_clothing_json"] as string | null,
      selected_style_id: row["selected_style_id"] as string | null,
      video_params_json: row["video_params_json"] as string | null,
      storyboard_json: row["storyboard_json"] as string | null,
      video_status: row["video_status"] as string | null,
      video_url: row["video_url"] as string | null,
      video_segments_json: row["video_segments_json"] as string | null,
      video_error: row["video_error"] as string | null,
      copywriting_json: row["copywriting_json"] as string | null,
      pre_deducted_credits: (row["pre_deducted_credits"] as number) ?? 0,
      created_at: row["created_at"] as string,
      updated_at: row["updated_at"] as string,
    };
  }
  return null;
}

/** 获取用户的所有会话 */
export function listSessions(userId: number, page = 1, limit = 10): { items: ShouzuoSessionRow[]; total: number } {
  const db = getDb();
  const countRows = db.exec("SELECT COUNT(*) FROM shouzuo_sessions WHERE user_id = ?", [userId]);
  const total = (countRows[0]?.values[0]?.[0] as number) ?? 0;

  const offset = (page - 1) * limit;
  const rows = db.exec(
    "SELECT * FROM shouzuo_sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
    [userId, limit, offset]
  );

  const items: ShouzuoSessionRow[] = (rows[0]?.values ?? []).map((row: unknown[]) => mapRowToSession(row));
  return { items, total };
}

// ===========================================================
// Step 2：AI 识别 + 风格推荐
// ===========================================================

/** 保存 AI 识别结果 */
export function saveAiRecognition(
  sessionId: string,
  userId: number,
  result: AiRecognitionResult,
): void {
  const db = getDb();
  const now = new Date().toISOString();

  db.run(
    "UPDATE shouzuo_sessions SET ai_recognition_json = ?, current_step = 'ai_recognize', updated_at = ? WHERE id = ? AND user_id = ?",
    [JSON.stringify(result), now, sessionId, userId]
  );

  saveDatabase();
}

// ===========================================================
// Step 3：视频参数确认 + 积分预扣
// ===========================================================

export function calculateEstimatedCredits(
  styleId: string,
  videoParams: VideoParams,
): number {
  const style = getStyleTemplate(styleId);
  if (!style) return 0;

  // 分镜积分
  const storyboardCredits = videoParams.storyboard_count * 3;

  // 视频积分：按总秒数计算（与全局定价一致）
  // Seedance 2.0: 720P=10积分/秒, 1080P=25积分/秒
  // Kling 3.0: 720P=7积分/秒, 1080P=10积分/秒
  const perSecond = videoParams.model === "seedance-2.0"
    ? (videoParams.resolution === "1080p" ? 25 : 10)
    : (videoParams.resolution === "1080p" ? 10 : 7);
  const videoCredits = Math.ceil(videoParams.duration * perSecond);

  return storyboardCredits + videoCredits;
}

/** 确认视频参数 + 预扣积分 */
export function confirmVideoParams(
  sessionId: string,
  userId: number,
  videoParams: VideoParams,
  estimatedCredits: number,
): void {
  const db = getDb();
  const now = new Date().toISOString();

  db.run(
    "UPDATE shouzuo_sessions SET video_params_json = ?, pre_deducted_credits = ?, current_step = 'video_params', updated_at = ? WHERE id = ? AND user_id = ?",
    [JSON.stringify(videoParams), estimatedCredits, now, sessionId, userId]
  );

  saveDatabase();
}

// ===========================================================
// Step 2+3：选择风格
// ===========================================================

/** 选择风格（从 AI 推荐或手动选择） */
export function selectStyle(
  sessionId: string,
  styleId: string,
  userId: number,
): StyleTemplate {
  const db = getDb();
  const style = STYLE_TEMPLATES.find((s) => s.style_id === styleId);
  if (!style) throw new Error("风格模板不存在");

  const now = new Date().toISOString();
  db.run(
    "UPDATE shouzuo_sessions SET selected_style_id = ?, current_step = 'select_style', updated_at = ? WHERE id = ? AND user_id = ?",
    [styleId, now, sessionId, userId]
  );

  saveDatabase();
  return style;
}

// ===========================================================
// Step 4：生成分镜图
// ===========================================================

/** 保存故事板（分镜图生成结果） */
export function saveStoryboard(
  sessionId: string,
  userId: number,
  frames: StoryboardFrame[],
): void {
  const db = getDb();
  const now = new Date().toISOString();
  const storyboardJson = JSON.stringify({
    frames,
    totalFrames: frames.length,
    generatedAt: now,
  });

  db.run(
    "UPDATE shouzuo_sessions SET storyboard_json = ?, current_step = 'storyboard', updated_at = ? WHERE id = ? AND user_id = ?",
    [storyboardJson, now, sessionId, userId]
  );

  saveDatabase();
}

// ===========================================================
// Step 5：生成视频
// ===========================================================

/** 保存视频生成任务提交状态 */
export function saveVideoTask(
  sessionId: string,
  userId: number,
  taskId: string,
  segments?: VideoSegment[],
): void {
  const db = getDb();
  const now = new Date().toISOString();

  if (segments) {
    // Kling 多段模式：保存所有段信息
    db.run(
      "UPDATE shouzuo_sessions SET video_status = 'processing', video_segments_json = ?, updated_at = ? WHERE id = ? AND user_id = ?",
      [JSON.stringify(segments), now, sessionId, userId]
    );
  } else {
    // Seedance 单段模式
    db.run(
      "UPDATE shouzuo_sessions SET video_status = 'processing', video_url = NULL, video_error = NULL, updated_at = ? WHERE id = ? AND user_id = ?",
      [now, sessionId, userId]
    );
  }

  saveDatabase();
}

/** 保存 Kling 多段视频生成结果（逐段更新） */
export function saveVideoSegmentResult(
  sessionId: string,
  userId: number,
  seq: number,
  result: { video_url?: string; status: "completed" | "failed"; error?: string },
): { allCompleted: boolean; segments: VideoSegment[] } {
  const db = getDb();
  const session = getSession(sessionId);
  if (!session || !session.video_segments_json) {
    throw new Error("会话不存在或视频段数据缺失");
  }

  const segments: VideoSegment[] = JSON.parse(session.video_segments_json);
  const target = segments.find((s) => s.seq === seq);
  if (!target) throw new Error("视频段不存在");

  if (result.status === "completed" && result.video_url) {
    target.video_url = result.video_url;
    target.status = "completed";
  } else {
    target.status = "failed";
    target.error = result.error ?? "视频段生成失败";
  }

  const now = new Date().toISOString();
  const allCompleted = segments.every((s) => s.status === "completed" || s.status === "failed");

  db.run(
    "UPDATE shouzuo_sessions SET video_segments_json = ?, updated_at = ? WHERE id = ? AND user_id = ?",
    [JSON.stringify(segments), now, sessionId, userId]
  );

  saveDatabase();
  return { allCompleted, segments };
}

/** 保存最终视频结果（Seedance 单段 或 Kling 拼接完成后） */
export function saveFinalVideoResult(
  sessionId: string,
  userId: number,
  result: { video_url: string; status: "completed"; thumbnail?: string } | { status: "failed"; error: string },
): void {
  const db = getDb();
  const now = new Date().toISOString();

  if (result.status === "completed") {
    db.run(
      "UPDATE shouzuo_sessions SET video_status = 'completed', video_url = ?, video_error = NULL, current_step = 'video', updated_at = ? WHERE id = ? AND user_id = ?",
      [result.video_url, now, sessionId, userId]
    );
  } else {
    db.run(
      "UPDATE shouzuo_sessions SET video_status = 'failed', video_error = ?, updated_at = ? WHERE id = ? AND user_id = ?",
      [result.error, now, sessionId, userId]
    );
  }

  saveDatabase();
}

// ===========================================================
// Step 6：AI 文案生成
// ===========================================================

/** 保存文案生成结果 */
export function saveCopywriting(
  sessionId: string,
  userId: number,
  result: CopywritingResult,
): void {
  const db = getDb();
  const now = new Date().toISOString();

  db.run(
    "UPDATE shouzuo_sessions SET copywriting_json = ?, current_step = 'copywriting', updated_at = ? WHERE id = ? AND user_id = ?",
    [JSON.stringify(result), now, sessionId, userId]
  );

  saveDatabase();
}

// ===========================================================
// 工具函数
// ===========================================================

/** 获取分镜提示词（合成后传入 GPT-Image-2） */
export function buildStoryboardPrompt(
  styleId: string,
  frameSeq: number,
  clothingInfo: ClothingInfo,
): { prompt: string; name: string } | null {
  const style = getStyleTemplate(styleId);
  if (!style) return null;

  const frame = style.storyboards.find((s) => s.seq === frameSeq);
  if (!frame) return null;

  // 合成提示词：分镜提示词 + 服装信息
  const clothingStr = [
    `Clothing type: ${clothingInfo.clothing_type}`,
    `Fabric: ${clothingInfo.material}`,
    `Color: ${clothingInfo.main_color}`,
    `Season: ${clothingInfo.season.join("/")}`,
  ].join(", ");

  const fullPrompt = `${frame.prompt}. ${clothingStr}. Photorealistic, high quality, 8k resolution, professional product photography.`;
  return { prompt: fullPrompt, name: frame.name };
}

/** 获取视频生成提示词 */
export function getVideoPrompt(
  styleId: string,
  model: "seedance-2.0" | "kling-v3",
  frameSeq?: number,
): string | null {
  const style = getStyleTemplate(styleId);
  if (!style) return null;

  if (model === "seedance-2.0") {
    return style.video_prompts.seedance;
  } else {
    if (frameSeq !== undefined) {
      const kf = style.video_prompts.kling_per_frame.find((k) => k.seq === frameSeq);
      return kf?.prompt ?? null;
    }
    return null;
  }
}

/** 获取文案生成提示词 */
export function getCopywritingPrompt(
  styleId: string,
  clothingInfo: ClothingInfo,
): string | null {
  const style = getStyleTemplate(styleId);
  if (!style) return null;

  const clothingStr = `服装类型：${clothingInfo.clothing_type}，面料：${clothingInfo.material}，颜色：${clothingInfo.main_color}，季节：${clothingInfo.season.join("/")}`;
  return style.copywriting_prompt.replace("{clothing_info}", clothingStr);
}

/** 删除会话 */
export function deleteSession(sessionId: string, userId: number): boolean {
  const db = getDb();
  const result = db.run(
    "DELETE FROM shouzuo_sessions WHERE id = ? AND user_id = ?",
    [sessionId, userId]
  );
  saveDatabase();
  return (result as any)?.changes > 0;
}
