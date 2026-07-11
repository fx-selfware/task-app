'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

const POLL_INTERVAL_MS = 3000;

/**
 * Live-ish updates via polling — see useTaskListEvents for why this is not
 * SSE anymore.
 */
export function useTemplateEvents(templateId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!templateId) return;

    const interval = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      // Skip while mutating — see useTaskListEvents for the race this avoids.
      if (queryClient.isMutating() > 0) return;
      queryClient.invalidateQueries({ queryKey: ['templates', templateId] });
    }, POLL_INTERVAL_MS);

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        queryClient.invalidateQueries({ queryKey: ['templates', templateId] });
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [templateId, queryClient]);
}
