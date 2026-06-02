import apiClient from './client';
import type { ApiResponse } from './auth';

export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type TaskType = 'image' | 'video' | 'text';
export type ReferenceImageRole = 'first_frame' | 'last_frame' | 'reference_image' | 'edit_source';

/** 参考图信息 */
export interface ReferenceImage {
  url: string;
  role: ReferenceImageRole;
}

export interface GenerationTask {
  id: string;
  modelId: string;
  type: TaskType;
  prompt: string;
  params: string | null;
  status: TaskStatus;
  costCredits: number;
  resultUrl: string | null;
  resultThumbnail: string | null;
  errorMessage: string | null;
  progress: number;
  startedAt: string | null;
  completedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface CreateTaskParams {
  modelId: string;
  prompt: string;
  params?: Record<string, unknown>;
  duration?: number;
  referenceImages?: ReferenceImage[];
}

export interface CreateTaskResult {
  id: string;
  status: TaskStatus;
  costCredits: number;
  createdAt: string;
}

export interface TaskListResult {
  items: GenerationTask[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TaskListParams {
  status?: TaskStatus;
  type?: TaskType;
  page?: number;
  pageSize?: number;
}

/** Create a new generation task */
export async function createTask(params: CreateTaskParams): Promise<CreateTaskResult> {
  const res = await apiClient.post<ApiResponse<CreateTaskResult>>('/tasks', params);
  return res.data.data;
}

/** Get a single task by ID */
export async function getTask(taskId: string): Promise<GenerationTask> {
  const res = await apiClient.get<ApiResponse<GenerationTask>>(`/tasks/${taskId}`);
  return res.data.data;
}

/** List tasks with optional filters */
export async function listTasks(params?: TaskListParams): Promise<TaskListResult> {
  const res = await apiClient.get<ApiResponse<TaskListResult>>('/tasks', { params });
  return res.data.data;
}

/** Cancel a running task */
export async function cancelTask(taskId: string): Promise<void> {
  await apiClient.post(`/tasks/${taskId}/cancel`);
}

/** Upload a reference image */
export async function uploadReferenceImage(file: File): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await apiClient.post<ApiResponse<{ url: string }>>('/upload/image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  });

  return res.data.data;
}
