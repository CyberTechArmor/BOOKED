import { useEffect, useState } from 'react';
import { useBookingStore, Booking, BookingStatus } from '@/stores/bookings';

const STATUS_OPTIONS: { value: BookingStatus | ''; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'NO_SHOW', label: 'No Show' },
];

const STATUS_COLORS: Record<BookingStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
  COMPLETED: 'bg-blue-100 text-blue-800',
  NO_SHOW: 'bg-gray-100 text-gray-800',
};

function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDuration(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const durationMs = endDate.getTime() - startDate.getTime();
  const minutes = Math.round(durationMs / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) return `${hours} hr`;
  return `${hours} hr ${remainingMinutes} min`;
}

export default function BookingsPage() {
  const {
    bookings,
    isLoading,
    error,
    fetchBookings,
    confirmBooking,
    cancelBooking,
  } = useBookingStore();

  const [statusFilter, setStatusFilter] = useState<BookingStatus | ''>('');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => {
    fetchBookings(statusFilter ? { status: statusFilter } : {});
  }, [fetchBookings, statusFilter]);

  const handleConfirm = async (booking: Booking) => {
    try {
      await confirmBooking(booking.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to confirm booking');
    }
  };

  const handleCancelClick = (booking: Booking) => {
    setSelectedBooking(booking);
    setCancelReason('');
    setShowCancelModal(true);
  };

  const handleCancelConfirm = async () => {
    if (!selectedBooking) return;

    try {
      await cancelBooking(selectedBooking.id, cancelReason || undefined);
      setShowCancelModal(false);
      setSelectedBooking(null);
      setCancelReason('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to cancel booking');
    }
  };

  const upcomingBookings = bookings.filter(
    (b) =>
      (b.status === 'PENDING' || b.status === 'CONFIRMED') &&
      new Date(b.startTime) > new Date()
  );

  const pastBookings = bookings.filter(
    (b) =>
      b.status === 'COMPLETED' ||
      b.status === 'NO_SHOW' ||
      b.status === 'CANCELLED' ||
      new Date(b.startTime) <= new Date()
  );

  if (isLoading && bookings.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Bookings</h1>
        <div className="card">
          <p className="text-gray-500">Loading bookings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
          <div className="flex gap-4">
            <select
              className="input w-48"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as BookingStatus | '')}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Cancel Modal */}
        {showCancelModal && selectedBooking && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Cancel Booking</h2>
              <p className="text-gray-600 mb-4">
                Are you sure you want to cancel the booking with{' '}
                <strong>{selectedBooking.attendee.name}</strong>?
              </p>

              <div className="mb-4">
                <label className="label">Reason (optional)</label>
                <textarea
                  className="input"
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Enter a reason for cancellation..."
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleCancelConfirm}
                  className="btn-danger flex-1"
                >
                  Cancel Booking
                </button>
                <button
                  onClick={() => {
                    setShowCancelModal(false);
                    setSelectedBooking(null);
                  }}
                  className="btn-outline"
                >
                  Keep Booking
                </button>
              </div>
            </div>
          </div>
        )}

        {bookings.length === 0 ? (
          <div className="card text-center py-12">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">No bookings yet</h3>
            <p className="mt-2 text-gray-500">
              When someone books time with you, it will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Upcoming Bookings */}
            {upcomingBookings.length > 0 && (
              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-4">
                  Upcoming ({upcomingBookings.length})
                </h2>
                <div className="space-y-3">
                  {upcomingBookings.map((booking) => (
                    <BookingCard
                      key={booking.id}
                      booking={booking}
                      onConfirm={handleConfirm}
                      onCancel={handleCancelClick}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Past Bookings */}
            {pastBookings.length > 0 && (
              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-4">
                  Past ({pastBookings.length})
                </h2>
                <div className="space-y-3">
                  {pastBookings.map((booking) => (
                    <BookingCard
                      key={booking.id}
                      booking={booking}
                      onConfirm={handleConfirm}
                      onCancel={handleCancelClick}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface BookingCardProps {
  booking: Booking;
  onConfirm: (booking: Booking) => void;
  onCancel: (booking: Booking) => void;
}

function BookingCard({ booking, onConfirm, onCancel }: BookingCardProps) {
  const isPast = new Date(booking.startTime) < new Date();
  const canConfirm = booking.status === 'PENDING' && !isPast;
  const canCancel = (booking.status === 'PENDING' || booking.status === 'CONFIRMED') && !isPast;

  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="font-medium text-gray-900">
              {booking.title || booking.eventType?.title || 'Meeting'}
            </h3>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                STATUS_COLORS[booking.status]
              }`}
            >
              {booking.status}
            </span>
          </div>

          <div className="space-y-1 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>{formatDateTime(booking.startTime)}</span>
              <span className="text-gray-400">({formatDuration(booking.startTime, booking.endTime)})</span>
            </div>

            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>{booking.attendee.name}</span>
              <span className="text-gray-400">({booking.attendee.email})</span>
            </div>

            {booking.location && (
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>{booking.location}</span>
              </div>
            )}

            {booking.cancelReason && (
              <div className="mt-2 p-2 bg-red-50 rounded text-red-700 text-xs">
                Cancellation reason: {booking.cancelReason}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 ml-4">
          {canConfirm && (
            <button
              onClick={() => onConfirm(booking)}
              className="btn-primary text-sm"
            >
              Confirm
            </button>
          )}
          {canCancel && (
            <button
              onClick={() => onCancel(booking)}
              className="btn-outline text-sm text-red-600 hover:text-red-700"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
