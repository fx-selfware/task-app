'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/lib/api/admin';

export function useUsers() {
  return useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => adminApi.fetchUsers().then((r) => r.users),
  });
}

export function useResetPassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, newPassword }: { userId: string; newPassword: string }) =>
      adminApi.resetUserPassword(userId, newPassword),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}
