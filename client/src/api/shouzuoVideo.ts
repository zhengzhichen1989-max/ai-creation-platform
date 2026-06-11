import apiClient from './client';
import type { ApiResponse } from './auth';
import type {
  ShouzuoSession,
  ImageAnalysis,
  StyleTemplate,
  Storyboard,
  ShouzuoVideoResult,
  CopywritingItem,
  ProductDescriptionResult,
  StartSessionParams,
  SelectStyleParams,
  GenerateStoryboardParams,
  RegenerateStoryboardParams,
  GenerateVideoParams,
  GenerateCopywritingParams,
} from '@/types/shouzuo';

/** Step 1+2: 上传图片并开始分析 → 创建会话 + 返回风格推荐 */
export async function startSession(params: StartSessionParams): Promise<ShouzuoSession> {
  const res = await apiClient.post<ApiResponse<ShouzuoSession>>('/shouzuo/session', params);
  return res.data.data;
}

/** Step 2: 获取图片分析结果 + 风格推荐（GPT-4o Vision，约5-15秒） */
export async function analyzeImages(sessionId: string): Promise<ImageAnalysis> {
  const res = await apiClient.get<ApiResponse<ImageAnalysis>>(`/shouzuo/session/${sessionId}/analyze`, {
    timeout: 30000, // 30秒超时（GPT-4o Vision 首次调用可能较慢）
  });
  return res.data.data;
}

/** Step 3: 选择风格模板 */
export async function selectStyle(params: SelectStyleParams): Promise<StyleTemplate> {
  const res = await apiClient.post<ApiResponse<StyleTemplate>>('/shouzuo/style/select', params);
  return res.data.data;
}

/** 获取可用风格模板列表 */
export async function getStyleTemplates(): Promise<StyleTemplate[]> {
  const res = await apiClient.get<ApiResponse<StyleTemplate[]>>('/shouzuo/styles');
  return res.data.data;
}

/** Step 4: 生成故事板（GPT-Image-2，每帧30-60秒，8帧最多约8-10分钟） */
export async function generateStoryboard(params: GenerateStoryboardParams): Promise<Storyboard> {
  const res = await apiClient.post<ApiResponse<Storyboard>>('/shouzuo/storyboard/generate', params, {
    timeout: 600000, // 10分钟超时（8帧×60秒+重试=最多10分钟）
  });
  return res.data.data;
}

/** Step 4 alt: 重新生成故事板 */
export async function regenerateStoryboard(params: RegenerateStoryboardParams): Promise<Storyboard> {
  const res = await apiClient.post<ApiResponse<Storyboard>>('/shouzuo/storyboard/regenerate', params, {
    timeout: 600000, // 10分钟超时
  });
  return res.data.data;
}

/** Step 4 alt: 重新生成单个分镜帧 */
export async function regenerateSingleFrame(params: {
  sessionId: string;
  styleId: string;
  styleName: string;
  frameIndex: number;
  feedback?: string;
}): Promise<Storyboard> {
  const res = await apiClient.post<ApiResponse<Storyboard>>('/shouzuo/storyboard/frame/regenerate', params, {
    timeout: 120000, // 2分钟超时（单帧约30秒）
  });
  return res.data.data;
}

/** 获取故事板状态/结果 */
export async function getStoryboard(sessionId: string): Promise<Storyboard> {
  const res = await apiClient.get<ApiResponse<Storyboard>>(`/shouzuo/session/${sessionId}/storyboard`);
  return res.data.data;
}

/** Step 6: 提交视频生成任务（DMXAPI处理12秒视频+首帧上传可能需数分钟） */
export async function generateShouzuoVideo(params: GenerateVideoParams): Promise<ShouzuoVideoResult> {
  const res = await apiClient.post<ApiResponse<ShouzuoVideoResult>>('/shouzuo/video/generate', params, {
    timeout: 600000, // 10分钟超时（匹配故事板，确保12秒视频+首帧上传不超时）
  });
  return res.data.data;
}

/** 查询视频生成任务状态 */
export async function getVideoTask(sessionId: string): Promise<ShouzuoVideoResult> {
  const res = await apiClient.get<ApiResponse<ShouzuoVideoResult>>(`/shouzuo/session/${sessionId}/video`, {
    timeout: 600000, // 10分钟超时（DMXAPI状态查询有时也慢）
  });
  return res.data.data;
}

/** Step 7: 生成文案（DeepSeek V4，约5-60秒，长文案可能更慢） */
export async function generateCopywriting(params: GenerateCopywritingParams): Promise<CopywritingItem[]> {
  const res = await apiClient.post<ApiResponse<CopywritingItem[]>>('/shouzuo/copywriting/generate', params, {
    timeout: 120000, // 2分钟超时（DeepSeek 处理长 prompt 可能需要 30-60 秒）
  });
  return res.data.data;
}

/** 获取会话状态 */
export async function getSession(sessionId: string): Promise<ShouzuoSession> {
  const res = await apiClient.get<ApiResponse<ShouzuoSession>>(`/shouzuo/session/${sessionId}`);
  return res.data.data;
}

/** AI 生成产品描述（GPT-4o Vision，约5-15秒） */
export async function generateProductDescription(imageUrls: string[]): Promise<ProductDescriptionResult> {
  const res = await apiClient.post<ApiResponse<ProductDescriptionResult>>(
    '/shouzuo/product-description/generate',
    { imageUrls },
    { timeout: 60000 },
  );
  return res.data.data;
}

/** 获取用户的历史种草视频会话列表 */
export async function getSessionHistory(params?: { page?: number; limit?: number }) {
  const res = await apiClient.get<ApiResponse<{ items: ShouzuoSession[]; total: number }>>('/shouzuo/sessions', { params });
  return res.data.data;
}
