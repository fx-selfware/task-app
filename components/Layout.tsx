'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMe } from '@/hooks/useAuth';

interface LayoutProps {
  children: React.ReactNode;
}

function isActive(pathname: string, to: string) {
  return pathname === to || pathname.startsWith(`${to}/`);
}

const ICON = {
  lists: <path d="M4 7h16M4 12h16M4 17h11" />,
  templates: (
    <>
      <path d="M8 4.5h10.5a1 1 0 0 1 1 1V16" />
      <path d="M4.5 8h11a1 1 0 0 1 1 1v10.5a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
    </>
  ),
};

/**
 * Bottom tabs, not a drawer.
 *
 * The hamburger spent the hardest-to-reach corner of the phone on a control
 * whose only job was revealing navigation, and put switching lists two taps
 * away. Tabs sit in the thumb zone and make it one.
 *
 * The You tab's icon is the account avatar, drawn from /api/auth/me. That is
 * deliberate: the session-resilience scenarios need something on screen that
 * cannot render unless the session was actually confirmed, and asserting on the
 * URL instead would pass on the frame before a client-side redirect fires. The
 * placeholder keeps the same box so nothing shifts when the name lands.
 */
export function Layout({ children }: LayoutProps) {
  const { data: user } = useMe();
  const pathname = usePathname();

  const tab = (href: string, label: string, icon: React.ReactNode, active: boolean) => (
    <Link
      href={href}
      className={`flex flex-1 flex-col items-center gap-1 py-1.5 text-[10px] ${
        active ? 'font-semibold text-teal-800 dark:text-teal-400' : 'text-gray-400'
      }`}
    >
      {icon}
      {label}
    </Link>
  );

  return (
    <div className="flex h-dvh flex-col bg-white dark:bg-gray-950">
      <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>

      <nav
        data-testid="tab-bar"
        className="flex shrink-0 items-stretch border-t border-gray-200 pb-2 pt-1.5 dark:border-gray-800"
      >
        {tab(
          '/task-lists',
          'Lists',
          <svg viewBox="0 0 24 24" className="h-[19px] w-[19px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            {ICON.lists}
          </svg>,
          isActive(pathname, '/task-lists'),
        )}
        {tab(
          '/templates',
          'Templates',
          <svg viewBox="0 0 24 24" className="h-[19px] w-[19px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            {ICON.templates}
          </svg>,
          isActive(pathname, '/templates'),
        )}
        <Link
          href="/you"
          data-testid="you-tab"
          className={`flex flex-1 flex-col items-center gap-1 py-1.5 text-[10px] ${
            isActive(pathname, '/you') ? 'font-semibold text-teal-800 dark:text-teal-400' : 'text-gray-400'
          }`}
        >
          {user ? (
            <span
              data-testid="account-initial"
              // Named from /me so it still proves the session was confirmed —
              // the initial alone would be too weak a signal to assert on.
              aria-label={user.name}
              className="flex h-[19px] w-[19px] items-center justify-center rounded-full bg-teal-800 text-[10px] font-bold text-white"
            >
              {user.name.charAt(0).toUpperCase()}
            </span>
          ) : (
            // AuthGuard renders the app alongside the session check rather than
            // behind it, so there is a moment with no account to show. Same box,
            // so nothing shifts when the name arrives.
            <span
              data-testid="account-loading"
              aria-hidden="true"
              className="h-[19px] w-[19px] animate-pulse rounded-full bg-gray-200 dark:bg-gray-700"
            />
          )}
          You
        </Link>
      </nav>
    </div>
  );
}
