import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';

interface EventType {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  durationMinutes: number;
  locationType: string;
  color: string | null;
  hosts: Array<{ userId: string; userName: string }>;
}

interface TimeSlot {
  start: string;
  end: string;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function BookingPage() {
  const { orgSlug, eventSlug } = useParams();
  const navigate = useNavigate();

  const [eventType, setEventType] = useState<EventType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Booking form
  const [step, setStep] = useState<'calendar' | 'form'>('calendar');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Fetch event type info
  useEffect(() => {
    async function fetchEventType() {
      try {
        const res = await fetch(`/api/v1/public/${orgSlug}/${eventSlug}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError('Event type not found');
          } else {
            setError('Failed to load event type');
          }
          return;
        }
        const data = await res.json();
        // API returns nested structure
        setEventType({
          ...data.data.eventType,
          color: data.data.organization?.primaryColor || '#0066FF',
        });
      } catch {
        setError('Failed to load event type');
      } finally {
        setLoading(false);
      }
    }
    fetchEventType();
  }, [orgSlug, eventSlug]);

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const days: Array<{ date: Date; isCurrentMonth: boolean; isToday: boolean; isPast: boolean }> = [];

    // Add days from previous month
    const startPadding = firstDay.getDay();
    for (let i = startPadding - 1; i >= 0; i--) {
      const date = new Date(year, month, -i);
      days.push({ date, isCurrentMonth: false, isToday: false, isPast: true });
    }

    // Add days of current month
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, month, d);
      const isToday = date.getTime() === today.getTime();
      const isPast = date < today;
      days.push({ date, isCurrentMonth: true, isToday, isPast });
    }

    // Add days from next month
    const endPadding = 42 - days.length;
    for (let i = 1; i <= endPadding; i++) {
      const date = new Date(year, month + 1, i);
      days.push({ date, isCurrentMonth: false, isToday: false, isPast: false });
    }

    return days;
  }, [currentMonth]);

  // Fetch available slots when date is selected
  useEffect(() => {
    if (!selectedDate || !eventType) return;

    const currentSelectedDate = selectedDate;
    const currentEventType = eventType;

    async function fetchSlots() {
      setLoadingSlots(true);
      try {
        const startDate = new Date(currentSelectedDate);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(currentSelectedDate);
        endDate.setHours(23, 59, 59, 999);
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

        const res = await fetch(
          `/api/v1/public/${orgSlug}/${eventSlug}/availability?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}&timezone=${tz}`
        );
        if (res.ok) {
          const data = await res.json();
          setAvailableSlots(data.data?.slots || generateMockSlots(currentSelectedDate, currentEventType.durationMinutes));
        } else {
          // Generate mock slots for demo
          setAvailableSlots(generateMockSlots(currentSelectedDate, currentEventType.durationMinutes));
        }
      } catch {
        setAvailableSlots(generateMockSlots(currentSelectedDate, currentEventType.durationMinutes));
      } finally {
        setLoadingSlots(false);
      }
    }
    fetchSlots();
  }, [selectedDate, eventType, orgSlug, eventSlug]);

  // Generate mock time slots for demo
  function generateMockSlots(date: Date, durationMinutes: number): TimeSlot[] {
    const slots: TimeSlot[] = [];
    const dayOfWeek = date.getDay();

    // No slots on weekends for demo
    if (dayOfWeek === 0 || dayOfWeek === 6) return slots;

    // Generate slots from 9am to 5pm
    for (let hour = 9; hour < 17; hour++) {
      const start = new Date(date);
      start.setHours(hour, 0, 0, 0);

      const end = new Date(start);
      end.setMinutes(end.getMinutes() + durationMinutes);

      // Only add if end time is within working hours
      if (end.getHours() <= 17) {
        slots.push({
          start: start.toISOString(),
          end: end.toISOString(),
        });
      }
    }

    return slots;
  }

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setSelectedSlot(null);
  };

  const handleSlotSelect = (slot: TimeSlot) => {
    setSelectedSlot(slot);
  };

  const handleContinue = () => {
    if (selectedSlot) {
      setStep('form');
    }
  };

  const handleBack = () => {
    setStep('calendar');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot || !eventType) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/public/${orgSlug}/${eventSlug}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startTime: selectedSlot.start,
          endTime: selectedSlot.end,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          attendee: {
            name: formData.name,
            email: formData.email,
          },
          customFieldResponses: formData.notes ? { notes: formData.notes } : undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        navigate(`/booking/confirmed/${data.data?.uid || 'success'}`);
      } else {
        const errorData = await res.json().catch(() => null);
        alert(errorData?.error?.message || 'Failed to book. Please try again.');
      }
    } catch {
      alert('Failed to book. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatSelectedDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !eventType) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">{error || 'Event not found'}</h1>
          <p className="text-gray-500">The booking link may be invalid or the event type has been removed.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Header */}
          <div
            className="px-6 py-5 border-b border-gray-100"
            style={{ borderTopWidth: 4, borderTopColor: eventType.color || '#0066FF' }}
          >
            <h1 className="text-xl font-semibold text-gray-900">{eventType.title}</h1>
            {eventType.description && (
              <p className="text-gray-500 mt-1">{eventType.description}</p>
            )}
            <div className="flex items-center gap-4 mt-3 text-sm text-gray-600">
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {eventType.durationMinutes} minutes
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                {eventType.locationType === 'MEET' ? 'Video Call' : eventType.locationType}
              </span>
            </div>
          </div>

          {/* Content */}
          {step === 'calendar' ? (
            <div className="flex flex-col md:flex-row">
              {/* Calendar */}
              <div className="flex-1 p-6 border-b md:border-b-0 md:border-r border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-gray-900">
                    {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                  </h2>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-1 mb-2">
                  {DAYS.map(day => (
                    <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((day, i) => {
                    const isSelected = selectedDate &&
                      day.date.toDateString() === selectedDate.toDateString();
                    const isDisabled = day.isPast || !day.isCurrentMonth;

                    return (
                      <button
                        key={i}
                        onClick={() => !isDisabled && handleDateSelect(day.date)}
                        disabled={isDisabled}
                        className={`
                          relative h-10 rounded-lg text-sm font-medium transition-all
                          ${isSelected
                            ? 'bg-blue-600 text-white'
                            : day.isToday
                              ? 'bg-blue-50 text-blue-600'
                              : isDisabled
                                ? 'text-gray-300 cursor-not-allowed'
                                : 'text-gray-700 hover:bg-gray-100'
                          }
                        `}
                      >
                        {day.date.getDate()}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time Slots */}
              <div className="w-full md:w-72 p-6">
                {selectedDate ? (
                  <>
                    <h3 className="font-medium text-gray-900 mb-4">
                      {formatSelectedDate(selectedDate)}
                    </h3>

                    {loadingSlots ? (
                      <div className="flex justify-center py-8">
                        <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
                      </div>
                    ) : availableSlots.length > 0 ? (
                      <div className="space-y-2 max-h-80 overflow-y-auto">
                        {availableSlots.map((slot, i) => (
                          <button
                            key={i}
                            onClick={() => handleSlotSelect(slot)}
                            className={`
                              w-full px-4 py-3 rounded-lg border text-sm font-medium transition-all
                              ${selectedSlot?.start === slot.start
                                ? 'border-blue-600 bg-blue-50 text-blue-600'
                                : 'border-gray-200 hover:border-blue-300 text-gray-700'
                              }
                            `}
                          >
                            {formatTime(slot.start)}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm py-4">
                        No available times on this date
                      </p>
                    )}

                    {selectedSlot && (
                      <button
                        onClick={handleContinue}
                        className="btn-primary w-full mt-4"
                      >
                        Continue
                      </button>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p>Select a date to see available times</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Booking Form */
            <div className="p-6">
              <button
                onClick={handleBack}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>

              <div className="max-w-md mx-auto">
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium text-gray-900">{formatSelectedDate(selectedDate!)}</span>
                    <br />
                    {formatTime(selectedSlot!.start)} - {formatTime(selectedSlot!.end)}
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Your Name *
                    </label>
                    <input
                      type="text"
                      required
                      className="input"
                      placeholder="John Smith"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      className="input"
                      placeholder="john@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Additional Notes
                    </label>
                    <textarea
                      className="input resize-none"
                      rows={3}
                      placeholder="Anything you'd like us to know?"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-primary w-full"
                  >
                    {submitting ? 'Scheduling...' : 'Schedule Meeting'}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-gray-400 mt-6">
          Powered by <span className="font-medium">BOOKED</span>
        </p>
      </div>
    </div>
  );
}
