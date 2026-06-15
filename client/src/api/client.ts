import axios from 'axios';
import type { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/stores/auth.store';
import { useSnackbarStore } from '@/stores/snackbar.store';

const apiClient = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── Token refresh 并发锁 ──────────────────────────────────────────
// 当多个请求同时收到 401 时，只触发一次 refresh，其余请求排队等待新 token
let isRefreshing = false;
let pendingRequests: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

function processPendingRequests(token: string) {
  pendingRequests.forEach(({ resolve }) => resolve(token));
  pendingRequests = [];
}

function rejectPendingRequests(error: unknown) {
  pendingRequests.forEach(({ reject }) => reject(error));
  pendingRequests = [];
}

/** Request interceptor — attach access token, fix FormData Content-Type */
apiClient.interceptors.request.use(
  (config) => {
    const accessToken = useAuthStore.getState().accessToken;
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    // 当发送 FormData 时，删除手动设置的 Content-Type，让浏览器自动设置
    // multipart/form-data + 正确的 boundary（手动设置会丢失 boundary 导致后端解析失败）
    if (config.data instanceof FormData) {
      delete (config.headers as Record<string, unknown>)['Content-Type'];
    }
    return config;
  },
  (error) => Promise.reject(error),
);

/** Response interceptor — handle 401 refresh & global error toast */
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // If 401 and we haven't retried yet, try refreshing the token
    // Skip refresh for auth endpoints (login/register) — their 401 means wrong credentials, not expired token
    const isAuthEndpoint =
      originalRequest.url?.includes('/auth/login') ||
      originalRequest.url?.includes('/auth/register') ||
      originalRequest.url?.includes('/auth/forgot-password') ||
      originalRequest.url?.includes('/auth/verify-security-answer');

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true;

      const refreshToken = useAuthStore.getState().refreshToken;
      if (!refreshToken) {
        useAuthStore.getState().logout();
        return Promise.reject(error);
      }

      // 并发锁：如果已在刷新中，将当前请求加入等待队列
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingRequests.push({
            resolve: (newToken: string) => {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              resolve(apiClient(originalRequest));
            },
            reject,
          });
        });
      }

      isRefreshing = true;

      try {
        const res = await axios.post('/api/v1/auth/refresh', { refreshToken });
        const { accessToken: newAccessToken, refreshToken: newRefreshToken } = res.data.data;
        useAuthStore.getState().setTokens(newAccessToken, newRefreshToken);

        // 通知所有排队的请求使用新 token
        processPendingRequests(newAccessToken);

        // 重试原始请求
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh failed — 拒绝所有排队请求 + force logout
        rejectPendingRequests(refreshError);
        useAuthStore.getState().logout();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Show error toast (for non-401 errors, auth endpoint 401s, and retried 401s)
    const message =
      error.response?.data?.message || error.message || '请求失败，请稍后重试';
    useSnackbarStore.getState().showSnackbar(message, 'error');

    return Promise.reject(error);
  },
);

export default apiClient;
