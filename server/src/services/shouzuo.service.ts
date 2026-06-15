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

export interface ProductLock {
  type: string;       // 产品类型锁定
  color: string;      // 主色锁定
  material: string;   // 面料锁定
  key_features: string[]; // 关键设计特征
  en_lock_description: string; // 英文锁定描述（30-50词）
}

export interface AiRecognitionResult {
  clothing_type: string;
  material: string;
  season: string[];
  main_color: string;
  style_tags: string[];
  recommendations: StyleRecommendation[];
  raw_json?: string; // GPT-4o 原始返回
  image_type?: 'flat_lay' | 'worn' | 'unknown';  // 图片类型判断
  needs_preprocessing?: boolean;                         // 是否需要预处理
  product_lock?: ProductLock;                            // 产品锁定描述
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
  current_step: string;       // "upload"|"ai_recognize"|"preprocessing"|"video_params"|"storyboard"|"video"|"copywriting"
  uploaded_images: string;      // JSON string[]
  ai_recognition_json: string | null;  // JSON - AiRecognitionResult (含 image_type / needs_preprocessing)
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
  preprocessed_image_url: string | null; // 预处理生成的穿着效果图 URL
  preprocessing_status: string | null; // "idle"|"generating"|"completed"|"failed"
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
    description: "柔和自然光、低饱和暖调、户外草地或木质场景，适合棉麻/钩针/文艺风服装",
    applicable_clothing_types: ["连衣裙", "开衫", "披肩", "围巾", "上装", "半裙", "手作编织"],
    applicable_materials: ["棉麻", "钩针", "羊毛", "棉", "亚麻", "蕾丝"],
    applicable_seasons: ["春", "秋"],
    applicable_colors: ["米白", "燕麦色", "浅绿", "卡其", "奶茶色", "浅灰"],
    recommended_model: "seedance-2.0",
    fallback_model: "kling-v3",
    default_resolution: "720p",
    default_storyboard_count: 4,
    cost_hint: "分镜图12积分 + 视频按秒计费（Seedance 9积分/秒，Kling每段3.6积分/秒）",
    storyboards: [
      {
        seq: 1, name: "产品特写", purpose: "视频开头，聚焦产品本身",
        prompt: "Based on the product image, generate a product close-up shot in Japanese mori style. The garment is placed on natural grass or a wooden deck, dappled sunlight filtering through leaves, NO human face or figure visible, focus entirely on the product silhouette, fabric texture, and color in natural light. Shallow depth of field, blurred green foliage background, warm green and off-white low-saturation color palette.",
        prompt_cn: "基于产品图，生成日系森系风格产品特写图。服装放置在自然草地或木质露台上，阳光透过树叶形成斑驳光影，画面中无人脸或人物，完全聚焦产品轮廓、面料质感和自然光下的色彩。浅景深，背景模糊的绿色植物，低饱和暖绿+米白色调。"
      },
      {
        seq: 2, name: "背面穿搭", purpose: "展示服装在自然光下的整体轮廓",
        prompt: "Based on the product image, generate a back-view outfit showcase in Japanese mori style. Person shown from behind or back three-quarter angle, face COMPLETELY INVISIBLE, no facial features visible, wearing the garment while walking slowly through a sunlit meadow or forest clearing. Displaying the full silhouette and drape of the garment in natural light, soft breeze gently swaying the hem. Shallow depth of field, warm green and off-white low-saturation tones.",
        prompt_cn: "基于产品图，生成日系森系风格背面穿搭图。人物背影或背面3/4视角，面部完全不可见，穿着该服装在阳光草地或林间空地缓步前行。展示服装在自然光下的完整轮廓和垂坠感，微风吹动衣角。浅景深，低饱和暖绿+米白色调。"
      },
      {
        seq: 3, name: "氛围侧影", purpose: "氛围镜头，轻微露脸",
        prompt: "Based on the product image, generate an atmospheric side-profile shot in Japanese mori style. Person in side profile or looking downward, face NOT fully visible, loose wispy strands of hair naturally drifting across the cheeks and eyes in a soft breeze, partially veiling the face, NEVER facing the camera directly. Soft morning light falling on the shoulders, the garment flowing naturally. Warm green and off-white low-saturation tones, gentle and healing atmosphere.",
        prompt_cn: "基于产品图，生成日系森系风格氛围侧影图。人物侧脸或低头，面部不完全可见，发丝自然飘动轻遮面颊和眼部，绝不正对镜头。柔和晨光洒在肩上，服装自然飘动。低饱和暖绿+米白色调，温柔治愈氛围。"
      },
      {
        seq: 4, name: "结尾远影", purpose: "视频结尾，远景留白收尾",
        prompt: "Based on the product image, generate a distant back-view ending shot in Japanese mori style. Person seen from far behind or as a side silhouette, face COMPLETELY INVISIBLE, walking away along a forest path or across an open meadow. Wide-angle composition with sky and trees as background, generous negative space, strong sense of breathing room. Low-saturation warm green and off-white tones, soft natural light.",
        prompt_cn: "基于产品图，生成日系森系风格结尾远影图。人物远景背影或侧面剪影，面部完全不可见，沿森林小径或草地中央渐行渐远。广角构图，天空和树木作为背景，留白多，呼吸感强。低饱和暖绿+米白色调，柔和自然光。"
      },
    ],
    video_prompts: {
      seedance: "Japanese mori-style fashion showcase, natural light, outdoor grassy or wooden setting, slow push-and-pull camera with subtle handheld breathing movement, low-saturation warm green and off-white tones, healing atmosphere, soft background blur, garment flowing gently in the breeze, gentle and airy feel",
      seedance_cn: "日系森系服装展示，自然光，户外草地/木质场景，镜头缓慢推拉，轻微手持呼吸感，低饱和暖绿+米白色调，治愈氛围，背景虚化，服装在微风中轻柔飘动，画面柔和有呼吸感",
      kling_per_frame: [
        { seq: 1, prompt: "Camera slowly pushes in toward the product on grass, gentle dappled light, macro focus on fabric texture", prompt_cn: "镜头缓慢推近草地上的产品，斑驳光影，微距聚焦面料质感" },
        { seq: 2, prompt: "Camera slowly tracks alongside the back-view figure, natural swaying movement", prompt_cn: "镜头缓慢跟随背影人物侧移，自然摇曳动态" },
        { seq: 3, prompt: "Camera slowly orbits around the side-profile figure, hair and fabric swaying in breeze", prompt_cn: "镜头缓慢环绕侧影人物，发丝和面料随风飘动" },
        { seq: 4, prompt: "Camera slowly pulls back as the figure recedes, negative space increasing in the frame", prompt_cn: "镜头缓慢拉远，人物渐行渐远，画面留白增多" },
      ],
    },
    copywriting_prompt: "你是一位小红书日系森系风格的博主，请为以下服装撰写一篇种草笔记。要求：标题含emoji、正文口语化亲切温柔、突出面料质感和自然生活感、多用\"治愈\"\"温柔\"\"氛围感\"等词汇、结尾加话题标签。服装信息：{clothing_info}",
  },
  {
    style_id: "street-urban",
    name: "潮流街头",
    emoji: "🔥",
    tagline: "节奏卡点，态度穿搭",
    description: "硬光高对比、城市水泥/霓虹场景、快节奏剪辑感，适合潮牌/运动装/年轻化服饰",
    applicable_clothing_types: ["卫衣", "夹克", "T恤", "短裤", "运动套装", "潮牌联名"],
    applicable_materials: ["牛仔", "尼龙", "涤纶", "棉", "科技面料"],
    applicable_seasons: ["春", "夏", "秋"],
    applicable_colors: ["黑色", "白色", "荧光色", "撞色", "迷彩"],
    recommended_model: "kling-v3",
    fallback_model: "seedance-2.0",
    default_resolution: "1080p",
    default_storyboard_count: 6,
    cost_hint: "分镜图18积分 + 视频按秒计费（Seedance 9积分/秒，Kling每段3.6积分/秒×6段）",
    storyboards: [
      {
        seq: 1, name: "产品特写", purpose: "视频开头，产品定调",
        prompt: "Based on the product image, generate a product close-up shot in street-urban editorial style. The garment displayed against a concrete wall or graffiti backdrop, NO human face or figure visible, focus entirely on the product design details, bold graphic elements, and urban texture. Hard side-lighting casting strong shadows, high-contrast, saturated colors.",
        prompt_cn: "基于产品图，生成潮流街头风格产品特写图。服装展示在城市水泥墙或涂鸦背景前，画面中无人脸或人物，完全聚焦产品设计细节、图案元素和都市质感。硬光侧面照射形成强阴影，高对比，色彩饱和。"
      },
      {
        seq: 2, name: "背面穿搭", purpose: "展示全身穿搭轮廓",
        prompt: "Based on the product image, generate a back-view street-style outfit shot. Person shown from behind or back three-quarter angle, face COMPLETELY INVISIBLE, no facial features visible, wearing the garment in an urban street scene with cityscape background. Jacket hem and silhouette clearly visible, fabric texture under hard lighting. Low-angle perspective, city lights in background.",
        prompt_cn: "基于产品图，生成街头背面穿搭图。人物背面3/4视角，面部完全不可见，穿着该服装在城市街景中，城市天际线背景。外套下摆和轮廓清晰可见，硬光下的面料质感。低角度透视，背景城市灯光。"
      },
      {
        seq: 3, name: "侧面剪影", purpose: "展示穿搭轮廓与版型",
        prompt: "Based on the product image, generate a side-silhouette street-style shot. Person shown in strict side profile, face COMPLETELY TURNED AWAY from the camera and INVISIBLE, displaying the full outfit silhouette and cut. City street or overpass background, hard rim lighting creating strong outline contrast, garment structure clearly visible. Medium shot composition.",
        prompt_cn: "基于产品图，生成街头侧面剪影图。人物严格侧面，面部完全转离镜头不可见，展示完整穿搭轮廓和版型。城市街道或天桥背景，硬质轮廓光形成强烈边缘对比，服装结构清晰。中景构图。"
      },
      {
        seq: 4, name: "氛围侧影", purpose: "氛围镜头，轻微露脸",
        prompt: "Based on the product image, generate an atmospheric side-profile shot in street-urban style. Person in side profile or looking downward, face NOT fully visible, loose messy hair naturally drifting across the cheeks and eyes in the urban wind, partially veiling the face, NEVER facing the camera directly. Neon lights or hard lighting scene, rim light on the garment, raw edgy urban atmosphere. High-contrast, saturated colors.",
        prompt_cn: "基于产品图，生成潮流街头氛围侧影图。人物侧脸或低头，面部不完全可见，凌乱发丝在城市风中自然飘动半遮面颊和眼部，绝不正对镜头。霓虹灯或硬光场景，服装轮廓光，粗犷都市氛围。高对比，色彩饱和。"
      },
      {
        seq: 5, name: "细节特写", purpose: "快速闪切展示设计细节",
        prompt: "Based on the product image, generate a close-up detail shot of the garment. Focus on prints, logos, zippers, or brim details, NO human face or figure visible, artificial studio lighting with metallic reflections, dark background to isolate the subject. Macro perspective, high sharpness, high contrast.",
        prompt_cn: "基于产品图，生成服装细节特写图。聚焦印花、logo、拉链、帽檐等设计细节，画面中无人脸或人物，人工打光，金属质感反光，背景暗色突出主体。微距视角，锐度高，高对比。"
      },
      {
        seq: 6, name: "定格结尾", purpose: "视频结尾，定格+文案空间",
        prompt: "Based on the product image, generate a freeze-frame ending shot. Person shown from behind or as a side silhouette, face COMPLETELY INVISIBLE, no facial features visible, simplified background, spotlight effect, garment fully displayed, unified color palette, generous negative space reserved for text overlay.",
        prompt_cn: "基于产品图，生成人物定格结尾图。人物背面或侧面剪影，面部完全不可见，简化背景，聚光灯效果，服装完整展示，色调统一，留出版式空间用于加文字。"
      },
    ],
    video_prompts: {
      seedance: "Street-style fashion showcase, fast pace, high-contrast lighting, saturated colors, city street backdrop with neon signs and concrete walls, strong dynamics, wide-angle perspective, beat-driven rhythm, garment details and urban textures in focus",
      seedance_cn: "潮流街头服装展示，快节奏，高对比光影，饱和色彩，城市街道背景，霓虹灯和水泥墙，动态强，广角透视，节奏卡点感，聚焦服装细节和都市质感",
      kling_per_frame: [
        { seq: 1, prompt: "Fast push-in toward product detail, hard-cut style, high contrast lighting", prompt_cn: "快速推近产品细节，硬切风格，高对比光影" },
        { seq: 2, prompt: "Low-angle shot tracking the back-view figure walking, wide-angle perspective impact", prompt_cn: "低角度跟踪背影人物行走，广角透视冲击感" },
        { seq: 3, prompt: "Camera slowly pans around the side silhouette, rim light emphasizing outline", prompt_cn: "镜头缓慢环绕侧面剪影，轮廓光强调边缘" },
        { seq: 4, prompt: "Camera slowly orbits the atmospheric side-profile, neon light reflections shifting", prompt_cn: "镜头缓慢环绕氛围侧影，霓虹灯光反射变化" },
        { seq: 5, prompt: "Quick flash-cut to detail close-up, slight camera shake for energy", prompt_cn: "快速闪切到细节特写，镜头微晃增加动感" },
        { seq: 6, prompt: "Camera slowly pushes in then freezes, leaving space for text overlay", prompt_cn: "镜头缓慢推近后定格，留出版式空间" },
      ],
    },
    copywriting_prompt: "你是一位小红书潮流穿搭博主，请为以下服装撰写一篇种草笔记。要求：标题含emoji、正文语气酷飒自信、突出设计态度和穿搭气场、多用\"绝了\"\"炸街\"\"氛围感拉满\"等词汇、结尾加话题标签。服装信息：{clothing_info}",
  },
  {
    style_id: "luxury-cinematic",
    name: "高级质感",
    emoji: "✨",
    tagline: "静谧大片，质感至上",
    description: "电影感单一光源、极简背景、浅景深留白，适合高端女装/礼服/设计师品牌/高级面料",
    applicable_clothing_types: ["礼服", "连衣裙", "西装外套", "风衣", "设计师款"],
    applicable_materials: ["真丝", "羊绒", "羊毛", "蕾丝", "缎面", "天鹅绒"],
    applicable_seasons: ["秋", "冬"],
    applicable_colors: ["黑", "白", "驼色", "酒红", "深蓝", "香槟金"],
    recommended_model: "seedance-2.0",
    fallback_model: "kling-v3",
    default_resolution: "1080p",
    default_storyboard_count: 3,
    cost_hint: "分镜图9积分 + 视频按秒计费（Seedance 9积分/秒，Kling每段3.6积分/秒）",
    storyboards: [
      {
        seq: 1, name: "产品特写", purpose: "视频开头，展示产品轮廓和材质",
        prompt: "Based on the product image, generate a product close-up shot in luxury cinematic style. The garment placed against a minimalist solid background (dark gray, off-white, or black), a single strong light source from the side or behind creates a distinct rim light on the product, NO human face or figure visible, focus entirely on the garment silhouette, material texture, and luminous sheen. Wide aperture shallow depth of field, background fully blurred or solid color.",
        prompt_cn: "基于产品图，生成高级质感风格产品特写图。服装放置在极简纯色背景上（深灰或米白或黑），单一强光源从侧面或背后打入，产品边缘轮廓光明显，画面中无人脸或人物，完全聚焦服装轮廓、材质质感和光泽。大光圈浅景深，背景完全虚化或纯色。"
      },
      {
        seq: 2, name: "氛围侧影", purpose: "氛围镜头，轻微露脸",
        prompt: "Based on the product image, generate an atmospheric side-profile shot in luxury cinematic style. Person in side profile or looking downward, face NOT fully visible, elegant loose hair naturally drifting across the cheeks in a gentle breeze, delicately veiling the features, NEVER facing the camera directly. Single strong light source creating cinematic Rembrandt or butterfly lighting on the garment, sophisticated and quiet. Wide aperture shallow depth of field, monochromatic gradient tones.",
        prompt_cn: "基于产品图，生成高级质感氛围侧影图。人物侧脸或低头，面部不完全可见，优雅散发在微风中自然飘过面颊，精致地轻遮五官，绝不正对镜头。单一强光源制造电影感伦勃朗光或蝴蝶光，高级安静感。大光圈浅景深，同色系渐变色调。"
      },
      {
        seq: 3, name: "结尾定格", purpose: "视频结尾，大量留白淡出",
        prompt: "Based on the product image, generate an ending freeze-frame shot in luxury cinematic style. Person shown from behind or as a side silhouette, face COMPLETELY INVISIBLE, no facial features visible, garment occupying about 50% of the frame with generous negative space. Soft even lighting, monochromatic gradient or black-and-white tones, composition referencing high-end fashion editorial.",
        prompt_cn: "基于产品图，生成高级质感结尾定格图。人物背面剪影或侧面，面部完全不可见，服装在画面中占比约50%，其余是大面积留白。光线柔和均匀，同色系渐变或黑白色调，构图参考高端时尚杂志大片。"
      },
    ],
    video_prompts: {
      seedance: "Luxury cinematic fashion showcase, minimalist background, single strong light source, Rembrandt or butterfly lighting, shallow depth of field with wide aperture and blurred background, extremely slow push-and-pull camera, low-saturation monochromatic gradient tones, high-end editorial magazine style, generous negative space, quiet and powerful, garment texture and drape in focus",
      seedance_cn: "高级质感服装展示，电影感，极简背景，单一强光源，伦勃朗光或蝴蝶光，浅景深大光圈背景虚化，镜头缓慢推拉节奏极慢，低饱和同色系渐变色调，高端时尚杂志风格，留白多，安静有力量感，聚焦服装质感和垂坠",
      kling_per_frame: [
        { seq: 1, prompt: "Camera slowly pushes in toward the product, single light source creating rim light, extremely slow pace", prompt_cn: "镜头缓慢推近产品，单一光源制造轮廓光，极慢节奏" },
        { seq: 2, prompt: "Camera slowly orbits the side-profile figure, light and shadow shifting across the garment", prompt_cn: "镜头缓慢环绕侧影人物，光影在服装上流动变化" },
        { seq: 3, prompt: "Camera extremely slowly pulls back, increasing negative space, fading out", prompt_cn: "镜头极缓慢拉远，增加留白，淡出收尾" },
      ],
    },
    copywriting_prompt: "你是一位小红书高级感穿搭博主，请为以下服装撰写一篇种草笔记。要求：标题含emoji、正文语言克制有品位、突出面料质感和剪裁工艺、多用\"质感\"\"高级\"\"一衣多穿\"等词汇、避免过度感叹、结尾加话题标签。服装信息：{clothing_info}",
  },
  {
    style_id: "office-commute",
    name: "职场通勤",
    emoji: "💼",
    tagline: "实用种草，日常得体",
    description: "明亮均匀光、办公室/咖啡厅场景、信息展示优先，适合职业装/衬衫/西装/日常通勤服饰",
    applicable_clothing_types: ["衬衫", "西装", "烟管裤", "一步裙", "风衣", "通勤连衣裙"],
    applicable_materials: ["棉", "涤纶", "混纺", "雪纺", "羊毛"],
    applicable_seasons: ["春", "秋", "冬"],
    applicable_colors: ["白", "蓝", "灰", "米", "黑", "卡其"],
    recommended_model: "seedance-2.0",
    fallback_model: "kling-v3",
    default_resolution: "720p",
    default_storyboard_count: 4,
    cost_hint: "分镜图12积分 + 视频按秒计费（Seedance 9积分/秒，Kling每段3.6积分/秒）",
    storyboards: [
      {
        seq: 1, name: "产品特写", purpose: "视频开头，建立职场场景",
        prompt: "Based on the product image, generate a product close-up shot in office-commute style. The garment placed in an office or café setting, natural light streaming through windows, NO human face or figure visible, focus entirely on the product silhouette and fabric quality in a professional environment. Bright even lighting, accurate color reproduction, background moderately blurred to preserve workplace atmosphere.",
        prompt_cn: "基于产品图，生成职场通勤风格产品特写图。服装放置在办公室或咖啡厅场景中，窗户自然光照射，画面中无人脸或人物，完全聚焦产品轮廓和面料质感。光线明亮均匀，色彩还原准确，背景适度虚化保留职场氛围。"
      },
      {
        seq: 2, name: "背面/侧面穿搭", purpose: "展示服装版型剪裁",
        prompt: "Based on the product image, generate a back or side-view outfit showcase in office-commute style. Person shown from behind or in strict side profile, face COMPLETELY INVISIBLE, no facial features visible, wearing the garment in a natural standing pose with arms at sides or in pockets. Focus on the overall cut, silhouette, and drape. Solid or minimalist background, even lighting across the clothing, accurate color reproduction.",
        prompt_cn: "基于产品图，生成职场通勤风格背面/侧面穿搭图。人物背面或严格侧面，面部完全不可见，穿着该服装自然站立，双手下垂或插兜。焦点在服装整体剪裁、版型和垂坠感。纯色或简约背景，光线均匀，色彩还原准确。"
      },
      {
        seq: 3, name: "氛围侧影", purpose: "氛围镜头，轻微露脸",
        prompt: "Based on the product image, generate an atmospheric side-profile shot in office-commute style. Person in side profile or looking downward, face NOT fully visible, loose strands of hair naturally drifting across the cheeks, partially veiling the face, NEVER facing the camera directly. Professional setting background (office corridor or café), bright even lighting, understated and professional atmosphere.",
        prompt_cn: "基于产品图，生成职场通勤风格氛围侧影图。人物侧脸或低头，面部不完全可见，碎发自然飘过面颊轻遮面部，绝不正对镜头。职业场景背景（办公室走廊或咖啡厅），光线明亮均匀，低调专业氛围。"
      },
      {
        seq: 4, name: "结尾展示", purpose: "视频结尾，实穿场景收尾",
        prompt: "Based on the product image, generate an ending back or side-silhouette shot in office-commute style. Person shown from behind or as a side silhouette, face COMPLETELY INVISIBLE, no facial features visible, sitting at an office desk or walking in a corridor. Garment performance in real movement, natural lighting, medium shot, strong sense of authenticity and practicality.",
        prompt_cn: "基于产品图，生成职场通勤风格结尾展示图。人物背面或侧面剪影，面部完全不可见，坐在办公桌前或走在走廊中。展示服装在真实动作下的版型表现，光线自然，中景构图，真实感和实用感强。"
      },
    ],
    video_prompts: {
      seedance: "Professional commuter fashion showcase, bright and clear, information-first presentation, office or café setting, natural light, steady camera with standard focal length, garment silhouette and cut clearly displayed, accurate color reproduction, practical outfit display",
      seedance_cn: "职场通勤服装展示，明亮清晰，信息展示优先，办公室或咖啡厅场景，自然光，平稳镜头标准焦段，服装版型和剪裁清晰展示，色彩还原准确，实用穿搭展示",
      kling_per_frame: [
        { seq: 1, prompt: "Camera slowly pushes in toward the product on desk, natural light, even lighting", prompt_cn: "镜头缓慢推近桌面上的产品，自然光，光线均匀" },
        { seq: 2, prompt: "Camera slowly tracks alongside the back-view figure, showing silhouette details", prompt_cn: "镜头缓慢跟随背影人物侧移，展示版型细节" },
        { seq: 3, prompt: "Camera slowly orbits the side-profile figure, professional setting in background", prompt_cn: "镜头缓慢环绕侧影人物，职业场景背景" },
        { seq: 4, prompt: "Camera slowly pulls back from medium shot, revealing the full outfit in real setting", prompt_cn: "镜头从中景缓慢拉远，展示整体穿搭在真实场景中的效果" },
      ],
    },
    copywriting_prompt: "你是一位小红书职场穿搭博主，请为以下服装撰写一篇种草笔记。要求：标题含emoji、正文实用接地气、突出版型和实穿性、多用\"显瘦\"\"百搭\"\"上班穿\"等词汇、可加入搭配建议、结尾加话题标签。服装信息：{clothing_info}",
  },
  {
    style_id: "story-lifestyle",
    name: "剧情植入",
    emoji: "🎬",
    tagline: "故事带入，情绪种草",
    description: "叙事驱动的场景切换、从犹豫到自信的情绪弧线、真实生活场景，适合任何服装的情景化展示",
    applicable_clothing_types: ["连衣裙", "上装", "外套", "套装", "半裙", "任何服装"],
    applicable_materials: ["不限"],
    applicable_seasons: ["不限"],
    applicable_colors: ["不限"],
    recommended_model: "kling-v3",
    fallback_model: "seedance-2.0",
    default_resolution: "1080p",
    default_storyboard_count: 5,
    cost_hint: "分镜图15积分 + 视频按秒计费（Seedance 9积分/秒，Kling每段3.6积分/秒×5段）",
    storyboards: [
      {
        seq: 1, name: "产品静物", purpose: "视频开头，产品在生活场景中",
        prompt: "Based on the product image, generate a product still-life shot in lifestyle setting. The garment placed naturally on a desk, beside a wardrobe, or draped over a chair, NO human face or figure visible, focus entirely on the product in a cozy real-life interior. Soft indoor natural lighting, authentic and unforced atmosphere, warm tones.",
        prompt_cn: "基于产品图，生成剧情植入风格产品静物图。服装自然放置在桌面、衣柜旁或搭在椅子上，画面中无人脸或人物，完全聚焦产品在温馨真实室内场景中的呈现。室内自然光，真实不做作的氛围，暖色调。"
      },
      {
        seq: 2, name: "背面穿搭", purpose: "展示穿上后的背面效果",
        prompt: "Based on the product image, generate a back-view outfit shot in lifestyle setting. Person shown from behind, face COMPLETELY INVISIBLE, no facial features visible, wearing the garment. Interior or doorway scene, soft natural light from windows, garment silhouette and drape clearly visible. Authentic real-life feel, unforced and natural.",
        prompt_cn: "基于产品图，生成剧情植入风格背面穿搭图。人物背面，面部完全不可见，穿着该服装。室内或门口场景，窗户柔和自然光，服装轮廓和垂坠感清晰可见。真实生活感，自然不做作。"
      },
      {
        seq: 3, name: "侧面剪影", purpose: "展示穿搭轮廓",
        prompt: "Based on the product image, generate a side-silhouette shot in lifestyle setting. Person in strict side profile, face COMPLETELY TURNED AWAY from the camera and INVISIBLE, displaying the full outfit silhouette and cut. Indoor natural light, real-life setting such as a hallway or living room, garment structure clearly visible. Authentic and candid feel.",
        prompt_cn: "基于产品图，生成剧情植入风格侧面剪影图。人物严格侧面，面部完全转离镜头不可见，展示完整穿搭轮廓和版型。室内自然光，真实生活场景如走廊或客厅，服装结构清晰可见。真实自然感。"
      },
      {
        seq: 4, name: "氛围侧影", purpose: "氛围镜头，情绪转折点，轻微露脸",
        prompt: "Based on the product image, generate an atmospheric side-profile shot in lifestyle setting. Person in side profile or looking downward, face NOT fully visible, loose strands of hair naturally drifting across the cheeks, partially veiling the face, NEVER facing the camera directly. Emotional turning point, soft window light or interior warm lighting, candid storytelling moment, genuine and touching.",
        prompt_cn: "基于产品图，生成剧情植入风格氛围侧影图。人物侧脸或低头，面部不完全可见，碎发自然飘过面颊轻遮面部，绝不正对镜头。情绪转折点，柔和窗光或室内暖光，自然故事感瞬间，真实动人。"
      },
      {
        seq: 5, name: "结尾定格", purpose: "定格结尾，留白版式空间",
        prompt: "Based on the product image, generate an ending freeze-frame shot in lifestyle setting. Person shown from behind or as a distant figure, face COMPLETELY INVISIBLE, no facial features visible, standing in an attractive setting (rooftop, doorway, or window light). Beautiful lighting, garment fully displayed, composition leaves generous negative space for text overlay.",
        prompt_cn: "基于产品图，生成剧情植入风格结尾定格图。人物背面或远影，面部完全不可见，站在好看的场景前（天台、门口或窗光下）。光线美好，服装完整展示，构图留出版式空间用于加文案。"
      },
    ],
    video_prompts: {
      seedance: "Narrative fashion showcase, lifestyle setting, authentic feel, natural light, true-to-life colors, emotional arc from contemplation to confidence, handheld shooting feel, storytelling rhythm, garment texture and drape emphasized",
      seedance_cn: "剧情式服装展示，生活化场景，真实感，自然光，真实色彩，从沉思到自信的情绪弧线，手持拍摄感，叙事节奏，聚焦服装质感和垂坠",
      kling_per_frame: [
        { seq: 1, prompt: "Handheld camera slowly approaches the still-life product, indoor natural light, intimate feel", prompt_cn: "手持镜头缓慢接近静物产品，室内自然光，亲密感" },
        { seq: 2, prompt: "Camera slowly tracks alongside the back-view figure, natural swaying movement", prompt_cn: "镜头缓慢跟随背影人物侧移，自然摇曳动态" },
        { seq: 3, prompt: "Camera slowly pans around the side silhouette, garment outline in focus", prompt_cn: "镜头缓慢环绕侧面剪影，聚焦服装轮廓" },
        { seq: 4, prompt: "Camera slowly orbits the atmospheric side-profile, emotional turning point, soft light shifting", prompt_cn: "镜头缓慢环绕氛围侧影，情绪转折点，柔光变化" },
        { seq: 5, prompt: "Camera slowly pulls back, figure in distant view, leaving space for text overlay", prompt_cn: "镜头缓慢拉远，人物远景，留出版式空间" },
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
  // v2.6 新增：服装预处理字段
  try { db.run("ALTER TABLE shouzuo_sessions ADD COLUMN preprocessed_image_url TEXT"); } catch (_) { /* ignore */ }
  try { db.run("ALTER TABLE shouzuo_sessions ADD COLUMN preprocessing_status TEXT DEFAULT 'idle'"); } catch (_) { /* ignore */ }
  // 兼容：旧版本可能没有 video_segment_ids 字段
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
  "preprocessed_image_url", "preprocessing_status",
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
    preprocessed_image_url: row[16] as string | null,
    preprocessing_status: row[17] as string | null,
    created_at: row[18] as string,
    updated_at: row[19] as string,
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
      preprocessed_image_url: (row["preprocessed_image_url"] as string) ?? null,
      preprocessing_status: (row["preprocessing_status"] as string) ?? null,
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

/** 更新会话的故事板数据 */
export function updateSessionStoryboard(sessionId: string, storyboardJson: string): void {
  const db = getDb();
  db.run(
    "UPDATE shouzuo_sessions SET storyboard_json = ?, updated_at = datetime('now') WHERE id = ?",
    [storyboardJson, sessionId],
  );
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

/**
 * 计算预估积分 — 按秒计费
 * 公式：总分镜积分 + 总视频积分
 * 分镜积分 = storyboard_count × 3
 * 视频积分 = 每秒单价 × 时长（秒）
 *   Seedance：单段，720p = 9积分/秒，1080p = 14积分/秒
 *   Kling：  多段（每段单独），720p = 3.6积分/秒，1080p = 5.6积分/秒
 * 最终向上取整（Math.ceil），避免出现小数积分
 */
export function calculateEstimatedCredits(
  styleId: string,
  videoParams: VideoParams,
): number {
  const style = getStyleTemplate(styleId);
  if (!style) return 0;

  // 分镜积分
  const storyboardCredits = videoParams.storyboard_count * 3;

  // 视频积分 — 按秒计费
  let videoCredits = 0;
  const duration = videoParams.duration;
  const resolution = videoParams.resolution;

  if (videoParams.model === "seedance-2.0") {
    // Seedance：1段视频，按秒计费
    const perSecond = resolution === "1080p" ? 14 : 9;
    videoCredits = Math.ceil(perSecond * duration);
  } else {
    // Kling：每段按秒计费
    const perSecond = resolution === "1080p" ? 5.6 : 3.6;
    const perSegment = Math.ceil(perSecond * duration);
    videoCredits = perSegment * videoParams.storyboard_count;
  }

  return storyboardCredits + videoCredits;
}

/** 确认视频参数（不再预扣积分，改为生成完成后按实际扣减） */
export function confirmVideoParams(
  sessionId: string,
  userId: number,
  videoParams: VideoParams,
): void {
  const db = getDb();
  const now = new Date().toISOString();

  db.run(
    "UPDATE shouzuo_sessions SET video_params_json = ?, current_step = 'video_params', updated_at = ? WHERE id = ? AND user_id = ?",
    [JSON.stringify(videoParams), now, sessionId, userId]
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
// 服装预处理
// ===========================================================

/** 保存预处理结果（穿着效果图 URL） */
export function savePreprocessedImage(
  sessionId: string,
  userId: number,
  preprocessedImageUrl: string,
): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.run(
    "UPDATE shouzuo_sessions SET preprocessed_image_url = ?, preprocessing_status = 'completed', current_step = 'preprocessing', updated_at = ? WHERE id = ? AND user_id = ?",
    [preprocessedImageUrl, now, sessionId, userId]
  );
  saveDatabase();
}

/** 更新预处理状态 */
export function updatePreprocessingStatus(
  sessionId: string,
  userId: number,
  status: 'generating' | 'completed' | 'failed',
  error?: string,
): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.run(
    "UPDATE shouzuo_sessions SET preprocessing_status = ?, updated_at = ? WHERE id = ? AND user_id = ?",
    [status, now, sessionId, userId]
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

  const prompt = `${frame.prompt}. ${clothingStr}. Photorealistic, high quality, 8k resolution, professional product photography.`;
  return { prompt, name: frame.name };
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
