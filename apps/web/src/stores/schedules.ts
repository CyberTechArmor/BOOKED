import { create } from 'zustand';

export interface ScheduleWindow {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  specificDate?: string | null;
  isAvailable: boolean;
}

export interface Schedule {
  id: string;
  name: string;
  isDefault: boolean;
  bufferBefore?: number | null;
  bufferAfter?: number | null;
  minimumNotice?: number | null;
  maxBookingsPerDay?: number | null;
  maxBookingsPerWeek?: number | null;
  windows: ScheduleWindow[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateScheduleInput {
  name: string;
  isDefault?: boolean;
  bufferBefore?: number | null;
  bufferAfter?: number | null;
  minimumNotice?: number | null;
  maxBookingsPerDay?: number | null;
  maxBookingsPerWeek?: number | null;
  windows?: Omit<ScheduleWindow, 'id'>[];
}

export interface ScheduleWindowInput {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  specificDate?: string | null;
  isAvailable?: boolean;
}

interface ScheduleState {
  schedules: Schedule[];
  isLoading: boolean;
  error: string | null;
  fetchSchedules: () => Promise<void>;
  createSchedule: (input: CreateScheduleInput) => Promise<Schedule>;
  updateSchedule: (id: string, input: Partial<CreateScheduleInput>) => Promise<Schedule>;
  deleteSchedule: (id: string) => Promise<void>;
  addWindow: (scheduleId: string, window: ScheduleWindowInput) => Promise<ScheduleWindow>;
  deleteWindow: (scheduleId: string, windowId: string) => Promise<void>;
}

export const useScheduleStore = create<ScheduleState>((set, get) => ({
  schedules: [],
  isLoading: false,
  error: null,

  fetchSchedules: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch('/api/v1/schedules', {
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to fetch schedules');
      }

      const { data } = await response.json();
      set({ schedules: data, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch schedules',
        isLoading: false
      });
    }
  },

  createSchedule: async (input: CreateScheduleInput) => {
    const response = await fetch('/api/v1/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to create schedule');
    }

    const { data } = await response.json();
    set({ schedules: [...get().schedules, data] });
    return data;
  },

  updateSchedule: async (id: string, input: Partial<CreateScheduleInput>) => {
    const response = await fetch(`/api/v1/schedules/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to update schedule');
    }

    const { data } = await response.json();
    set({
      schedules: get().schedules.map((s) => (s.id === id ? data : s)),
    });
    return data;
  },

  deleteSchedule: async (id: string) => {
    const response = await fetch(`/api/v1/schedules/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to delete schedule');
    }

    set({
      schedules: get().schedules.filter((s) => s.id !== id),
    });
  },

  addWindow: async (scheduleId: string, window: ScheduleWindowInput) => {
    const response = await fetch(`/api/v1/schedules/${scheduleId}/windows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(window),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to add time window');
    }

    const { data } = await response.json();

    // Update the schedule with the new window
    set({
      schedules: get().schedules.map((s) =>
        s.id === scheduleId
          ? { ...s, windows: [...s.windows, data] }
          : s
      ),
    });

    return data;
  },

  deleteWindow: async (scheduleId: string, windowId: string) => {
    const response = await fetch(`/api/v1/schedules/${scheduleId}/windows/${windowId}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to delete time window');
    }

    set({
      schedules: get().schedules.map((s) =>
        s.id === scheduleId
          ? { ...s, windows: s.windows.filter((w) => w.id !== windowId) }
          : s
      ),
    });
  },
}));
