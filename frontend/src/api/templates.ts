import { api } from './client';
import type { TemplateSummary, TaskTemplate, TemplateTask, TemplateShare, Task, Permission } from '../types';

export const templatesApi = {
  getAll: () =>
    api.get<{ owned: TemplateSummary[]; shared: TemplateSummary[] }>('/templates'),

  getById: (id: string) =>
    api.get<{ template: TaskTemplate; isOwner: boolean; permission: Permission | null }>(
      `/templates/${id}`,
    ),

  create: (name: string) => api.post<{ template: TaskTemplate }>('/templates', { name }),

  rename: (id: string, name: string) =>
    api.patch<{ template: TaskTemplate }>(`/templates/${id}`, { name }),

  delete: (id: string) => api.delete<void>(`/templates/${id}`),

  createTask: (
    templateId: string,
    data: { title: string; description?: string; parentId?: string },
  ) => api.post<{ task: TemplateTask }>(`/templates/${templateId}/tasks`, data),

  updateTask: (
    templateId: string,
    taskId: string,
    data: { title?: string; description?: string },
  ) =>
    api.patch<{ task: TemplateTask }>(`/templates/${templateId}/tasks/${taskId}`, data),

  deleteTask: (templateId: string, taskId: string) =>
    api.delete<void>(`/templates/${templateId}/tasks/${taskId}`),

  moveTask: (templateId: string, taskId: string, parentId: string | null) =>
    api.patch<{ task: TemplateTask }>(`/templates/${templateId}/tasks/${taskId}/move`, { parentId }),

  reorderTasks: (templateId: string, orderedIds: string[], parentId?: string | null) =>
    api.put<{ ok: boolean }>(`/templates/${templateId}/tasks/reorder`, {
      orderedIds,
      parentId: parentId ?? null,
    }),

  apply: (templateId: string, taskListId: string) =>
    api.post<{ tasks: Task[] }>(`/templates/${templateId}/apply`, { taskListId }),

  // Sharing
  getShares: (templateId: string) =>
    api.get<{ shares: TemplateShare[] }>(`/templates/${templateId}/shares`),

  createShare: (templateId: string, email: string, permission: Permission) =>
    api.post<{ share: TemplateShare }>(`/templates/${templateId}/shares`, {
      email,
      permission,
    }),

  updateShare: (templateId: string, shareId: string, permission: Permission) =>
    api.patch<{ share: TemplateShare }>(
      `/templates/${templateId}/shares/${shareId}`,
      { permission },
    ),

  deleteShare: (templateId: string, shareId: string) =>
    api.delete<void>(`/templates/${templateId}/shares/${shareId}`),
};
