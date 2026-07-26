'use client';

import { useEffect } from 'react';
import { useIsMutating, useQueryClient } from '@tanstack/react-query';

const POLL_INTERVAL_MS = 3000;

/**
 * Live-ish updates via polling — see useTaskListEvents for why this is not
 * SSE anymore.
 *
 * Unlike a task list, a template is read in a single database round trip, so
 * there is no cheaper token to poll for: asking for the template itself costs
 * exactly what asking whether it changed would. The interval is paused while
 * the tab is hidden and while a mutation is in flight, for the same reasons.
 */
export function useTemplateEvents(templateId: string) {
  const queryClient = useQueryClient();
  const isMutating = useIsMutating() > 0;

  useEffect(() => {
    if (!templateId || isMutating) return;

    const interval = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      queryClient.invalidateQueries({ queryKey: ['templates', templateId] });
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [templateId, isMutating, queryClient]);
}
