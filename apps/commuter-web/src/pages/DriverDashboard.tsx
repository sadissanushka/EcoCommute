import React, { useState, useEffect } from 'react';
import { walletApi, bookingApi } from '../api/client';
import { ShuttleTrip } from '../types';

interface DriverDashboardProps {
  onPublishClick?: () => void;
  onStartRideClick?: () => void;
  onScanPassClick?: () => void;
  onNavigationClick?: () => void;
}

export const DriverDashboard: React.FC<DriverDashboardProps> = ({
  onPublishClick,
  onStartRideClick,
  onScanPassClick,
  onNavigationClick,
}) => {
  const [reimbursementLkr, setReimbursementLkr] = useState<number>(14850.0);
  const [trips, setTrips] = useState<ShuttleTrip[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    async function loadDriverData() {
      try {
        const [wallet, availableTrips] = await Promise.all([
          walletApi.getBalance().catch(() => null),
          bookingApi.getTrips().catch(() => [] as ShuttleTrip[]),
        ]);

        if (!isMounted) return;

        if (wallet) {
          // Multiply balance or use ledger derived value
          setReimbursementLkr(wallet.balanceLkr ? Number((wallet.balanceLkr * 34.6).toFixed(2)) : 14850.0);
        }

        if (availableTrips && availableTrips.length > 0) {
          setTrips(availableTrips.slice(0, 3));
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadDriverData();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="flex flex-col w-full max-w-md mx-auto px-4 pb-24 font-sans text-on-surface">
      {/* Header Stats Section */}
      <div className="py-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-2xl font-bold text-on-surface">Driver Dashboard</h1>
            <p className="text-xs text-on-surface-variant font-medium">Manage your corporate carpool & shuttle community</p>
          </div>
          <div className="bg-primary/10 p-2 rounded-full text-primary">
            <span className="material-symbols-outlined text-[28px]">eco</span>
          </div>
        </div>

        {/* Earnings Quick Glance Card */}
        <div className="bg-primary text-on-primary p-5 rounded-2xl shadow-lg relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-xs uppercase font-semibold opacity-90 mb-1">Monthly Fuel Reimbursements</p>
            <h2 className="text-3xl font-bold tracking-tight mb-3">LKR {reimbursementLkr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
            <div className="flex items-center gap-2">
              <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-semibold">12 Rides Shared</span>
              <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-semibold">85kg CO₂ Saved</span>
            </div>
          </div>
          <svg className="absolute -right-4 -bottom-4 w-40 h-40 opacity-15 text-white pointer-events-none" fill="currentColor" viewBox="0 0 200 200">
            <path d="M40,100 C40,40 100,40 100,40 C100,40 160,40 160,100 C160,160 100,160 100,160 C100,160 40,160 40,100"></path>
          </svg>
        </div>
      </div>

      {/* Primary Action: Publish a Ride */}
      <div className="mb-4">
        <button
          onClick={onPublishClick}
          className="w-full bg-surface-container-lowest border border-outline-variant/30 hover:bg-surface-container-low text-on-surface flex items-center justify-between p-4 rounded-2xl shadow-sm transition-all active:scale-[0.98] cursor-pointer group"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-primary flex items-center justify-center text-on-primary group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[24px]">add</span>
            </div>
            <div className="text-left">
              <p className="font-bold text-sm text-on-surface">Publish a Ride</p>
              <p className="text-xs text-on-surface-variant">Share your commute and split fuel costs</p>
            </div>
          </div>
          <span className="material-symbols-outlined text-outline text-[20px] group-hover:translate-x-0.5 transition-transform">
            chevron_right
          </span>
        </button>
      </div>

      {/* Quick Access Bar: Start Ride & Scan Pass */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <button
          onClick={onStartRideClick}
          className="p-3.5 bg-surface-container-low border border-outline-variant/30 rounded-2xl hover:bg-surface-container-high transition-all text-left shadow-sm cursor-pointer flex flex-col gap-2 active:scale-[0.98]"
        >
          <div className="w-9 h-9 rounded-xl bg-secondary text-on-secondary flex items-center justify-center font-bold">
            <span className="material-symbols-outlined text-[20px]">play_arrow</span>
          </div>
          <div>
            <div className="font-bold text-xs text-on-surface">Start Active Ride</div>
            <div className="text-[10px] text-on-surface-variant">Live telematics & OTP gate</div>
          </div>
        </button>

        <button
          onClick={onScanPassClick}
          className="p-3.5 bg-surface-container-low border border-outline-variant/30 rounded-2xl hover:bg-surface-container-high transition-all text-left shadow-sm cursor-pointer flex flex-col gap-2 active:scale-[0.98]"
        >
          <div className="w-9 h-9 rounded-xl bg-primary text-on-primary flex items-center justify-center font-bold">
            <span className="material-symbols-outlined text-[20px]">qr_code_scanner</span>
          </div>
          <div>
            <div className="font-bold text-xs text-on-surface">Scan Passenger Pass</div>
            <div className="text-[10px] text-on-surface-variant">Validate QR & NFC tokens</div>
          </div>
        </button>
      </div>

      {/* Upcoming Scheduled Rides */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-bold text-on-surface uppercase tracking-wider">Scheduled Carpool Routes</h3>
          <span className="text-[11px] text-primary font-bold">Real-Time Sync</span>
        </div>

        {trips.length > 0 ? (
          trips.map((trip) => (
            <div
              key={trip.id}
              className="bg-surface-container-lowest p-4 rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col gap-3"
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs font-bold text-primary uppercase tracking-wider">
                    {trip.departAt ? new Date(trip.departAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '08:30 AM'} • {trip.routeName}
                  </span>
                  <div className="flex items-center gap-1 text-[11px] text-on-surface-variant mt-0.5 font-medium">
                    <span className="material-symbols-outlined text-[15px]">group</span>
                    <span>{trip.availableSeats || 3} Seats Available</span>
                  </div>
                </div>
                <span className="bg-secondary-fixed text-on-secondary-fixed text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                  Confirmed
                </span>
              </div>

              {/* Origin -> Destination timeline */}
              <div className="relative flex flex-col gap-2 pl-4 before:content-[''] before:absolute before:left-[5px] before:top-[6px] before:bottom-[6px] before:w-[2px] before:bg-outline-variant/40">
                <div className="relative">
                  <div className="absolute -left-[15px] top-1 w-2 h-2 rounded-full bg-primary" />
                  <p className="text-[10px] uppercase font-semibold text-on-surface-variant">Origin</p>
                  <p className="text-xs font-bold text-on-surface truncate">{trip.originName}</p>
                </div>
                <div className="relative">
                  <div className="absolute -left-[15px] top-1 w-2 h-2 rounded-full bg-secondary" />
                  <p className="text-[10px] uppercase font-semibold text-on-surface-variant">Destination</p>
                  <p className="text-xs font-bold text-on-surface truncate">{trip.destinationName}</p>
                </div>
              </div>

              <div className="flex gap-2 pt-1 border-t border-surface-container-high/60">
                <button
                  onClick={onScanPassClick}
                  className="flex-1 py-2 rounded-xl bg-surface-container-high text-on-surface text-xs font-semibold hover:bg-surface-container-highest transition-colors cursor-pointer text-center"
                >
                  Manage Riders
                </button>
                <button
                  onClick={onStartRideClick}
                  className="flex-1 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-primary-hover active:scale-95 transition-all cursor-pointer text-center"
                >
                  Start Ride
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col gap-3">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs font-bold text-primary uppercase tracking-wider">
                  Tomorrow, 08:30 AM
                </span>
                <div className="flex items-center gap-1 text-[11px] text-on-surface-variant mt-0.5">
                  <span className="material-symbols-outlined text-[15px]">group</span>
                  <span>3 Seats Available</span>
                </div>
              </div>
              <span className="bg-secondary-fixed text-on-secondary-fixed text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                Confirmed
              </span>
            </div>

            <div className="relative flex flex-col gap-2 pl-4 before:content-[''] before:absolute before:left-[5px] before:top-[6px] before:bottom-[6px] before:w-[2px] before:bg-outline-variant/40">
              <div className="relative">
                <div className="absolute -left-[15px] top-1 w-2 h-2 rounded-full bg-primary" />
                <p className="text-[10px] uppercase font-semibold text-on-surface-variant">Origin</p>
                <p className="text-xs font-bold text-on-surface">128 Oakwood Gardens, North Suburbs</p>
              </div>
              <div className="relative">
                <div className="absolute -left-[15px] top-1 w-2 h-2 rounded-full bg-secondary" />
                <p className="text-[10px] uppercase font-semibold text-on-surface-variant">Destination</p>
                <p className="text-xs font-bold text-on-surface">Tech District, Building C (Dialog HQ)</p>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={onScanPassClick}
                className="flex-1 py-2 rounded-xl bg-surface-container-high text-on-surface text-xs font-semibold hover:bg-surface-container-highest transition-colors cursor-pointer"
              >
                Manage Riders
              </button>
              <button
                onClick={onStartRideClick}
                className="flex-1 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-primary-hover transition-colors cursor-pointer"
              >
                Start Ride
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bento Grid: Vehicle Details & Turn Navigation */}
      <div className="bg-surface-container-low p-4 rounded-2xl flex items-center justify-between border border-outline-variant/30 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-[28px]">electric_car</span>
          </div>
          <div>
            <h4 className="text-xs font-bold text-on-surface">Tesla Model 3 / Prius Hybrid</h4>
            <p className="text-[11px] text-on-surface-variant">WP-CAR-3912 • Electric Green</p>
          </div>
        </div>

        {onNavigationClick && (
          <button
            onClick={onNavigationClick}
            className="px-3 py-1.5 rounded-xl bg-primary/10 text-primary font-bold text-xs hover:bg-primary/20 transition-colors cursor-pointer flex items-center gap-1"
          >
            <span>HUD Nav</span>
            <span className="material-symbols-outlined text-[15px]">navigation</span>
          </button>
        )}
      </div>
    </div>
  );
};
