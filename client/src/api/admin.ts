import apiClient from './client';
import type { ApiResponse } from './auth';

// ---- 积分套餐类型 ----

export interface AdminCreditPackage {
  id: string;
  name: string;
  credits: number;
  price_cents: number;
  unit_label: string | null;
  enabled: number;
  sort_order: number;
  created_at: string;
}

export interface AdminPackageCreatePayload {
  id: string;
  name: string;
  credits: number;
  price_cents: number;
  unit_label?: string;
  enabled?: number;
  sort_order?: number;
}

export interface AdminPackageUpdatePayload {
  name?: string;
  credits?: number;
  price_cents?: number;
  unit_label?: string;
  enabled?: number;
  sort_order?: number;
}

// ---- AI模型类型 ----

export interface AdminAiModel {
  id: string;
  name: string;
  type: string;
  category: string;
  cost_credits: number;
  adapter_class: string;
  enabled: number;
  config: string | null;
  sort_order: number;
  duration_options: string | null;
  duration_pricing: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminModelCreatePayload {
  id: string;
  name: string;
  type: 'image' | 'video' | 'text';
  category: 'starter' | 'standard' | 'advanced' | 'flagship';
  cost_credits: number;
  adapter_class: string;
  enabled?: number;
  config?: string;
  sort_order?: number;
  duration_options?: string | null;
  duration_pricing?: string | null;
}

export interface AdminModelUpdatePayload {
  name?: string;
  type?: 'image' | 'video' | 'text';
  category?: 'starter' | 'standard' | 'advanced' | 'flagship';
  cost_credits?: number;
  adapter_class?: string;
  enabled?: number;
  config?: string;
  sort_order?: number;
  duration_options?: string | null;
  duration_pricing?: string | null;
}

// ---- 积分套餐 API ----

/** 获取所有积分套餐（含已下架） */
export async function adminListPackages(): Promise<AdminCreditPackage[]> {
  const res = await apiClient.get<ApiResponse<AdminCreditPackage[]>>('/admin/packages');
  return res.data.data;
}

/** 新增积分套餐 */
export async function adminCreatePackage(payload: AdminPackageCreatePayload): Promise<AdminCreditPackage> {
  const res = await apiClient.post<ApiResponse<AdminCreditPackage>>('/admin/packages', payload);
  return res.data.data;
}

/** 更新积分套餐 */
export async function adminUpdatePackage(id: string, payload: AdminPackageUpdatePayload): Promise<AdminCreditPackage> {
  const res = await apiClient.put<ApiResponse<AdminCreditPackage>>(`/admin/packages/${id}`, payload);
  return res.data.data;
}

/** 下架积分套餐（软删除） */
export async function adminDeletePackage(id: string): Promise<void> {
  await apiClient.delete(`/admin/packages/${id}`);
}

// ---- AI模型 API ----

/** 获取所有AI模型（含已下架） */
export async function adminListModels(): Promise<AdminAiModel[]> {
  const res = await apiClient.get<ApiResponse<AdminAiModel[]>>('/admin/models');
  return res.data.data;
}

/** 新增AI模型 */
export async function adminCreateModel(payload: AdminModelCreatePayload): Promise<AdminAiModel> {
  const res = await apiClient.post<ApiResponse<AdminAiModel>>('/admin/models', payload);
  return res.data.data;
}

/** 更新AI模型 */
export async function adminUpdateModel(id: string, payload: AdminModelUpdatePayload): Promise<AdminAiModel> {
  const res = await apiClient.put<ApiResponse<AdminAiModel>>(`/admin/models/${id}`, payload);
  return res.data.data;
}

/** 下架AI模型（软删除） */
export async function adminDeleteModel(id: string): Promise<void> {
  await apiClient.delete(`/admin/models/${id}`);
}
