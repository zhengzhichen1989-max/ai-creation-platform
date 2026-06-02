import apiClient from './client';

/** 通用 API 响应结构 */
export interface ApiResponse<T = unknown> {
  code: number;
  data: T;
  message: string;
}

export interface User {
  id: number;
  email: string;
  nickname: string;
  avatarUrl: string | null;
  role?: string;
}

export interface AuthResult {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
}

/** Register a new user */
export async function register(
  email: string,
  password: string,
  nickname: string,
): Promise<AuthResult> {
  const res = await apiClient.post<ApiResponse<AuthResult>>('/auth/register', {
    email,
    password,
    nickname,
  });
  return res.data.data;
}

/** Login with email and password */
export async function login(email: string, password: string): Promise<AuthResult> {
  const res = await apiClient.post<ApiResponse<AuthResult>>('/auth/login', {
    email,
    password,
  });
  return res.data.data;
}

/** Refresh access token */
export async function refreshToken(refreshTokenValue: string): Promise<RefreshResult> {
  const res = await apiClient.post<ApiResponse<RefreshResult>>('/auth/refresh', {
    refreshToken: refreshTokenValue,
  });
  return res.data.data;
}

/** Get current authenticated user */
export async function getMe(): Promise<User> {
  const res = await apiClient.get<ApiResponse<User>>('/auth/me');
  return res.data.data;
}

/** Reset password using token */
export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await apiClient.post<ApiResponse<{ message: string }>>('/auth/reset-password', { token, newPassword });
}

/** Forgot password - check security question */
export async function forgotPassword(email: string): Promise<{ hasSecurityQuestion: boolean; question: string | null }> {
  const res = await apiClient.post<ApiResponse<{ hasSecurityQuestion: boolean; question: string | null }>>('/auth/forgot-password', { email });
  return res.data.data;
}

/** Verify security answer */
export async function verifySecurityAnswer(email: string, answer: string): Promise<{ token: string }> {
  const res = await apiClient.post<ApiResponse<{ token: string }>>('/auth/verify-security-answer', { email, answer });
  return res.data.data;
}

/** Set security question (authenticated) */
export async function setSecurityQuestion(question: string, answer: string): Promise<void> {
  await apiClient.put<ApiResponse<{ message: string }>>('/auth/security-question', { question, answer });
}
