import { useState, useMemo } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useMe, useLogout } from '../hooks/useAuth';
import { useTaskLists } from '../hooks/useTaskLists';

interface LayoutProps {
  children: React.ReactNode;
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center rounded-lg px-2 py-2 text-sm transition-colors ${
    isActive
      ? 'bg-blue-50 text-blue-700 font-medium'
      : 'text-gray-700 hover:bg-gray-100'
  }`;

export function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { data: user } = useMe();
  const { data: listsData } = useTaskLists();
  const logout = useLogout();
  const navigate = useNavigate();

  const allLists = useMemo(
    () => [...(listsData?.owned ?? []), ...(listsData?.shared ?? [])],
    [listsData],
  );

  const handleLogout = async () => {
    await logout.mutateAsync().catch(() => {});
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 transform bg-white shadow-lg transition-transform duration-200 md:relative md:translate-x-0 md:shadow-none ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        data-testid="sidebar"
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-14 items-center border-b px-4">
            <Link to="/task-lists" onClick={() => setSidebarOpen(false)} className="text-lg font-bold text-blue-600">
              TaskApp
            </Link>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto p-3">
            <div className="mb-2">
              <p className="px-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                My Lists
              </p>
              <div className="mt-1 space-y-1">
                {allLists.map((list) => (
                  <NavLink
                    key={list.id}
                    to={`/task-lists/${list.id}`}
                    onClick={() => setSidebarOpen(false)}
                    className={navLinkClass}
                  >
                    <span className="truncate">{list.name}</span>
                    {list.role === 'shared' && (
                      <span className="ml-auto text-xs text-gray-400">shared</span>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <NavLink
                to="/task-lists"
                end
                onClick={() => setSidebarOpen(false)}
                className={navLinkClass}
              >
                All Lists
              </NavLink>
              <NavLink
                to="/templates"
                onClick={() => setSidebarOpen(false)}
                className={navLinkClass}
              >
                Templates
              </NavLink>
              {user?.role === 'ADMIN' && (
                <NavLink
                  to="/admin"
                  onClick={() => setSidebarOpen(false)}
                  className={navLinkClass}
                >
                  <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                  Admin
                </NavLink>
              )}
            </div>
          </nav>

          {/* User footer */}
          <div className="border-t p-3">
            <p className="mb-2 text-center text-xs text-gray-400">build {__APP_COMMIT__}</p>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-sm font-semibold">
                {user?.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-800">{user?.name}</p>
                <p className="truncate text-xs text-gray-500">{user?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="rounded p-2 text-gray-400 hover:text-gray-700"
                title="Log out"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Mobile header with hamburger */}
        <header className="flex h-14 items-center border-b bg-white px-4 md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="mr-3 rounded-lg p-2 text-gray-600 hover:bg-gray-100"
            aria-label="Open sidebar"
            data-testid="hamburger"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
          <Link to="/task-lists" onClick={() => setSidebarOpen(false)} className="text-lg font-bold text-blue-600">
            TaskApp
          </Link>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 pb-16 md:p-6 md:pb-16">{children}</main>
      </div>
    </div>
  );
}
