import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { Platform } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { updateStoredTokens } from '../utils/secureStorage';

/**
 * Resolves the API Gateway URL dynamically according to the execution environment:
 * - Physical Device / Custom: process.env.API_BASE_URL or via setApiBaseUrl()
 * - Android Emulator: 10.0.2.2:8080 (maps back to host machine localhost:8080)
 * - iOS Simulator / Node / Default: localhost:8080
 */
export function resolveBaseUrl(): string {
  if (process.env.API_BASE_URL) {
    return process.env.API_BASE_URL;
  }

  if (Platform && Platform.OS === 'android') {
    return 'http://10.0.2.2:18080';
  }

  return 'http://localhost:18080';
}

// Configuration container
export const API_CONFIG = {
  baseURL: resolveBaseUrl(),
  timeout: 10000,
};

/**
 * Programmatically configure the API Gateway base URL at runtime.
 * Useful when testing with a physical device connected to your local Wi-Fi.
 */
export function setApiBaseUrl(newBaseUrl: string): void {
  API_CONFIG.baseURL = newBaseUrl;
  apiClient.defaults.baseURL = newBaseUrl;
}

// Global standard error envelope interface
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details: Record<string, any>;
  };
}

export const apiClient = axios.create({
  baseURL: API_CONFIG.baseURL,
  timeout: API_CONFIG.timeout,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Helper for generating UUID v4 in React Native without external polyfill
function generateRequestId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Request Interceptor: Attach Bearer Token & Request-Id
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().accessToken;
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    config.headers['X-Request-Id'] = generateRequestId();
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: 401 Automatic Refresh & Concurrency Retry Queue
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorResponse>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Check if error is 401 Unauthorized and not already retried
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      // Do not attempt to refresh for login or refresh requests themselves
      if (
        originalRequest.url?.includes('/auth/login') ||
        originalRequest.url?.includes('/auth/refresh')
      ) {
        return Promise.reject(parseApiError(error));
      }

      // If refresh is already in-flight, queue this request until refresh completes
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(parseApiError(err)));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = useAuthStore.getState().refreshToken;

      if (!refreshToken) {
        await useAuthStore.getState().logout();
        return Promise.reject(parseApiError(error));
      }

      try {
        const refreshResponse = await axios.post<{
          tokens: { accessToken: string; refreshToken: string };
        }>(`${API_CONFIG.baseURL}/auth/refresh`, { refreshToken });

        const { accessToken, refreshToken: newRefresh } = refreshResponse.data.tokens;

        // Update in-memory Zustand store and persist to secure device keystore
        useAuthStore.getState().setTokens(accessToken, newRefresh);
        await updateStoredTokens({ accessToken, refreshToken: newRefresh });

        processQueue(null, accessToken);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return apiClient(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        await useAuthStore.getState().logout();
        return Promise.reject(parseApiError(refreshErr as AxiosError<ApiErrorResponse>));
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(parseApiError(error));
  }
);

// Standard Error Envelope Mapper
export function parseApiError(error: AxiosError<ApiErrorResponse> | any): {
  code: string;
  message: string;
  details: Record<string, any>;
  status?: number;
} {
  if (error.response?.data?.error) {
    return {
      ...error.response.data.error,
      status: error.response.status,
    };
  }
  return {
    code: error.code || 'NETWORK_ERROR',
    message: error.message || 'Unable to connect to service. Please check your network.',
    details: {},
    status: error.response?.status,
  };
}
