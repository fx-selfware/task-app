import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sharesApi } from '../api/shares';
import type { Permission } from '../types';

export function useShares(listId: string) {
  return useQuery({
    queryKey: ['shares', listId],
    queryFn: () => sharesApi.getAll(listId).then((r) => r.shares),
    enabled: !!listId,
  });
}

export function useCreateShare(listId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ email, permission }: { email: string; permission: Permission }) =>
      sharesApi.create(listId, email, permission),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shares', listId] });
      queryClient.invalidateQueries({ queryKey: ['task-lists', listId] });
    },
  });
}

export function useUpdateShare(listId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ shareId, permission }: { shareId: string; permission: Permission }) =>
      sharesApi.update(listId, shareId, permission),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shares', listId] });
    },
  });
}

export function useDeleteShare(listId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (shareId: string) => sharesApi.delete(listId, shareId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shares', listId] });
      queryClient.invalidateQueries({ queryKey: ['task-lists', listId] });
    },
  });
}
