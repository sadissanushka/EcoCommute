import { create } from 'zustand';
import axios from 'axios';
import {
  saveSession,
  getSession,
  clearSession,
} from '../utils/secureStorage';

export interface UserProfile {
  id: number;
  email: string;
  fullName: string;
  role: 'employee' | 'driver' | 'admin' | 'policymaker';
  companyId: number | null;
  companyName?: string | null;
  corporateVerified: boolean;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isRestoringSession: boolean;

  // Actions
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: UserProfile) => void;
  login: (tokens: AuthTokens, user: UserProfile) => Promise<void>;
  logout: () => Promise<void>;
  initializeAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  isAuthenticated: false,
  isLoading: false,
  isRestoringSession: true,

  setTokens: (accessToken: string, refreshToken: string) =>
    set({
      accessToken,
      refreshToken,
      isAuthenticated: true,
    }),

  setUser: (user: UserProfile) =>
    set({
      user,
    }),

  login: async (tokens: AuthTokens, user: UserProfile) => {
    set({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user,
      isAuthenticated: true,
      isLoading: false,
    });

    try {
      await saveSession(tokens, user);
    } catch (err) {
      console.warn('Failed to persist session to secure keystore:', err);
    }
  },

  logout: async () => {
    const currentRefreshToken = get().refreshToken;

    // Immediately clear in-memory state
    set({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });

    // Revoke token on backend (fire and forget / gracefully handle network down)
    if (currentRefreshToken) {
      try {
        const { API_CONFIG } = require('../api/client');
        await axios.post(
          `${API_CONFIG.baseURL}/auth/logout`,
          { refreshToken: currentRefreshToken },
          { timeout: 5000 }
        );
      } catch {
        // If server is unreachable, local logout still succeeds
      }
    }

    // Purge hardware keystore
    try {
      await clearSession();
    } catch (err) {
      console.warn('Failed to purge keystore on logout:', err);
    }
  },

  initializeAuth: async () => {
    set({ isRestoringSession: true });

    try {
      const stored = await getSession();

      if (!stored || !stored.tokens?.accessToken) {
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          isAuthenticated: false,
          isRestoringSession: false,
        });
        return;
      }

      // Populate memory with stored tokens
      set({
        accessToken: stored.tokens.accessToken,
        refreshToken: stored.tokens.refreshToken,
        user: stored.user,
        isAuthenticated: true,
      });

      // Verify restored session with backend GET /auth/me
      try {
        const { apiClient } = require('../api/client');
        const res = await apiClient.get('/auth/me');

        if (res.data?.user) {
          const freshUser: UserProfile = {
            id: res.data.user.id,
            email: res.data.user.email,
            fullName: res.data.user.full_name || res.data.user.fullName,
            role: res.data.user.role,
            companyId: res.data.user.company_id ?? res.data.user.companyId,
            companyName: res.data.user.company_name ?? res.data.user.companyName,
            corporateVerified: res.data.user.corporate_verified ?? res.data.user.corporateVerified ?? false,
          };

          set({ user: freshUser });
          await saveSession(stored.tokens, freshUser);
        }
      } catch (verifyErr: any) {
        // If 401 and refresh interceptor also failed, state is cleared by interceptor
        if (verifyErr.response?.status === 401) {
          await get().logout();
        }
        // If other error (e.g., temporary network offline), keep stored session
      }
    } catch (err) {
      console.warn('Session restoration failed:', err);
      set({ isAuthenticated: false, user: null });
    } finally {
      set({ isRestoringSession: false });
    }
  },
}));
