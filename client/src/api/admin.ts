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

// ---- 用户管理类型 ----

export interface AdminUserListItem {
  id: number;
  email: string;
  nickname: string;
  avatarUrl: string | null;
  role: string;
  status: string;
  creditBalance: number;
  createdAt: string;
}

export interface AdminUserDetail {
  id: number;
  email: string;
  nickname: string;
  avatarUrl: string | null;
  role: string;
  status: string;
  securityQuestion: string | null;
  creditBalance: number;
  creditVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminOperationLog {
  id: number;
  adminId: number;
  adminEmail: string;
  targetUserId: number | null;
  action: string;
  detail: string | null;
  createdAt: string;
}

export interface CreditTransactionInfo {
  id: number;
  userId: number;
  type: string;
  amount: number;
  balanceAfter: number;
  referenceId: string | null;
  description: string | null;
  createdAt: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface BatchTopupResult {
  successCount: number;
  failCount: number;
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

// ---- 用户管理 API ----

/** 获取用户列表（分页/搜索/筛选） */
export async function adminListUsers(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  role?: string;
}): Promise<PaginatedResult<AdminUserListItem>> {
  const res = await apiClient.get<ApiResponse<PaginatedResult<AdminUserListItem>>>('/admin/users', { params });
  return res.data.data;
}

/** 获取用户详情 */
export async function adminGetUser(id: number): Promise<AdminUserDetail> {
  const res = await apiClient.get<ApiResponse<AdminUserDetail>>(`/admin/users/${id}`);
  return res.data.data;
}

/** 手动充值积分 */
export async function adminCreditTopup(id: number, amount: number, description: string): Promise<CreditTransactionInfo> {
  const res = await apiClient.post<ApiResponse<CreditTransactionInfo>>(`/admin/users/${id}/credit-topup`, { amount, description });
  return res.data.data;
}

/** 生成密码重置链接 */
export async function adminResetPassword(id: number): Promise<{ token: string; resetUrl: string }> {
  const res = await apiClient.post<ApiResponse<{ token: string; resetUrl: string }>>(`/admin/users/${id}/reset-password`);
  return res.data.data;
}

/** 获取用户积分流水 */
export async function adminGetTransactions(id: number, params: {
  page?: number;
  pageSize?: number;
  type?: string;
}): Promise<PaginatedResult<CreditTransactionInfo>> {
  const res = await apiClient.get<ApiResponse<PaginatedResult<CreditTransactionInfo>>>(`/admin/users/${id}/transactions`, { params });
  return res.data.data;
}

/** 更新用户状态（禁用/启用） */
export async function adminUpdateUserStatus(id: number, status: string): Promise<AdminUserDetail> {
  const res = await apiClient.put<ApiResponse<AdminUserDetail>>(`/admin/users/${id}/status`, { status });
  return res.data.data;
}

/** 批量充值 */
export async function adminBatchTopup(userIds: number[], amount: number, description: string): Promise<BatchTopupResult> {
  const res = await apiClient.post<ApiResponse<BatchTopupResult>>('/admin/users/batch-credit-topup', { userIds, amount, description });
  return res.data.data;
}

/** 获取操作日志 */
export async function adminGetOperationLogs(params: {
  page?: number;
  pageSize?: number;
  action?: string;
  adminId?: number;
}): Promise<PaginatedResult<AdminOperationLog>> {
  const res = await apiClient.get<ApiResponse<PaginatedResult<AdminOperationLog>>>('/admin/operation-logs', { params });
  return res.data.data;
}
