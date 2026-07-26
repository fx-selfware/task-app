'use client';

import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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

  const { data: version, dataUpdatedAt, isError } = useQuery({
    queryKey: ['task-list-version', listId],
    queryFn: () => taskListsApi.getVersion(listId).then((r) => r.version),
    enabled: !!listId,
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });

  // The token this client has actually caught up to. It only advances once a
  // refetch has landed, so a refetch that fails or gets cancelled is retried
  // on the next poll instead of being silently skipped forever.
  const applied = useRef<string | null>(null);

  useEffect(() => {
    applied.current = null;
  }, [listId]);

  useEffect(() => {
    // Losing access (a revoked share) turns this into a 404. Refetching the
    // list surfaces that as "List not found" instead of leaving stale contents
    // on screen indefinitely.
    if (isError) {
      queryClient.invalidateQueries({ queryKey: ['task-lists', listId] });
      return;
    }

    if (!version) return;

    // The first answer only establishes a baseline — it describes the list
    // that is already on screen.
    if (applied.current === null) {
      applied.current = version;
      return;
    }
    if (applied.current === version) return;

    // A poll landing mid-mutation would answer with pre-mutation data and
    // clobber the optimistic patch. Skipping without advancing `applied` means
    // the next tick picks it up. `dataUpdatedAt` is a dependency so this runs
    // on every poll response, not only when the token changes.
    if (queryClient.isMutating() > 0) return;

    let cancelled = false;
    const target = version;
    queryClient.invalidateQueries({ queryKey: ['task-lists', listId] }).then(() => {
      const state = queryClient.getQueryState(['task-lists', listId]);
      if (!cancelled && state?.status === 'success') applied.current = target;
    });

    return () => {
      cancelled = true;
    };
  }, [version, dataUpdatedAt, isError, listId, queryClient]);
}
