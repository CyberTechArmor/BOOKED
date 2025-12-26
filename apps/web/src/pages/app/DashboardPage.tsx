import { useAuthStore } from '@/stores/auth';

export default function DashboardPage() {
  const { user, organization, logout } = useAuthStore();

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">BOOKED</h1>
              {organization && (
                <span className="ml-4 text-sm text-gray-500">{organization.name}</span>
              )}
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-700">{user?.name}</span>
              <button onClick={logout} className="btn-outline text-sm">
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card">
            <h3 className="text-lg font-medium text-gray-900">Upcoming Bookings</h3>
            <p className="text-3xl font-bold text-[var(--primary)] mt-2">0</p>
            <a href="/app/bookings" className="text-sm text-[var(--primary)] hover:underline mt-4 inline-block">
              View all bookings →
            </a>
          </div>

          <div className="card">
            <h3 className="text-lg font-medium text-gray-900">Event Types</h3>
            <p className="text-3xl font-bold text-[var(--primary)] mt-2">0</p>
            <a href="/app/event-types" className="text-sm text-[var(--primary)] hover:underline mt-4 inline-block">
              Manage event types →
            </a>
          </div>

          <div className="card">
            <h3 className="text-lg font-medium text-gray-900">Availability</h3>
            <p className="text-sm text-gray-500 mt-2">Configure your availability</p>
            <a href="/app/availability" className="text-sm text-[var(--primary)] hover:underline mt-4 inline-block">
              Set availability →
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
