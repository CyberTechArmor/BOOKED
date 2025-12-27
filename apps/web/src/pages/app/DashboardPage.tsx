import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useBookingStore } from '@/stores/bookings';
import { useEventTypeStore } from '@/stores/eventTypes';
import { useScheduleStore } from '@/stores/schedules';

export default function DashboardPage(): JSX.Element {
  const { bookings, fetchBookings } = useBookingStore();
  const { eventTypes, fetchEventTypes } = useEventTypeStore();
  const { schedules, fetchSchedules } = useScheduleStore();

  useEffect(() => {
    fetchBookings();
    fetchEventTypes();
    fetchSchedules();
  }, [fetchBookings, fetchEventTypes, fetchSchedules]);

  const upcomingBookings = bookings.filter(
    (b) =>
      (b.status === 'PENDING' || b.status === 'CONFIRMED') &&
      new Date(b.startTime) > new Date()
  );

  return (
    <div className="p-6 lg:p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link to="/app/bookings" className="card hover:shadow-md transition-shadow">
          <h3 className="text-lg font-medium text-gray-900">Upcoming Bookings</h3>
          <p className="text-3xl font-bold text-[var(--primary)] mt-2">
            {upcomingBookings.length}
          </p>
          <span className="text-sm text-[var(--primary)] mt-4 inline-block">
            View all bookings →
          </span>
        </Link>

        <Link to="/app/event-types" className="card hover:shadow-md transition-shadow">
          <h3 className="text-lg font-medium text-gray-900">Event Types</h3>
          <p className="text-3xl font-bold text-[var(--primary)] mt-2">
            {eventTypes.length}
          </p>
          <span className="text-sm text-[var(--primary)] mt-4 inline-block">
            Manage event types →
          </span>
        </Link>

        <Link to="/app/availability" className="card hover:shadow-md transition-shadow">
          <h3 className="text-lg font-medium text-gray-900">Availability</h3>
          <p className="text-3xl font-bold text-[var(--primary)] mt-2">
            {schedules.length}
          </p>
          <p className="text-sm text-gray-500">
            {schedules.length === 1 ? '1 schedule' : `${schedules.length} schedules`}
          </p>
          <span className="text-sm text-[var(--primary)] mt-4 inline-block">
            Set availability →
          </span>
        </Link>
      </div>

      {/* Quick actions */}
      <div className="mt-8">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link to="/app/event-types" className="btn-primary">
            Create Event Type
          </Link>
          <Link to="/app/availability" className="btn-outline">
            Set Availability
          </Link>
        </div>
      </div>
    </div>
  );
}
