import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function useTaskListEvents(listId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!listId) return;

    const eventSource = new EventSource(`/api/task-lists/${listId}/events`);

    eventSource.onmessage = () => {
      queryClient.invalidateQueries({ queryKey: ['task-lists', listId] });
    };

    return () => {
      eventSource.close();
    };
  }, [listId, queryClient]);
}
