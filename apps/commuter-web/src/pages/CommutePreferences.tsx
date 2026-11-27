import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { authApi } from '../api/client';

interface CommutePreferencesProps {
  user?: User | null;
  onUserUpdated?: (user: User) => void;
  onBack?: () => void;
}

const WEEK_DAYS = [
  { id: 'Mon', short: 'M' },
  { id: 'Tue', short: 'T' },
  { id: 'Wed', short: 'W' },
  { id: 'Thu', short: 'T' },
  { id: 'Fri', short: 'F' },
  { id: 'Sat', short: 'S' },
  { id: 'Sun', short: 'S' },
];

export const CommutePreferences: React.FC<CommutePreferencesProps> = ({
  user,
  onUserUpdated,
  onBack,
}) => {
  const [homeAddress, setHomeAddress] = useState(user?.preferences?.homeAddress || '');
  const [officeAddress, setOfficeAddress] = useState(
    user?.preferences?.officeAddress || user?.preferences?.workHub || ''
  );
  const [editingRoute, setEditingRoute] = useState(false);
  const [morningTime, setMorningTime] = useState(user?.preferences?.morningTime || '08:00 AM');
  const [eveningTime, setEveningTime] = useState(user?.preferences?.eveningTime || '05:30 PM');
  const [selectedDays, setSelectedDays] = useState<string[]>(
    user?.preferences?.commuteDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  );
  const [selectedMode, setSelectedMode] = useState<'shuttle' | 'carpool' | 'multimodal'>(
    user?.preferences?.transitMode || 'shuttle'
  );
  const [proximityAlerts, setProximityAlerts] = useState<boolean>(
    user?.preferences?.proximityAlerts ?? true
  );
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (user?.preferences) {
      setHomeAddress(user.preferences.homeAddress || '');
      setOfficeAddress(user.preferences.officeAddress || user.preferences.workHub || '');
      setMorningTime(user.preferences.morningTime || '08:00 AM');
      setEveningTime(user.preferences.eveningTime || '05:30 PM');
      if (Array.isArray(user.preferences.commuteDays)) {
        setSelectedDays(user.preferences.commuteDays);
      }
      if (user.preferences.transitMode) {
        setSelectedMode(user.preferences.transitMode);
      }
      if (user.preferences.proximityAlerts !== undefined) {
        setProximityAlerts(user.preferences.proximityAlerts);
      }
    }
  }, [user]);

  const toggleDay = (d: string) => {
    setSelectedDays((prev) =>
      prev.includes(d) ? prev.filter((item) => item !== d) : [...prev, d]
    );
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setToastMessage(null);
      const updatedUser = await authApi.updateMe({
        preferences: {
          homeAddress: homeAddress.trim(),
          officeAddress: officeAddress.trim(),
          commuteDays: selectedDays,
          morningTime: morningTime.trim(),
          eveningTime: eveningTime.trim(),
          transitMode: selectedMode,
          proximityAlerts,
        },
      });
      if (onUserUpdated) {
        onUserUpdated(updatedUser);
      }
      setEditingRoute(false);
      setToastMessage('Commute schedule & route updated successfully!');
      setTimeout(() => setToastMessage(null), 3200);
    } catch (err: any) {
      setToastMessage(err.message || 'Failed to save commute preferences.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto w-full px-4 py-3 pb-24 space-y-4 font-sans text-on-surface">
      {/* Sub-Header */}
      {onBack && (
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-container-high text-xs font-semibold text-on-surface hover:bg-surface-container-highest transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            <span>Settings</span>
          </button>
          <span className="text-xs font-medium text-on-surface-variant">
            {selectedDays.length} days selected
          </span>
        </div>
      )}

      {/* Card 1: Daily Route & Locations */}
      <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-outline-variant/25 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-on-surface">Daily Route</h2>
          <button
            type="button"
            onClick={() => setEditingRoute(!editingRoute)}
            className="text-secondary text-xs font-semibold hover:opacity-80 cursor-pointer"
          >
            {editingRoute ? 'Done' : 'Edit'}
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 p-2.5 rounded-lg bg-surface-container-low">
            <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center shrink-0 text-primary">
              <span className="material-symbols-outlined text-[18px]">my_location</span>
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[11px] text-on-surface-variant font-medium block">Home Pickup</span>
              {editingRoute ? (
                <input
                  type="text"
                  value={homeAddress}
                  onChange={(e) => setHomeAddress(e.target.value)}
                  placeholder="Enter your pickup stop or address"
                  className="w-full text-sm text-on-surface bg-surface-container-lowest px-2 py-1 rounded border border-outline-variant/40 outline-none mt-0.5"
                />
              ) : (
                <span className="text-sm text-on-surface font-medium truncate block">
                  {homeAddress || 'Not set — tap Edit to configure'}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 p-2.5 rounded-lg bg-surface-container-low">
            <div className="w-8 h-8 rounded-full bg-secondary-fixed text-secondary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[18px]">apartment</span>
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[11px] text-on-surface-variant font-medium block">Office Hub</span>
              {editingRoute ? (
                <input
                  type="text"
                  value={officeAddress}
                  onChange={(e) => setOfficeAddress(e.target.value)}
                  placeholder="Enter your corporate office address"
                  className="w-full text-sm text-on-surface bg-surface-container-lowest px-2 py-1 rounded border border-outline-variant/40 outline-none mt-0.5"
                />
              ) : (
                <span className="text-sm text-on-surface font-medium truncate block">
                  {officeAddress || 'Not set — tap Edit to configure'}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Card 2: Weekly Office Schedule */}
      <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-outline-variant/25 flex flex-col gap-3">
        <h2 className="text-base font-semibold text-on-surface">Weekly Schedule</h2>

        <div className="flex items-center justify-between gap-1.5">
          {WEEK_DAYS.map((day) => {
            const active = selectedDays.includes(day.id);
            return (
              <button
                key={day.id}
                type="button"
                aria-pressed={active}
                onClick={() => toggleDay(day.id)}
                className={`flex-1 h-11 rounded-lg text-sm font-semibold flex items-center justify-center transition-colors cursor-pointer ${
                  active
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'bg-surface-container text-on-surface-variant hover:bg-surface-variant'
                }`}
              >
                {day.short}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <div className="bg-surface-container-low px-3 py-2 rounded-lg flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-on-surface-variant">
              <span className="material-symbols-outlined text-[16px]">light_mode</span>
              <span className="text-[11px] font-medium">Morning</span>
            </div>
            <input
              type="text"
              value={morningTime}
              onChange={(e) => setMorningTime(e.target.value)}
              className="w-full bg-transparent text-sm font-medium text-on-surface outline-none"
            />
          </div>

          <div className="bg-surface-container-low px-3 py-2 rounded-lg flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-on-surface-variant">
              <span className="material-symbols-outlined text-[16px]">bedtime</span>
              <span className="text-[11px] font-medium">Evening</span>
            </div>
            <input
              type="text"
              value={eveningTime}
              onChange={(e) => setEveningTime(e.target.value)}
              className="w-full bg-transparent text-sm font-medium text-on-surface outline-none"
            />
          </div>
        </div>
      </div>

      {/* Card 3: Transit Mode & Ride Style */}
      <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-outline-variant/25 flex flex-col gap-3">
        <h2 className="text-base font-semibold text-on-surface">Transit Mode &amp; Ride Style</h2>

        <div className="flex flex-col gap-2">
          {[
            { id: 'shuttle' as const, label: 'Corporate Shuttle (EV)', icon: 'directions_bus' },
            { id: 'carpool' as const, label: 'Colleague Carpool', icon: 'group' },
            { id: 'multimodal' as const, label: 'Multi-Modal Express', icon: 'commute' },
          ].map((mode) => {
            const isSelected = selectedMode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => setSelectedMode(mode.id)}
                className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors text-left ${
                  isSelected
                    ? 'bg-primary/10 border border-primary/30'
                    : 'bg-surface-container-low hover:bg-surface-container border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      isSelected
                        ? 'bg-primary text-on-primary'
                        : 'bg-secondary-fixed text-secondary'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px]">{mode.icon}</span>
                  </div>
                  <span className="text-sm font-semibold text-on-surface">{mode.label}</span>
                </div>
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                    isSelected
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container-highest text-transparent'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">check</span>
                </div>
              </button>
            );
          })}

          {/* Proximity Alerts Toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-surface-container-low mt-1">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-secondary shrink-0">
                <span className="material-symbols-outlined text-[20px]">notifications_active</span>
              </div>
              <span className="text-sm font-semibold text-on-surface">Proximity Alerts</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={proximityAlerts}
              onClick={() => setProximityAlerts(!proximityAlerts)}
              className={`w-12 h-7 rounded-full relative transition-colors cursor-pointer shrink-0 ${
                proximityAlerts ? 'bg-primary' : 'bg-surface-container-highest'
              }`}
            >
              <span
                className={`block w-5 h-5 bg-surface-container-lowest rounded-full shadow-sm transform transition-transform ${
                  proximityAlerts ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Save Action */}
      <div className="pt-1">
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="w-full h-12 bg-primary hover:bg-primary-container text-on-primary rounded-full text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer disabled:opacity-60"
        >
          <span className="material-symbols-outlined text-[20px]">check_circle</span>
          <span>{saving ? 'Saving Preferences...' : 'Save Preferences'}</span>
        </button>

        {toastMessage && (
          <div className="mt-3 w-full bg-inverse-surface text-inverse-on-surface px-4 py-2.5 rounded-xl flex items-center gap-2 text-xs font-medium shadow-md">
            <span className="material-symbols-outlined text-primary-fixed text-[18px]">task_alt</span>
            <span>{toastMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
};
