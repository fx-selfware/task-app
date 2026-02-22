import { api } from './client';
import type { TaskTemplate, TemplateTask, Task } from '../types';

export const templatesApi = {
  getAll: () => api.get<{ templates: TaskTemplate[] }>('/templates'),

  getById: (id: string) => api.get<{ template: TaskTemplate }>(`/templates/${id}`),

  create: (name: string) => api.post<{ template: TaskTemplate }>('/templates', { name }),

  rename: (id: string, name: string) =>
    api.patch<{ template: TaskTemplate }>(`/templates/${id}`, { name }),

  delete: (id: string) => api.delete<void>(`/templates/${id}`),

  createTask: (
    templateId: string,
    data: { title: string; description?: string },
  ) => api.post<{ task: TemplateTask }>(`/templates/${templateId}/tasks`, data),

  updateTask: (
    templateId: string,
    taskId: string,
    data: { title?: string; description?: string },
  ) =>
    api.patch<{ task: TemplateTask }>(`/templates/${templateId}/tasks/${taskId}`, data),

  deleteTask: (templateId: string, taskId: string) =>
    api.delete<void>(`/templates/${templateId}/tasks/${taskId}`),

  apply: (templateId: string, taskListId: string) =>
    api.post<{ tasks: Task[] }>(`/templates/${templateId}/apply`, { taskListId }),
};
