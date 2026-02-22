import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { templatesApi } from '../api/templates';

export function useTemplates() {
  return useQuery({
    queryKey: ['templates'],
    queryFn: () => templatesApi.getAll().then((r) => r.templates),
  });
}

export function useTemplate(id: string) {
  return useQuery({
    queryKey: ['templates', id],
    queryFn: () => templatesApi.getById(id).then((r) => r.template),
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
    mutationFn: (data: { title: string; description?: string }) =>
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
