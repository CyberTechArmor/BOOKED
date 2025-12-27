import { create } from 'zustand';
import { useAuthStore } from './auth';

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';

// Helper to get organization headers
function getOrgHeaders(contentType = false): HeadersInit {
  const org = useAuthStore.getState().organization;
  const headers: HeadersInit = {};
  if (contentType) {
    headers['Content-Type'] = 'application/json';
  }
  if (org?.slug) {
    headers['X-Organization'] = org.slug;
  }
  return headers;
}

export interface Attendee {
  email: string;
  name: string;
  phone?: string;
}

export interface Booking {
  id: string;
  uid: string;
  eventTypeId?: string;
  hostId: string;
  startTime: string;
  endTime: string;
  timezone: string;
  title?: string;
  description?: string;
  status: BookingStatus;
  location?: string;
  attendee: Attendee;
  customFieldResponses?: Record<string, unknown>;
  cancelledAt?: string;
  cancelReason?: string;
  confirmedAt?: string;
  createdAt: string;
  updatedAt: string;
  eventType?: {
    id: string;
    title: string;
    slug: string;
  };
  host?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface ListBookingsQuery {
  status?: BookingStatus;
  startDate?: string;
  endDate?: string;
  hostId?: string;
  eventTypeId?: string;
  limit?: number;
  cursor?: string;
}

interface BookingState {
  bookings: Booking[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  cursor: string | null;
  fetchBookings: (query?: ListBookingsQuery) => Promise<void>;
  confirmBooking: (id: string) => Promise<void>;
  cancelBooking: (id: string, reason?: string) => Promise<void>;
}

export const useBookingStore = create<BookingState>((set, get) => ({
  bookings: [],
  isLoading: false,
  error: null,
  hasMore: false,
  cursor: null,

  fetchBookings: async (query: ListBookingsQuery = {}) => {
    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (query.status) params.append('status', query.status);
      if (query.startDate) params.append('startDate', query.startDate);
      if (query.endDate) params.append('endDate', query.endDate);
      if (query.hostId) params.append('hostId', query.hostId);
      if (query.eventTypeId) params.append('eventTypeId', query.eventTypeId);
      if (query.limit) params.append('limit', query.limit.toString());
      if (query.cursor) params.append('cursor', query.cursor);

      const response = await fetch(`/api/v1/bookings?${params.toString()}`, {
        headers: getOrgHeaders(),
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to fetch bookings');
      }

      const { data, pagination } = await response.json();
      set({
        bookings: query.cursor ? [...get().bookings, ...data] : data,
        isLoading: false,
        hasMore: pagination?.hasMore || false,
        cursor: pagination?.nextCursor || null,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch bookings',
        isLoading: false,
      });
    }
  },

  confirmBooking: async (id: string) => {
    const response = await fetch(`/api/v1/bookings/${id}/confirm`, {
      method: 'POST',
      headers: getOrgHeaders(),
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to confirm booking');
    }

    const { data } = await response.json();
    set({
      bookings: get().bookings.map((b) => (b.id === id ? data : b)),
    });
  },

  cancelBooking: async (id: string, reason?: string) => {
    const response = await fetch(`/api/v1/bookings/${id}/cancel`, {
      method: 'POST',
      headers: getOrgHeaders(true),
      credentials: 'include',
      body: JSON.stringify({ reason }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to cancel booking');
    }

    const { data } = await response.json();
    set({
      bookings: get().bookings.map((b) => (b.id === id ? data : b)),
    });
  },
}));
