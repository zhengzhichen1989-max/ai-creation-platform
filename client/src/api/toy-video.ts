import apiClient from './client';
import type { ApiResponse } from './auth';

/** 获取支持的模板列表 */
export function getToyTemplates(): Promise<ApiResponse<any>> {
  return apiClient.get('/api/v1/toy-video/templates');
}

/** 获取支持的语言列表 */
export function getToyLanguages(): Promise<ApiResponse<any>> {
  return apiClient.get('/api/v1/toy-video/languages');
}

/** 获取支持的尺寸列表 */
export function getToySizes(): Promise<ApiResponse<any>> {
  return apiClient.get('/api/v1/toy-video/sizes');
}

/** 分析产品图片 */
export function analyzeToyImage(imageUrl: string): Promise<ApiResponse<any>> {
  return apiClient.post('/api/v1/toy-video/analyze-image', { imageUrl });
}

/** 生成故事板（分镜脚本） */
export function generateToyStoryboard(data: {
  templateId: string;
  productInfo: any;
  language: string;
}): Promise<ApiResponse<any>> {
  return apiClient.post('/api/v1/toy-video/generate-storyboard', data);
}

/** 创建视频生成任务 */
export function createToyVideoTask(data: {
  templateId: string;
  language: string;
  size: string;
  productInfo: any;
  storyboard: any;
}): Promise<ApiResponse<any>> {
  return apiClient.post('/api/v1/toy-video/create-task', data);
}

/** 获取任务状态 */
export function getToyTask(taskId: string): Promise<ApiResponse<any>> {
  return apiClient.get(`/api/v1/toy-video/task/${taskId}`);
}

/** 获取用户的任务列表 */
export function getToyTasks(): Promise<ApiResponse<any>> {
  return apiClient.get('/api/v1/toy-video/tasks');
}
