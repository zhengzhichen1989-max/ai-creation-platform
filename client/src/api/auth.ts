import apiClient from './client';
import type { ApiResponse } from './auth';

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
