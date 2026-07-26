'use client';

import { useState } from 'react';
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { isRefusal } from '@/lib/api/client';
import { Toaster, showErrorToast } from '@/components/Toaster';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        // Writes are optimistic, so a failure would otherwise make the change
        // quietly vanish. One place to catch every one of them.
        mutationCache: new MutationCache({
          onError: (error) => {
            showErrorToast(error instanceof Error ? error.message : 'Something went wrong');
          },
        }),
        defaultOptions: {
          queries: {
            retry: (failureCount, error: unknown) =>
              isRefusal(error) ? false : failureCount < 2,
            // Navigating back to a list shouldn't refetch what was loaded a
            // moment ago; open lists are kept fresh by their own poll instead.
            staleTime: 30_000,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster />
    </QueryClientProvider>
  );
}
