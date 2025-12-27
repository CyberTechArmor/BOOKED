import { useEffect, useState, useCallback } from 'react';
import { useEventTypeStore, EventType, CreateEventTypeInput, AssignmentType, LocationType } from '@/stores/eventTypes';
import { useAuthStore } from '@/stores/auth';

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];
const LOCATION_TYPES: { value: LocationType; label: string; icon: string }[] = [
  { value: 'MEET', label: 'Video Call', icon: '📹' },
  { value: 'PHONE', label: 'Phone Call', icon: '📞' },
  { value: 'IN_PERSON', label: 'In Person', icon: '📍' },
  { value: 'CUSTOM', label: 'Custom', icon: '⚙️' },
];

const COLOR_SWATCHES = [
  '#4F46E5', // Indigo
  '#7C3AED', // Violet
  '#EC4899', // Pink
  '#EF4444', // Red
  '#F97316', // Orange
  '#F59E0B', // Amber
  '#10B981', // Emerald
  '#14B8A6', // Teal
  '#06B6D4', // Cyan
  '#3B82F6', // Blue
  '#6366F1', // Indigo light
  '#64748B', // Slate
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
  bufferBefore: number;
  bufferAfter: number;
  minimumNotice: number;
  maxBookingsPerDay: number | null;
  maxBookingsPerWeek: number | null;
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
  color: '#4F46E5',
  bufferBefore: 0,
  bufferAfter: 0,
  minimumNotice: 0,
  maxBookingsPerDay: null,
  maxBookingsPerWeek: null,
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
  const [deleteConfirm, setDeleteConfirm] = useState<EventType | null>(null);

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
      color: eventType.color || '#4F46E5',
      bufferBefore: eventType.bufferBefore || 0,
      bufferAfter: eventType.bufferAfter || 0,
      minimumNotice: eventType.minimumNotice || 0,
      maxBookingsPerDay: eventType.maxBookingsPerDay || null,
      maxBookingsPerWeek: eventType.maxBookingsPerWeek || null,
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
      bufferBefore: formData.bufferBefore || undefined,
      bufferAfter: formData.bufferAfter || undefined,
      minimumNotice: formData.minimumNotice || undefined,
      maxBookingsPerDay: formData.maxBookingsPerDay || undefined,
      maxBookingsPerWeek: formData.maxBookingsPerWeek || undefined,
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
      await fetchEventTypes();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'An unexpected error occurred');
      await fetchEventTypes();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (eventType: EventType) => {
    try {
      await deleteEventType(eventType.id);
      setDeleteConfirm(null);
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
      await fetchEventTypes();
    }
  };

  if (isLoading && eventTypes.length === 0) {
    return (
      <div className="p-6 lg:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Event Types</h1>
              <p className="text-slate-500 mt-1">Create and manage your booking types</p>
            </div>
          </div>
          <div className="card flex items-center justify-center py-12">
            <div className="flex items-center gap-3 text-slate-500">
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Loading event types...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Event Types</h1>
            <p className="text-slate-500 mt-1">Create and manage your booking types</p>
          </div>
          <button onClick={handleCreateNew} className="btn-primary">
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Event Type
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-red-700 flex items-center gap-3">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div className="modal-backdrop" onClick={() => setDeleteConfirm(null)}>
            <div className="modal max-w-md" onClick={(e) => e.stopPropagation()}>
              <div className="p-6 text-center">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Delete Event Type</h3>
                <p className="text-slate-500 mb-6">
                  Are you sure you want to delete <strong>"{deleteConfirm.title}"</strong>? This action cannot be undone.
                </p>
                <div className="flex gap-3 justify-center">
                  <button onClick={() => setDeleteConfirm(null)} className="btn-outline px-6">
                    Cancel
                  </button>
                  <button onClick={() => handleDelete(deleteConfirm)} className="btn-danger px-6">
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Share Modal */}
        {shareModal && (
          <div className="modal-backdrop" onClick={() => setShareModal(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="text-lg font-semibold text-slate-900">Share "{shareModal.title}"</h2>
                <button onClick={() => setShareModal(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="modal-body space-y-5">
                <div>
                  <label className="label">Booking Link</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={getBookingUrl(shareModal)}
                      className="input flex-1 bg-slate-50 font-mono text-sm"
                    />
                    <button
                      onClick={() => copyToClipboard(getBookingUrl(shareModal), 'link')}
                      className={`btn-outline px-4 min-w-[80px] ${copied === 'link' ? 'text-emerald-600 border-emerald-200 bg-emerald-50' : ''}`}
                    >
                      {copied === 'link' ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="label">Embed Code</label>
                  <div className="relative">
                    <textarea
                      readOnly
                      value={getEmbedCode(shareModal)}
                      rows={3}
                      className="input bg-slate-50 font-mono text-sm resize-none"
                    />
                    <button
                      onClick={() => copyToClipboard(getEmbedCode(shareModal), 'embed')}
                      className={`absolute top-2 right-2 px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                        copied === 'embed'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      }`}
                    >
                      {copied === 'embed' ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                  <p className="helper-text">Paste this code into your website to embed the booking form.</p>
                </div>
              </div>
              <div className="modal-footer">
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
        )}

        {/* Create/Edit Event Type Modal */}
        {showForm && (
          <div className="modal-backdrop" onClick={() => !isSubmitting && setShowForm(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header flex-shrink-0">
                <h2 className="text-lg font-semibold text-slate-900">
                  {editingEventType ? 'Edit Event Type' : 'Create Event Type'}
                </h2>
                <button
                  onClick={() => !isSubmitting && setShowForm(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                  disabled={isSubmitting}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="modal-body overflow-y-auto flex-1">
                {formError && (
                  <div className="mb-5 p-3 bg-red-50 border border-red-100 rounded-lg text-red-700 text-sm flex items-center gap-2">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {formError}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Basic Info Section */}
                  <div>
                    <h3 className="section-title">Basic Information</h3>
                    <div className="space-y-4">
                      <div className="form-group">
                        <label className="label">Title *</label>
                        <input
                          type="text"
                          className="input"
                          value={formData.title}
                          onChange={(e) => handleTitleChange(e.target.value)}
                          placeholder="e.g., 30 Minute Consultation"
                        />
                      </div>

                      <div className="form-group">
                        <label className="label">URL Slug *</label>
                        <div className="flex items-center">
                          <span className="text-sm text-slate-400 mr-1">/{organization?.slug || 'org'}/</span>
                          <input
                            type="text"
                            className="input"
                            value={formData.slug}
                            onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                            placeholder="30-minute-consultation"
                          />
                        </div>
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
                    </div>
                  </div>

                  <div className="divider" />

                  {/* Meeting Details Section */}
                  <div>
                    <h3 className="section-title">Meeting Details</h3>
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
                              {lt.icon} {lt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {(formData.locationType === 'CUSTOM' || formData.locationType === 'IN_PERSON') && (
                      <div className="form-group mt-4">
                        <label className="label">Location Details</label>
                        <input
                          type="text"
                          className="input"
                          value={formData.locationValue}
                          onChange={(e) => setFormData({ ...formData, locationValue: e.target.value })}
                          placeholder={formData.locationType === 'IN_PERSON' ? 'Enter address...' : 'Enter meeting details...'}
                        />
                      </div>
                    )}

                    <div className="form-group mt-4">
                      <label className="label">Color</label>
                      <div className="flex flex-wrap gap-2">
                        {COLOR_SWATCHES.map((color) => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => setFormData({ ...formData, color })}
                            className={`w-8 h-8 rounded-full transition-all ${
                              formData.color === color
                                ? 'ring-2 ring-offset-2 ring-slate-400 scale-110'
                                : 'hover:scale-110'
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="divider" />

                  {/* Booking Limits Section */}
                  <div>
                    <h3 className="section-title">Booking Limits & Buffers</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="form-group">
                        <label className="label">Buffer Before (min)</label>
                        <input
                          type="number"
                          className="input"
                          min="0"
                          max="120"
                          value={formData.bufferBefore}
                          onChange={(e) => setFormData({ ...formData, bufferBefore: parseInt(e.target.value) || 0 })}
                          placeholder="0"
                        />
                        <p className="helper-text">Time gap before meetings</p>
                      </div>
                      <div className="form-group">
                        <label className="label">Buffer After (min)</label>
                        <input
                          type="number"
                          className="input"
                          min="0"
                          max="120"
                          value={formData.bufferAfter}
                          onChange={(e) => setFormData({ ...formData, bufferAfter: parseInt(e.target.value) || 0 })}
                          placeholder="0"
                        />
                        <p className="helper-text">Time gap after meetings</p>
                      </div>
                      <div className="form-group">
                        <label className="label">Minimum Notice (hours)</label>
                        <input
                          type="number"
                          className="input"
                          min="0"
                          max="720"
                          value={formData.minimumNotice}
                          onChange={(e) => setFormData({ ...formData, minimumNotice: parseInt(e.target.value) || 0 })}
                          placeholder="0"
                        />
                        <p className="helper-text">How far in advance</p>
                      </div>
                      <div className="form-group">
                        <label className="label">Max Bookings/Day</label>
                        <input
                          type="number"
                          className="input"
                          min="1"
                          max="100"
                          value={formData.maxBookingsPerDay || ''}
                          onChange={(e) => setFormData({ ...formData, maxBookingsPerDay: e.target.value ? parseInt(e.target.value) : null })}
                          placeholder="No limit"
                        />
                      </div>
                      <div className="form-group col-span-2 sm:col-span-1">
                        <label className="label">Max Bookings/Week</label>
                        <input
                          type="number"
                          className="input"
                          min="1"
                          max="500"
                          value={formData.maxBookingsPerWeek || ''}
                          onChange={(e) => setFormData({ ...formData, maxBookingsPerWeek: e.target.value ? parseInt(e.target.value) : null })}
                          placeholder="No limit"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="divider" />

                  {/* Settings Section */}
                  <div>
                    <h3 className="section-title">Settings</h3>
                    <div className="space-y-3">
                      <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={formData.isActive}
                          onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                          className="checkbox"
                        />
                        <div>
                          <span className="text-sm font-medium text-slate-700">Active</span>
                          <p className="text-xs text-slate-500">This event type can be booked</p>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={formData.isPublic}
                          onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                          className="checkbox"
                        />
                        <div>
                          <span className="text-sm font-medium text-slate-700">Public</span>
                          <p className="text-xs text-slate-500">Visible on your public booking page</p>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={formData.requiresConfirmation}
                          onChange={(e) => setFormData({ ...formData, requiresConfirmation: e.target.checked })}
                          className="checkbox"
                        />
                        <div>
                          <span className="text-sm font-medium text-slate-700">Requires Confirmation</span>
                          <p className="text-xs text-slate-500">Bookings need manual approval</p>
                        </div>
                      </label>
                    </div>
                  </div>
                </form>
              </div>

              <div className="modal-footer flex-shrink-0">
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="btn-primary flex-1"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Saving...
                    </>
                  ) : (
                    editingEventType ? 'Save Changes' : 'Create Event Type'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="btn-outline px-6"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Event Types Grid */}
        {eventTypes.length === 0 ? (
          <div className="card text-center py-16">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">No event types yet</h3>
            <p className="text-slate-500 mb-6 max-w-sm mx-auto">
              Create your first event type so others can start booking time with you.
            </p>
            <button onClick={handleCreateNew} className="btn-primary">
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Your First Event Type
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {eventTypes.map((eventType) => (
              <div key={eventType.id} className="card-hover relative group">
                {/* Color bar */}
                <div
                  className="absolute top-0 left-0 right-0 h-1 rounded-t-xl"
                  style={{ backgroundColor: eventType.color || '#4F46E5' }}
                />

                {/* Content */}
                <div className="pt-2">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900 truncate">{eventType.title}</h3>
                      <p className="text-sm text-slate-400 truncate font-mono">/{eventType.slug}</p>
                    </div>
                    {/* Actions */}
                    <div className="flex gap-1 ml-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setShareModal(eventType)}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Share"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleEdit(eventType)}
                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(eventType)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {eventType.description && (
                    <p className="text-sm text-slate-500 mb-4 line-clamp-2">{eventType.description}</p>
                  )}

                  {/* Badges */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className="badge-gray">
                      <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {eventType.durationMinutes} min
                    </span>
                    <span className="badge-gray">
                      {LOCATION_TYPES.find((lt) => lt.value === eventType.locationType)?.icon}{' '}
                      {LOCATION_TYPES.find((lt) => lt.value === eventType.locationType)?.label}
                    </span>
                    {eventType.requiresConfirmation && (
                      <span className="badge-warning">
                        Needs approval
                      </span>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                    <button
                      onClick={() => handleToggleActive(eventType)}
                      className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                        eventType.isActive
                          ? 'text-emerald-600 hover:text-emerald-700'
                          : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${eventType.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                      {eventType.isActive ? 'Active' : 'Inactive'}
                    </button>
                    <span className={`text-xs font-medium px-2 py-1 rounded ${
                      eventType.isPublic
                        ? 'bg-indigo-50 text-indigo-600'
                        : 'bg-slate-100 text-slate-500'
                    }`}>
                      {eventType.isPublic ? 'Public' : 'Private'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
