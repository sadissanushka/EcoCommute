import React, { useState } from 'react';

interface CommutePreferencesProps {
  onBack?: () => void;
}

export const CommutePreferences: React.FC<CommutePreferencesProps> = ({ onBack }) => {
  const [shiftStart, setShiftStart] = useState('08:30 AM');
  const [shiftEnd, setShiftEnd] = useState('05:30 PM');
  const [selectedDays, setSelectedDays] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  const [selectedMode, setSelectedMode] = useState<'shuttle' | 'carpool' | 'multimodal'>('shuttle');
  const [isSaved, setIsSaved] = useState(false);

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const toggleDay = (d: string) => {
    setSelectedDays((prev) =>
      prev.includes(d) ? prev.filter((item) => item !== d) : [...prev, d]
    );
  };

  const handleSave = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        {onBack ? (
          <button
            onClick={onBack}
            className="px-3.5 py-1.5 rounded-xl bg-surface-container-low dark:bg-surface-container border border-outline-variant/30 text-xs font-semibold text-on-surface dark:text-white"
          >
            ← Back
          </button>
        ) : (
          <div />
        )}
        <h1 className="text-xl font-bold text-on-surface dark:text-white">Commute Preferences</h1>
        <div className="w-8" />
      </div>

      {/* Shift Timing Card */}
      <div className="bg-surface-container-lowest dark:bg-surface-container border border-outline-variant/30 rounded-2xl p-6 shadow-sm space-y-4">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-primary">Shift & Office Hours</h2>
          <p className="text-xs text-on-surface-variant dark:text-outline-variant mt-0.5">
            Synchronize automated shuttle seat hold windows with your workday.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-on-surface dark:text-white">Office Arrival</label>
            <input
              type="text"
              value={shiftStart}
              onChange={(e) => setShiftStart(e.target.value)}
              className="px-3.5 py-2.5 bg-surface-container-low dark:bg-surface-container-high border border-outline-variant/30 rounded-xl text-xs font-semibold text-on-surface dark:text-white outline-none"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-on-surface dark:text-white">Office Departure</label>
            <input
              type="text"
              value={shiftEnd}
              onChange={(e) => setShiftEnd(e.target.value)}
              className="px-3.5 py-2.5 bg-surface-container-low dark:bg-surface-container-high border border-outline-variant/30 rounded-xl text-xs font-semibold text-on-surface dark:text-white outline-none"
            />
          </div>
        </div>

        {/* Working Days */}
        <div className="space-y-2 pt-2">
          <label className="text-xs font-semibold text-on-surface dark:text-white">Commute Days</label>
          <div className="flex items-center gap-2">
            {days.map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${
                  selectedDays.includes(day)
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-low dark:bg-surface-container-high text-on-surface-variant dark:text-outline-variant hover:text-on-surface'
                }`}
              >
                {day}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Transit Mode Preference */}
      <div className="bg-surface-container-lowest dark:bg-surface-container border border-outline-variant/30 rounded-2xl p-6 shadow-sm space-y-4">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-secondary">Preferred Transit Mode</h2>
          <p className="text-xs text-on-surface-variant dark:text-outline-variant mt-0.5">
            Default option when booking or allocating weekly commute legs.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 pt-2">
          {[
            { id: 'shuttle', title: 'EV Shuttle', icon: '🚌' },
            { id: 'carpool', title: 'Carpool Leg', icon: '🚗' },
            { id: 'multimodal', title: 'Multi-Modal', icon: '⚡' },
          ].map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => setSelectedMode(mode.id as any)}
              className={`p-4 rounded-xl border text-center transition flex flex-col items-center gap-2 ${
                selectedMode === mode.id
                  ? 'border-primary bg-primary/10 text-primary font-bold'
                  : 'border-outline-variant/30 bg-surface-container-low dark:bg-surface-container-high text-on-surface-variant dark:text-outline-variant'
              }`}
            >
              <span className="text-2xl">{mode.icon}</span>
              <span className="text-xs">{mode.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        className="w-full py-3 bg-primary hover:bg-primary-container text-on-primary font-bold text-sm rounded-xl shadow-sm transition"
      >
        {isSaved ? 'Preferences Saved!' : 'Save Preferences'}
      </button>
    </div>
  );
};
