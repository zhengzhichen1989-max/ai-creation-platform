import apiClient from './client';
import type { ApiResponse } from './auth';

export interface AIModel {
  id: string;
  name: string;
  type: 'image' | 'video' | 'text';
  category: 'starter' | 'standard' | 'advanced' | 'flagship';
  costCredits: number;
  config: string | null;
  durationOptions: number[] | null;
  durationPricing: Record<string, number> | null;
  resolutionOptions: string[] | null;
  resolutionPricing: Record<string, number | Record<string, number>> | null;
}

/** List all available models, optionally filtered by type */
export async function listModels(type?: 'image' | 'video' | 'text'): Promise<AIModel[]> {
  const params: Record<string, string> = {};
  if (type) params.type = type;
  const res = await apiClient.get<ApiResponse<AIModel[]>>('/models', { params });
  return res.data.data;
}

/** Get a single model by ID */
export async function getModel(modelId: string): Promise<AIModel> {
  const res = await apiClient.get<ApiResponse<AIModel>>(`/models/${modelId}`);
  return res.data.data;
}
