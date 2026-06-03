import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/api/auth';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  isAdmin: boolean;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: User) => void;
  login: (accessToken: string, refreshToken: string, user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAdmin: false,

      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken }),

      setUser: (user) => set({ user, isAdmin: user.role === 'admin' }),

      login: (accessToken, refreshToken, user) =>
        set({ accessToken, refreshToken, user, isAdmin: user.role === 'admin' }),

      logout: () =>
        set({ accessToken: null, refreshToken: null, user: null, isAdmin: false }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        isAdmin: state.isAdmin,
      }),
    },
  ),
);
