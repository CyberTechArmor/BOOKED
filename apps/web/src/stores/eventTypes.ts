import { create } from 'zustand';
import { useAuthStore } from './auth';

export type AssignmentType = 'SINGLE' | 'ROUND_ROBIN' | 'COLLECTIVE';
export type LocationType = 'MEET' | 'PHONE' | 'IN_PERSON' | 'CUSTOM';

export interface CustomField {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'checkbox' | 'phone' | 'email';
  required: boolean;
  options?: string[];
  placeholder?: string;
}

export interface EventType {
  id: string;
  title: string;
  slug: string;
  description?: string;
  durationMinutes: number;
  isActive: boolean;
  isPublic: boolean;
  requiresConfirmation: boolean;
  assignmentType: AssignmentType;
  locationType: LocationType;
  locationValue?: string;
  color?: string;
  customFields: CustomField[];
  bufferBefore?: number;
  bufferAfter?: number;
  minimumNotice?: number;
  maxBookingsPerDay?: number;
  maxBookingsPerWeek?: number;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEventTypeInput {
  title: string;
  slug: string;
  description?: string;
  durationMinutes?: number;
  isActive?: boolean;
  isPublic?: boolean;
  requiresConfirmation?: boolean;
  assignmentType?: AssignmentType;
  locationType?: LocationType;
  locationValue?: string;
  color?: string;
  customFields?: CustomField[];
  bufferBefore?: number;
  bufferAfter?: number;
  minimumNotice?: number;
  maxBookingsPerDay?: number;
  maxBookingsPerWeek?: number;
}

// Helper to get organization headers
function getOrgHeaders(): HeadersInit {
  const org = useAuthStore.getState().organization;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (org?.slug) {
    headers['X-Organization'] = org.slug;
  }
  return headers;
}

interface EventTypeState {
  eventTypes: EventType[];
  isLoading: boolean;
  error: string | null;
  fetchEventTypes: () => Promise<void>;
  createEventType: (input: CreateEventTypeInput) => Promise<EventType>;
  updateEventType: (id: string, input: Partial<CreateEventTypeInput>) => Promise<EventType>;
  deleteEventType: (id: string) => Promise<void>;
}

export const useEventTypeStore = create<EventTypeState>((set, get) => ({
  eventTypes: [],
  isLoading: false,
  error: null,

  fetchEventTypes: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch('/api/v1/event-types', {
        headers: getOrgHeaders(),
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to fetch event types');
      }

      const { data } = await response.json();
      set({ eventTypes: data, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch event types',
        isLoading: false
      });
    }
  },

  createEventType: async (input: CreateEventTypeInput) => {
    const response = await fetch('/api/v1/event-types', {
      method: 'POST',
      headers: getOrgHeaders(),
      credentials: 'include',
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to create event type');
    }

    const { data } = await response.json();
    set({ eventTypes: [...get().eventTypes, data] });
    return data;
  },

  updateEventType: async (id: string, input: Partial<CreateEventTypeInput>) => {
    const response = await fetch(`/api/v1/event-types/${id}`, {
      method: 'PATCH',
      headers: getOrgHeaders(),
      credentials: 'include',
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to update event type');
    }

    const { data } = await response.json();
    set({
      eventTypes: get().eventTypes.map((et) => (et.id === id ? data : et)),
    });
    return data;
  },

  deleteEventType: async (id: string) => {
    const response = await fetch(`/api/v1/event-types/${id}`, {
      method: 'DELETE',
      headers: getOrgHeaders(),
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to delete event type');
    }

    set({
      eventTypes: get().eventTypes.filter((et) => et.id !== id),
    });
  },
}));
