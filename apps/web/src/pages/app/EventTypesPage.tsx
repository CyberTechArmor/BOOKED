import { useEffect, useState } from 'react';
import { useEventTypeStore, EventType, CreateEventTypeInput, AssignmentType, LocationType } from '@/stores/eventTypes';

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];
const LOCATION_TYPES: { value: LocationType; label: string }[] = [
  { value: 'MEET', label: 'Video Call' },
  { value: 'PHONE', label: 'Phone Call' },
  { value: 'IN_PERSON', label: 'In Person' },
  { value: 'CUSTOM', label: 'Custom Location' },
];

const COLOR_SWATCHES = [
  '#0066FF', // Primary blue
  '#3B82F6', // Blue
  '#6366F1', // Indigo
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#EF4444', // Red
  '#F97316', // Orange
  '#F59E0B', // Amber
  '#10B981', // Emerald
  '#14B8A6', // Teal
  '#06B6D4', // Cyan
  '#6B7280', // Gray
];

interface EventTypeFormData {
  title: string;
  slug: string;
  description: string;
  durationMinutes: number;
  isActive: boolean;
  isPublic: boolean;
  requiresConfirmation: boolean;
  assignmentType: AssignmentType;
  locationType: LocationType;
  locationValue: string;
  color: string;
}

const initialFormData: EventTypeFormData = {
  title: '',
  slug: '',
  description: '',
  durationMinutes: 30,
  isActive: true,
  isPublic: true,
  requiresConfirmation: false,
  assignmentType: 'SINGLE',
  locationType: 'MEET',
  locationValue: '',
  color: '#0066FF',
};

export default function EventTypesPage() {
  const {
    eventTypes,
    isLoading,
    error,
    fetchEventTypes,
    createEventType,
    updateEventType,
    deleteEventType,
  } = useEventTypeStore();

  const [showForm, setShowForm] = useState(false);
  const [editingEventType, setEditingEventType] = useState<EventType | null>(null);
  const [formData, setFormData] = useState<EventTypeFormData>(initialFormData);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    fetchEventTypes();
  }, [fetchEventTypes]);

  const handleCreateNew = () => {
    setFormData(initialFormData);
    setEditingEventType(null);
    setShowForm(true);
    setFormError(null);
  };

  const handleEdit = (eventType: EventType) => {
    setFormData({
      title: eventType.title,
      slug: eventType.slug,
      description: eventType.description || '',
      durationMinutes: eventType.durationMinutes,
      isActive: eventType.isActive,
      isPublic: eventType.isPublic,
      requiresConfirmation: eventType.requiresConfirmation,
      assignmentType: eventType.assignmentType,
      locationType: eventType.locationType,
      locationValue: eventType.locationValue || '',
      color: eventType.color || '#0066FF',
    });
    setEditingEventType(eventType);
    setShowForm(true);
    setFormError(null);
  };

  const generateSlug = (title: string): string => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleTitleChange = (title: string) => {
    setFormData({
      ...formData,
      title,
      slug: editingEventType ? formData.slug : generateSlug(title),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.title.trim()) {
      setFormError('Title is required');
      return;
    }

    if (!formData.slug.trim()) {
      setFormError('Slug is required');
      return;
    }

    const payload: CreateEventTypeInput = {
      title: formData.title.trim(),
      slug: formData.slug.trim(),
      description: formData.description.trim() || undefined,
      durationMinutes: formData.durationMinutes,
      isActive: formData.isActive,
      isPublic: formData.isPublic,
      requiresConfirmation: formData.requiresConfirmation,
      assignmentType: formData.assignmentType,
      locationType: formData.locationType,
      locationValue: formData.locationValue.trim() || undefined,
      color: formData.color,
    };

    try {
      if (editingEventType) {
        await updateEventType(editingEventType.id, payload);
      } else {
        await createEventType(payload);
      }
      setShowForm(false);
      setFormData(initialFormData);
      setEditingEventType(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save event type');
    }
  };

  const handleDelete = async (eventType: EventType) => {
    if (!confirm(`Are you sure you want to delete "${eventType.title}"?`)) {
      return;
    }

    try {
      await deleteEventType(eventType.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete event type');
    }
  };

  const handleToggleActive = async (eventType: EventType) => {
    try {
      await updateEventType(eventType.id, { isActive: !eventType.isActive });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update event type');
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Event Types</h1>
        <div className="card">
          <p className="text-gray-500">Loading event types...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Event Types</h1>
          <button onClick={handleCreateNew} className="btn-primary">
            Create Event Type
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Create/Edit Event Type Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto py-8">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 my-auto">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">
                  {editingEventType ? 'Edit Event Type' : 'Create Event Type'}
                </h2>
              </div>

              {/* Modal Body */}
              <div className="px-6 py-5">
                {formError && (
                  <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {formError}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Title *</label>
                    <input
                      type="text"
                      className="input"
                      value={formData.title}
                      onChange={(e) => handleTitleChange(e.target.value)}
                      placeholder="e.g., 30 Minute Meeting"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Slug *</label>
                    <input
                      type="text"
                      className="input"
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                      placeholder="e.g., 30-minute-meeting"
                    />
                    <p className="text-xs text-gray-500 mt-1.5">URL-friendly identifier for your booking link</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                    <textarea
                      className="input resize-none"
                      rows={2}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Brief description of this meeting type..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Duration</label>
                      <select
                        className="input"
                        value={formData.durationMinutes}
                        onChange={(e) => setFormData({ ...formData, durationMinutes: parseInt(e.target.value) })}
                      >
                        {DURATION_OPTIONS.map((d) => (
                          <option key={d} value={d}>
                            {d} minutes
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Location</label>
                      <select
                        className="input"
                        value={formData.locationType}
                        onChange={(e) => setFormData({ ...formData, locationType: e.target.value as LocationType })}
                      >
                        {LOCATION_TYPES.map((lt) => (
                          <option key={lt.value} value={lt.value}>
                            {lt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {(formData.locationType === 'CUSTOM' || formData.locationType === 'IN_PERSON') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Location Details</label>
                      <input
                        type="text"
                        className="input"
                        value={formData.locationValue}
                        onChange={(e) => setFormData({ ...formData, locationValue: e.target.value })}
                        placeholder="Enter address or meeting details..."
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
                    <div className="flex flex-wrap gap-2">
                      {COLOR_SWATCHES.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setFormData({ ...formData, color })}
                          className={`w-8 h-8 rounded-full transition-all ${
                            formData.color === color
                              ? 'ring-2 ring-offset-2 ring-gray-900 scale-110'
                              : 'hover:scale-110'
                          }`}
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isActive}
                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                        className="w-4 h-4 rounded border-gray-300 text-[var(--primary)] focus:ring-[var(--primary)]"
                      />
                      <span className="text-sm text-gray-700">Active (can be booked)</span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isPublic}
                        onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                        className="w-4 h-4 rounded border-gray-300 text-[var(--primary)] focus:ring-[var(--primary)]"
                      />
                      <span className="text-sm text-gray-700">Public (visible to everyone)</span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.requiresConfirmation}
                        onChange={(e) => setFormData({ ...formData, requiresConfirmation: e.target.checked })}
                        className="w-4 h-4 rounded border-gray-300 text-[var(--primary)] focus:ring-[var(--primary)]"
                      />
                      <span className="text-sm text-gray-700">Requires confirmation</span>
                    </label>
                  </div>

                  {/* Modal Footer */}
                  <div className="flex gap-3 pt-4 border-t border-gray-200 mt-6">
                    <button type="submit" className="btn-primary flex-1">
                      {editingEventType ? 'Save Changes' : 'Create Event Type'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowForm(false);
                        setEditingEventType(null);
                      }}
                      className="btn-outline px-6"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {eventTypes.length === 0 ? (
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
            <h3 className="mt-4 text-lg font-medium text-gray-900">No event types yet</h3>
            <p className="mt-2 text-gray-500">
              Create event types so others can book time with you.
            </p>
            <button onClick={handleCreateNew} className="btn-primary mt-4">
              Create Your First Event Type
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {eventTypes.map((eventType) => (
              <div key={eventType.id} className="card relative">
                <div
                  className="absolute top-0 left-0 right-0 h-1 rounded-t-lg"
                  style={{ backgroundColor: eventType.color || '#0066FF' }}
                />

                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-medium text-gray-900">{eventType.title}</h3>
                    <p className="text-sm text-gray-500">/{eventType.slug}</p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEdit(eventType)}
                      className="p-1 text-gray-500 hover:text-gray-700"
                      title="Edit"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(eventType)}
                      className="p-1 text-gray-500 hover:text-red-600"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                {eventType.description && (
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">{eventType.description}</p>
                )}

                <div className="flex flex-wrap gap-2 mb-3">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
                    {eventType.durationMinutes} min
                  </span>
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
                    {LOCATION_TYPES.find((lt) => lt.value === eventType.locationType)?.label}
                  </span>
                  {eventType.requiresConfirmation && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-700">
                      Requires confirmation
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <button
                    onClick={() => handleToggleActive(eventType)}
                    className={`text-sm ${
                      eventType.isActive ? 'text-green-600' : 'text-gray-500'
                    }`}
                  >
                    {eventType.isActive ? 'Active' : 'Inactive'}
                  </button>
                  <span className={`text-xs ${eventType.isPublic ? 'text-blue-600' : 'text-gray-500'}`}>
                    {eventType.isPublic ? 'Public' : 'Private'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
