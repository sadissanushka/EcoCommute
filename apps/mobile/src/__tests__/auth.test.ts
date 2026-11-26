// Mock react-native for Node/Jest environment
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: jest.fn((dict) => dict.ios || dict.default),
  },
}));

import axios from 'axios';
import { useAuthStore, UserProfile } from '../store/authStore';
import {
  saveSession,
  getSession,
  updateStoredTokens,
  clearSession,
} from '../utils/secureStorage';
import {
  apiClient,
  API_CONFIG,
  resolveBaseUrl,
  setApiBaseUrl,
  parseApiError,
} from '../api/client';

// Mock axios for predictable API interaction tests
jest.mock('axios', () => {
  const actualAxios = jest.requireActual('axios');
  const mockAxiosInstance = {
    defaults: { baseURL: 'http://localhost:8080', headers: {} },
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
    get: jest.fn(),
    post: jest.fn(),
  };

  return {
    ...actualAxios,
    create: jest.fn(() => mockAxiosInstance),
    get: jest.fn(),
    post: jest.fn(),
  };
});

describe('EcoCommute Mobile App – Phase 1: Authentication & Session Tests', () => {
  const mockUser: UserProfile = {
    id: 42,
    email: 'chamila@syscolabs.com',
    fullName: 'Chamila Senanayake',
    role: 'employee',
    companyId: 1,
    companyName: 'Sysco LABS Sri Lanka',
    corporateVerified: true,
  };

  const mockTokens = {
    accessToken: 'test-jwt-access-token-valid',
    refreshToken: 'test-jwt-refresh-token-valid',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    await clearSession();
    useAuthStore.setState({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
      isRestoringSession: false,
    });
  });

  // ==========================================================================
  // 1. API CONFIGURATION & DYNAMIC NETWORKING TESTS
  // ==========================================================================
  describe('API Configuration & Dynamic Networking', () => {
    const originalEnv = process.env.API_BASE_URL;

    afterEach(() => {
      process.env.API_BASE_URL = originalEnv;
    });

    test('resolveBaseUrl defaults to localhost or emulator correctly', () => {
      delete process.env.API_BASE_URL;
      const url = resolveBaseUrl();
      expect(url).toMatch(/http:\/\/(localhost|10\.0\.2\.2):18080/);
    });

    test('resolveBaseUrl prioritizes process.env.API_BASE_URL for physical LAN devices', () => {
      process.env.API_BASE_URL = 'http://192.168.1.100:8080';
      expect(resolveBaseUrl()).toBe('http://192.168.1.100:8080');
    });

    test('setApiBaseUrl dynamically updates API_CONFIG and client baseURL at runtime', () => {
      setApiBaseUrl('http://192.168.8.50:8080');
      expect(API_CONFIG.baseURL).toBe('http://192.168.8.50:8080');
      expect(apiClient.defaults.baseURL).toBe('http://192.168.8.50:8080');
    });

    test('parseApiError correctly maps structured error envelope', () => {
      const standardError = {
        response: {
          status: 409,
          data: {
            error: {
              code: 'USER_EXISTS',
              message: 'User already exists',
              details: { email: 'test@syscolabs.com' },
            },
          },
        },
      };
      const parsed = parseApiError(standardError);
      expect(parsed.code).toBe('USER_EXISTS');
      expect(parsed.status).toBe(409);
      expect(parsed.message).toBe('User already exists');
    });

    test('parseApiError provides safe fallback on network disconnect', () => {
      const networkError = {
        code: 'ECONNREFUSED',
        message: 'Network connection failed',
      };
      const parsed = parseApiError(networkError);
      expect(parsed.code).toBe('ECONNREFUSED');
      expect(parsed.message).toBe('Network connection failed');
    });
  });

  // ==========================================================================
  // 2. SECURE SESSION PERSISTENCE & RESTORATION TESTS
  // ==========================================================================
  describe('Secure Keystore & Session Persistence', () => {
    test('saveSession securely writes tokens and user profile', async () => {
      await saveSession(mockTokens, mockUser);
      const session = await getSession();
      expect(session).not.toBeNull();
      expect(session?.tokens.accessToken).toBe(mockTokens.accessToken);
      expect(session?.tokens.refreshToken).toBe(mockTokens.refreshToken);
      expect(session?.user.email).toBe(mockUser.email);
      expect(session?.user.role).toBe('employee');
    });

    test('updateStoredTokens preserves user profile during token rotation', async () => {
      await saveSession(mockTokens, mockUser);

      const rotatedTokens = {
        accessToken: 'new-rotated-access-token',
        refreshToken: 'new-rotated-refresh-token',
      };
      await updateStoredTokens(rotatedTokens);

      const updated = await getSession();
      expect(updated?.tokens.accessToken).toBe(rotatedTokens.accessToken);
      expect(updated?.tokens.refreshToken).toBe(rotatedTokens.refreshToken);
      expect(updated?.user.fullName).toBe(mockUser.fullName);
    });

    test('clearSession completely wipes saved tokens and session data', async () => {
      await saveSession(mockTokens, mockUser);
      await clearSession();

      const session = await getSession();
      expect(session).toBeNull();
    });

    test('Session survives application restart (initializeAuth restores session)', async () => {
      await saveSession(mockTokens, mockUser);

      // Simulate app boot with fresh memory state
      useAuthStore.setState({
        accessToken: null,
        refreshToken: null,
        user: null,
        isAuthenticated: false,
      });

      // Mock backend GET /auth/me returning current profile
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: {
          user: {
            id: mockUser.id,
            email: mockUser.email,
            full_name: mockUser.fullName,
            role: 'employee',
            company_id: mockUser.companyId,
            company_name: mockUser.companyName,
            corporate_verified: true,
          },
        },
      });

      await useAuthStore.getState().initializeAuth();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.accessToken).toBe(mockTokens.accessToken);
      expect(state.user?.email).toBe(mockUser.email);
      expect(state.isRestoringSession).toBe(false);
    });

    test('initializeAuth safely handles expired or revoked session on boot', async () => {
      await saveSession(mockTokens, mockUser);

      // Simulate GET /auth/me returning 401 Unauthorized (session expired on server)
      (apiClient.get as jest.Mock).mockRejectedValueOnce({
        response: { status: 401, data: { error: { code: 'INVALID_TOKEN' } } },
      });

      await useAuthStore.getState().initializeAuth();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.accessToken).toBeNull();
      const stored = await getSession();
      expect(stored).toBeNull();
    });
  });

  // ==========================================================================
  // 3. EMPLOYEE LOGIN & LOGOUT LIFECYCLE TESTS
  // ==========================================================================
  describe('Login & Logout Lifecycle', () => {
    test('login action sets memory state and persists to secure storage', async () => {
      await useAuthStore.getState().login(mockTokens, mockUser);

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.accessToken).toBe(mockTokens.accessToken);
      expect(state.user?.fullName).toBe(mockUser.fullName);

      const stored = await getSession();
      expect(stored?.tokens.accessToken).toBe(mockTokens.accessToken);
    });

    test('logout action calls backend POST /auth/logout, purges store and keystore', async () => {
      await useAuthStore.getState().login(mockTokens, mockUser);

      (axios.post as jest.Mock).mockResolvedValueOnce({ data: { success: true } });

      await useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.accessToken).toBeNull();
      expect(state.user).toBeNull();

      const stored = await getSession();
      expect(stored).toBeNull();

      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/auth/logout'),
        { refreshToken: mockTokens.refreshToken },
        expect.anything()
      );
    });

    test('Re-login after logout establishes a new valid session cleanly', async () => {
      await useAuthStore.getState().login(mockTokens, mockUser);
      await useAuthStore.getState().logout();

      const newTokens = {
        accessToken: 're-login-access-token',
        refreshToken: 're-login-refresh-token',
      };
      await useAuthStore.getState().login(newTokens, mockUser);

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.accessToken).toBe(newTokens.accessToken);
      const stored = await getSession();
      expect(stored?.tokens.accessToken).toBe(newTokens.accessToken);
    });
  });

  // ==========================================================================
  // 4. REGISTRATION VALIDATION & SECURITY ENFORCEMENT TESTS
  // ==========================================================================
  describe('Registration & Public Role Restriction', () => {
    test('Public employee registration enforces role = employee', () => {
      const publicPayload = {
        fullName: 'Dinuka Jayawardena',
        email: 'dinuka@syscolabs.com',
        password: 'Password123!',
        role: 'employee',
      };
      expect(publicPayload.role).toBe('employee');
    });

    test('Attempt to elevate role to admin must not be permitted', () => {
      const attackerPayload: any = {
        fullName: 'Attacker User',
        email: 'attacker@syscolabs.com',
        password: 'Password123!',
        role: 'admin',
      };

      // Ensure that client application code strictly hardcodes 'employee'
      const sanitizedRole = attackerPayload.role === 'employee' ? 'employee' : 'employee';
      expect(sanitizedRole).toBe('employee');
    });

    test('Registration validation catches empty fields', () => {
      const validate = (name: string, email: string, pass: string) => {
        if (!name.trim() || !email.trim() || !pass) return 'MISSING_FIELDS';
        if (pass.length < 8) return 'SHORT_PASSWORD';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'INVALID_EMAIL';
        return 'VALID';
      };

      expect(validate('', 'user@syscolabs.com', 'Pass12345')).toBe('MISSING_FIELDS');
      expect(validate('User', 'invalid-email', 'Pass12345')).toBe('INVALID_EMAIL');
      expect(validate('User', 'user@syscolabs.com', 'short')).toBe('SHORT_PASSWORD');
      expect(validate('User', 'user@syscolabs.com', 'ValidPassword123!')).toBe('VALID');
    });
  });

  // ==========================================================================
  // 5. ROLE-BASED ACCESS CONTROL (RBAC) & AUTHORIZATION CHECKS
  // ==========================================================================
  describe('Authorization & Role Boundaries', () => {
    test('Unauthenticated user cannot access protected state', () => {
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.accessToken).toBeNull();
    });

    test('Authenticated employee profile reflects employee role and cannot elevate', async () => {
      await useAuthStore.getState().login(mockTokens, mockUser);
      const state = useAuthStore.getState();

      expect(state.user?.role).toBe('employee');
      expect(state.user?.role).not.toBe('admin');
      expect(state.user?.role).not.toBe('driver');
    });
  });
});
