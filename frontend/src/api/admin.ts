import { api } from './client';
import type { User } from '../types';

export const adminApi = {
  fetchUsers: () => api.get<{ users: User[] }>('/admin/users'),

  resetUserPassword: (userId: string, newPassword: string) =>
    api.post<{ ok: boolean }>(`/admin/users/${userId}/reset-password`, { newPassword }),
};
