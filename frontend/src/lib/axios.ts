import axios, { AxiosError } from 'axios';
import { useAuthStore } from '@/store/auth.store';
import { ApiError, type ApiErrorBody } from '@/types/api';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorBody>) => {
    const isLoginRequest = error.config?.url?.includes('/auth/login');
    if (error.response?.status === 401 && !isLoginRequest) {
      useAuthStore.getState().logout();
    }

    if (error.response?.data?.code) {
      return Promise.reject(new ApiError(error.response.data));
    }

    return Promise.reject(new Error(error.message || 'No se pudo conectar con el servidor.'));
  },
);
