import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { taskListsApi } from '../api/taskLists';

export function useTaskLists() {
  return useQuery({
    queryKey: ['task-lists'],
    queryFn: () => taskListsApi.getAll(),
  });
}

export function useTaskList(id: string) {
  return useQuery({
    queryKey: ['task-lists', id],
    queryFn: () => taskListsApi.getById(id),
    enabled: !!id,
  });
}

export function useCreateTaskList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => taskListsApi.create(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-lists'] });
    },
  });
}

export function useRenameTaskList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      taskListsApi.rename(id, name),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['task-lists'] });
      queryClient.invalidateQueries({ queryKey: ['task-lists', id] });
    },
  });
}

export function useDeleteTaskList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => taskListsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-lists'] });
    },
  });
}
