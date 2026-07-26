'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

const POLL_INTERVAL_MS = 3000;

/**
 * Live-ish updates via polling — see useTaskListEvents for why this is not
 * SSE anymore.
 *
 * Unlike a task list, a template is read in a single database round trip, so
 * there is no cheaper token to poll for: asking for the template itself costs
 * exactly what asking whether it changed would.
 */
export function useTemplateEvents(templateId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!templateId) return;

    const interval = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      // Checked inside the tick rather than as an effect dependency: as a
      // dependency it would tear down and restart the interval on every
      // mutation, so anyone editing faster than the interval would never poll.
      if (queryClient.isMutating() > 0) return;
      queryClient.invalidateQueries({ queryKey: ['templates', templateId] });
    }, POLL_INTERVAL_MS);

    // Catch up immediately on returning to the tab.
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
