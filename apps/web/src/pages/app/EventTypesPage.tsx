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
  '#18181B', // Black
  '#3F3F46', // Zinc
  '#71717A', // Gray
  '#DC2626', // Red
  '#EA580C', // Orange
  '#CA8A04', // Yellow
  '#16A34A', // Green
  '#0D9488', // Teal
  '#0284C7', // Blue
  '#7C3AED', // Purple
  '#DB2777', // Pink
  '#64748B', // Slate
];

type FormStep = 'basics' | 'details' | 'limits' | 'settings';

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
  color: '#18181B',
  bufferBefore: 0,
  bufferAfter: 0,
  minimumNotice: 0,
  maxBookingsPerDay: null,
  maxBookingsPerWeek: null,
};

const STEPS: { key: FormStep; label: string; description: string }[] = [
  { key: 'basics', label: 'Basic Info', description: 'Name and URL' },
  { key: 'details', label: 'Meeting Details', description: 'Duration & location' },
  { key: 'limits', label: 'Limits', description: 'Buffers & caps' },
  { key: 'settings', label: 'Settings', description: 'Visibility & confirmation' },
];

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
  const [currentStep, setCurrentStep] = useState<FormStep>('basics');

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
    setCurrentStep('basics');
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
      color: eventType.color || '#18181B',
      bufferBefore: eventType.bufferBefore || 0,
      bufferAfter: eventType.bufferAfter || 0,
      minimumNotice: eventType.minimumNotice || 0,
      maxBookingsPerDay: eventType.maxBookingsPerDay || null,
      maxBookingsPerWeek: eventType.maxBookingsPerWeek || null,
    });
    setEditingEventType(eventType);
    setShowForm(true);
    setFormError(null);
    setCurrentStep('basics');
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

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setFormError(null);

    if (!formData.title.trim()) {
      setFormError('Title is required');
      setCurrentStep('basics');
      return;
    }

    if (!formData.slug.trim()) {
      setFormError('Slug is required');
      setCurrentStep('basics');
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

  const nextStep = () => {
    const currentIndex = STEPS.findIndex(s => s.key === currentStep);
    if (currentIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[currentIndex + 1].key);
    }
  };

  const prevStep = () => {
    const currentIndex = STEPS.findIndex(s => s.key === currentStep);
    if (currentIndex > 0) {
      setCurrentStep(STEPS[currentIndex - 1].key);
    }
  };

  const isStepComplete = (step: FormStep): boolean => {
    switch (step) {
      case 'basics':
        return formData.title.trim().length > 0 && formData.slug.trim().length > 0;
      case 'details':
        return formData.durationMinutes > 0;
      case 'limits':
        return true;
      case 'settings':
        return true;
      default:
        return false;
    }
  };

  if (isLoading && eventTypes.length === 0) {
    return (
      <div className="p-6 lg:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-semibold" style={{ color: 'var(--foreground)' }}>Event Types</h1>
              <p style={{ color: 'var(--muted)' }} className="mt-1">Create and manage your booking types</p>
            </div>
          </div>
          <div className="card flex items-center justify-center py-12">
            <div className="flex items-center gap-3" style={{ color: 'var(--muted)' }}>
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
            <h1 className="text-2xl font-semibold" style={{ color: 'var(--foreground)' }}>Event Types</h1>
            <p style={{ color: 'var(--muted)' }} className="mt-1">Create and manage your booking types</p>
          </div>
          <button onClick={handleCreateNew} className="btn-primary">
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Event Type
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl flex items-center gap-3" style={{ backgroundColor: 'rgba(220,38,38,0.1)', color: 'var(--error)', border: '1px solid var(--error)' }}>
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
                <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'rgba(220,38,38,0.1)' }}>
                  <svg className="w-6 h-6" style={{ color: 'var(--error)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--foreground)' }}>Delete Event Type</h3>
                <p style={{ color: 'var(--muted)' }} className="mb-6">
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
                <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>Share "{shareModal.title}"</h2>
                <button onClick={() => setShareModal(null)} className="transition-colors" style={{ color: 'var(--muted)' }}>
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
                      className="input flex-1 font-mono text-sm"
                      style={{ backgroundColor: 'var(--background-secondary)' }}
                    />
                    <button
                      onClick={() => copyToClipboard(getBookingUrl(shareModal), 'link')}
                      className="btn-outline px-4 min-w-[80px]"
                      style={copied === 'link' ? { color: 'var(--success)', borderColor: 'var(--success)' } : {}}
                    >
                      {copied === 'link' ? 'Copied!' : 'Copy'}
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
                      className="input font-mono text-sm resize-none"
                      style={{ backgroundColor: 'var(--background-secondary)' }}
                    />
                    <button
                      onClick={() => copyToClipboard(getEmbedCode(shareModal), 'embed')}
                      className="absolute top-2 right-2 px-3 py-1 text-xs font-medium rounded-md transition-colors"
                      style={{
                        backgroundColor: copied === 'embed' ? 'var(--success)' : 'var(--background-secondary)',
                        color: copied === 'embed' ? 'white' : 'var(--foreground-secondary)',
                        border: '1px solid var(--border)'
                      }}
                    >
                      {copied === 'embed' ? 'Copied!' : 'Copy'}
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

        {/* Create/Edit Event Type Modal with Flow Steps */}
        {showForm && (
          <div className="modal-backdrop" onClick={() => !isSubmitting && setShowForm(false)}>
            <div
              className="rounded-2xl shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-hidden flex flex-col"
              style={{ backgroundColor: 'var(--card-bg)' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="modal-header flex-shrink-0">
                <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
                  {editingEventType ? 'Edit Event Type' : 'Create Event Type'}
                </h2>
                <button
                  onClick={() => !isSubmitting && setShowForm(false)}
                  className="transition-colors"
                  style={{ color: 'var(--muted)' }}
                  disabled={isSubmitting}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Step indicators */}
              <div className="px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="flex gap-2">
                  {STEPS.map((step, index) => {
                    const isActive = step.key === currentStep;
                    const isComplete = isStepComplete(step.key) && STEPS.findIndex(s => s.key === currentStep) > index;
                    return (
                      <button
                        key={step.key}
                        onClick={() => setCurrentStep(step.key)}
                        className="flex-1 p-3 rounded-lg text-left transition-all"
                        style={{
                          backgroundColor: isActive ? 'var(--background-secondary)' : 'transparent',
                          border: `1px solid ${isActive ? 'var(--primary)' : 'var(--border)'}`
                        }}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold"
                            style={{
                              backgroundColor: isComplete ? 'var(--success)' : isActive ? 'var(--primary)' : 'var(--background-secondary)',
                              color: isComplete || isActive ? 'var(--background)' : 'var(--muted)',
                            }}
                          >
                            {isComplete ? '✓' : index + 1}
                          </span>
                          <span className="text-sm font-medium" style={{ color: isActive ? 'var(--foreground)' : 'var(--muted)' }}>
                            {step.label}
                          </span>
                        </div>
                        <p className="text-xs ml-8" style={{ color: 'var(--muted)' }}>{step.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Form content */}
              <div className="modal-body overflow-y-auto flex-1">
                {formError && (
                  <div className="mb-5 p-3 rounded-lg text-sm flex items-center gap-2" style={{ backgroundColor: 'rgba(220,38,38,0.1)', color: 'var(--error)' }}>
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {formError}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Step 1: Basic Info */}
                  {currentStep === 'basics' && (
                    <div className="space-y-5">
                      <div className="form-group">
                        <label className="label">Title *</label>
                        <input
                          type="text"
                          className="input"
                          value={formData.title}
                          onChange={(e) => handleTitleChange(e.target.value)}
                          placeholder="e.g., 30 Minute Consultation"
                          autoFocus
                        />
                        <p className="helper-text">What should people see when booking?</p>
                      </div>

                      <div className="form-group">
                        <label className="label">URL Slug *</label>
                        <div className="flex items-center gap-1">
                          <span className="text-sm" style={{ color: 'var(--muted)' }}>/{organization?.slug || 'org'}/</span>
                          <input
                            type="text"
                            className="input flex-1"
                            value={formData.slug}
                            onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                            placeholder="30-minute-consultation"
                          />
                        </div>
                        <p className="helper-text">This will be the URL people use to book</p>
                      </div>

                      <div className="form-group">
                        <label className="label">Description</label>
                        <textarea
                          className="input resize-none"
                          rows={3}
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          placeholder="Brief description of this meeting type..."
                        />
                        <p className="helper-text">Optional description shown on the booking page</p>
                      </div>
                    </div>
                  )}

                  {/* Step 2: Meeting Details */}
                  {currentStep === 'details' && (
                    <div className="space-y-5">
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
                        <div className="form-group">
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

                      <div className="form-group">
                        <label className="label">Color</label>
                        <p className="helper-text mb-3">Choose a color to identify this event type</p>
                        <div className="flex flex-wrap gap-3">
                          {COLOR_SWATCHES.map((color) => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => setFormData({ ...formData, color })}
                              className="w-10 h-10 rounded-lg transition-all"
                              style={{
                                backgroundColor: color,
                                transform: formData.color === color ? 'scale(1.15)' : 'scale(1)',
                                boxShadow: formData.color === color ? '0 0 0 2px var(--background), 0 0 0 4px var(--foreground)' : 'none'
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 3: Limits */}
                  {currentStep === 'limits' && (
                    <div className="space-y-5">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="form-group">
                          <label className="label">Buffer Before</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              className="input"
                              min="0"
                              max="120"
                              value={formData.bufferBefore}
                              onChange={(e) => setFormData({ ...formData, bufferBefore: parseInt(e.target.value) || 0 })}
                            />
                            <span style={{ color: 'var(--muted)' }}>min</span>
                          </div>
                          <p className="helper-text">Free time before each meeting</p>
                        </div>
                        <div className="form-group">
                          <label className="label">Buffer After</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              className="input"
                              min="0"
                              max="120"
                              value={formData.bufferAfter}
                              onChange={(e) => setFormData({ ...formData, bufferAfter: parseInt(e.target.value) || 0 })}
                            />
                            <span style={{ color: 'var(--muted)' }}>min</span>
                          </div>
                          <p className="helper-text">Free time after each meeting</p>
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="label">Minimum Notice</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            className="input"
                            min="0"
                            max="720"
                            value={formData.minimumNotice}
                            onChange={(e) => setFormData({ ...formData, minimumNotice: parseInt(e.target.value) || 0 })}
                            style={{ maxWidth: '150px' }}
                          />
                          <span style={{ color: 'var(--muted)' }}>hours</span>
                        </div>
                        <p className="helper-text">How far in advance must meetings be booked?</p>
                      </div>

                      <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border)' }}>
                        <h4 className="text-sm font-medium mb-3" style={{ color: 'var(--foreground)' }}>Booking Caps</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="form-group">
                            <label className="label">Per Day</label>
                            <input
                              type="number"
                              className="input"
                              min="1"
                              max="100"
                              value={formData.maxBookingsPerDay || ''}
                              onChange={(e) => setFormData({ ...formData, maxBookingsPerDay: e.target.value ? parseInt(e.target.value) : null })}
                              placeholder="Unlimited"
                            />
                          </div>
                          <div className="form-group">
                            <label className="label">Per Week</label>
                            <input
                              type="number"
                              className="input"
                              min="1"
                              max="500"
                              value={formData.maxBookingsPerWeek || ''}
                              onChange={(e) => setFormData({ ...formData, maxBookingsPerWeek: e.target.value ? parseInt(e.target.value) : null })}
                              placeholder="Unlimited"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 4: Settings */}
                  {currentStep === 'settings' && (
                    <div className="space-y-3">
                      <label
                        className="flex items-center gap-4 p-4 rounded-lg cursor-pointer transition-colors"
                        style={{ border: '1px solid var(--border)' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--background-secondary)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <input
                          type="checkbox"
                          checked={formData.isActive}
                          onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                          className="checkbox"
                        />
                        <div className="flex-1">
                          <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Active</span>
                          <p className="text-xs" style={{ color: 'var(--muted)' }}>This event type can accept new bookings</p>
                        </div>
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: formData.isActive ? 'var(--success)' : 'var(--muted)' }}
                        />
                      </label>

                      <label
                        className="flex items-center gap-4 p-4 rounded-lg cursor-pointer transition-colors"
                        style={{ border: '1px solid var(--border)' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--background-secondary)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <input
                          type="checkbox"
                          checked={formData.isPublic}
                          onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                          className="checkbox"
                        />
                        <div className="flex-1">
                          <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Public</span>
                          <p className="text-xs" style={{ color: 'var(--muted)' }}>Visible on your public booking page</p>
                        </div>
                      </label>

                      <label
                        className="flex items-center gap-4 p-4 rounded-lg cursor-pointer transition-colors"
                        style={{ border: '1px solid var(--border)' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--background-secondary)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <input
                          type="checkbox"
                          checked={formData.requiresConfirmation}
                          onChange={(e) => setFormData({ ...formData, requiresConfirmation: e.target.checked })}
                          className="checkbox"
                        />
                        <div className="flex-1">
                          <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Requires Confirmation</span>
                          <p className="text-xs" style={{ color: 'var(--muted)' }}>New bookings need your manual approval</p>
                        </div>
                      </label>
                    </div>
                  )}
                </form>
              </div>

              {/* Footer with navigation */}
              <div className="modal-footer flex-shrink-0">
                <div className="flex gap-3 w-full">
                  {currentStep !== 'basics' && (
                    <button type="button" onClick={prevStep} className="btn-outline">
                      Back
                    </button>
                  )}
                  <div className="flex-1" />
                  {currentStep !== 'settings' ? (
                    <button type="button" onClick={nextStep} className="btn-primary px-8">
                      Continue
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSubmit()}
                      disabled={isSubmitting}
                      className="btn-primary px-8"
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
                  )}
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="btn-ghost"
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Event Types Grid */}
        {eventTypes.length === 0 ? (
          <div className="card text-center py-16">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'var(--background-secondary)' }}>
              <svg className="w-8 h-8" style={{ color: 'var(--muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium mb-2" style={{ color: 'var(--foreground)' }}>No event types yet</h3>
            <p style={{ color: 'var(--muted)' }} className="mb-6 max-w-sm mx-auto">
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
                  style={{ backgroundColor: eventType.color || '#18181B' }}
                />

                {/* Content */}
                <div className="pt-2">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate" style={{ color: 'var(--foreground)' }}>{eventType.title}</h3>
                      <p className="text-sm truncate font-mono" style={{ color: 'var(--muted)' }}>/{eventType.slug}</p>
                    </div>
                    {/* Actions */}
                    <div className="flex gap-1 ml-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setShareModal(eventType)}
                        className="p-2 rounded-lg transition-colors"
                        style={{ color: 'var(--muted)' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--background-secondary)';
                          e.currentTarget.style.color = 'var(--foreground)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.color = 'var(--muted)';
                        }}
                        title="Share"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleEdit(eventType)}
                        className="p-2 rounded-lg transition-colors"
                        style={{ color: 'var(--muted)' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--background-secondary)';
                          e.currentTarget.style.color = 'var(--foreground)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.color = 'var(--muted)';
                        }}
                        title="Edit"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(eventType)}
                        className="p-2 rounded-lg transition-colors"
                        style={{ color: 'var(--muted)' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(220,38,38,0.1)';
                          e.currentTarget.style.color = 'var(--error)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.color = 'var(--muted)';
                        }}
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {eventType.description && (
                    <p className="text-sm mb-4 line-clamp-2" style={{ color: 'var(--muted)' }}>{eventType.description}</p>
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
                  <div className="flex items-center justify-between pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                    <button
                      onClick={() => handleToggleActive(eventType)}
                      className="flex items-center gap-2 text-sm font-medium transition-colors"
                      style={{ color: eventType.isActive ? 'var(--success)' : 'var(--muted)' }}
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: eventType.isActive ? 'var(--success)' : 'var(--muted)' }}
                      />
                      {eventType.isActive ? 'Active' : 'Inactive'}
                    </button>
                    <span
                      className="text-xs font-medium px-2 py-1 rounded"
                      style={{
                        backgroundColor: eventType.isPublic ? 'var(--background-secondary)' : 'var(--background-secondary)',
                        color: eventType.isPublic ? 'var(--foreground)' : 'var(--muted)',
                        border: '1px solid var(--border)'
                      }}
                    >
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
