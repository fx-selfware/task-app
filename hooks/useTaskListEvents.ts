'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function useTaskListEvents(listId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!listId) return;

    let isFirstOpen = true;
    const eventSource = new EventSource(`/api/task-lists/${listId}/events`);

    eventSource.onopen = () => {
      if (isFirstOpen) {
        isFirstOpen = false;
        return; // Skip invalidation on first open; useQuery already fetches it
      }
      // Refetch on reconnection after a connection drop
      queryClient.invalidateQueries({ queryKey: ['task-lists', listId] });
    };

    eventSource.onmessage = () => {
      queryClient.invalidateQueries({ queryKey: ['task-lists', listId] });
    };

    return () => {
      eventSource.close();
    };
  }, [listId, queryClient]);
}
