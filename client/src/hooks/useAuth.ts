import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import * as authApi from '@/api/auth';
import { useAuthStore } from '@/stores/auth.store';
import { useSnackbarStore } from '@/stores/snackbar.store';

export function useLogin() {
  const login = useAuthStore((s) => s.login);
  const showSnackbar = useSnackbarStore((s) => s.showSnackbar);
  const navigate = useNavigate();

  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authApi.login(email, password),
    onSuccess: (data) => {
      login(data.accessToken, data.refreshToken, data.user);
      showSnackbar('登录成功', 'success');
      navigate('/workspace');
    },
    onError: () => {
      // Error toast is handled by the Axios interceptor
    },
  });
}

export function usePhoneLogin() {
  const login = useAuthStore((s) => s.login);
  const showSnackbar = useSnackbarStore((s) => s.showSnackbar);
  const navigate = useNavigate();

  return useMutation({
    mutationFn: ({ phone, code }: { phone: string; code: string }) =>
      authApi.phoneLogin(phone, code),
    onSuccess: (data) => {
      login(data.accessToken, data.refreshToken, data.user);
      showSnackbar('登录成功', 'success');
      navigate('/workspace');
    },
    onError: () => {
    },
  });
}

export function useRegister() {
  const login = useAuthStore((s) => s.login);
  const showSnackbar = useSnackbarStore((s) => s.showSnackbar);
  const navigate = useNavigate();

  return useMutation({
    mutationFn: ({
      email,
      password,
      nickname,
    }: {
      email: string;
      password: string;
      nickname: string;
    }) => authApi.register(email, password, nickname),
    onSuccess: (data) => {
      login(data.accessToken, data.refreshToken, data.user);
      showSnackbar('注册成功', 'success');
      navigate('/workspace');
    },
    onError: () => {
      // Error toast is handled by the Axios interceptor
    },
  });
}

export function useLogout() {
  const logout = useAuthStore((s) => s.logout);
  const showSnackbar = useSnackbarStore((s) => s.showSnackbar);
  const navigate = useNavigate();

  return () => {
    logout();
    showSnackbar('已退出登录', 'info');
    navigate('/login');
  };
}

export function useCurrentUser() {
  return useAuthStore((s) => s.user);
}
