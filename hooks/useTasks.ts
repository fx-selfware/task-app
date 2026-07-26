'use client';

import { createId } from '@paralleldrive/cuid2';
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
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
 * Every write applies to the cache first and reconciles with the server's
 * answer afterwards, so the UI never waits on a round trip. Two rules keep
 * that honest:
 *
 *  - the cache patch mirrors the server's own semantics (see patchTaskInList),
 *    or a later refetch would contradict what's already on screen;
 *  - failures roll back to the pre-mutation snapshot, and the query client's
 *    MutationCache reports them (components/Toaster).
 *
 * Successful writes splice the returned row in rather than invalidating: an
 * invalidate spends a second round trip re-reading a list whose contents we
 * already know, and the 3s poll catches anything else.
 */

/**
 * Mirror of the server's update semantics (lib/services/tasks.ts updateTask):
 * completing a top-level task cascades DONE to its TODO subtasks, and
 * un-completing a subtask also un-completes its parent.
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

function insertTask(detail: ListDetail, task: Task): ListDetail {
  const tasks = detail.list.tasks ?? [];
  if (!task.parentId) {
    return { ...detail, list: { ...detail.list, tasks: [...tasks, task] } };
  }
  return {
    ...detail,
    list: {
      ...detail.list,
      tasks: tasks.map((t) => (t.id === task.parentId ? { ...t, subtasks: [...(t.subtasks ?? []), task] } : t)),
    },
  };
}

function replaceTask(detail: ListDetail, taskId: string, task: Task): ListDetail {
  const tasks = (detail.list.tasks ?? []).map((t) => {
    if (t.id === taskId) return { ...task, subtasks: t.subtasks ?? [] };
    const subtasks = t.subtasks ?? [];
    if (!subtasks.some((s) => s.id === taskId)) return t;
    return { ...t, subtasks: subtasks.map((s) => (s.id === taskId ? task : s)) };
  });
  return { ...detail, list: { ...detail.list, tasks } };
}

function removeTask(detail: ListDetail, taskId: string): ListDetail {
  const tasks = (detail.list.tasks ?? [])
    .filter((t) => t.id !== taskId)
    .map((t) => ({ ...t, subtasks: (t.subtasks ?? []).filter((s) => s.id !== taskId) }));
  return { ...detail, list: { ...detail.list, tasks } };
}

/** Mirrors deleteCompletedTasks: done tasks go, their TODO subtasks are promoted. */
function removeCompletedTasks(detail: ListDetail): ListDetail {
  const next: Task[] = [];
  for (const task of detail.list.tasks ?? []) {
    const survivingSubtasks = (task.subtasks ?? []).filter((s) => s.status !== 'DONE');
    if (task.status === 'DONE') {
      for (const sub of survivingSubtasks) next.push({ ...sub, parentId: null, subtasks: [] });
    } else {
      next.push({ ...task, subtasks: survivingSubtasks });
    }
  }
  return { ...detail, list: { ...detail.list, tasks: next } };
}

/** Mirrors moveTask: a promoted subtask lands directly after its former parent. */
function moveTaskInList(detail: ListDetail, taskId: string, newParentId: string | null): ListDetail {
  const tasks = detail.list.tasks ?? [];
  let moving: Task | undefined;
  const remaining: Task[] = [];

  for (const task of tasks) {
    if (task.id === taskId) {
      moving = task;
      continue;
    }
    const subtasks = task.subtasks ?? [];
    const found = subtasks.find((s) => s.id === taskId);
    if (found) {
      moving = found;
      remaining.push({ ...task, subtasks: subtasks.filter((s) => s.id !== taskId) });
    } else {
      remaining.push(task);
    }
  }

  if (!moving) return detail;

  if (newParentId) {
    const demoted: Task = { ...moving, parentId: newParentId, subtasks: [] };
    return {
      ...detail,
      list: {
        ...detail.list,
        tasks: remaining.map((t) => (t.id === newParentId ? { ...t, subtasks: [...(t.subtasks ?? []), demoted] } : t)),
      },
    };
  }

  const promoted: Task = { ...moving, parentId: null, subtasks: [] };
  const formerParentIndex = remaining.findIndex((t) => t.id === moving?.parentId);
  const next = [...remaining];
  next.splice(formerParentIndex >= 0 ? formerParentIndex + 1 : next.length, 0, promoted);
  return { ...detail, list: { ...detail.list, tasks: next } };
}

/** Snapshot, patch, and hand the snapshot back for rollback. */
async function patchListDetail(
  queryClient: QueryClient,
  listId: string,
  patch: (detail: ListDetail) => ListDetail,
): Promise<{ previous: ListDetail | undefined }> {
  await queryClient.cancelQueries({ queryKey: listKey(listId) });
  const previous = queryClient.getQueryData<ListDetail>(listKey(listId));
  if (previous) queryClient.setQueryData(listKey(listId), patch(previous));
  return { previous };
}

function rollback(queryClient: QueryClient, listId: string, context?: { previous: ListDetail | undefined }) {
  if (context?.previous) queryClient.setQueryData(listKey(listId), context.previous);
}

export function useCreateTask(listId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string; title: string; description?: string; parentId?: string }) =>
      tasksApi.create(listId, data),
    onMutate: async (data) => {
      // Not a placeholder: the server is told to use this id (see lib/ids.ts),
      // so acting on the new task before the response lands still works.
      const newId = data.id;
      const now = new Date().toISOString();
      const { previous } = await patchListDetail(queryClient, listId, (detail) => {
        const siblings = data.parentId
          ? ((detail.list.tasks ?? []).find((t) => t.id === data.parentId)?.subtasks ?? [])
          : (detail.list.tasks ?? []);
        const optimistic: Task = {
          id: data.id,
          title: data.title,
          description: data.description?.trim() ? data.description : null,
          status: 'TODO',
          order: siblings.reduce((max, t) => Math.max(max, t.order), -1) + 1,
          taskListId: listId,
          parentId: data.parentId ?? null,
          subtasks: [],
          createdAt: now,
          updatedAt: now,
        };
        return insertTask(detail, optimistic);
      });
      return { previous, newId };
    },
    onError: (_err, _vars, context) => rollback(queryClient, listId, context),
    onSuccess: (result, _vars, context) => {
      if (!context?.newId) return;
      const previous = queryClient.getQueryData<ListDetail>(listKey(listId));
      if (previous) {
        queryClient.setQueryData(listKey(listId), replaceTask(previous, context.newId, result.task));
      }
    },
  });
}

export function useUpdateTask(listId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, data }: { taskId: string; data: UpdateTaskData }) => tasksApi.update(listId, taskId, data),
    onMutate: ({ taskId, data }) => patchListDetail(queryClient, listId, (d) => patchTaskInList(d, taskId, data)),
    onError: (_err, _vars, context) => rollback(queryClient, listId, context),
    onSuccess: (result, { taskId }) => {
      const previous = queryClient.getQueryData<ListDetail>(listKey(listId));
      if (previous) queryClient.setQueryData(listKey(listId), replaceTask(previous, taskId, result.task));
    },
  });
}

export function useDeleteTask(listId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => tasksApi.delete(listId, taskId),
    onMutate: (taskId) => patchListDetail(queryClient, listId, (d) => removeTask(d, taskId)),
    onError: (_err, _vars, context) => rollback(queryClient, listId, context),
  });
}

export function useDeleteCompletedTasks(listId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => tasksApi.deleteCompleted(listId),
    onMutate: () => patchListDetail(queryClient, listId, removeCompletedTasks),
    onError: (_err, _vars, context) => rollback(queryClient, listId, context),
  });
}

export function useReorderTasks(listId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderedIds, parentId }: { orderedIds: string[]; parentId?: string | null }) =>
      tasksApi.reorder(listId, orderedIds, parentId),
    onMutate: ({ orderedIds, parentId }) =>
      patchListDetail(queryClient, listId, (d) => reorderInList(d, orderedIds, parentId)),
    onError: (_err, _vars, context) => rollback(queryClient, listId, context),
  });
}

export function useMoveTask(listId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, parentId }: { taskId: string; parentId: string | null }) =>
      tasksApi.move(listId, taskId, parentId),
    onMutate: ({ taskId, parentId }) =>
      patchListDetail(queryClient, listId, (d) => moveTaskInList(d, taskId, parentId)),
    onError: (_err, _vars, context) => rollback(queryClient, listId, context),
    // The server renumbers both sibling groups, and only it knows the final
    // orders — the one write still worth re-reading.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listKey(listId) });
    },
  });
}
