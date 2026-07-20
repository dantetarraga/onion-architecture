import { api } from '@/lib/axios';
import type { AuthUser } from '@/types/entities';

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  fullName: string;
}

export interface LoginResult {
  accessToken: string;
  user: AuthUser;
}

export const authApi = {
  login: (input: LoginInput) => api.post<LoginResult>('/auth/login', input).then((r) => r.data),
  register: (input: RegisterInput) => api.post<AuthUser>('/auth/register', input).then((r) => r.data),
};
