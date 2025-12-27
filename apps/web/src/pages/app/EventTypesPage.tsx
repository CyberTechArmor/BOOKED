import { useEffect, useState, useCallback } from 'react';
import { useEventTypeStore, EventType, CreateEventTypeInput, AssignmentType, LocationType } from '@/stores/eventTypes';
import { useAuthStore } from '@/stores/auth';

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];
const LOCATION_TYPES: { value: LocationType; label: string }[] = [
  { value: 'MEET', label: 'Video Call' },
  { value: 'PHONE', label: 'Phone Call' },
  { value: 'IN_PERSON', label: 'In Person' },
  { value: 'CUSTOM', label: 'Custom Location' },
];

const COLOR_SWATCHES = [
  '#0066FF',
  '#3B82F6',
  '#6366F1',
  '#8B5CF6',
  '#EC4899',
  '#EF4444',
  '#F97316',
  '#F59E0B',
  '#10B981',
  '#14B8A6',
  '#06B6D4',
  '#6B7280',
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
  const { organization } = useAuthStore();

  const [showForm, setShowForm] = useState(false);
  const [editingEventType, setEditingEventType] = useState<EventType | null>(null);
  const [formData, setFormData] = useState<EventTypeFormData>(initialFormData);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shareModal, setShareModal] = useState<EventType | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetchEventTypes();
  }, [fetchEventTypes]);

  const getBookingUrl = useCallback((eventType: EventType) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/${organization?.slug || 'org'}/${eventType.slug}`;
  }, [organization]);

  const getEmbedCode = useCallback((eventType: EventType) => {
    const url = getBookingUrl(eventType);
    return `<iframe src="${url}" width="100%" height="700" frameborder="0"></iframe>`;
  }, [getBookingUrl]);

  const copyToClipboard = useCallback(async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Fallback
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    }
  }, []);

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

    setIsSubmitting(true);
    try {
      if (editingEventType) {
        await updateEventType(editingEventType.id, payload);
      } else {
        await createEventType(payload);
      }
      setShowForm(false);
      setFormData(initialFormData);
      setEditingEventType(null);
      // Refresh to get latest data
      await fetchEventTypes();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'An unexpected error occurred');
      // Still refresh in case the action succeeded but response failed
      await fetchEventTypes();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (eventType: EventType) => {
    if (!confirm(`Are you sure you want to delete "${eventType.title}"?`)) {
      return;
    }

    try {
      await deleteEventType(eventType.id);
      await fetchEventTypes();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete event type');
    }
  };

  const handleToggleActive = async (eventType: EventType) => {
    try {
      await updateEventType(eventType.id, { isActive: !eventType.isActive });
      await fetchEventTypes();
    } catch {
      // Silently refresh
      await fetchEventTypes();
    }
  };

  if (isLoading && eventTypes.length === 0) {
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

        {/* Share Modal */}
        {shareModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">Share "{shareModal.title}"</h2>
                <button
                  onClick={() => setShareModal(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-6 space-y-5">
                {/* Booking Link */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Booking Link</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={getBookingUrl(shareModal)}
                      className="input flex-1 bg-gray-50 text-sm"
                    />
                    <button
                      onClick={() => copyToClipboard(getBookingUrl(shareModal), 'link')}
                      className={`btn-outline px-4 ${copied === 'link' ? 'text-green-600 border-green-600' : ''}`}
                    >
                      {copied === 'link' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>

                {/* Embed Code */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Embed Code</label>
                  <div className="relative">
                    <textarea
                      readOnly
                      value={getEmbedCode(shareModal)}
                      rows={3}
                      className="input bg-gray-50 text-sm font-mono resize-none"
                    />
                    <button
                      onClick={() => copyToClipboard(getEmbedCode(shareModal), 'embed')}
                      className={`absolute top-2 right-2 px-3 py-1 text-xs font-medium rounded ${
                        copied === 'embed'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {copied === 'embed' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1.5">Paste this code into your website to embed the booking form.</p>
                </div>

                {/* Quick Actions */}
                <div className="flex gap-3 pt-2">
                  <a
                    href={getBookingUrl(shareModal)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary flex-1 text-center"
                  >
                    Open Booking Page
                  </a>
                  <button onClick={() => setShareModal(null)} className="btn-outline px-6">
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Create/Edit Event Type Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto py-8">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 my-auto">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  {editingEventType ? 'Edit Event Type' : 'Create Event Type'}
                </h2>
              </div>

              <div className="px-6 py-5 max-h-[70vh] overflow-y-auto">
                {formError && (
                  <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {formError}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="form-group">
                    <label className="label">Title *</label>
                    <input
                      type="text"
                      className="input"
                      value={formData.title}
                      onChange={(e) => handleTitleChange(e.target.value)}
                      placeholder="e.g., 30 Minute Meeting"
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">Slug *</label>
                    <input
                      type="text"
                      className="input"
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                      placeholder="e.g., 30-minute-meeting"
                    />
                    <p className="helper-text">URL-friendly identifier for your booking link</p>
                  </div>

                  <div className="form-group">
                    <label className="label">Description</label>
                    <textarea
                      className="input resize-none"
                      rows={2}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Brief description of this meeting type..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="form-group">
                      <label className="label">Duration</label>
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
                    <div className="form-group">
                      <label className="label">Location</label>
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
                    <div className="form-group">
                      <label className="label">Location Details</label>
                      <input
                        type="text"
                        className="input"
                        value={formData.locationValue}
                        onChange={(e) => setFormData({ ...formData, locationValue: e.target.value })}
                        placeholder="Enter address or meeting details..."
                      />
                    </div>
                  )}

                  <div className="form-group">
                    <label className="label">Color</label>
                    <div className="flex flex-wrap gap-2">
                      {COLOR_SWATCHES.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setFormData({ ...formData, color })}
                          className={`w-9 h-9 rounded-full transition-all ${
                            formData.color === color
                              ? 'ring-2 ring-offset-2 ring-gray-900 scale-110'
                              : 'hover:scale-110'
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={formData.isActive}
                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                        className="checkbox"
                      />
                      <span className="text-sm text-gray-700 group-hover:text-gray-900">Active (can be booked)</span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={formData.isPublic}
                        onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                        className="checkbox"
                      />
                      <span className="text-sm text-gray-700 group-hover:text-gray-900">Public (visible to everyone)</span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={formData.requiresConfirmation}
                        onChange={(e) => setFormData({ ...formData, requiresConfirmation: e.target.checked })}
                        className="checkbox"
                      />
                      <span className="text-sm text-gray-700 group-hover:text-gray-900">Requires confirmation</span>
                    </label>
                  </div>
                </form>
              </div>

              <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="btn-primary flex-1"
                >
                  {isSubmitting ? 'Saving...' : editingEventType ? 'Save Changes' : 'Create Event Type'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingEventType(null);
                  }}
                  className="btn-outline px-6"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
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
              <div key={eventType.id} className="card-hover relative group">
                <div
                  className="absolute top-0 left-0 right-0 h-1.5 rounded-t-xl"
                  style={{ backgroundColor: eventType.color || '#0066FF' }}
                />

                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{eventType.title}</h3>
                    <p className="text-sm text-gray-500 truncate">/{eventType.slug}</p>
                  </div>
                  <div className="flex gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setShareModal(eventType)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                      title="Share"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleEdit(eventType)}
                      className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded"
                      title="Edit"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(eventType)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
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

                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="badge-gray">
                    {eventType.durationMinutes} min
                  </span>
                  <span className="badge-gray">
                    {LOCATION_TYPES.find((lt) => lt.value === eventType.locationType)?.label}
                  </span>
                  {eventType.requiresConfirmation && (
                    <span className="badge-warning">
                      Requires confirmation
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <button
                    onClick={() => handleToggleActive(eventType)}
                    className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
                      eventType.isActive ? 'text-green-600 hover:text-green-700' : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${eventType.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                    {eventType.isActive ? 'Active' : 'Inactive'}
                  </button>
                  <span className={`text-xs font-medium ${eventType.isPublic ? 'text-blue-600' : 'text-gray-400'}`}>
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
