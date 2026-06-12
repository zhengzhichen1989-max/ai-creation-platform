/** 种草视频工作流步骤 */
export type ShouzuoStep =
  | 'upload'        // Step 1: 上传产品图
  | 'analyze'       // Step 2: 图片理解 + 风格推荐
  | 'select_style'  // Step 3: 用户选择风格模板
  | 'storyboard'    // Step 4: 生成故事板 (GPT-Image-2)
  | 'confirm_board' // Step 5: 用户确认故事板
  | 'generate'      // Step 6: 生成种草视频
  | 'copywriting'   // Step 7: AI文案生成
  | 'download';     // Step 8: 用户挑选 + 一键下载

/** 工作流步骤定义（带标签和序号） */
export const SHOUZUO_STEPS: { key: ShouzuoStep; label: string; number: number }[] = [
  { key: 'upload', label: '上传产品图', number: 1 },
  { key: 'analyze', label: '风格推荐', number: 2 },
  { key: 'select_style', label: '选择风格', number: 3 },
  { key: 'storyboard', label: '故事板', number: 4 },
  { key: 'confirm_board', label: '确认分镜', number: 5 },
  { key: 'generate', label: '生成视频', number: 6 },
  { key: 'copywriting', label: 'AI文案', number: 7 },
  { key: 'download', label: '下载', number: 8 },
];

/** 视频生成模型 */
export const VIDEO_MODELS = [
  { id: 'kling-v3', name: 'Kling 3.0', description: '可灵3.0 — 画面细腻，动作自然，支持1080p/720p，适合高品质带货视频', icon: '🎬' },
  { id: 'seedance-2-0', name: 'Seedance 2.0', description: '即梦2.0 标准版 — 质量更好，支持720p', icon: '🎨' },
  { id: 'seedance-2-0-fast', name: 'Seedance 2.0 快速', description: '即梦2.0 快速版 — 生成更快，适合快速出片和测试', icon: '⚡' },
] as const;

export type VideoModelId = typeof VIDEO_MODELS[number]['id'];

/** 风格模板 */
export interface StyleTemplate {
  id: string;
  name: string;         // 森系 / 日系 / 复古 / 极简 / 氛围感
  description: string;
  promptPrefix: string; // 注入到prompt的样式描述
}

/** 图片分析结果 */
export interface ImageAnalysis {
  category: string;       // 品类（服装/饰品/家居/食品...）
  colors: string[];       // 主色调
  materials: string[];    // 材质
  style: string;          // 识别到的风格
  styleReason?: string;   // AI 推荐该风格的理由
  recommendedStyles: StyleTemplate[]; // 全部 5 个风格模板
  analyzedByAI?: boolean; // 是否由 AI 真实分析
  aiError?: string;       // AI 分析失败时的错误信息（不阻断流程）
}

/** 故事板分镜帧 */
export interface StoryboardFrame {
  index: number;         // 帧序号 1-4（新方案）
  description: string;   // 分镜描述（中文）
  imageUrl: string;      // 生成的帧图片URL
  prompt: string;        // 生成该帧的prompt
}

/** 故事板 */
export interface Storyboard {
  frames: StoryboardFrame[];   // 4-8个分镜帧
  totalFrames: number;
  style: string;               // 使用的风格
  generatedAt: string;         // 生成时间
}

/** 种草视频生成结果 */
export interface ShouzuoVideoResult {
  taskId: string;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  duration: number;     // 视频时长(秒)
  progress: number;     // 0-100
  errorMessage?: string;
}

/** AI文案 */
export interface CopywritingItem {
  index: number;
  title: string;        // 标题
  body: string;         // 正文
  hashtags: string[];   // 话题标签
  platform: 'xiaohongshu' | 'douyin' | 'instagram';
  selected: boolean;    // 用户是否选中
}

/** 种草视频会话状态 */
export interface ShouzuoSession {
  sessionId: string;
  currentStep: ShouzuoStep;
  uploadedImages: string[];     // 上传的产品图URL列表
  selectedStyle?: StyleTemplate;
  storyboard?: Storyboard;
  videoResult?: ShouzuoVideoResult;
  copywritingItems: CopywritingItem[];
  createdAt: string;
}

/** 产品信息（用于故事板生成和视频生成） */
export interface ProductInfo {
  name: string;            // 产品名称
  description: string;     // 产品描述/基本介绍
  sellingPoints: string[]; // 核心卖点（最多5条）
  price?: string;          // 价格（可选）
  targetAudience?: string; // 目标人群（可选）
}

/** AI生成的产品描述结果 */
export interface ProductDescriptionResult {
  productName: string;
  productDescription: string;
  sellingPoints: string[];
}

/** API请求参数 */
export interface StartSessionParams {
  images: string[];     // 上传的图片URL列表
  productInfo?: ProductInfo; // 产品信息（可选）
}

export interface SelectStyleParams {
  sessionId: string;
  styleId: string;
}

export interface GenerateStoryboardParams {
  sessionId: string;
  styleId: string;
  styleName: string;
  frameCount: number;   // 4-8
  productDescription?: string; // 用户补充的产品描述
}

export interface RegenerateStoryboardParams {
  sessionId: string;
  styleId: string;
  styleName: string;
  frameCount: number;
  feedback?: string;    // 用户对上一版故事板的反馈
}

export interface GenerateVideoParams {
  sessionId: string;
  storyboardFrames: StoryboardFrame[];
  styleName: string;
  modelId: string;       // kling-v3 | seedance-2-0 | seedance-2-0-fast
  duration?: number;     // 5-15秒
  resolution?: string;    // 视频比例："9:16" | "16:9" | "1:1" | "3:4" | "4:3" | "2:1" | "1:2"
  resolutionQuality?: string;  // 分辨率品质："720p" | "1080p"
  firstFrameIndex?: number; // 用户选择的首帧索引（默认0）
  lastFrameIndex?: number;  // 用户选择的尾帧索引（默认最后一帧）
}

export interface GenerateCopywritingParams {
  sessionId: string;
  videoUrl: string;
  styleName: string;
  productDescription?: string;
}
