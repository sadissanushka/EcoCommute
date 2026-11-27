import React, { useState, useEffect } from 'react';
import { User, getAvatarInitials } from '../types';
import { authApi, bookingApi, walletApi } from '../api/client';

interface SettingsProps {
  user: User | null;
  onUserUpdated: (user: User) => void;
  onLogout: () => void;
  onNavigateToPreferences: () => void;
  onNavigateToPass: () => void;
  onNavigateToWallet: () => void;
  onNavigateToSos: () => void;
}

const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  si: 'සිංහල',
  ta: 'தமிழ்',
};

export const Settings: React.FC<SettingsProps> = ({
  user,
  onUserUpdated,
  onLogout,
  onNavigateToPreferences,
  onNavigateToPass,
  onNavigateToWallet,
  onNavigateToSos,
}) => {
  const [subView, setSubView] = useState<'main' | 'personal-info'>('main');
  const [co2SavedKg, setCo2SavedKg] = useState<number>(0);
  const [ridesCount, setRidesCount] = useState<number>(0);

  // Personal Info form state
  const [isEditingProfile, setIsEditingProfile] = useState<boolean>(false);
  const [fullName, setFullName] = useState<string>(user?.fullName || '');
  const [phone, setPhone] = useState<string>(user?.phone || '');
  const [workHub, setWorkHub] = useState<string>(user?.preferences?.workHub || '');
  const [emergencyContact, setEmergencyContact] = useState<string>(user?.preferences?.emergencyContact || '');
  const [savingProfile, setSavingProfile] = useState<boolean>(false);
  const [profileToast, setProfileToast] = useState<string | null>(null);

  // Notification Modal state
  const [showNotificationsModal, setShowNotificationsModal] = useState<boolean>(false);
  const [tripUpdates, setTripUpdates] = useState<boolean>(user?.preferences?.notifications?.tripUpdates ?? true);
  const [passAlerts, setPassAlerts] = useState<boolean>(user?.preferences?.notifications?.passAlerts ?? true);
  const [ecoSummaries, setEcoSummaries] = useState<boolean>(user?.preferences?.notifications?.ecoSummaries ?? false);
  const [savingNotifications, setSavingNotifications] = useState<boolean>(false);

  // Language Modal state
  const [showLanguageModal, setShowLanguageModal] = useState<boolean>(false);
  const [selectedLang, setSelectedLang] = useState<'en' | 'si' | 'ta'>(user?.preferences?.language || 'en');
  const [savingLanguage, setSavingLanguage] = useState<boolean>(false);

  // Logout loading state
  const [loggingOut, setLoggingOut] = useState<boolean>(false);

  // Sync local state when user prop changes
  useEffect(() => {
    if (user) {
      setFullName(user.fullName || '');
      setPhone(user.phone || '');
      setWorkHub(user.preferences?.workHub || '');
      setEmergencyContact(user.preferences?.emergencyContact || '');
      setTripUpdates(user.preferences?.notifications?.tripUpdates ?? true);
      setPassAlerts(user.preferences?.notifications?.passAlerts ?? true);
      setEcoSummaries(user.preferences?.notifications?.ecoSummaries ?? false);
      setSelectedLang(user.preferences?.language || 'en');
    }
  }, [user]);

  // Fetch real eco-impact metrics & bookings count from PostgreSQL-backed services
  useEffect(() => {
    let mounted = true;
    async function loadMetrics() {
      try {
        const [walletRes, bookingsRes] = await Promise.all([
          walletApi.getBalance().catch(() => null),
          bookingApi.getMyBookings().catch(() => []),
        ]);
        if (!mounted) return;
        if (walletRes) {
          setCo2SavedKg(walletRes.co2SavedKg || 0);
        }
        if (Array.isArray(bookingsRes)) {
          const activeOrCompleted = bookingsRes.filter((b) => b.status !== 'cancelled');
          setRidesCount(activeOrCompleted.length);
        }
      } catch (err) {
        console.warn('Failed to load profile metrics:', err);
      }
    }
    loadMetrics();
    return () => {
      mounted = false;
    };
  }, []);

  const handleSavePersonalInfo = async () => {
    if (!fullName.trim()) {
      setProfileToast('Full name cannot be empty.');
      return;
    }
    try {
      setSavingProfile(true);
      setProfileToast(null);
      const updatedUser = await authApi.updateMe({
        fullName: fullName.trim(),
        phone: phone.trim() || null,
        preferences: {
          workHub: workHub.trim(),
          emergencyContact: emergencyContact.trim(),
        },
      });
      onUserUpdated(updatedUser);
      setIsEditingProfile(false);
      setProfileToast('Profile details updated successfully.');
      setTimeout(() => setProfileToast(null), 3000);
    } catch (err: any) {
      setProfileToast(err.message || 'Failed to save profile changes.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveNotifications = async () => {
    try {
      setSavingNotifications(true);
      const updatedUser = await authApi.updateMe({
        preferences: {
          notifications: {
            tripUpdates,
            passAlerts,
            ecoSummaries,
          },
        },
      });
      onUserUpdated(updatedUser);
      setShowNotificationsModal(false);
    } catch (err: any) {
      alert(err.message || 'Failed to update notification preferences.');
    } finally {
      setSavingNotifications(false);
    }
  };

  const handleSaveLanguage = async () => {
    try {
      setSavingLanguage(true);
      const updatedUser = await authApi.updateMe({
        preferences: {
          language: selectedLang,
        },
      });
      onUserUpdated(updatedUser);
      setShowLanguageModal(false);
    } catch (err: any) {
      alert(err.message || 'Failed to update language preference.');
    } finally {
      setSavingLanguage(false);
    }
  };

  const handleSignOut = async () => {
    setLoggingOut(true);
    await authApi.logout();
    onLogout();
  };

  const displayName = user?.fullName || user?.email?.split('@')[0] || 'Commuter';
  const companyName = user?.companyName || (user?.email?.includes('@syscolabs') ? 'Sysco LABS' : 'Corporate Partner');
  const employeeId = user?.id ? `EMP-${user.id.toString().padStart(4, '0')}` : 'EMP-0000';
  const roleLabel =
    user?.role === 'admin'
      ? 'Fleet Administrator'
      : user?.role === 'driver'
        ? 'Corporate Driver'
        : user?.role === 'policymaker'
          ? 'ESG Policymaker'
          : 'Corporate Commuter';

  // Sub-view: Personal Info (matches ui-ux/settings/profile_info/code.html)
  if (subView === 'personal-info') {
    return (
      <main className="flex flex-col w-full max-w-lg mx-auto px-4 pb-24 pt-2 font-sans text-on-surface">
        {/* Sub-view Navigation Bar */}
        <div className="flex items-center justify-between py-2 mb-2">
          <button
            type="button"
            onClick={() => {
              setIsEditingProfile(false);
              setSubView('main');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-container-high text-on-surface text-xs font-semibold hover:bg-surface-container-highest transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            <span>Settings</span>
          </button>
          <span className="text-sm font-bold text-on-surface">Personal Info</span>
          <div className="w-16" />
        </div>

        {/* Identity Summary */}
        <div className="flex flex-col items-center text-center pt-2">
          <div className="relative mb-3">
            <div className="w-24 h-24 rounded-full bg-primary/10 text-primary border-2 border-primary/20 flex items-center justify-center font-bold text-2xl select-none">
              {getAvatarInitials(displayName)}
            </div>
            {user?.verified && (
              <div className="absolute bottom-0 right-0 bg-primary text-on-primary w-7 h-7 rounded-full flex items-center justify-center shadow-sm">
                <span className="material-symbols-outlined text-[16px]">verified</span>
              </div>
            )}
          </div>
          <h2 className="text-xl font-semibold text-on-surface">{displayName}</h2>
          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-on-surface-variant">
            <span>{roleLabel}</span>
            <span className="w-1 h-1 rounded-full bg-outline-variant" />
            <span className="text-secondary font-medium">{companyName}</span>
          </div>
        </div>

        {/* Account Information Card */}
        <div className="mt-6 space-y-4">
          <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-outline-variant/25 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-1">
              <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                Account Information
              </span>
              <button
                type="button"
                onClick={() => {
                  if (isEditingProfile && user) {
                    setFullName(user.fullName || '');
                    setPhone(user.phone || '');
                    setWorkHub(user.preferences?.workHub || '');
                    setEmergencyContact(user.preferences?.emergencyContact || '');
                  }
                  setIsEditingProfile(!isEditingProfile);
                }}
                className="text-secondary text-xs font-semibold flex items-center gap-1 hover:opacity-80 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {isEditingProfile ? 'close' : 'edit'}
                </span>
                <span>{isEditingProfile ? 'Cancel' : 'Edit'}</span>
              </button>
            </div>

            {/* Full Name */}
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-surface-container flex items-center justify-center text-on-surface-variant shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-[20px]">person</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-on-surface-variant">Full Name</p>
                <input
                  type="text"
                  readOnly={!isEditingProfile}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={`w-full text-sm text-on-surface outline-none py-1 transition-colors ${
                    isEditingProfile
                      ? 'bg-surface-container-low px-2.5 rounded-lg border border-outline-variant/40 mt-0.5'
                      : 'bg-transparent cursor-default'
                  }`}
                />
              </div>
            </div>

            {/* Work Email */}
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-surface-container flex items-center justify-center text-on-surface-variant shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-[20px]">alternate_email</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-on-surface-variant">Work Email</p>
                  {user?.verified && (
                    <span className="inline-flex items-center gap-0.5 text-primary text-xs font-medium">
                      <span className="material-symbols-outlined text-[14px]">verified</span>
                      <span>Verified</span>
                    </span>
                  )}
                </div>
                <p className="text-sm text-on-surface py-1 truncate">{user?.email || '—'}</p>
              </div>
            </div>

            {/* Phone Number */}
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-surface-container flex items-center justify-center text-on-surface-variant shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-[20px]">call</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-on-surface-variant">Phone Number</p>
                <input
                  type="tel"
                  readOnly={!isEditingProfile}
                  value={phone}
                  placeholder="Add corporate phone number"
                  onChange={(e) => setPhone(e.target.value)}
                  className={`w-full text-sm text-on-surface outline-none py-1 transition-colors ${
                    isEditingProfile
                      ? 'bg-surface-container-low px-2.5 rounded-lg border border-outline-variant/40 mt-0.5'
                      : 'bg-transparent cursor-default'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Corporate & Logistics Card */}
          <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-outline-variant/25 flex flex-col gap-4">
            <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider pb-1">
              Corporate &amp; Logistics
            </span>

            {/* Employee ID */}
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-surface-container flex items-center justify-center text-on-surface-variant shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-[20px]">badge</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-on-surface-variant">Employee ID</p>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-sm font-medium text-on-surface">{employeeId}</span>
                  <span className="text-[11px] font-medium text-on-surface-variant bg-surface-container-high px-2 py-0.5 rounded">
                    Fixed
                  </span>
                </div>
              </div>
            </div>

            {/* Work Hub */}
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-surface-container flex items-center justify-center text-on-surface-variant shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-[20px]">domain</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-on-surface-variant">Work Location / Hub</p>
                <input
                  type="text"
                  readOnly={!isEditingProfile}
                  value={workHub}
                  placeholder="Enter your office hub address"
                  onChange={(e) => setWorkHub(e.target.value)}
                  className={`w-full text-sm text-on-surface outline-none py-1 transition-colors ${
                    isEditingProfile
                      ? 'bg-surface-container-low px-2.5 rounded-lg border border-outline-variant/40 mt-0.5'
                      : 'bg-transparent cursor-default'
                  }`}
                />
              </div>
            </div>

            {/* Emergency Contact */}
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-surface-container flex items-center justify-center text-on-surface-variant shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-[20px]">contact_emergency</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-on-surface-variant">Emergency Contact</p>
                <input
                  type="text"
                  readOnly={!isEditingProfile}
                  value={emergencyContact}
                  placeholder="Name & phone for SOS dispatch"
                  onChange={(e) => setEmergencyContact(e.target.value)}
                  className={`w-full text-sm text-on-surface outline-none py-1 transition-colors ${
                    isEditingProfile
                      ? 'bg-surface-container-low px-2.5 rounded-lg border border-outline-variant/40 mt-0.5'
                      : 'bg-transparent cursor-default'
                  }`}
                />
              </div>
            </div>
          </div>

          {isEditingProfile && (
            <button
              type="button"
              disabled={savingProfile}
              onClick={handleSavePersonalInfo}
              className="w-full h-12 bg-primary hover:bg-primary-container text-on-primary font-semibold text-sm rounded-xl shadow-sm flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              <span>{savingProfile ? 'Saving...' : 'Save Changes'}</span>
            </button>
          )}

          {profileToast && (
            <div className="p-3 rounded-xl bg-primary/10 text-primary text-xs font-semibold text-center border border-primary/20">
              {profileToast}
            </div>
          )}
        </div>
      </main>
    );
  }

  // Main Settings View (matches ui-ux/settings/profile/code.html)
  return (
    <main className="flex flex-col w-full max-w-lg mx-auto px-4 pb-24 pt-2 font-sans text-on-surface">
      {/* Profile Identity Card */}
      <div className="flex flex-col items-center text-center mt-2">
        <div className="relative mb-3">
          <div className="w-24 h-24 rounded-full bg-primary/10 text-primary border-2 border-primary/20 flex items-center justify-center font-bold text-2xl shadow-sm select-none">
            {getAvatarInitials(displayName)}
          </div>
          {user?.verified && (
            <div className="absolute bottom-0 right-0 bg-primary text-on-primary w-7 h-7 rounded-full flex items-center justify-center shadow-sm">
              <span className="material-symbols-outlined text-[16px]">verified</span>
            </div>
          )}
        </div>
        <h1 className="text-2xl font-semibold text-on-surface">{displayName}</h1>
        <p className="text-sm text-on-surface-variant mt-0.5">{companyName}</p>
        <p className="text-xs text-outline mt-0.5">{user?.email}</p>
      </div>

      {/* Minimal Eco Impact Pill (Real DB Metrics) */}
      <div className="mt-6 bg-surface-container-low rounded-xl p-4 flex items-center justify-between border border-outline-variant/20">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-primary shrink-0">
            <span className="material-symbols-outlined text-[20px]">eco</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-bold text-primary leading-tight">
              {co2SavedKg.toFixed(1)}{' '}
              <span className="text-xs text-on-surface-variant font-normal">kg</span>
            </span>
            <span className="text-xs text-on-surface-variant">CO₂ Saved</span>
          </div>
        </div>

        <div className="w-px h-8 bg-outline-variant/40 mx-2" />

        <div className="flex items-center gap-3 flex-1 pl-2">
          <div className="w-10 h-10 rounded-full bg-secondary-fixed flex items-center justify-center text-secondary shrink-0">
            <span className="material-symbols-outlined text-[20px]">commute</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-bold text-secondary leading-tight">{ridesCount}</span>
            <span className="text-xs text-on-surface-variant">Rides</span>
          </div>
        </div>
      </div>

      {/* Essential Settings List */}
      <div className="mt-6 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setSubView('personal-info')}
          className="flex items-center justify-between p-4 bg-surface-container-lowest rounded-xl border border-outline-variant/20 hover:bg-surface-container-low transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center text-on-surface-variant shrink-0">
              <span className="material-symbols-outlined text-[20px]">badge</span>
            </div>
            <span className="text-sm font-medium text-on-surface truncate">Personal Info</span>
          </div>
          <span className="material-symbols-outlined text-on-surface-variant text-[20px]">chevron_right</span>
        </button>

        <button
          type="button"
          onClick={onNavigateToPreferences}
          className="flex items-center justify-between p-4 bg-surface-container-lowest rounded-xl border border-outline-variant/20 hover:bg-surface-container-low transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center text-on-surface-variant shrink-0">
              <span className="material-symbols-outlined text-[20px]">tune</span>
            </div>
            <span className="text-sm font-medium text-on-surface truncate">Commute Preferences</span>
          </div>
          <span className="material-symbols-outlined text-on-surface-variant text-[20px]">chevron_right</span>
        </button>

        <button
          type="button"
          onClick={onNavigateToPass}
          className="flex items-center justify-between p-4 bg-surface-container-lowest rounded-xl border border-outline-variant/20 hover:bg-surface-container-low transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center text-on-surface-variant shrink-0">
              <span className="material-symbols-outlined text-[20px]">verified_user</span>
            </div>
            <span className="text-sm font-medium text-on-surface truncate">Corporate Pass</span>
          </div>
          <span className="material-symbols-outlined text-on-surface-variant text-[20px]">chevron_right</span>
        </button>

        <button
          type="button"
          onClick={onNavigateToWallet}
          className="flex items-center justify-between p-4 bg-surface-container-lowest rounded-xl border border-outline-variant/20 hover:bg-surface-container-low transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center text-on-surface-variant shrink-0">
              <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
            </div>
            <span className="text-sm font-medium text-on-surface truncate">Wallet</span>
          </div>
          <span className="material-symbols-outlined text-on-surface-variant text-[20px]">chevron_right</span>
        </button>

        <button
          type="button"
          onClick={() => setShowNotificationsModal(true)}
          className="flex items-center justify-between p-4 bg-surface-container-lowest rounded-xl border border-outline-variant/20 hover:bg-surface-container-low transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center text-on-surface-variant shrink-0">
              <span className="material-symbols-outlined text-[20px]">notifications_active</span>
            </div>
            <span className="text-sm font-medium text-on-surface truncate">Notifications</span>
          </div>
          <span className="material-symbols-outlined text-on-surface-variant text-[20px]">chevron_right</span>
        </button>

        <button
          type="button"
          onClick={() => setShowLanguageModal(true)}
          className="flex items-center justify-between p-4 bg-surface-container-lowest rounded-xl border border-outline-variant/20 hover:bg-surface-container-low transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center text-on-surface-variant shrink-0">
              <span className="material-symbols-outlined text-[20px]">translate</span>
            </div>
            <span className="text-sm font-medium text-on-surface truncate">Language</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-primary">{LANGUAGE_LABELS[selectedLang] || 'English'}</span>
            <span className="material-symbols-outlined text-on-surface-variant text-[20px]">chevron_right</span>
          </div>
        </button>

        <button
          type="button"
          onClick={onNavigateToSos}
          className="flex items-center justify-between p-4 bg-surface-container-lowest rounded-xl border border-outline-variant/20 hover:bg-surface-container-low transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-error-container/50 flex items-center justify-center text-error shrink-0">
              <span className="material-symbols-outlined text-[20px]">fmd_bad</span>
            </div>
            <span className="text-sm font-medium text-error truncate">Emergency SOS</span>
          </div>
          <span className="material-symbols-outlined text-error text-[20px]">chevron_right</span>
        </button>
      </div>

      {/* Sign Out Action (Only lives in Settings, not on main header) */}
      <div className="mt-8">
        <button
          type="button"
          disabled={loggingOut}
          onClick={handleSignOut}
          className="w-full py-3.5 rounded-xl bg-surface-container-low hover:bg-error-container/40 text-error font-semibold text-sm flex items-center justify-center gap-2 transition-colors border border-error/20 cursor-pointer disabled:opacity-60"
        >
          <span className="material-symbols-outlined text-[18px]">logout</span>
          <span>{loggingOut ? 'Signing Out...' : 'Log Out'}</span>
        </button>
      </div>

      {/* Notification Preferences Popup Modal */}
      {showNotificationsModal && (
        <div
          className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-[3px] flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowNotificationsModal(false);
          }}
        >
          <div className="bg-surface-container-lowest rounded-2xl shadow-xl p-6 w-full max-w-sm flex flex-col border border-outline-variant/30">
            <div className="flex items-center justify-between pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">tune</span>
                <h2 className="text-lg font-semibold text-on-surface">Notification Preferences</h2>
              </div>
              <button
                type="button"
                aria-label="Close dialog"
                onClick={() => setShowNotificationsModal(false)}
                className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="flex flex-col gap-2.5 my-3">
              {/* Trip & Shuttle Updates */}
              <div className="bg-surface-container-low rounded-xl p-3.5 flex items-center justify-between gap-3">
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium text-on-surface truncate">Trip &amp; Shuttle Updates</span>
                  <span className="text-xs text-on-surface-variant mt-0.5">Real-time arrival alerts &amp; gate changes</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={tripUpdates}
                  onClick={() => setTripUpdates(!tripUpdates)}
                  className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full p-0.5 transition-colors ${
                    tripUpdates ? 'bg-primary' : 'bg-surface-variant'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-6 w-6 rounded-full shadow-sm transform transition ${
                      tripUpdates ? 'translate-x-5 bg-on-primary' : 'translate-x-0 bg-surface-container-lowest'
                    }`}
                  />
                </button>
              </div>

              {/* Pass & Allowance Alerts */}
              <div className="bg-surface-container-low rounded-xl p-3.5 flex items-center justify-between gap-3">
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium text-on-surface truncate">Pass &amp; Allowance Alerts</span>
                  <span className="text-xs text-on-surface-variant mt-0.5">Monthly subsidy balance &amp; renewal notices</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={passAlerts}
                  onClick={() => setPassAlerts(!passAlerts)}
                  className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full p-0.5 transition-colors ${
                    passAlerts ? 'bg-primary' : 'bg-surface-variant'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-6 w-6 rounded-full shadow-sm transform transition ${
                      passAlerts ? 'translate-x-5 bg-on-primary' : 'translate-x-0 bg-surface-container-lowest'
                    }`}
                  />
                </button>
              </div>

              {/* Eco-Impact Summaries */}
              <div className="bg-surface-container-low rounded-xl p-3.5 flex items-center justify-between gap-3">
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium text-on-surface truncate">Eco-Impact Summaries</span>
                  <span className="text-xs text-on-surface-variant mt-0.5">Weekly carbon savings &amp; ESG milestones</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={ecoSummaries}
                  onClick={() => setEcoSummaries(!ecoSummaries)}
                  className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full p-0.5 transition-colors ${
                    ecoSummaries ? 'bg-primary' : 'bg-surface-variant'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-6 w-6 rounded-full shadow-sm transform transition ${
                      ecoSummaries ? 'translate-x-5 bg-on-primary' : 'translate-x-0 bg-surface-container-lowest'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                disabled={savingNotifications}
                onClick={handleSaveNotifications}
                className="w-full bg-primary hover:bg-primary-container text-on-primary text-sm py-3 rounded-xl font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-[18px]">check</span>
                <span>{savingNotifications ? 'Saving...' : 'Save Preferences'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowNotificationsModal(false)}
                className="w-full bg-transparent text-on-surface-variant text-sm py-2 rounded-xl hover:text-on-surface transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Select Language Popup Modal */}
      {showLanguageModal && (
        <div
          className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-[3px] flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowLanguageModal(false);
          }}
        >
          <div className="w-full max-w-sm bg-surface-container-lowest rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 flex flex-col border border-outline-variant/30">
            <div className="w-10 h-1 bg-surface-container-highest rounded-full self-center mb-4 sm:hidden" />

            <div className="flex items-center justify-between pb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[18px]">translate</span>
                </div>
                <h2 className="text-lg font-semibold text-on-surface">Select Language</h2>
              </div>
              <button
                type="button"
                aria-label="Close language selector"
                onClick={() => setShowLanguageModal(false)}
                className="w-9 h-9 rounded-full bg-surface-container-low hover:bg-surface-container flex items-center justify-center text-on-surface-variant transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <p className="text-xs text-on-surface-variant mb-4">
              Choose your interface language. Real-time transit alerts and receipts will adapt automatically.
            </p>

            <div className="flex flex-col gap-2" role="radiogroup" aria-label="Available Languages">
              {[
                { code: 'en' as const, badge: 'EN', title: 'English', subtitle: 'Default' },
                { code: 'si' as const, badge: 'සිං', title: 'සිංහල', subtitle: 'Sinhala • ශ්‍රී ලංකාව' },
                { code: 'ta' as const, badge: 'த', title: 'தமிழ்', subtitle: 'Tamil • இலங்கை' },
              ].map((lang) => {
                const isSelected = selectedLang === lang.code;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => setSelectedLang(lang.code)}
                    className={`flex items-center justify-between p-3.5 rounded-xl cursor-pointer transition-colors text-left ${
                      isSelected
                        ? 'bg-surface-container-low border border-primary/30'
                        : 'bg-surface-container-lowest hover:bg-surface-container-low border border-outline-variant/20'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                          isSelected
                            ? 'bg-primary/15 text-primary'
                            : 'bg-surface-container-high text-on-surface-variant'
                        }`}
                      >
                        {lang.badge}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-semibold text-on-surface truncate">{lang.title}</span>
                        <span className="text-xs text-on-surface-variant">{lang.subtitle}</span>
                      </div>
                    </div>
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'bg-primary text-on-primary'
                          : 'bg-surface-container-high text-transparent'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">check</span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-2 mt-5">
              <button
                type="button"
                disabled={savingLanguage}
                onClick={handleSaveLanguage}
                className="w-full h-12 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-sm font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-[20px]">done</span>
                <span>{savingLanguage ? 'Updating...' : 'Save Changes'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowLanguageModal(false)}
                className="w-full h-10 rounded-xl bg-transparent hover:bg-surface-container text-on-surface-variant hover:text-on-surface text-sm font-medium transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
