import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksApi } from '../api/tasks';
import type { TaskStatus } from '../types';

export function useCreateTask(listId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { title: string; description?: string; parentId?: string }) =>
      tasksApi.create(listId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-lists', listId] });
    },
  });
}

export function useUpdateTask(listId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      taskId,
      data,
    }: {
      taskId: string;
      data: {
        title?: string;
        description?: string | null;
        status?: TaskStatus;
      };
    }) => tasksApi.update(listId, taskId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-lists', listId] });
    },
  });
}

export function useDeleteTask(listId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => tasksApi.delete(listId, taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-lists', listId] });
    },
  });
}

export function useDeleteCompletedTasks(listId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => tasksApi.deleteCompleted(listId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-lists', listId] });
    },
  });
}

export function useReorderTasks(listId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      orderedIds,
      parentId,
    }: {
      orderedIds: string[];
      parentId?: string | null;
    }) => tasksApi.reorder(listId, orderedIds, parentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-lists', listId] });
    },
  });
}

export function useMoveTask(listId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, parentId }: { taskId: string; parentId: string | null }) =>
      tasksApi.move(listId, taskId, parentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-lists', listId] });
    },
  });
}

export function useDeleteCompletedSubtasks(listId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (parentId: string) => tasksApi.deleteCompletedSubtasks(listId, parentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-lists', listId] });
    },
  });
}
