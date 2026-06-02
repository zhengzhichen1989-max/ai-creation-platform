import apiClient from './client';
import type { ApiResponse } from './auth';
import type { TaskType } from './tasks';

export interface GenerationItem {
  id: string;
  modelId: string;
  modelName: string;
  type: TaskType;
  prompt: string;
  resultUrl: string | null;
  resultThumbnail: string | null;
  costCredits: number;
  status: string;
  expiresAt: string | null;
  createdAt: string;
}

export interface GenerationListResult {
  items: GenerationItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface GenerationListParams {
  type?: TaskType;
  modelId?: string;
  page?: number;
  pageSize?: number;
}

/** List generation history */
export async function listGenerations(params?: GenerationListParams): Promise<GenerationListResult> {
  const res = await apiClient.get<ApiResponse<GenerationListResult>>(
    '/generations',
    { params },
  );
  return res.data.data;
}

/** Get a single generation detail */
export async function getGeneration(taskId: string): Promise<GenerationItem> {
  const res = await apiClient.get<ApiResponse<GenerationItem>>(`/generations/${taskId}`);
  return res.data.data;
}
