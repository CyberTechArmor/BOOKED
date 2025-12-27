import { useEffect, useState } from 'react';
import { useScheduleStore, Schedule, ScheduleWindowInput } from '@/stores/schedules';

const DAYS_OF_WEEK = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const minute = i % 2 === 0 ? '00' : '30';
  return `${hour.toString().padStart(2, '0')}:${minute}`;
});

interface ScheduleFormData {
  name: string;
  isDefault: boolean;
  bufferBefore: string;
  bufferAfter: string;
  minimumNotice: string;
  maxBookingsPerDay: string;
  maxBookingsPerWeek: string;
}

const initialFormData: ScheduleFormData = {
  name: '',
  isDefault: false,
  bufferBefore: '',
  bufferAfter: '',
  minimumNotice: '',
  maxBookingsPerDay: '',
  maxBookingsPerWeek: '',
};

export default function AvailabilityPage() {
  const {
    schedules,
    isLoading,
    error,
    fetchSchedules,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    addWindow,
    deleteWindow,
  } = useScheduleStore();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [formData, setFormData] = useState<ScheduleFormData>(initialFormData);
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [showAddWindow, setShowAddWindow] = useState(false);
  const [windowForm, setWindowForm] = useState<ScheduleWindowInput>({
    dayOfWeek: 1,
    startTime: '09:00',
    endTime: '17:00',
    isAvailable: true,
  });

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  useEffect(() => {
    if (schedules.length > 0 && !selectedSchedule) {
      setSelectedSchedule(schedules[0]);
    }
  }, [schedules, selectedSchedule]);

  const handleCreateNew = () => {
    setFormData(initialFormData);
    setEditingSchedule(null);
    setShowCreateForm(true);
    setFormError(null);
  };

  const handleEdit = (schedule: Schedule) => {
    setFormData({
      name: schedule.name,
      isDefault: schedule.isDefault,
      bufferBefore: schedule.bufferBefore?.toString() || '',
      bufferAfter: schedule.bufferAfter?.toString() || '',
      minimumNotice: schedule.minimumNotice?.toString() || '',
      maxBookingsPerDay: schedule.maxBookingsPerDay?.toString() || '',
      maxBookingsPerWeek: schedule.maxBookingsPerWeek?.toString() || '',
    });
    setEditingSchedule(schedule);
    setShowCreateForm(true);
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.name.trim()) {
      setFormError('Schedule name is required');
      return;
    }

    const payload = {
      name: formData.name.trim(),
      isDefault: formData.isDefault,
      bufferBefore: formData.bufferBefore ? parseInt(formData.bufferBefore) : null,
      bufferAfter: formData.bufferAfter ? parseInt(formData.bufferAfter) : null,
      minimumNotice: formData.minimumNotice ? parseInt(formData.minimumNotice) : null,
      maxBookingsPerDay: formData.maxBookingsPerDay ? parseInt(formData.maxBookingsPerDay) : null,
      maxBookingsPerWeek: formData.maxBookingsPerWeek ? parseInt(formData.maxBookingsPerWeek) : null,
    };

    try {
      if (editingSchedule) {
        const updated = await updateSchedule(editingSchedule.id, payload);
        if (selectedSchedule?.id === editingSchedule.id) {
          setSelectedSchedule(updated);
        }
      } else {
        const created = await createSchedule(payload);
        setSelectedSchedule(created);
      }
      setShowCreateForm(false);
      setFormData(initialFormData);
      setEditingSchedule(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save schedule');
    }
  };

  const handleDelete = async (schedule: Schedule) => {
    if (!confirm(`Are you sure you want to delete "${schedule.name}"?`)) {
      return;
    }

    try {
      await deleteSchedule(schedule.id);
      if (selectedSchedule?.id === schedule.id) {
        setSelectedSchedule(schedules.find((s) => s.id !== schedule.id) || null);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete schedule');
    }
  };

  const handleAddWindow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchedule) return;

    try {
      await addWindow(selectedSchedule.id, windowForm);
      setShowAddWindow(false);
      setWindowForm({
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '17:00',
        isAvailable: true,
      });
      // Refresh the selected schedule
      const updated = schedules.find((s) => s.id === selectedSchedule.id);
      if (updated) setSelectedSchedule({ ...updated });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add time window');
    }
  };

  const handleDeleteWindow = async (windowId: string) => {
    if (!selectedSchedule) return;
    if (!confirm('Are you sure you want to delete this time window?')) return;

    try {
      await deleteWindow(selectedSchedule.id, windowId);
      // Update selected schedule
      setSelectedSchedule({
        ...selectedSchedule,
        windows: selectedSchedule.windows.filter((w) => w.id !== windowId),
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete time window');
    }
  };

  const getWindowsForDay = (dayOfWeek: number) => {
    if (!selectedSchedule) return [];
    return selectedSchedule.windows.filter((w) => w.dayOfWeek === dayOfWeek);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Availability</h1>
        <div className="card">
          <p className="text-gray-500">Loading schedules...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Availability</h1>
          <button onClick={handleCreateNew} className="btn-primary">
            Create Schedule
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Create/Edit Schedule Modal */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                {editingSchedule ? 'Edit Schedule' : 'Create Schedule'}
              </h2>

              {formError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                  {formError}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label className="label">Schedule Name *</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Working Hours"
                  />
                </div>

                <div className="mb-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.isDefault}
                      onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">Set as default schedule</span>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="label">Buffer Before (min)</label>
                    <input
                      type="number"
                      className="input"
                      value={formData.bufferBefore}
                      onChange={(e) => setFormData({ ...formData, bufferBefore: e.target.value })}
                      min="0"
                      max="120"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="label">Buffer After (min)</label>
                    <input
                      type="number"
                      className="input"
                      value={formData.bufferAfter}
                      onChange={(e) => setFormData({ ...formData, bufferAfter: e.target.value })}
                      min="0"
                      max="120"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="label">Minimum Notice (hours)</label>
                  <input
                    type="number"
                    className="input"
                    value={formData.minimumNotice}
                    onChange={(e) => setFormData({ ...formData, minimumNotice: e.target.value })}
                    min="0"
                    max="720"
                    placeholder="0"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="label">Max Bookings/Day</label>
                    <input
                      type="number"
                      className="input"
                      value={formData.maxBookingsPerDay}
                      onChange={(e) => setFormData({ ...formData, maxBookingsPerDay: e.target.value })}
                      min="1"
                      max="100"
                      placeholder="No limit"
                    />
                  </div>
                  <div>
                    <label className="label">Max Bookings/Week</label>
                    <input
                      type="number"
                      className="input"
                      value={formData.maxBookingsPerWeek}
                      onChange={(e) => setFormData({ ...formData, maxBookingsPerWeek: e.target.value })}
                      min="1"
                      max="500"
                      placeholder="No limit"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button type="submit" className="btn-primary flex-1">
                    {editingSchedule ? 'Save Changes' : 'Create Schedule'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateForm(false);
                      setEditingSchedule(null);
                    }}
                    className="btn-outline"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Add Time Window Modal */}
        {showAddWindow && selectedSchedule && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Add Time Window</h2>

              <form onSubmit={handleAddWindow}>
                <div className="mb-4">
                  <label className="label">Day of Week</label>
                  <select
                    className="input"
                    value={windowForm.dayOfWeek}
                    onChange={(e) => setWindowForm({ ...windowForm, dayOfWeek: parseInt(e.target.value) })}
                  >
                    {DAYS_OF_WEEK.map((day, index) => (
                      <option key={day} value={index}>
                        {day}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="label">Start Time</label>
                    <select
                      className="input"
                      value={windowForm.startTime}
                      onChange={(e) => setWindowForm({ ...windowForm, startTime: e.target.value })}
                    >
                      {TIME_OPTIONS.map((time) => (
                        <option key={time} value={time}>
                          {time}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">End Time</label>
                    <select
                      className="input"
                      value={windowForm.endTime}
                      onChange={(e) => setWindowForm({ ...windowForm, endTime: e.target.value })}
                    >
                      {TIME_OPTIONS.map((time) => (
                        <option key={time} value={time}>
                          {time}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button type="submit" className="btn-primary flex-1">
                    Add Time Window
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddWindow(false)}
                    className="btn-outline"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {schedules.length === 0 ? (
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
            <h3 className="mt-4 text-lg font-medium text-gray-900">No schedules yet</h3>
            <p className="mt-2 text-gray-500">
              Create a schedule to define when you're available for bookings.
            </p>
            <button onClick={handleCreateNew} className="btn-primary mt-4">
              Create Your First Schedule
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Schedule List */}
            <div className="lg:col-span-1">
              <div className="card">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Your Schedules</h2>
                <div className="space-y-2">
                  {schedules.map((schedule) => (
                    <div
                      key={schedule.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedSchedule?.id === schedule.id
                          ? 'border-[var(--primary)] bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedSchedule(schedule)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium text-gray-900">{schedule.name}</h3>
                          {schedule.isDefault && (
                            <span className="text-xs text-[var(--primary)]">Default</span>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(schedule);
                            }}
                            className="p-1 text-gray-500 hover:text-gray-700"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(schedule);
                            }}
                            className="p-1 text-gray-500 hover:text-red-600"
                            title="Delete"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {schedule.windows.length} time window{schedule.windows.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Schedule Details */}
            <div className="lg:col-span-2">
              {selectedSchedule ? (
                <div className="card">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-lg font-medium text-gray-900">{selectedSchedule.name}</h2>
                      {selectedSchedule.isDefault && (
                        <span className="text-sm text-[var(--primary)]">Default Schedule</span>
                      )}
                    </div>
                    <button onClick={() => setShowAddWindow(true)} className="btn-primary text-sm">
                      Add Time Window
                    </button>
                  </div>

                  {/* Schedule Settings Summary */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-xs text-gray-500">Buffer Before</p>
                      <p className="font-medium">{selectedSchedule.bufferBefore || 0} min</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Buffer After</p>
                      <p className="font-medium">{selectedSchedule.bufferAfter || 0} min</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Min Notice</p>
                      <p className="font-medium">{selectedSchedule.minimumNotice || 0} hrs</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Max/Day</p>
                      <p className="font-medium">{selectedSchedule.maxBookingsPerDay || 'No limit'}</p>
                    </div>
                  </div>

                  {/* Weekly View */}
                  <h3 className="text-md font-medium text-gray-900 mb-4">Weekly Availability</h3>
                  <div className="space-y-3">
                    {DAYS_OF_WEEK.map((day, index) => {
                      const windows = getWindowsForDay(index);
                      return (
                        <div key={day} className="flex items-start gap-4 py-2 border-b border-gray-100 last:border-0">
                          <div className="w-24 font-medium text-gray-700">{day}</div>
                          <div className="flex-1">
                            {windows.length === 0 ? (
                              <span className="text-gray-400 text-sm">Unavailable</span>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {windows.map((window) => (
                                  <div
                                    key={window.id}
                                    className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm"
                                  >
                                    <span>
                                      {window.startTime} - {window.endTime}
                                    </span>
                                    <button
                                      onClick={() => handleDeleteWindow(window.id)}
                                      className="text-green-600 hover:text-red-600"
                                    >
                                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="card text-center py-12">
                  <p className="text-gray-500">Select a schedule to view details</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
