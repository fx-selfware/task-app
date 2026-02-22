import { api } from './client';
import type { TaskList, TaskListSummary } from '../types';

export const taskListsApi = {
  getAll: () =>
    api.get<{ owned: TaskListSummary[]; shared: TaskListSummary[] }>('/task-lists'),

  getById: (id: string) =>
    api.get<{ list: TaskList; isOwner: boolean; permission: string }>(
      `/task-lists/${id}`,
    ),

  create: (name: string) => api.post<{ list: TaskList }>('/task-lists', { name }),

  rename: (id: string, name: string) =>
    api.patch<{ list: TaskList }>(`/task-lists/${id}`, { name }),

  delete: (id: string) => api.delete<void>(`/task-lists/${id}`),
};
