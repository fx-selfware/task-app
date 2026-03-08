import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { templatesApi } from '../api/templates';
import type { Permission } from '../types';

export function useTemplates() {
  return useQuery({
    queryKey: ['templates'],
    queryFn: () => templatesApi.getAll(),
  });
}

export function useTemplate(id: string) {
  return useQuery({
    queryKey: ['templates', id],
    queryFn: () => templatesApi.getById(id),
    enabled: !!id,
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => templatesApi.create(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}

export function useRenameTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      templatesApi.rename(id, name),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      queryClient.invalidateQueries({ queryKey: ['templates', id] });
    },
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => templatesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}

export function useCreateTemplateTask(templateId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { title: string; description?: string; parentId?: string }) =>
      templatesApi.createTask(templateId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates', templateId] });
    },
  });
}

export function useUpdateTemplateTask(templateId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      taskId,
      data,
    }: {
      taskId: string;
      data: { title?: string; description?: string };
    }) => templatesApi.updateTask(templateId, taskId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates', templateId] });
    },
  });
}

export function useDeleteTemplateTask(templateId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => templatesApi.deleteTask(templateId, taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates', templateId] });
    },
  });
}

export function useMoveTemplateTask(templateId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, parentId }: { taskId: string; parentId: string | null }) =>
      templatesApi.moveTask(templateId, taskId, parentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates', templateId] });
    },
  });
}

export function useReorderTemplateTasks(templateId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      orderedIds,
      parentId,
    }: {
      orderedIds: string[];
      parentId?: string | null;
    }) => templatesApi.reorderTasks(templateId, orderedIds, parentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates', templateId] });
    },
  });
}

export function useApplyTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      templateId,
      taskListId,
    }: {
      templateId: string;
      taskListId: string;
    }) => templatesApi.apply(templateId, taskListId),
    onSuccess: (_data, { taskListId }) => {
      queryClient.invalidateQueries({ queryKey: ['task-lists', taskListId] });
    },
  });
}

// Sharing hooks
export function useTemplateShares(templateId: string) {
  return useQuery({
    queryKey: ['template-shares', templateId],
    queryFn: () => templatesApi.getShares(templateId).then((r) => r.shares),
    enabled: !!templateId,
  });
}

export function useCreateTemplateShare(templateId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ email, permission }: { email: string; permission: Permission }) =>
      templatesApi.createShare(templateId, email, permission),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template-shares', templateId] });
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}

export function useUpdateTemplateShare(templateId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ shareId, permission }: { shareId: string; permission: Permission }) =>
      templatesApi.updateShare(templateId, shareId, permission),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template-shares', templateId] });
    },
  });
}

export function useDeleteTemplateShare(templateId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (shareId: string) => templatesApi.deleteShare(templateId, shareId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template-shares', templateId] });
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}
