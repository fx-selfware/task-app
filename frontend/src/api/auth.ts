import { api } from './client';
import type { User } from '../types';

export const authApi = {
  register: (data: { email: string; password: string; name: string }) =>
    api.post<{ user: User }>('/auth/register', data),

  login: (data: { email: string; password: string }) =>
    api.post<{ user: User }>('/auth/login', data),

  logout: () => api.post<{ ok: boolean }>('/auth/logout'),

  me: () => api.get<{ user: User }>('/auth/me'),
};
