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
    cost_hint: "分镜图12积分 + 视频约45-85积分（视时长分辨率）",
    storyboards: [
      {
        seq: 1, name: "全身展示", purpose: "视频开头，缓慢推近镜头展示整体穿搭",
        prompt: "Based on the product image, generate a full-body outfit showcase in Japanese mori style. The person stands on a grassy field or wooden deck bathed in soft morning side-light, wearing the garment with a relaxed, natural expression, not looking at the camera, hair and hem gently swaying in the breeze. Shallow depth of field, blurred background, warm green and off-white low-saturation color palette.",
        prompt_cn: "基于产品图，生成日系森系风格服装全身展示图。人物站在自然光下的草地或木质露台，清晨柔和阳光从侧面打入，穿着该服装，表情松弛自然，不看镜头，微风吹动发丝和衣角。浅景深，背景虚化，色调偏暖绿+米白低饱和。"
      },
      {
        seq: 2, name: "面料特写", purpose: "视频中间，展示材质细节",
        prompt: "Based on the product image, generate a close-up detail shot of the fabric texture. Dappled sunlight filtering through leaves falls across the fabric surface, a hand gently grazing the material to reveal its weave and texture, with blurred green foliage in the background. Macro perspective, soft lighting, warm natural tones.",
        prompt_cn: "基于产品图，生成服装面料细节特写图。阳光透过树叶在面料上形成斑驳光影，手部轻抚服装表面，展示面料纹理质感，背景模糊的绿色植物。微距视角，光线柔和，色调温暖自然。"
      },
      {
        seq: 3, name: "生活场景", purpose: "视频中间，建立生活化代入感",
        prompt: "Based on the product image, generate a lifestyle scene of someone wearing the garment. The person sits naturally on a wooden bench or stone steps, holding a coffee cup or book, sunlight falling on their shoulders and the clothing, with a park or Japanese-style garden in the background. Medium shot, consistent low-saturation warm tones throughout.",
        prompt_cn: "基于产品图，生成穿着该服装的生活化场景图。人物坐在木质长椅或台阶上，手捧咖啡或书本，自然坐姿，阳光洒在肩膀和服装上，背景是公园或日式庭院。中景构图，色调统一在低饱和暖调。"
      },
      {
        seq: 4, name: "背影侧影", purpose: "视频结尾，淡出收尾",
        prompt: "Based on the product image, generate a back or side-profile view of the person. Walking slowly along a forest path or across an open meadow, or glancing back over their shoulder, the garment's full silhouette visible in natural light, hair drifting gently. Wide-angle composition with sky and trees as background, generous negative space, a sense of breathing room.",
        prompt_cn: "基于产品图，生成人物背影或侧影图。在森林小径或草地中央，人物缓步前行或侧身回望，服装在自然光下呈现完整轮廓，发丝自然飘动。广角构图，天空和树木作为背景，留白多，呼吸感强。"
      },
    ],
    video_prompts: {
      seedance: "Japanese mori-style fashion showcase, natural light, outdoor grassy or wooden setting, slow push-and-pull camera with subtle handheld breathing movement, low-saturation warm green and off-white tones, healing atmosphere, soft background blur, natural relaxed expression, gentle and airy feel",
      seedance_cn: "日系森系服装展示，自然光，户外草地/木质场景，镜头缓慢推拉，轻微手持呼吸感，低饱和暖绿+米白色调，治愈氛围，背景虚化，人物表情自然松弛，画面柔和有呼吸感",
      kling_per_frame: [
        { seq: 1, prompt: "Camera slowly pushes in from a distance with subtle handheld sway, creating an organic breathing feel", prompt_cn: "镜头从远处缓慢推近，保持手持微摇的呼吸感" },
        { seq: 2, prompt: "Camera slowly pans across the fabric detail, maintaining macro focus", prompt_cn: "镜头缓慢横移扫过面料细节，保持微距焦点" },
        { seq: 3, prompt: "Camera slowly pushes in from the side, holding a medium shot composition", prompt_cn: "镜头从侧面缓慢推近人物，保持中景构图" },
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
    cost_hint: "分镜图18积分 + 视频约90-210积分（6段拼接，视时长分辨率）",
    storyboards: [
      {
        seq: 1, name: "硬照特写", purpose: "视频开头，定调",
        prompt: "Based on the product image, generate an upper-body close-up in street-style editorial look. Concrete wall or graffiti backdrop, hard side-lighting casting strong shadows, subject staring directly at the camera with a confident, fierce expression, wearing accessories, high-contrast lighting, saturated colors.",
        prompt_cn: "基于产品图，生成潮流硬照风格的上半身特写。城市水泥墙或涂鸦背景，硬光从侧面打入，人物直视镜头，表情自信冷酷，佩戴配饰，高对比光影，色彩饱和度高。"
      },
      {
        seq: 2, name: "全身街拍", purpose: "展示全身穿搭，广角冲击感",
        prompt: "Based on the product image, generate a full-body street-style outfit shot. City street, overpass, or neon-lit scene, subject mid-stride with one foot forward, jacket fluttering in the wind, city lights blurring in the background. Low-angle shot with wide-angle perspective distortion for strong visual impact.",
        prompt_cn: "基于产品图，生成街头全身穿搭图。城市街道或天桥或霓虹灯下，人物行走姿态动态感强，一脚迈出，外套随风微扬，背景是模糊的城市灯光。低角度仰拍，广角透视，强视觉冲击。"
      },
      {
        seq: 3, name: "细节特写", purpose: "快速闪切展示设计细节",
        prompt: "Based on the product image, generate a close-up detail shot of the garment. Focus on prints, logos, zippers, or brim details, artificial studio lighting with metallic reflections, dark background to isolate the subject. Macro perspective, high sharpness.",
        prompt_cn: "基于产品图，生成服装细节特写图。聚焦印花、logo、拉链、帽檐等设计细节，人工打光，金属质感反光，背景暗色突出主体。微距视角，锐度高。"
      },
      {
        seq: 4, name: "动态姿态", purpose: "增强动感，展示服装动态表现",
        prompt: "Based on the product image, generate a dynamic pose shot. Jumping, turning, leaning against a wall, or crouching — classic street poses — with a vivid expression, hair slightly disheveled from movement, fabric creasing naturally with body motion. High-speed shutter freezing the instant, city background blurred.",
        prompt_cn: "基于产品图，生成人物动态姿态图。跳跃、转身、靠墙或蹲坐等街头常见姿态，表情生动，发型因动态微乱，服装随身体扭曲产生褶皱。高速快门凝固瞬间，背景城市模糊。"
      },
      {
        seq: 5, name: "夜景霓虹", purpose: "色彩对比高潮段",
        prompt: "Based on the product image, generate a night scene outfit shot under neon lights. Colorful neon glow from behind or the side creating a strong rim light on the subject, neon color reflections on shadowed areas of the face, predominantly cool tones. Blurred night market or street lights in the background.",
        prompt_cn: "基于产品图，生成夜景霓虹灯下的穿搭图。彩色霓虹灯光从背后或侧面照射，人物轮廓光明显，面部阴影处有霓虹色彩反射，冷色调为主。背景是模糊的夜市或街道灯光。"
      },
      {
        seq: 6, name: "定格结尾", purpose: "视频结尾，定格+文案空间",
        prompt: "Based on the product image, generate a freeze-frame side or back view. Simplified background, spotlight effect, subject perfectly still, garment fully displayed, unified color palette, negative space reserved for text overlay.",
        prompt_cn: "基于产品图，生成人物侧身或背影的定格图。简化背景，聚光灯效果，人物静止，服装完整展示，色调统一，留出版式空间用于加文字。"
      },
    ],
    video_prompts: {
      seedance: "Street-style fashion showcase, fast pace, high-contrast lighting, saturated colors, city street backdrop with neon signs and concrete walls, confident expression, strong dynamics, wide-angle perspective, beat-driven rhythm",
      seedance_cn: "潮流街头服装展示，快节奏，高对比光影，饱和色彩，城市街道背景，霓虹灯和水泥墙，人物自信表情，动态强，广角透视，节奏卡点感",
      kling_per_frame: [
        { seq: 1, prompt: "Fast push-in to face close-up, hard-cut style, high contrast", prompt_cn: "快速推近到面部特写，硬切风格，高对比" },
        { seq: 2, prompt: "Low-angle shot, subject striding toward camera, wide-angle perspective impact", prompt_cn: "低角度仰拍，人物大步走来，广角透视冲击感" },
        { seq: 3, prompt: "Quick flash-cut to detail close-up, slight camera shake for energy", prompt_cn: "快速闪切到细节特写，镜头微晃增加动感" },
        { seq: 4, prompt: "High-speed freeze of dynamic moment with slight slow-motion replay for impact", prompt_cn: "快门凝固动态瞬间后微慢放，增强冲击力" },
        { seq: 5, prompt: "Camera pans across neon lights, color gradient transition", prompt_cn: "镜头横移扫过霓虹灯光，色彩渐变过渡" },
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
    cost_hint: "分镜图9积分 + 视频约70-130积分（视时长分辨率）",
    storyboards: [
      {
        seq: 1, name: "轮廓剪影", purpose: "视频开头，慢推镜头展示轮廓",
        prompt: "Based on the product image, generate a silhouette or full-view showcase against a minimalist solid background (dark gray, off-white, or black). A single strong light source from the side or behind creates a distinct rim light on the garment, the person standing with elegant, restrained posture. Wide aperture shallow depth of field, background fully blurred or solid color.",
        prompt_cn: "基于产品图，生成服装轮廓剪影或全景展示图。极简纯色背景（深灰或米白或黑），单一强光源从侧面或背后打入，人物侧身或正面站立，姿态优雅克制，服装轮廓光明显，面料质感在光下有细微反光。大光圈浅景深，背景完全虚化或纯色。"
      },
      {
        seq: 2, name: "面料光影", purpose: "视频中间，慢推特写展示质感",
        prompt: "Based on the product image, generate a close-up of the fabric under dramatic lighting. Strong side-light or top-light reveals the texture of silk, wool, or lace, creating smooth gradients of highlight and shadow across the fabric surface. Dark or pure black background to emphasize the fabric's natural sheen. Macro or close-up shot, precise focus.",
        prompt_cn: "基于产品图，生成面料在特殊光线下的特写图。强侧光或顶光照射面料，展示丝绸或羊毛或蕾丝等纹理，光影在服装表面形成渐变，高光和阴影层次丰富。背景暗色或纯黑，突出面料本身的光泽感。微距或近景，焦点精确。"
      },
      {
        seq: 3, name: "情绪肖像", purpose: "视频结尾，慢拉镜头，淡出",
        prompt: "Based on the product image, generate an emotional portrait. The person's face turned slightly away, eyes avoiding the camera, expression serene and elevated. Soft, even lighting (butterfly or Rembrandt pattern), garment occupying about 60% of the frame with generous negative space. Unified tonal palette — monochromatic gradient or black-and-white, composition referencing high-end fashion editorial.",
        prompt_cn: "基于产品图，生成人物情绪化肖像图。人物微侧脸，眼神避开镜头，表情淡然高级，光线柔和均匀（蝴蝶光或伦勃朗光），服装在画面中占比约60%，其余是留白空间。色调统一，同色系渐变或黑白，构图参考高端时尚杂志大片。"
      },
    ],
    video_prompts: {
      seedance: "Luxury cinematic fashion showcase, minimalist background, single strong light source, Rembrandt or butterfly lighting, shallow depth of field with wide aperture and blurred background, extremely slow push-and-pull camera, low-saturation monochromatic gradient tones, high-end editorial magazine style, generous negative space, quiet and powerful",
      seedance_cn: "高级质感服装展示，电影感，极简背景，单一强光源，伦勃朗光或蝴蝶光，浅景深大光圈背景虚化，镜头缓慢推拉节奏极慢，低饱和同色系渐变色调，高端时尚杂志风格，留白多，安静有力量感",
      kling_per_frame: [
        { seq: 1, prompt: "Camera slowly pushes in from the silhouette, maintaining an extremely slow pace", prompt_cn: "镜头从剪影轮廓缓慢推近，保持极慢节奏" },
        { seq: 2, prompt: "Camera pans across the fabric light-and-shadow play, maintaining macro focus", prompt_cn: "镜头横移扫过面料光影，保持微距焦点" },
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
    cost_hint: "分镜图12积分 + 视频约45-85积分（视时长分辨率）",
    storyboards: [
      {
        seq: 1, name: "上班场景", purpose: "视频开头，建立场景代入",
        prompt: "Based on the product image, generate a commuter outfit shot in a professional setting. The person walks down an office corridor or café carrying a bag, natural friendly smile, slightly turned toward the camera. Bright, even lighting — office natural light or warm café light — with the background moderately blurred to preserve the workplace atmosphere.",
        prompt_cn: "基于产品图，生成职场通勤场景的穿搭图。人物提着包走在办公室走廊或咖啡厅，自然微笑，表情亲和专业，微侧身看向镜头。光线明亮均匀，办公室自然光或咖啡厅暖光，背景适度虚化，保留职场氛围。"
      },
      {
        seq: 2, name: "正面展示", purpose: "清晰展示服装版型",
        prompt: "Based on the product image, generate a clear front-view showcase of the garment. Solid or minimalist background, even lighting across the clothing, full-body front shot, natural standing pose with arms at sides or in pockets, focus on the overall cut and silhouette. Accurate color reproduction, no heavy filters.",
        prompt_cn: "基于产品图，生成服装正面清晰展示图。纯色或简约背景，光线均匀打在服装上，正面全身照，姿态自然站立，双手自然下垂或插兜，焦点在服装整体剪裁和版型。色彩还原准确，不过度滤镜。"
      },
      {
        seq: 3, name: "搭配细节", purpose: "快速展示设计亮点",
        prompt: "Based on the product image, generate a styling detail shot. Focus on collar, cuffs, waistline, or buttons — key design highlights — with the person in a seated pose or using hand gestures to draw attention. Light concentrated on the detail area, background slightly darkened. Medium close-up, high information density.",
        prompt_cn: "基于产品图，生成穿搭搭配细节图。聚焦领口、袖口、腰线、纽扣等设计亮点，人物坐姿或手部动作配合展示，光线聚焦在细节处，背景适度暗化。近景或中近景，信息密度高。"
      },
      {
        seq: 4, name: "实用展示", purpose: "视频结尾，强化实穿信任感",
        prompt: "Based on the product image, generate a practical wear shot of the person seated or walking. Showing how the garment performs during real movement — not too tight, no excessive wrinkling. Office chair or café seating scenario, natural lighting, relaxed posture, medium shot, strong sense of authenticity.",
        prompt_cn: "基于产品图，生成人物坐下或行走时的穿搭图。展示服装在真实动作下的版型表现，不紧绷、不褶皱过度。办公室椅子或咖啡厅座位场景，光线自然，姿态放松，中景构图，真实感强。"
      },
    ],
    video_prompts: {
      seedance: "Professional commuter fashion showcase, bright and clear, information-first presentation, office or café setting, natural light, steady camera with standard focal length, natural friendly smile, accurate color reproduction, practical outfit display with clear silhouette",
      seedance_cn: "职场通勤服装展示，明亮清晰，信息展示优先，办公室或咖啡厅场景，自然光，平稳镜头标准焦段，人物自然微笑亲和专业感，色彩还原准确，实用穿搭展示，版型清晰",
      kling_per_frame: [
        { seq: 1, prompt: "Camera follows the walking subject, steady lateral movement, medium shot", prompt_cn: "镜头跟随人物行走，平稳移动，保持中景" },
        { seq: 2, prompt: "Fixed front-facing camera, slowly pushing in to show silhouette details", prompt_cn: "镜头固定正面，缓慢推近展示版型细节" },
        { seq: 3, prompt: "Camera pushes in to a detail close-up, focus on collar or cuffs", prompt_cn: "镜头推近到细节特写，焦点在领口或袖口" },
        { seq: 4, prompt: "Camera slowly pulls back from medium shot, revealing the full outfit", prompt_cn: "镜头从中景缓慢拉远，展示整体穿搭效果" },
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
    cost_hint: "分镜图15积分 + 视频约75-175积分（5段拼接，视时长分辨率）",
    storyboards: [
      {
        seq: 1, name: "场景引入", purpose: "视频开头，今天穿什么",
        prompt: "Based on the product image, generate a lifestyle opening scene. The person at home or standing in front of a mirror, expression slightly hesitant or thoughtful, holding a phone or standing before an open wardrobe. Interior natural lighting. Background is a real bedroom or living room, not overly styled.",
        prompt_cn: "基于产品图，生成生活化场景的开场图。人物在家中或镜子前，表情略带犹豫或思考，手持手机或站在衣柜前，光线是室内自然光。背景是真实的卧室或客厅环境，不过度布置。"
      },
      {
        seq: 2, name: "穿上转变", purpose: "情绪转折点",
        prompt: "Based on the product image, generate a transformation shot after putting on the garment. Mirror selfie or friend-photographing scenario, the person's expression shifting from hesitation to a confident smile. Bright lighting — ring light or window natural light — garment prominently displayed, background in front of a mirror or outdoors.",
        prompt_cn: "基于产品图，生成人物穿上服装后的转变图。镜前自拍或朋友拍照场景，人物表情从犹豫变为自信微笑。光线明亮，自拍补光灯或窗边自然光，服装在画面中突出展示，背景是镜前或户外。"
      },
      {
        seq: 3, name: "场景使用", purpose: "展示实穿场景",
        prompt: "Based on the product image, generate the garment worn in its target scenario. Commuter wear: walking down the street or entering an office. Date outfit: café or restaurant. Activewear: gym or park. Lighting shifts naturally with the setting, authentic and unforced.",
        prompt_cn: "基于产品图，生成服装在目标场景中的使用图。通勤装：走在街上或进办公室；约会装：咖啡厅或餐厅；运动装：健身房或公园。光线跟随场景变化，真实自然。"
      },
      {
        seq: 4, name: "细节互动", purpose: "增强真实感和代入感",
        prompt: "Based on the product image, generate a detail shot of the person interacting with the garment. Adjusting a collar, buttoning up, pulling a zipper — a captured action moment. Hands clearly in motion, focused expression. Medium close-up, focus on the action and clothing detail.",
        prompt_cn: "基于产品图，生成人物与服装互动的细节图。整理衣领、系扣子、拉拉链等动作瞬间，手部动作清晰，表情专注自然。近景或中近景，焦点在动作和服装细节。"
      },
      {
        seq: 5, name: "结尾展示", purpose: "定格+购买引导",
        prompt: "Based on the product image, generate a confident final showcase shot. Attractive background (rooftop, street, or natural setting), person facing the camera or slightly turned, smiling naturally, garment fully displayed, beautiful lighting. Composition leaves negative space for text overlay.",
        prompt_cn: "基于产品图，生成人物自信展示的结尾图。在好看的背景前（天台或街道或自然场景），人物正面或微侧，微笑看镜头或自然姿态，服装完整展示，光线美好。构图留出版式空间用于加文案。"
      },
    ],
    video_prompts: {
      seedance: "Narrative fashion showcase, lifestyle setting, authentic feel, natural light, true-to-life colors, emotional arc from hesitation to confidence, handheld shooting feel, storytelling rhythm",
      seedance_cn: "剧情式服装展示，生活化场景，真实感，自然光，真实色彩，人物有情绪变化，手持拍摄感，叙事节奏，从犹豫到自信的情绪弧线",
      kling_per_frame: [
        { seq: 1, prompt: "Handheld camera with subtle shake, simulating an authentic phone-shot perspective, indoor natural light", prompt_cn: "手持镜头轻微晃动，模拟真实手机拍摄视角，室内自然光" },
        { seq: 2, prompt: "Camera slowly pushes from the hesitant expression to the confident smile, emotional turning point", prompt_cn: "镜头从犹豫表情缓慢推到自信微笑，情绪转折点" },
        { seq: 3, prompt: "Camera follows the subject into the scene, medium shot, natural transition", prompt_cn: "镜头跟随人物走进场景，保持中景，自然过渡" },
        { seq: 4, prompt: "Camera pushes in to a hand-action close-up, focus on clothing detail", prompt_cn: "镜头推近到手部动作特写，焦点在服装细节" },
        { seq: 5, prompt: "Camera slowly pulls back, subject standing confident, leaving space for text overlay", prompt_cn: "镜头缓慢拉远，人物自信站定，留出版式空间" },
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

/**
 * 计算预估积分
 * 公式：总分镜积分 + 总视频积分
 * 分镜积分 = storyboard_count × 3
 * 视频积分（Seedance）= 查 video_pricing 表
 * 视频积分（Kling）= 单段积分 × storyboard_count
 */
export function calculateEstimatedCredits(
  styleId: string,
  videoParams: VideoParams,
): number {
  const style = getStyleTemplate(styleId);
  if (!style) return 0;

  // 分镜积分
  const storyboardCredits = videoParams.storyboard_count * 3;

  // 视频积分
  let videoCredits = 0;
  if (videoParams.model === "seedance-2.0") {
    // Seedance：1段视频
    const pricing: Record<string, number> = {
      "720p-5": 45, "720p-8": 60, "720p-10": 75, "720p-15": 95,
      "1080p-5": 70, "1080p-8": 90, "1080p-10": 110, "1080p-15": 140,
    };
    videoCredits = pricing[`${videoParams.resolution}-${videoParams.duration}`] ?? 75;
  } else {
    // Kling：分镜数段视频，每段单独计费
    const perSegment: Record<string, number> = {
      "720p-5": 18, "720p-8": 24, "720p-10": 30, "720p-15": 40,
      "1080p-5": 28, "1080p-8": 38, "1080p-10": 48, "1080p-15": 60,
    };
    const segCredits = perSegment[`${videoParams.resolution}-${videoParams.duration}`] ?? 30;
    videoCredits = segCredits * videoParams.storyboard_count;
  }

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
