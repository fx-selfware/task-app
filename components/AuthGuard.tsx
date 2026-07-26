'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMe } from '@/hooks/useAuth';
import { isRefusal } from '@/lib/api/client';
import { Button } from '@/components/Button';
import { Spinner } from '@/components/Spinner';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isError, error, refetch, isFetching } = useMe();
  const router = useRouter();

  // Being signed out means the server looked at the token and refused it.
  // Failing to ask at all is a different thing, and leaves the session
  // perfectly good — a cold launch is when the network is least reliable, and
  // treating a stumble there as a logout sent people back to a login form that
  // their password was never the problem with.
  const signedOut = isError && isRefusal(error);
  const unreachable = isError && !signedOut;

  useEffect(() => {
    if (signedOut) router.replace('/login');
  }, [signedOut, router]);

  // Children render while /me is still in flight, so the page's own queries go
  // out in parallel with it rather than a round trip behind it. Anyone without
  // a session cookie was already redirected by middleware.ts; what's left here
  // is an expired or forged token, which lands on the branch below once /me
  // answers.
  if (signedOut) {
    // Redirect is in flight (see effect above); show the loading state rather
    // than flashing protected content.
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (unreachable) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-xl font-semibold text-gray-800">Can&apos;t reach the server</h1>
          <p className="mt-2 text-sm text-gray-500">
            You&apos;re still signed in — this looks like a connection problem.
          </p>
          <Button className="mt-6" loading={isFetching} onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
