'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMe } from '@/hooks/useAuth';
import { Spinner } from '@/components/Spinner';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading, isError } = useMe();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && (isError || !user)) {
      router.replace('/login');
    }
  }, [isLoading, isError, user, router]);

  // Children render while /me is still in flight, so the page's own queries go
  // out in parallel with it rather than a round trip behind it. Anyone without
  // a session cookie was already redirected by middleware.ts; what's left here
  // is an expired or forged token, which lands on the branch below once /me
  // answers.
  if (!isLoading && (isError || !user)) {
    // Redirect is in flight (see effect above); show the loading state rather
    // than flashing protected content.
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return <>{children}</>;
}
