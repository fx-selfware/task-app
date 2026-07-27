'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMe, useLogout } from '@/hooks/useAuth';

/**
 * Everything the sidebar footer used to carry, in the place people look for it.
 *
 * Log out was previously a bare icon with a `title` attribute — invisible on a
 * touch device, where there is no hover. It gets a labelled row here.
 */
export default function YouPage() {
  const { data: user } = useMe();
  const logout = useLogout();
  const router = useRouter();

  const build = process.env.NEXT_PUBLIC_APP_COMMIT ?? 'dev';

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="px-4 pb-2 pt-3 text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">You</h1>

      <div className="flex items-center gap-3 border-y border-gray-200 px-4 py-3 dark:border-gray-800">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-800 text-base font-bold text-white">
          {user ? user.name.charAt(0).toUpperCase() : ''}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-gray-900 dark:text-gray-100">{user?.name ?? ''}</span>
          <span className="block truncate text-sm text-gray-500">{user?.email ?? ''}</span>
        </span>
        {user?.role === 'ADMIN' && <span className="text-xs font-semibold text-gray-500">Admin</span>}
      </div>

      {user?.role === 'ADMIN' && (
        <>
          <p className="px-4 pb-1 pt-5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Administration
          </p>
          <Link
            href="/admin"
            className="flex items-center gap-3 border-y border-gray-200 px-4 py-3 text-[15px] text-gray-900 dark:border-gray-800 dark:text-gray-100"
          >
            User management
            <svg viewBox="0 0 24 24" className="ml-auto h-4 w-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 5.5l6.5 6.5L10 18.5" />
            </svg>
          </Link>
        </>
      )}

      <p className="px-4 pb-1 pt-5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">App</p>
      <div className="flex items-center gap-3 border-y border-gray-200 px-4 py-3 text-[15px] dark:border-gray-800">
        <span className="text-gray-900 dark:text-gray-100">Build</span>
        <span data-testid="build-hash" className="ml-auto font-mono text-sm text-gray-500">
          {build}
        </span>
      </div>

      <button
        type="button"
        onClick={async () => {
          await logout.mutateAsync().catch(() => {});
          router.push('/login');
        }}
        className="mt-3 w-full border-y border-gray-200 px-4 py-3 text-left text-[15px] font-medium text-red-600 dark:border-gray-800"
      >
        Log out
      </button>
    </div>
  );
}
