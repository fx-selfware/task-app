'use client';

import { createId } from '@paralleldrive/cuid2';
import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { taskListsApi } from '@/lib/api/taskLists';
import type { TaskList, TaskListSummary } from '@/types';

type ListIndex = { owned: TaskListSummary[]; shared: TaskListSummary[] };
type ListDetail = { list: TaskList; isOwner: boolean; permission: string };

const indexKey = ['task-lists'] as const;
const listKey = (id: string) => ['task-lists', id] as const;

/** See hooks/useTasks for why these writes patch the cache instead of refetching. */
async function patchIndex(
  queryClient: QueryClient,
  patch: (index: ListIndex) => ListIndex,
): Promise<{ previous: ListIndex | undefined }> {
  // `exact`, or this also cancels every ['task-lists', id] detail query.
  await queryClient.cancelQueries({ queryKey: indexKey, exact: true });
  const previous = queryClient.getQueryData<ListIndex>(indexKey);
  if (previous) queryClient.setQueryData(indexKey, patch(previous));
  return { previous };
}

export function useTaskLists() {
  return useQuery({
    queryKey: indexKey,
    queryFn: () => taskListsApi.getAll(),
  });
}

export function useTaskList(id: string) {
  return useQuery({
    queryKey: listKey(id),
    queryFn: () => taskListsApi.getById(id),
    enabled: !!id,
    // The open list has its own poll; without this, every remount would
    // refetch on top of it.
    staleTime: 2000,
  });
}

export function useCreateTaskList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, id }: { name: string; id: string }) => taskListsApi.create(name, id),
    onMutate: async ({ name, id: newId }) => {
      const now = new Date().toISOString();
      const { previous } = await patchIndex(queryClient, (index) => ({
        ...index,
        owned: [
          ...index.owned,
          {
            id: newId,
            name,
            ownerId: '',
            createdAt: now,
            updatedAt: now,
            role: 'owner' as const,
            _count: { tasks: 0 },
          },
        ],
      }));
      return { previous, newId };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(indexKey, context.previous);
    },
    onSuccess: (result, _vars, context) => {
      const previous = queryClient.getQueryData<ListIndex>(indexKey);
      if (!previous || !context?.newId) return;
      queryClient.setQueryData(indexKey, {
        ...previous,
        owned: previous.owned.map((l) =>
          l.id === context.newId ? { ...result.list, role: 'owner' as const, _count: { tasks: 0 } } : l,
        ),
      });
    },
  });
}

export function useRenameTaskList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => taskListsApi.rename(id, name),
    onMutate: async ({ id, name }) => {
      const rename = <T extends { id: string; name: string }>(l: T) => (l.id === id ? { ...l, name } : l);
      const { previous } = await patchIndex(queryClient, (index) => ({
        owned: index.owned.map(rename),
        shared: index.shared.map(rename),
      }));

      await queryClient.cancelQueries({ queryKey: listKey(id) });
      const previousDetail = queryClient.getQueryData<ListDetail>(listKey(id));
      if (previousDetail) {
        queryClient.setQueryData(listKey(id), { ...previousDetail, list: { ...previousDetail.list, name } });
      }
      return { previous, previousDetail };
    },
    onError: (_err, { id }, context) => {
      if (context?.previous) queryClient.setQueryData(indexKey, context.previous);
      if (context?.previousDetail) queryClient.setQueryData(listKey(id), context.previousDetail);
    },
  });
}

export function useDeleteTaskList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => taskListsApi.delete(id),
    onMutate: (id) =>
      patchIndex(queryClient, (index) => ({
        owned: index.owned.filter((l) => l.id !== id),
        shared: index.shared.filter((l) => l.id !== id),
      })),
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(indexKey, context.previous);
    },
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: listKey(id) });
    },
  });
}
