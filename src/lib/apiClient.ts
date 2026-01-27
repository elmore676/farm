import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import { tokenStorage } from './tokenStorage';
import { useAuthStore } from '@/store/authStore';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'https://farm-9zxw.onrender.com/api/v1';

type RetryableRequest = AxiosRequestConfig & { _retry?: boolean };

const apiClient: AxiosInstance = axios.create({
  baseURL,
  withCredentials: false,
});

let isRefreshing = false;
let refreshQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null) => {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (token && !error) {
      resolve(token);
    } else {
      reject(error);
    }
  });
  refreshQueue = [];
};

const refreshTokens = async (): Promise<string> => {
  const refreshToken = tokenStorage.getRefreshToken();
  if (!refreshToken) throw new Error('NO_REFRESH');
  const resp = await axios.post(
    `${baseURL}/auth/refresh`,
    { refreshToken },
    { withCredentials: false }
  );
  const { accessToken, refreshToken: nextRefreshToken } = resp.data;
  tokenStorage.setTokens(accessToken, nextRefreshToken);
  return accessToken;
};

apiClient.interceptors.request.use((config) => {
  const token = tokenStorage.getAccessToken();
  if (token) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`,
    } as AxiosRequestConfig['headers'];
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableRequest | undefined;
    if (!originalRequest) throw error;

    const status = error.response?.status;
    if (status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        try {
          const newToken = await new Promise<string>((resolve, reject) => {
            refreshQueue.push({ resolve, reject });
          });
          originalRequest.headers = {
            ...originalRequest.headers,
            Authorization: `Bearer ${newToken}`,
          };
          originalRequest._retry = true;
          return apiClient(originalRequest);
        } catch (err) {
          useAuthStore.getState().logout('Session expired');
          throw err;
        }
      }

      originalRequest._retry = true;
      isRefreshing = true;
      try {
        const newToken = await refreshTokens();
        processQueue(null, newToken);
        originalRequest.headers = {
          ...originalRequest.headers,
          Authorization: `Bearer ${newToken}`,
        };
        return apiClient(originalRequest);
      } catch (err) {
        processQueue(err, null);
        useAuthStore.getState().logout('Session expired');
        throw err;
      } finally {
        isRefreshing = false;
      }
    }

    if (status === 403) {
      useAuthStore.getState().logout('Access denied');
    }

    throw error;
  }
);

export default apiClient;
