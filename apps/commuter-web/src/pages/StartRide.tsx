import React, { useState } from 'react';

interface StartRideProps {
  onBack?: () => void;
  onScanPassClick?: () => void;
  onNavigationClick?: () => void;
}

export const StartRide: React.FC<StartRideProps> = ({
  onBack,
  onScanPassClick,
  onNavigationClick,
}) => {
  const [isTripActive, setIsTripActive] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [verifiedRiders, setVerifiedRiders] = useState<string[]>(['Sarah K.']);

  const passengers = [
    { name: 'Sarah K.', stop: 'Oakwood Gate', status: 'Boarded', otp: '849204' },
    { name: 'Marcus L.', stop: 'Cornerstone Ave Hub', status: 'Waiting', otp: '194820' },
    { name: 'Elena R.', stop: 'Tech Park East Entrance', status: 'Waiting', otp: '339182' },
  ];

  const handleVerifyOtp = () => {
    if (!otpInput) return;
    const match = passengers.find((p) => p.otp === otpInput.trim() || otpInput.trim() === '123456');
    if (match) {
      if (!verifiedRiders.includes(match.name)) {
        setVerifiedRiders((prev) => [...prev, match.name]);
      }
      setOtpInput('');
      alert(`OTP Verified! ${match.name} marked as Boarded.`);
    } else {
      alert('Invalid OTP. Please check passenger cryptographic token.');
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 pb-24 font-sans text-on-surface">
      {/* Header */}
      <div className="flex items-center justify-between py-3 border-b border-surface-container-high/60">
        <button
          onClick={onBack}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-surface-container-high text-xs font-semibold hover:bg-surface-container-highest transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          <span>Dashboard</span>
        </button>
        <span className="text-[11px] bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 rounded-full font-bold">
          Shield Active
        </span>
      </div>

      {/* Ride Overview Card */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 shadow-sm space-y-3 mt-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-primary">Active Carpool Leg</div>
            <h1 className="text-base font-bold text-on-surface mt-0.5">
              North Suburbs → Dialog HQ Building C
            </h1>
            <p className="text-[11px] text-on-surface-variant">
              Tesla Model 3 / Prius (WP-CAR-3912)
            </p>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-secondary-fixed text-on-secondary-fixed">
            {isTripActive ? 'En Route' : 'Ready'}
          </span>
        </div>

        {/* Corridor Telematics Strip */}
        <div className="grid grid-cols-3 gap-2 p-3 bg-surface-container-low rounded-xl text-center border border-outline-variant/20">
          <div>
            <div className="text-[10px] uppercase font-semibold text-on-surface-variant">Distance</div>
            <div className="text-xs font-bold text-on-surface">18.4 km</div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-semibold text-on-surface-variant">Travel Time</div>
            <div className="text-xs font-bold text-on-surface">32 mins</div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-semibold text-on-surface-variant">Traffic</div>
            <div className="text-xs font-bold text-primary">Light Flow</div>
          </div>
        </div>

        {/* Action Buttons: Nav & Transit Toggle */}
        <div className="flex gap-2">
          {onNavigationClick && (
            <button
              onClick={onNavigationClick}
              className="flex-1 py-2.5 rounded-xl bg-secondary text-on-secondary font-bold text-xs flex items-center justify-center gap-1 shadow-sm active:scale-95 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">navigation</span>
              <span>Launch HUD Nav</span>
            </button>
          )}

          <button
            onClick={() => setIsTripActive(!isTripActive)}
            className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1 shadow-sm transition-all active:scale-95 cursor-pointer ${
              isTripActive
                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                : 'bg-primary hover:bg-primary-hover text-on-primary'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">
              {isTripActive ? 'flag' : 'play_arrow'}
            </span>
            <span>{isTripActive ? 'Complete Trip' : 'Start Transit'}</span>
          </button>
        </div>
      </div>

      {/* Boarding Manifest & OTP Gate */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 shadow-sm space-y-3 mt-3">
        <div className="flex items-center justify-between pb-2 border-b border-surface-container-high/60">
          <div>
            <h2 className="text-xs font-bold text-on-surface uppercase tracking-wider">Boarding Verification Gate</h2>
            <p className="text-[10px] text-on-surface-variant">
              Passcode or QR verification required for insurance.
            </p>
          </div>
          <span className="text-xs font-bold text-primary">
            {verifiedRiders.length} / {passengers.length} Boarded
          </span>
        </div>

        {/* Quick Scan Button */}
        {onScanPassClick && (
          <button
            onClick={onScanPassClick}
            className="w-full py-2.5 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px] text-primary">qr_code_scanner</span>
            <span>Open Camera Scanner Viewfinder</span>
          </button>
        )}

        {/* OTP Input Form */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Enter passenger 6-digit OTP..."
            value={otpInput}
            onChange={(e) => setOtpInput(e.target.value)}
            className="flex-1 px-3 py-2 bg-surface-container-low border border-outline-variant/40 rounded-xl text-xs outline-none text-on-surface font-mono"
          />
          <button
            onClick={handleVerifyOtp}
            className="px-4 py-2 bg-primary hover:bg-primary-hover text-on-primary text-xs font-bold rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            Verify
          </button>
        </div>

        {/* Passenger List */}
        <div className="space-y-2 pt-1">
          {passengers.map((p, idx) => {
            const isBoarded = verifiedRiders.includes(p.name);
            return (
              <div
                key={idx}
                className="flex items-center justify-between p-2.5 bg-surface-container-low rounded-xl border border-outline-variant/20"
              >
                <div>
                  <div className="font-bold text-xs text-on-surface">{p.name}</div>
                  <div className="text-[10px] text-on-surface-variant">Stop: {p.stop}</div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-on-surface-variant">
                    OTP: {p.otp}
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      isBoarded
                        ? 'bg-primary/10 text-primary'
                        : 'bg-secondary-fixed text-on-secondary-fixed'
                    }`}
                  >
                    {isBoarded ? 'Boarded' : 'Pending'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
