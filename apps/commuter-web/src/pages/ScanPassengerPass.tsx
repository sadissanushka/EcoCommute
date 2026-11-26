import React, { useState, useEffect } from 'react';
import { bookingApi } from '../api/client';
import { ManifestPassenger } from '../types';

interface ScanPassengerPassProps {
  onBack: () => void;
  onNavigateToNavigation?: () => void;
  tripId?: number;
}

export const ScanPassengerPass: React.FC<ScanPassengerPassProps> = ({
  onBack,
  onNavigateToNavigation,
  tripId = 1,
}) => {
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [boardedCount, setBoardedCount] = useState<number>(0);
  const [otpCode, setOtpCode] = useState<string>('');
  const [showOtpModal, setShowOtpModal] = useState<boolean>(false);
  const [passengers, setPassengers] = useState<ManifestPassenger[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadManifest = async () => {
    try {
      setLoading(true);
      const list = await bookingApi.getTripManifest(tripId);
      setPassengers(list);
      setBoardedCount(list.filter((p) => p.status === 'Boarded').length);
    } catch (err) {
      console.warn('Failed to load trip manifest:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadManifest();
  }, [tripId]);

  const totalRiders = passengers.length;
  const progressPct = totalRiders > 0 ? Math.round((boardedCount / totalRiders) * 100) : 0;

  const handleVerifyOtp = async () => {
    if (!otpCode.trim()) return;
    try {
      const res = await bookingApi.boardPassenger(tripId, { passCode: otpCode.trim() });
      if (res.success) {
        setPassengers((prev) =>
          prev.map((p) => (p.bookingId === res.bookingId ? { ...p, status: 'Boarded' as const } : p))
        );
        setBoardedCount((prev) => prev + 1);
        setShowOtpModal(false);
        setOtpCode('');
        alert(`Passenger ${res.passengerName} verified and boarded.`);
      }
    } catch (err: any) {
      alert(err.message || 'Invalid Passcode. Please check passenger digital pass OTP.');
    }
  };

  const handleBoardPassenger = async (p: ManifestPassenger) => {
    try {
      const res = await bookingApi.boardPassenger(tripId, { bookingId: p.bookingId });
      if (res.success) {
        setPassengers((prev) =>
          prev.map((item) => (item.bookingId === p.bookingId ? { ...item, status: 'Boarded' as const } : item))
        );
        setBoardedCount((prev) => prev + 1);
      }
    } catch (err: any) {
      alert(err.message || 'Check-in failed');
    }
  };

  return (
    <div className="flex flex-col relative w-full min-h-[calc(100vh-64px)] bg-surface font-sans max-w-md mx-auto pb-24">
      {/* Top Header */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-surface-container-high/60">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="w-9 h-9 flex items-center justify-center rounded-full text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </button>
          <h1 className="text-sm font-bold text-on-surface">Scan Passenger Pass</h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setTorchOn(!torchOn)}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
              torchOn ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">
              {torchOn ? 'flashlight_off' : 'flashlight_on'}
            </span>
          </button>
          {onNavigateToNavigation && (
            <button
              onClick={onNavigateToNavigation}
              className="px-2.5 py-1 rounded-xl bg-secondary text-on-secondary text-xs font-bold"
            >
              Start Nav
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col w-full px-4 pt-3 gap-3">
        {/* Status bar */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-on-surface-variant font-medium">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span className="uppercase tracking-wider text-[10px] font-bold">Route 114 Express</span>
          </div>
          <div className="bg-surface-container-high px-2.5 py-0.5 rounded-full text-[11px] font-bold text-primary flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">eco</span>
            <span>EV Bus #08</span>
          </div>
        </div>

        {/* QR Scanner Viewfinder Frame */}
        <div className="relative w-full h-72 rounded-2xl bg-inverse-surface overflow-hidden shadow-lg flex flex-col justify-between p-3.5">
          <div className="relative z-10 flex items-center justify-between w-full">
            <div className="bg-inverse-surface/85 backdrop-blur-md px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm text-xs text-inverse-on-surface">
              <span className="material-symbols-outlined text-[16px] text-primary-fixed">center_focus_strong</span>
              <span>Align QR pass in frame</span>
            </div>
            <span className="text-[10px] font-mono text-primary-fixed bg-black/40 px-2 py-0.5 rounded">
              OPTICAL NFC
            </span>
          </div>

          {/* Center Target Box with Scanner Frame */}
          <div
            onClick={() => {
              const nextWaiting = passengers.find((p) => p.status === 'Waiting');
              if (nextWaiting) handleBoardPassenger(nextWaiting);
            }}
            className="relative z-10 self-center w-48 h-48 flex items-center justify-center cursor-pointer"
            title="Scan passenger QR pass"
          >
            <span className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-primary-fixed rounded-tl-lg" />
            <span className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-primary-fixed rounded-tr-lg" />
            <span className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-primary-fixed rounded-bl-lg" />
            <span className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-primary-fixed rounded-br-lg" />

            <div className="w-40 h-40 rounded-xl bg-inverse-surface/40 backdrop-blur-[1px] relative overflow-hidden flex flex-col items-center justify-center border border-white/10">
              <span className="material-symbols-outlined text-[44px] text-white/20 select-none">qr_code_2</span>
              <span className="text-[10px] text-white/50 mt-1">Tap to scan next passenger</span>
            </div>
          </div>

          <div className="relative z-10 flex items-center justify-center pb-1">
            <div className="bg-inverse-surface/90 backdrop-blur-md px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm text-xs text-inverse-on-surface">
              <span className="w-2 h-2 rounded-full bg-primary-fixed" />
              <span>Camera feed active • TOTP ready</span>
            </div>
          </div>
        </div>

        {/* Boarding Manifest Progress Card */}
        <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-outline-variant/30 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-on-surface uppercase tracking-wider">Manifest Verification</span>
            <span className="text-xs font-bold text-primary">{boardedCount} / {totalRiders} Boarded ({progressPct}%)</span>
          </div>

          <div className="w-full h-2 rounded-full bg-surface-container-highest overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs font-semibold text-on-surface">Passenger Manifest</span>
            <button
              onClick={() => setShowOtpModal(true)}
              className="text-xs text-secondary font-bold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[15px]">pin</span>
              <span>Manual 6-Digit Code</span>
            </button>
          </div>

          {/* Passenger List */}
          <div className="flex flex-col gap-2">
            {passengers.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-2 rounded-xl bg-surface-container-low border border-outline-variant/20"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                    {p.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-on-surface truncate">{p.name}</span>
                    <span className="text-[10px] text-on-surface-variant truncate">{p.org} • {p.seat}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                      p.status === 'Boarded'
                        ? 'bg-primary/10 text-primary'
                        : 'bg-secondary-fixed text-on-secondary-fixed'
                    }`}
                  >
                    {p.status}
                  </span>
                  {p.status === 'Waiting' && (
                    <button
                      onClick={() => handleBoardPassenger(p)}
                      className="px-2 py-0.5 rounded-lg bg-primary text-on-primary text-[10px] font-bold"
                    >
                      Check-In
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Manual 6-Digit Code Verification Modal */}
      {showOtpModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl max-w-xs w-full p-5 shadow-2xl border border-outline-variant/30 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-surface-container-high/60 pb-2">
              <h4 className="font-bold text-sm text-on-surface">Enter Passenger Passcode</h4>
              <button
                onClick={() => setShowOtpModal(false)}
                className="text-on-surface-variant hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <p className="text-xs text-on-surface-variant">
              Enter the 6-digit TOTP code displayed on the passenger's Corporate Commute Pass.
            </p>

            <input
              type="text"
              maxLength={6}
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              placeholder="e.g. 849204"
              className="w-full text-center text-xl font-mono font-bold tracking-widest p-3 rounded-xl border border-outline-variant/40 bg-surface-container-high focus:outline-primary"
            />

            <div className="flex gap-2">
              <button
                onClick={() => setShowOtpModal(false)}
                className="flex-1 py-2 rounded-xl bg-surface-container text-on-surface text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleVerifyOtp}
                className="flex-1 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold"
              >
                Verify & Board
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
