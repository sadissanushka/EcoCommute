import React, { useState } from 'react';

interface StartRideProps {
  onBack?: () => void;
}

export const StartRide: React.FC<StartRideProps> = ({ onBack }) => {
  const [isTripActive, setIsTripActive] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [verifiedRiders, setVerifiedRiders] = useState<string[]>(['Sarah K.']);

  const passengers = [
    { name: 'Sarah K.', stop: 'Oakwood Gate', status: 'Boarded', otp: '482190' },
    { name: 'Marcus L.', stop: 'Cornerstone Ave Hub', status: 'Waiting', otp: '194820' },
    { name: 'Elena R.', stop: 'Tech Park East Entrance', status: 'Waiting', otp: '339182' },
  ];

  const handleVerifyOtp = () => {
    if (!otpInput) return;
    const match = passengers.find((p) => p.otp === otpInput);
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
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="px-3.5 py-1.5 rounded-xl bg-surface-container-low dark:bg-surface-container border border-outline-variant/30 text-xs font-semibold text-on-surface dark:text-white"
        >
          ← Back to Dashboard
        </button>
        <span className="text-xs bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-full font-semibold">
          Route Deviation Shield Active
        </span>
      </div>

      {/* Ride Overview Card */}
      <div className="bg-surface-container-lowest dark:bg-surface-container border border-outline-variant/30 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-primary">Active Carpool Leg</div>
            <h1 className="text-xl font-bold text-on-surface dark:text-white mt-1">
              North Suburbs → Dialog HQ Building C
            </h1>
            <p className="text-xs text-on-surface-variant dark:text-outline-variant mt-0.5">
              Vehicle: Toyota Prius Hybrid (WP-CAR-3912)
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-secondary/10 text-secondary border border-secondary/20">
            {isTripActive ? 'En Route (Live GPS)' : 'Ready at Origin'}
          </span>
        </div>

        {/* Corridor Telematics Strip */}
        <div className="grid grid-cols-3 gap-3 p-4 bg-surface-container-low dark:bg-surface-container-high rounded-xl text-center">
          <div>
            <div className="text-xs text-on-surface-variant dark:text-outline-variant">Distance</div>
            <div className="text-base font-bold text-on-surface dark:text-white">18.4 km</div>
          </div>
          <div>
            <div className="text-xs text-on-surface-variant dark:text-outline-variant">Est. Travel Time</div>
            <div className="text-base font-bold text-on-surface dark:text-white">32 mins</div>
          </div>
          <div>
            <div className="text-xs text-on-surface-variant dark:text-outline-variant">Corridor Traffic</div>
            <div className="text-base font-bold text-primary">Light Flow</div>
          </div>
        </div>

        {/* Trip Dispatch Toggle */}
        <button
          onClick={() => setIsTripActive(!isTripActive)}
          className={`w-full py-3 rounded-xl font-bold text-sm shadow-sm transition ${
            isTripActive
              ? 'bg-amber-600 hover:bg-amber-700 text-white'
              : 'bg-primary hover:bg-primary-container text-on-primary'
          }`}
        >
          {isTripActive ? 'Complete Trip & Publish Settlement' : 'Start Transit (Engage Shield)'}
        </button>
      </div>

      {/* Boarding Manifest & OTP Gate */}
      <div className="bg-surface-container-lowest dark:bg-surface-container border border-outline-variant/30 rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
          <div>
            <h2 className="text-base font-bold text-on-surface dark:text-white">Boarding Manifest & OTP Gate</h2>
            <p className="text-xs text-on-surface-variant dark:text-outline-variant">
              Cryptographic one-time passcode required for passenger boarding insurance.
            </p>
          </div>
          <span className="text-xs font-bold text-primary font-mono">
            {verifiedRiders.length} / {passengers.length} Boarded
          </span>
        </div>

        {/* OTP Input Form */}
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Enter passenger 6-digit OTP..."
            value={otpInput}
            onChange={(e) => setOtpInput(e.target.value)}
            className="flex-1 px-4 py-2.5 bg-surface-container-low dark:bg-surface-container-high border border-outline-variant/40 rounded-xl text-sm outline-none text-on-surface dark:text-white font-mono"
          />
          <button
            onClick={handleVerifyOtp}
            className="px-5 py-2.5 bg-primary hover:bg-primary-container text-on-primary text-xs font-bold rounded-xl shadow-sm transition"
          >
            Verify OTP
          </button>
        </div>

        {/* Passenger List */}
        <div className="space-y-3 pt-2">
          {passengers.map((p, idx) => {
            const isBoarded = verifiedRiders.includes(p.name);
            return (
              <div
                key={idx}
                className="flex items-center justify-between p-3.5 bg-surface-container-low dark:bg-surface-container-high rounded-xl"
              >
                <div>
                  <div className="font-semibold text-sm text-on-surface dark:text-white">{p.name}</div>
                  <div className="text-xs text-on-surface-variant dark:text-outline-variant">Stop: {p.stop}</div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-on-surface-variant dark:text-outline-variant">
                    Token: {p.otp}
                  </span>
                  <span
                    className={`text-xs px-2.5 py-1 rounded-md font-semibold ${
                      isBoarded
                        ? 'bg-primary/10 text-primary border border-primary/20'
                        : 'bg-secondary/10 text-secondary border border-secondary/20'
                    }`}
                  >
                    {isBoarded ? 'Boarded' : 'Pending OTP'}
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
