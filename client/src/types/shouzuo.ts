/** 种草视频工作流步骤（6步新版） */
export type ShouzuoStep =
  | 'upload'         // Step 1: 上传产品图
  | 'ai_recognize'   // Step 2: AI 识别产品图 + 风格推荐
  | 'video_params'    // Step 3: 确认视频参数
  | 'storyboard'      // Step 4: 生成故事板
  | 'video'           // Step 5: 生成视频
  | 'copywriting';    // Step 6: AI 文案生成 + 导出

/** 工作流步骤定义（带标签和序号） */
export const SHOUZUO_STEPS: { key: ShouzuoStep; label: string; number: number }[] = [
  { key: 'upload', label: '上传产品图', number: 1 },
  { key: 'ai_recognize', label: 'AI识别', number: 2 },
  { key: 'video_params', label: '视频参数', number: 3 },
  { key: 'storyboard', label: '故事板', number: 4 },
  { key: 'video', label: '生成视频', number: 5 },
  { key: 'copywriting', label: 'AI文案', number: 6 },
];

// ============================================================
// 风格模板（5款新风格）
// ============================================================

/** 风格模板 */
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
  recommended_model: string;
  fallback_model: string;
  default_resolution: string;
  default_storyboard_count: number;
  cost_hint: string;
}

/** 风格推荐结果 */
export interface StyleRecommendation {
  style_id: string;
  confidence: number; // 0-1
  reason: string;
}

// ============================================================
// AI 识别结果
// ============================================================

/** 服装信息 */
export interface ClothingInfo {
  clothing_type: string;
  material: string;
  season: string[];
  main_color: string;
  style_tags: string[];
  edited?: boolean; // 用户是否编辑过
}

/** AI 识别结果 */
export interface AiRecognitionResult {
  clothing_type: string;
  material: string;
  season: string[];
  main_color: string;
  style_tags: string[];
  recommendations: StyleRecommendation[];
  raw_json?: string;
  analyzedByAI?: boolean;
  aiError?: string;
}

// ============================================================
// 视频参数
// ============================================================

/** 视频模型 */
export const VIDEO_MODELS = [
  { id: 'seedance-2.0', name: 'Seedance 2.0', description: '即梦2.0 — 单段模式，质量更好，支持1080p', icon: '🎬' },
  { id: 'kling-v3', name: 'Kling 3.0', description: '可灵3.0 — 多段拼接，画面细腻，支持1080p', icon: '🎨' },
] as const;

export type VideoModelId = typeof VIDEO_MODELS[number]['id'];

/** 视频参数 */
export interface VideoParams {
  model: VideoModelId;
  duration: number;       // 5-15秒
  resolution: '720p' | '1080p';
  storyboard_count: number; // 1-6
  kling_duration_splits?: number[]; // 仅 Kling 模式
}

// ============================================================
// 故事板
// ============================================================

/** 故事板分镜帧 */
export interface StoryboardFrame {
  seq: number;           // 序号 1-6
  name: string;           // 帧名称
  prompt: string;         // 英文提示词（传入模型）
  prompt_cn: string;     // 中文说明（仅展示）
  imageUrl?: string;     // 生成的帧图片URL
  status: 'pending' | 'generating' | 'completed' | 'failed';
  retry_count: number;
}

/** 故事板 */
export interface Storyboard {
  frames: StoryboardFrame[];
  totalFrames: number;
  style_id: string;
  generatedAt: string;
}

// ============================================================
// 视频生成
// ============================================================

/** 视频段（Kling 多段模式） */
export interface VideoSegment {
  seq: number;
  task_id: string;
  video_url?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  duration: number;
  error?: string;
}

/** 种草视频生成结果 */
export interface ShouzuoVideoResult {
  taskId: string;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  duration: number;
  progress: number;
  errorMessage?: string;
  /** Kling 多段拼接：总段数和已完成数 */
  segmentCount?: number;
  segmentCompleted?: number;
}

// ============================================================
// 文案
// ============================================================

/** AI 文案结果 */
export interface CopywritingResult {
  title: string;
  content: string;
  tags: string[];
}

/** 文案项（前端展示用） */
export interface CopywritingItem {
  index: number;
  title: string;
  body: string;
  hashtags: string[];
  platform: 'xiaohongshu' | 'douyin' | 'instagram';
  selected: boolean;
}

// ============================================================
// 会话状态
// ============================================================

/** 种草视频会话状态 */
export interface ShouzuoSession {
  sessionId: string;
  currentStep: ShouzuoStep;
  uploadedImages: string[];
  aiRecognition?: AiRecognitionResult;
  selectedStyle?: StyleTemplate;
  videoParams?: VideoParams;
  storyboard?: Storyboard;
  videoResult?: ShouzuoVideoResult;
  copywritingItems: CopywritingItem[];
  preDeductedCredits: number;
  createdAt: string;
}

// ============================================================
// API 请求参数
// ============================================================

/** 产品信息 */
export interface ProductInfo {
  name: string;
  description: string;
  sellingPoints: string[];
  price?: string;
  targetAudience?: string;
}

/** 开始会话参数 */
export interface StartSessionParams {
  images: string[];
  productInfo?: ProductInfo;
}

/** 确认视频参数参数 */
export interface ConfirmVideoParams {
  sessionId: string;
  videoParams: VideoParams;
}

/** 生成故事板参数 */
export interface GenerateStoryboardParams {
  sessionId: string;
  storyboardCount: number;
  userEditedClothing?: ClothingInfo;
}

/** 生成视频参数 */
export interface GenerateVideoParams {
  sessionId: string;
  model: VideoModelId;
  resolution: '720p' | '1080p';
  storyboardFrames: {
    seq: number;
    name: string;
    prompt: string;
    imageUrl: string;
  }[];
  kling_duration_splits?: number[];
}

/** 生成文案参数 */
export interface GenerateCopywritingParams {
  sessionId: string;
  userEditedClothing?: ClothingInfo;
}
