import { create } from 'zustand';
import * as api from '../api';
import type { AuthStatus } from '../types';

interface AuthState {
  status: AuthStatus | null;
  isLoading: boolean;
  error: string | null;
  checkAuth: () => Promise<void>;
  loginWithToken: (token: string) => Promise<void>;
  loginWithCookies: (cookies: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: null,
  isLoading: true,
  error: null,

  checkAuth: async () => {
    set({ isLoading: true, error: null });
    try {
      const status = await api.checkAuth();
      set({ status, isLoading: false });
    } catch (e: any) {
      set({ status: { authenticated: false }, isLoading: false, error: e.toString() });
    }
  },

  loginWithToken: async (token: string) => {
    set({ isLoading: true, error: null });
    try {
      const status = await api.login(token);
      set({ status, isLoading: false });
    } catch (e: any) {
      set({ isLoading: false, error: e.toString() });
      throw e;
    }
  },

  loginWithCookies: async (cookies: string) => {
    set({ isLoading: true, error: null });
    try {
      const token = await api.extractTokenFromCookies(cookies);
      const status = await api.login(token);
      set({ status, isLoading: false });
    } catch (e: any) {
      set({ isLoading: false, error: e.toString() });
      throw e;
    }
  },

  logout: async () => {
    await api.logout();
    set({ status: { authenticated: false } });
  },
}));
