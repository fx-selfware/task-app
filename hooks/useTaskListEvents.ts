'use client';

import { useEffect, useRef } from 'react';
import { useIsMutating, useQuery, useQueryClient } from '@tanstack/react-query';
import { taskListsApi } from '@/lib/api/taskLists';

const POLL_INTERVAL_MS = 3000;

/**
 * Live-ish updates via polling. This replaced an SSE/EventSource
 * implementation when the app moved to serverless hosting: in-process
 * pub/sub can't reach subscribers held by other function instances.
 *
 * The poll asks for a change token rather than the list, so finding nothing
 * new costs one database round trip and a few bytes instead of two round trips
 * and every task in the list; the list is refetched only when the token moves.
 * react-query pauses the interval while the tab is hidden.
 */
export function useTaskListEvents(listId: string) {
  const queryClient = useQueryClient();
  // A poll landing mid-mutation would answer with pre-mutation data and
  // clobber the optimistic patch — visible as a flicker over a slow network.
  const isMutating = useIsMutating() > 0;

  const { data: version } = useQuery({
    queryKey: ['task-list-version', listId],
    queryFn: () => taskListsApi.getVersion(listId).then((r) => r.version),
    enabled: !!listId,
    refetchInterval: isMutating ? false : POLL_INTERVAL_MS,
    staleTime: 0,
    gcTime: 0,
  });

  const seen = useRef<string | null>(null);

  useEffect(() => {
    seen.current = null;
  }, [listId]);

  useEffect(() => {
    if (!version) return;
    // The first answer only establishes a baseline — it describes the list
    // that is already on screen.
    if (seen.current !== null && seen.current !== version) {
      queryClient.invalidateQueries({ queryKey: ['task-lists', listId] });
    }
    seen.current = version;
  }, [version, listId, queryClient]);
}
