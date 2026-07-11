'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksApi } from '@/lib/api/tasks';
import type { Task, TaskList, TaskStatus } from '@/types';

type ListDetail = { list: TaskList; isOwner: boolean; permission: string };

interface UpdateTaskData {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
}

const listKey = (listId: string) => ['task-lists', listId] as const;

/**
 * Mirror of the server's update semantics (lib/services/tasks.ts updateTask):
 * completing a top-level task cascades DONE to its TODO subtasks, and
 * un-completing a subtask also un-completes its parent. Keeping the cache
 * patch faithful means later refetches agree with what's already on screen.
 */
function patchTaskInList(detail: ListDetail, taskId: string, data: UpdateTaskData): ListDetail {
  const tasks = (detail.list.tasks ?? []).map((top) => {
    if (top.id === taskId) {
      const updated: Task = { ...top, ...data };
      if (data.status === 'DONE') {
        updated.subtasks = (top.subtasks ?? []).map((s) =>
          s.status === 'TODO' ? { ...s, status: 'DONE' as TaskStatus } : s,
        );
      }
      return updated;
    }
    if (!(top.subtasks ?? []).some((s) => s.id === taskId)) return top;
    const subtasks = (top.subtasks ?? []).map((s) => (s.id === taskId ? { ...s, ...data } : s));
    return { ...top, status: data.status === 'TODO' ? ('TODO' as TaskStatus) : top.status, subtasks };
  });
  return { ...detail, list: { ...detail.list, tasks } };
}

function reorderInList(detail: ListDetail, orderedIds: string[], parentId?: string | null): ListDetail {
  const pos = new Map(orderedIds.map((id, i) => [id, i]));
  const sortByIds = <T extends { id: string }>(arr: T[]): T[] =>
    [...arr].sort((a, b) => (pos.get(a.id) ?? Infinity) - (pos.get(b.id) ?? Infinity));

  if (!parentId) {
    return { ...detail, list: { ...detail.list, tasks: sortByIds(detail.list.tasks ?? []) } };
  }
  const tasks = (detail.list.tasks ?? []).map((t) =>
    t.id === parentId ? { ...t, subtasks: sortByIds(t.subtasks ?? []) } : t,
  );
  return { ...detail, list: { ...detail.list, tasks } };
}

export function useCreateTask(listId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { title: string; description?: string; parentId?: string }) =>
      tasksApi.create(listId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listKey(listId) });
    },
  });
}

export function useUpdateTask(listId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, data }: { taskId: string; data: UpdateTaskData }) =>
      tasksApi.update(listId, taskId, data),
    // Optimistic: over a remote database the refetch is slow enough that the
    // UI would visibly fall back to the stale cache without this.
    onMutate: async ({ taskId, data }) => {
      await queryClient.cancelQueries({ queryKey: listKey(listId) });
      const previous = queryClient.getQueryData<ListDetail>(listKey(listId));
      if (previous) {
        queryClient.setQueryData(listKey(listId), patchTaskInList(previous, taskId, data));
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(listKey(listId), context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: listKey(listId) });
    },
  });
}

export function useDeleteTask(listId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => tasksApi.delete(listId, taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listKey(listId) });
    },
  });
}

export function useDeleteCompletedTasks(listId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => tasksApi.deleteCompleted(listId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listKey(listId) });
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
    onMutate: async ({ orderedIds, parentId }) => {
      await queryClient.cancelQueries({ queryKey: listKey(listId) });
      const previous = queryClient.getQueryData<ListDetail>(listKey(listId));
      if (previous) {
        queryClient.setQueryData(listKey(listId), reorderInList(previous, orderedIds, parentId));
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(listKey(listId), context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: listKey(listId) });
    },
  });
}

export function useMoveTask(listId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, parentId }: { taskId: string; parentId: string | null }) =>
      tasksApi.move(listId, taskId, parentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listKey(listId) });
    },
  });
}

export function useDeleteCompletedSubtasks(listId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (parentId: string) => tasksApi.deleteCompletedSubtasks(listId, parentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listKey(listId) });
    },
  });
}
