'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sharesApi } from '@/lib/api/shares';
import type { Permission, TaskListShare } from '@/types';

const sharesKey = (listId: string) => ['shares', listId] as const;

/** `enabled` lets the modal keep this query idle until it is actually opened. */
export function useShares(listId: string, enabled = true) {
  return useQuery({
    queryKey: sharesKey(listId),
    queryFn: () => sharesApi.getAll(listId).then((r) => r.shares),
    enabled: enabled && !!listId,
  });
}

export function useCreateShare(listId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ email, permission }: { email: string; permission: Permission }) =>
      sharesApi.create(listId, email, permission),
    // The server resolves the email to a user, so there is nothing to show
    // optimistically — this one genuinely needs the response.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sharesKey(listId) });
      queryClient.invalidateQueries({ queryKey: ['task-lists', listId] });
    },
  });
}

export function useUpdateShare(listId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ shareId, permission }: { shareId: string; permission: Permission }) =>
      sharesApi.update(listId, shareId, permission),
    onMutate: async ({ shareId, permission }) => {
      await queryClient.cancelQueries({ queryKey: sharesKey(listId) });
      const previous = queryClient.getQueryData<TaskListShare[]>(sharesKey(listId));
      if (previous) {
        queryClient.setQueryData(
          sharesKey(listId),
          previous.map((s) => (s.id === shareId ? { ...s, permission } : s)),
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(sharesKey(listId), context.previous);
    },
    // The list's own permission and canWrite come from the detail response.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sharesKey(listId) });
      queryClient.invalidateQueries({ queryKey: ['task-lists', listId] });
    },
  });
}

export function useDeleteShare(listId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (shareId: string) => sharesApi.delete(listId, shareId),
    onMutate: async (shareId) => {
      await queryClient.cancelQueries({ queryKey: sharesKey(listId) });
      const previous = queryClient.getQueryData<TaskListShare[]>(sharesKey(listId));
      if (previous) {
        queryClient.setQueryData(
          sharesKey(listId),
          previous.filter((s) => s.id !== shareId),
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(sharesKey(listId), context.previous);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sharesKey(listId) });
      queryClient.invalidateQueries({ queryKey: ['task-lists', listId] });
    },
  });
}
