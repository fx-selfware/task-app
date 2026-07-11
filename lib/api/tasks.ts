import { api } from '@/lib/api/client';
import type { Task, TaskStatus } from '@/types';

export const tasksApi = {
  create: (
    listId: string,
    data: { title: string; description?: string; parentId?: string },
  ) => api.post<{ task: Task }>(`/task-lists/${listId}/tasks`, data),

  update: (
    listId: string,
    taskId: string,
    data: { title?: string; description?: string | null; status?: TaskStatus },
  ) => api.patch<{ task: Task }>(`/task-lists/${listId}/tasks/${taskId}`, data),

  delete: (listId: string, taskId: string) =>
    api.delete<void>(`/task-lists/${listId}/tasks/${taskId}`),

  reorder: (listId: string, orderedIds: string[], parentId?: string | null) =>
    api.put<{ ok: boolean }>(`/task-lists/${listId}/tasks/reorder`, {
      orderedIds,
      parentId: parentId ?? null,
    }),

  move: (listId: string, taskId: string, parentId: string | null) =>
    api.patch<{ task: Task }>(`/task-lists/${listId}/tasks/${taskId}/move`, { parentId }),

  deleteCompleted: (listId: string) =>
    api.delete<void>(`/task-lists/${listId}/tasks/completed`),

  deleteCompletedSubtasks: (listId: string, parentId: string) =>
    api.delete<void>(`/task-lists/${listId}/tasks/${parentId}/subtasks/completed`),
};
