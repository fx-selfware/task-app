import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useMe } from './useAuth';

export function useTaskListEvents(listId: string) {
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const meIdRef = useRef(me?.id);

  useEffect(() => {
    meIdRef.current = me?.id;
  }, [me?.id]);

  useEffect(() => {
    if (!listId) return;

    const eventSource = new EventSource(`/api/task-lists/${listId}/events`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.userId && data.userId !== meIdRef.current) {
          queryClient.invalidateQueries({ queryKey: ['task-lists', listId] });
        }
      } catch {
        // Ignore malformed events
      }
    };

    return () => {
      eventSource.close();
    };
  }, [listId, queryClient]);
}
