import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth';

type SettingsTab = 'profile' | 'organization' | 'notifications';

export default function SettingsPage() {
  const { user, organization } = useAuthStore();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    name: '',
    email: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Organization form state
  const [orgForm, setOrgForm] = useState({
    name: '',
    slug: '',
  });
  const [orgSaving, setOrgSaving] = useState(false);
  const [orgSuccess, setOrgSuccess] = useState(false);

  // Notification preferences
  const [notifications, setNotifications] = useState({
    emailBookingConfirmation: true,
    emailBookingCancellation: true,
    emailBookingReminder: true,
    emailDailyDigest: false,
  });
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifSuccess, setNotifSuccess] = useState(false);

  useEffect(() => {
    if (user) {
      setProfileForm({
        name: user.name || '',
        email: user.email || '',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
    }
    if (organization) {
      setOrgForm({
        name: organization.name || '',
        slug: organization.slug || '',
      });
    }
  }, [user, organization]);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileSuccess(false);

    // Simulate save - in production, this would call an API
    await new Promise(resolve => setTimeout(resolve, 500));

    setProfileSaving(false);
    setProfileSuccess(true);
    setTimeout(() => setProfileSuccess(false), 3000);
  };

  const handleOrgSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrgSaving(true);
    setOrgSuccess(false);

    await new Promise(resolve => setTimeout(resolve, 500));

    setOrgSaving(false);
    setOrgSuccess(true);
    setTimeout(() => setOrgSuccess(false), 3000);
  };

  const handleNotificationsSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotifSaving(true);
    setNotifSuccess(false);

    await new Promise(resolve => setTimeout(resolve, 500));

    setNotifSaving(false);
    setNotifSuccess(true);
    setTimeout(() => setNotifSuccess(false), 3000);
  };

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'profile',
      label: 'Profile',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
    {
      id: 'organization',
      label: 'Organization',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      ),
    },
  ];

  const timezones = [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Phoenix',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Asia/Singapore',
    'Australia/Sydney',
    'Pacific/Auckland',
  ];

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

        {/* Tab Navigation */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-lg mb-6 w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Profile Settings */}
        {activeTab === 'profile' && (
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Profile Settings</h2>

            <form onSubmit={handleProfileSave} className="space-y-5">
              <div className="flex items-start gap-6 pb-6 border-b border-gray-200">
                <div className="w-20 h-20 rounded-full bg-[var(--primary)] flex items-center justify-center text-white text-2xl font-semibold">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">{user?.name}</h3>
                  <p className="text-sm text-gray-500">{user?.email}</p>
                  <button type="button" className="mt-2 text-sm text-[var(--primary)] hover:underline">
                    Change avatar
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="label">Full Name</label>
                <input
                  type="text"
                  className="input max-w-md"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="label">Email Address</label>
                <input
                  type="email"
                  className="input max-w-md"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                />
                <p className="helper-text">Used for notifications and login</p>
              </div>

              <div className="form-group">
                <label className="label">Timezone</label>
                <select
                  className="input max-w-md"
                  value={profileForm.timezone}
                  onChange={(e) => setProfileForm({ ...profileForm, timezone: e.target.value })}
                >
                  {timezones.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
                <p className="helper-text">All times will be displayed in this timezone</p>
              </div>

              <div className="flex items-center gap-3 pt-4">
                <button type="submit" className="btn-primary" disabled={profileSaving}>
                  {profileSaving ? 'Saving...' : 'Save Changes'}
                </button>
                {profileSuccess && (
                  <span className="text-sm text-green-600 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Saved successfully
                  </span>
                )}
              </div>
            </form>
          </div>
        )}

        {/* Organization Settings */}
        {activeTab === 'organization' && (
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Organization Settings</h2>

            <form onSubmit={handleOrgSave} className="space-y-5">
              <div className="form-group">
                <label className="label">Organization Name</label>
                <input
                  type="text"
                  className="input max-w-md"
                  value={orgForm.name}
                  onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="label">Organization URL</label>
                <div className="flex items-center max-w-md">
                  <span className="px-3 py-2.5 bg-gray-100 border border-r-0 border-gray-300 rounded-l-lg text-gray-500 text-sm">
                    {window.location.origin}/
                  </span>
                  <input
                    type="text"
                    className="input rounded-l-none flex-1"
                    value={orgForm.slug}
                    onChange={(e) => setOrgForm({ ...orgForm, slug: e.target.value })}
                  />
                </div>
                <p className="helper-text">This is your organization's unique booking URL</p>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 max-w-md">
                <h4 className="font-medium text-gray-900 mb-2">Booking Page URL</h4>
                <p className="text-sm text-gray-600 break-all">
                  {window.location.origin}/{orgForm.slug}
                </p>
              </div>

              <div className="flex items-center gap-3 pt-4">
                <button type="submit" className="btn-primary" disabled={orgSaving}>
                  {orgSaving ? 'Saving...' : 'Save Changes'}
                </button>
                {orgSuccess && (
                  <span className="text-sm text-green-600 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Saved successfully
                  </span>
                )}
              </div>
            </form>

            <hr className="my-8 border-gray-200" />

            <div>
              <h3 className="font-medium text-gray-900 mb-4">Danger Zone</h3>
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium text-red-800">Delete Organization</h4>
                    <p className="text-sm text-red-600 mt-1">
                      Permanently delete this organization and all its data. This action cannot be undone.
                    </p>
                  </div>
                  <button type="button" className="btn-danger text-sm">
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Notification Settings */}
        {activeTab === 'notifications' && (
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Notification Preferences</h2>

            <form onSubmit={handleNotificationsSave} className="space-y-6">
              <div>
                <h3 className="font-medium text-gray-900 mb-4">Email Notifications</h3>
                <div className="space-y-4">
                  <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                    <div>
                      <p className="font-medium text-gray-900">Booking Confirmations</p>
                      <p className="text-sm text-gray-500">Receive an email when someone books time with you</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifications.emailBookingConfirmation}
                      onChange={(e) => setNotifications({ ...notifications, emailBookingConfirmation: e.target.checked })}
                      className="checkbox"
                    />
                  </label>

                  <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                    <div>
                      <p className="font-medium text-gray-900">Booking Cancellations</p>
                      <p className="text-sm text-gray-500">Receive an email when a booking is cancelled</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifications.emailBookingCancellation}
                      onChange={(e) => setNotifications({ ...notifications, emailBookingCancellation: e.target.checked })}
                      className="checkbox"
                    />
                  </label>

                  <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                    <div>
                      <p className="font-medium text-gray-900">Booking Reminders</p>
                      <p className="text-sm text-gray-500">Receive reminders before your upcoming meetings</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifications.emailBookingReminder}
                      onChange={(e) => setNotifications({ ...notifications, emailBookingReminder: e.target.checked })}
                      className="checkbox"
                    />
                  </label>

                  <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                    <div>
                      <p className="font-medium text-gray-900">Daily Digest</p>
                      <p className="text-sm text-gray-500">Receive a daily summary of your bookings</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifications.emailDailyDigest}
                      onChange={(e) => setNotifications({ ...notifications, emailDailyDigest: e.target.checked })}
                      className="checkbox"
                    />
                  </label>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-4">
                <button type="submit" className="btn-primary" disabled={notifSaving}>
                  {notifSaving ? 'Saving...' : 'Save Preferences'}
                </button>
                {notifSuccess && (
                  <span className="text-sm text-green-600 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Saved successfully
                  </span>
                )}
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
