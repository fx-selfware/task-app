import { api } from '@/lib/api/client';
import type { TaskListShare, Permission } from '@/types';

export const sharesApi = {
  getAll: (listId: string) =>
    api.get<{ shares: TaskListShare[] }>(`/task-lists/${listId}/shares`),

  create: (listId: string, email: string, permission: Permission) =>
    api.post<{ share: TaskListShare }>(`/task-lists/${listId}/shares`, {
      email,
      permission,
    }),

  update: (listId: string, shareId: string, permission: Permission) =>
    api.patch<{ share: TaskListShare }>(
      `/task-lists/${listId}/shares/${shareId}`,
      { permission },
    ),

  delete: (listId: string, shareId: string) =>
    api.delete<void>(`/task-lists/${listId}/shares/${shareId}`),
};
