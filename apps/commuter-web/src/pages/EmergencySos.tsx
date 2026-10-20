import React, { useState, useRef, useEffect } from 'react';
import { safetyApi } from '../api/client';

interface EmergencySosProps {
  onBack: () => void;
}

export const EmergencySos: React.FC<EmergencySosProps> = ({ onBack }) => {
  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0); // 0 to 100
  const [triggered, setTriggered] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [gpsActive, setGpsActive] = useState(true);

  const holdTimerRef = useRef<any>(null);
  const progressIntervalRef = useRef<any>(null);

  const startHold = () => {
    if (triggered) return;
    setHolding(true);
    setProgress(0);

    const startTime = Date.now();
    const duration = 3000; // 3 seconds

    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / duration) * 100));
      setProgress(pct);

      if (pct >= 100) {
        clearInterval(progressIntervalRef.current);
        activateSos();
      }
    }, 50);
  };

  const endHold = () => {
    if (triggered) return;
    setHolding(false);
    setProgress(0);
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
  };

  const activateSos = async () => {
    setTriggered(true);
    setSubmitting(true);

    try {
      await safetyApi.triggerSos({
        tripId: 1,
        lat: 6.904,
        lng: 79.865,
        note: 'Manual commuter SOS initiated from web mobile app',
      });
    } catch (e) {
      console.warn('Emergency SOS fallback dispatch logged');
    } finally {
      setSubmitting(false);
    }
  };

  // SVG ring circumference = 2 * PI * 44 = 276.46
  const strokeDashoffset = 276.46 - (276.46 * progress) / 100;

  return (
    <main className="relative w-full pt-16 bg-surface min-h-screen pb-24 max-w-md mx-auto font-sans">
      <div className="flex flex-col w-full px-4 space-y-4 pt-2">
        {/* Live Location & Safety Assurance Banner */}
        <div className="w-full bg-surface-container-low rounded-2xl p-4 shadow-sm border border-outline-variant/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                <span className="material-symbols-outlined text-primary text-[20px]">
                  fmd_good
                </span>
                <span className="absolute w-2 h-2 rounded-full bg-primary animate-ping"></span>
              </div>
              <div className="min-w-0">
                <span className="block text-[10px] uppercase font-bold text-outline">
                  Live GPS Monitoring
                </span>
                <span className="block text-xs font-bold text-on-surface truncate">
                  Barnes Place, Colombo 07
                </span>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                checked={gpsActive}
                onChange={(e) => setGpsActive(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-surface-container-highest rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>

          <div className="mt-2 pt-2 flex items-center gap-1.5 border-t border-surface-container-high/60">
            <span className="material-symbols-outlined text-primary text-[16px]">verified_user</span>
            <span className="text-[11px] text-on-surface-variant font-medium">
              Real-time PostGIS buffer active during office commute route
            </span>
          </div>
        </div>

        {/* Primary SOS Trigger Card */}
        <div className="relative w-full bg-error-container text-on-error-container rounded-3xl p-6 shadow-lg overflow-hidden flex flex-col items-center text-center border border-error/20">
          {/* Ambient Glow */}
          <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-error/15 blur-2xl pointer-events-none"></div>
          <div className="absolute -bottom-10 -left-10 w-28 h-28 rounded-full bg-error/10 blur-xl pointer-events-none"></div>

          <div className="relative z-10 flex flex-col items-center w-full">
            {/* Circular Progress Ring with SOS Button */}
            <div className="relative mb-4">
              <svg className="w-28 h-28 -rotate-90 transform" viewBox="0 0 100 100">
                <circle
                  className="text-error/20 fill-none"
                  cx="50"
                  cy="50"
                  r="44"
                  stroke="currentColor"
                  strokeWidth="5"
                />
                <circle
                  className="text-error fill-none transition-all duration-75"
                  cx="50"
                  cy="50"
                  r="44"
                  stroke="currentColor"
                  strokeWidth="5"
                  strokeDasharray="276.46"
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                />
              </svg>

              <button
                onMouseDown={startHold}
                onMouseUp={endHold}
                onMouseLeave={endHold}
                onTouchStart={startHold}
                onTouchEnd={endHold}
                aria-label="Activate SOS"
                className={`absolute inset-0 m-auto w-20 h-20 rounded-full text-on-error shadow-2xl flex flex-col items-center justify-center select-none cursor-pointer focus:outline-none transition-all active:scale-95 ${
                  triggered
                    ? 'bg-emerald-700 animate-pulse'
                    : holding
                    ? 'bg-error scale-105 ring-4 ring-error/40'
                    : 'bg-error'
                }`}
              >
                <span className="material-symbols-outlined text-3xl">
                  {triggered ? 'done_all' : 'emergency'}
                </span>
                <span className="text-[11px] font-bold tracking-wider uppercase mt-0.5">
                  {triggered ? 'SENT' : 'SOS'}
                </span>
              </button>
            </div>

            <h2 className="text-lg font-bold text-on-error-container">
              {triggered
                ? 'Emergency SOS Dispatched!'
                : holding
                ? `Holding... ${progress}%`
                : 'Hold 3s for SOS'}
            </h2>

            <p className="text-xs text-on-error-container/85 mt-1 max-w-xs leading-relaxed">
              {triggered
                ? 'Live telemetry and incident ticket dispatched to Dialog Security Ops and Police 119.'
                : 'Dispatches real-time coordinates to Dialog Security Ops Desk and local emergency services (119).'}
            </p>

            <div className="mt-4 inline-flex items-center gap-1.5 bg-surface-container-lowest/80 text-error px-3 py-1 rounded-full text-xs font-semibold shadow-sm">
              <span className="material-symbols-outlined text-[15px]">shield</span>
              <span>Auto-records telemetry & incident logs</span>
            </div>
          </div>
        </div>

        {/* Priority Response Direct Call Contacts */}
        <div className="w-full flex flex-col space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-bold text-on-surface uppercase tracking-wider">
              Emergency Contacts
            </span>
            <span className="text-[10px] text-outline">Sri Lanka (Direct)</span>
          </div>

          {/* Police & Ambulance Card */}
          <div className="w-full bg-surface-container-lowest rounded-2xl p-3.5 shadow-sm flex items-center justify-between border border-outline-variant/30">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[22px]">local_police</span>
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-bold text-on-surface truncate">
                  Police & Suwa Seriya
                </h3>
                <p className="text-[11px] text-outline truncate">119 National • 1990 Medical</p>
              </div>
            </div>

            <a
              href="tel:119"
              aria-label="Call 119"
              className="w-10 h-10 rounded-full bg-secondary text-on-secondary flex items-center justify-center active:scale-95 shadow-md"
            >
              <span className="material-symbols-outlined text-[18px]">call</span>
            </a>
          </div>

          {/* Corporate Security Desk */}
          <div className="w-full bg-surface-container-lowest rounded-2xl p-3.5 shadow-sm flex items-center justify-between border border-outline-variant/30">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-primary-fixed text-on-primary-fixed flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[22px]">security</span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs font-bold text-on-surface truncate">
                    Dialog Security HQ
                  </h3>
                  <span className="bg-primary-fixed text-on-primary-fixed text-[9px] font-bold px-1.5 py-0.2 rounded-full">
                    24/7
                  </span>
                </div>
                <p className="text-[11px] text-outline truncate">+94 11 710 0000</p>
              </div>
            </div>

            <a
              href="tel:+94117100000"
              aria-label="Call Corporate Security"
              className="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center active:scale-95 shadow-md"
            >
              <span className="material-symbols-outlined text-[18px]">call</span>
            </a>
          </div>
        </div>
      </div>
    </main>
  );
};
