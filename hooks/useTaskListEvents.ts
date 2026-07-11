'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

const POLL_INTERVAL_MS = 3000;

/**
 * Live-ish updates via polling. This replaced an SSE/EventSource
 * implementation when the app moved to serverless hosting: in-process
 * pub/sub can't reach subscribers held by other function instances.
 * Polling is skipped while the tab is hidden.
 */
export function useTaskListEvents(listId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!listId) return;

    const interval = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      // A poll-triggered refetch mid-mutation would return pre-mutation data
      // and clobber optimistic updates (visible as UI flicker over a slow
      // network) — skip while any mutation is in flight.
      if (queryClient.isMutating() > 0) return;
      queryClient.invalidateQueries({ queryKey: ['task-lists', listId] });
    }, POLL_INTERVAL_MS);

    // Refetch immediately when the tab becomes visible again
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        queryClient.invalidateQueries({ queryKey: ['task-lists', listId] });
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [listId, queryClient]);
}
