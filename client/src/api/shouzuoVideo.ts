import apiClient from './client';
import type { ApiResponse } from './auth';
import type {
  ShouzuoSession,
  AiRecognitionResult,
  StyleTemplate,
  VideoParams,
  Storyboard,
  ShouzuoVideoResult,
  CopywritingResult,
  ProductInfo,
  StartSessionParams,
  ConfirmVideoParams,
  GenerateStoryboardParams,
  GenerateVideoParams,
  GenerateCopywritingParams,
} from '@/types/shouzuo';

// ============================================================
// Step 1: 上传产品图 → 创建会话
// ============================================================

/** 上传图片到服务器 */
export async function uploadImages(files: File[]): Promise<string[]> {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append('images', file);
  });

  const res = await apiClient.post<ApiResponse<{ urls: string[] }>>('/upload/images', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  });
  return res.data.data.urls;
}

/** 创建种草视频会话 */
export async function createSession(params: StartSessionParams): Promise<ShouzuoSession> {
  const res = await apiClient.post<ApiResponse<ShouzuoSession>>('/shouzuo/session', params);
  return res.data.data;
}

// ============================================================
// Step 2: AI 识别产品图 + 风格推荐
// ============================================================

/** 获取图片分析结果 + 风格推荐 */
export async function analyzeImages(sessionId: string): Promise<AiRecognitionResult> {
  const res = await apiClient.get<ApiResponse<AiRecognitionResult>>(`/shouzuo/session/${sessionId}/analyze`, {
    timeout: 30000,
  });
  return res.data.data;
}

/** 保存 AI 识别结果（用户编辑后） */
export async function saveAiRecognition(
  sessionId: string,
  aiRecognition: AiRecognitionResult,
  userEditedClothing?: AiRecognitionResult['clothing_type'] & { style_tags: string[] },
): Promise<void> {
  await apiClient.post<ApiResponse<void>>('/shouzuo/ai-recognition/save', {
    sessionId,
    aiRecognition,
    userEditedClothing,
  });
}

// ============================================================
// Step 3: 确认视频参数 + 预扣积分
// ============================================================

/** 确认视频参数 + 预扣积分 */
export async function confirmVideoParams(sessionId: string, params: VideoParams): Promise<void> {
  await apiClient.post<ApiResponse<void>>('/shouzuo/video/confirm-params', {
    sessionId,
    videoParams: params,
  });
}

// ============================================================
// Step 4: 生成故事板
// ============================================================

/** 生成故事板 */
export async function generateStoryboard(params: GenerateStoryboardParams): Promise<Storyboard> {
  const res = await apiClient.post<ApiResponse<Storyboard>>('/shouzuo/storyboard/generate', params, {
    timeout: 600000, // 10分钟超时
  });
  return res.data.data;
}

/** 重新生成故事板 */
export async function regenerateStoryboard(params: GenerateStoryboardParams & { feedback?: string }): Promise<Storyboard> {
  const res = await apiClient.post<ApiResponse<Storyboard>>('/shouzuo/storyboard/regenerate', params, {
    timeout: 600000,
  });
  return res.data.data;
}

// ============================================================
// Step 5: 生成视频
// ============================================================

/** 生成视频 */
export async function generateVideo(params: GenerateVideoParams): Promise<ShouzuoVideoResult> {
  const res = await apiClient.post<ApiResponse<ShouzuoVideoResult>>('/shouzuo/video/generate', params, {
    timeout: 600000,
  });
  return res.data.data;
}

/** 查询视频生成状态 */
export async function getVideoStatus(sessionId: string): Promise<ShouzuoVideoResult> {
  const res = await apiClient.get<ApiResponse<ShouzuoVideoResult>>(`/shouzuo/session/${sessionId}/video`, {
    timeout: 600000,
  });
  return res.data.data;
}

// ============================================================
// Step 6: AI 文案生成
// ============================================================

/** 生成 AI 文案 */
export async function generateCopywriting(params: GenerateCopywritingParams): Promise<CopywritingResult> {
  const res = await apiClient.post<ApiResponse<CopywritingResult>>('/shouzuo/copywriting/generate', params, {
    timeout: 120000,
  });
  return res.data.data;
}

// ============================================================
// 通用 API
// ============================================================

/** 获取可用风格模板列表 */
export async function getStyleTemplates(): Promise<StyleTemplate[]> {
  const res = await apiClient.get<ApiResponse<StyleTemplate[]>>('/shouzuo/styles');
  return res.data.data;
}

/** 获取会话状态 */
export async function getSession(sessionId: string): Promise<ShouzuoSession> {
  const res = await apiClient.get<ApiResponse<ShouzuoSession>>(`/shouzuo/session/${sessionId}`);
  return res.data.data;
}

/** 获取用户的历史会话列表 */
export async function getSessionHistory(params?: { page?: number; limit?: number }): Promise<{ items: ShouzuoSession[]; total: number }> {
  const res = await apiClient.get<ApiResponse<{ items: ShouzuoSession[]; total: number }>>('/shouzuo/sessions', { params });
  return res.data.data;
}

/** AI 生成产品描述 */
export async function generateProductDescription(imageUrls: string[]): Promise<{ productName: string; productDescription: string; sellingPoints: string[] }> {
  const res = await apiClient.post<ApiResponse<{ productName: string; productDescription: string; sellingPoints: string[] }>>(
    '/shouzuo/product-description/generate',
    { imageUrls },
    { timeout: 60000 },
  );
  return res.data.data;
}
