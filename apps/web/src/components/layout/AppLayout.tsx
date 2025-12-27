import { useState, useCallback, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import { useThemeStore } from '@/stores/theme';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    path: '/app',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    label: 'Bookings',
    path: '/app/bookings',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    label: 'Event Types',
    path: '/app/event-types',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    label: 'Availability',
    path: '/app/availability',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: 'Settings',
    path: '/app/settings',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps): JSX.Element {
  const location = useLocation();
  const { user, organization, logout } = useAuthStore();
  const { theme, setTheme, resolvedTheme } = useThemeStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Apply theme on mount
  useEffect(() => {
    const root = document.documentElement;
    if (resolvedTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [resolvedTheme]);

  const handleLogout = useCallback(async () => {
    await logout();
  }, [logout]);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  const cycleTheme = useCallback(() => {
    const themes: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system'];
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
  }, [theme, setTheme]);

  const isActivePath = (path: string): boolean => {
    if (path === '/app') {
      return location.pathname === '/app';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="h-screen flex overflow-hidden" style={{ backgroundColor: 'var(--background)' }}>
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 flex flex-col
          transform transition-transform duration-200 ease-in-out
          lg:translate-x-0 lg:static lg:flex
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{
          backgroundColor: 'var(--card-bg)',
          borderRight: '1px solid var(--border)'
        }}
      >
        {/* Logo */}
        <div
          className="flex items-center justify-between h-16 px-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <Link to="/app" className="flex items-center gap-2">
            <span className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>BOOKED</span>
          </Link>
          <button
            onClick={closeSidebar}
            className="lg:hidden p-2 rounded-lg transition-colors"
            style={{ color: 'var(--muted)' }}
            aria-label="Close sidebar"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Organization */}
        {organization && (
          <div
            className="px-4 py-3 flex-shrink-0"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Organization</p>
            <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>{organization.name}</p>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = isActivePath(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={closeSidebar}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150"
                style={{
                  backgroundColor: isActive ? 'var(--primary)' : 'transparent',
                  color: isActive ? 'var(--background)' : 'var(--foreground-secondary)',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'var(--background-secondary)';
                    e.currentTarget.style.color = 'var(--foreground)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--foreground-secondary)';
                  }
                }}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Theme toggle */}
        <div className="px-3 py-2 flex-shrink-0">
          <button
            onClick={cycleTheme}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              color: 'var(--foreground-secondary)',
              backgroundColor: 'transparent'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--background-secondary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            {resolvedTheme === 'dark' ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            )}
            <span className="capitalize">{theme}</span>
          </button>
        </div>

        {/* User section */}
        <div
          className="p-4 flex-shrink-0"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium"
              style={{ backgroundColor: 'var(--primary)', color: 'var(--background)' }}
            >
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>{user?.name}</p>
              <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="mt-3 w-full px-3 py-2 text-sm font-medium rounded-lg transition-colors"
            style={{
              backgroundColor: 'var(--background-secondary)',
              color: 'var(--foreground)',
              border: '1px solid var(--border)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--border)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--background-secondary)';
            }}
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top header for mobile */}
        <header
          className="lg:hidden flex items-center justify-between h-16 px-4 flex-shrink-0"
          style={{
            backgroundColor: 'var(--card-bg)',
            borderBottom: '1px solid var(--border)'
          }}
        >
          <button
            onClick={toggleSidebar}
            className="p-2 -ml-2 rounded-lg"
            style={{ color: 'var(--muted)' }}
            aria-label="Open sidebar"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>BOOKED</span>
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium"
            style={{ backgroundColor: 'var(--primary)', color: 'var(--background)' }}
          >
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto" style={{ backgroundColor: 'var(--background)' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
