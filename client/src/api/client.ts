import axios from 'axios';
import { useAuthStore } from '@/stores/auth.store';
import { useSnackbarStore } from '@/stores/snackbar.store';

const apiClient = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

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
  async (error) => {
    const originalRequest = error.config;

    // If 401 and we haven't retried yet, try refreshing the token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = useAuthStore.getState().refreshToken;
      if (!refreshToken) {
        useAuthStore.getState().logout();
        return Promise.reject(error);
      }

      try {
        const res = await axios.post('/api/v1/auth/refresh', { refreshToken });
        const { accessToken: newAccessToken, refreshToken: newRefreshToken } = res.data.data;
        useAuthStore.getState().setTokens(newAccessToken, newRefreshToken);

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return apiClient(originalRequest);
      } catch {
        // Refresh failed — force logout
        useAuthStore.getState().logout();
        return Promise.reject(error);
      }
    }

    // Show error toast for non-401 errors
    const message =
      error.response?.data?.message || error.message || '请求失败，请稍后重试';
    useSnackbarStore.getState().showSnackbar(message, 'error');

    return Promise.reject(error);
  },
);

export default apiClient;
