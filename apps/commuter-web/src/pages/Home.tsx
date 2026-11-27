import React, { useState, useEffect } from 'react';
import { User, getFriendlyFirstName, getAvatarInitials, MyBooking, ShuttleTrip } from '../types';
import { bookingApi, safetyApi, walletApi } from '../api/client';
import { SharedRouteMap, MapCoordinate } from '../components/SharedRouteMap';

interface HomeProps {
  user: User | null;
  onNavigateToBook: () => void;
  onNavigateToTracking: (tripId: number) => void;
  onNavigateToWallet: () => void;
  onNavigateToSos: () => void;
  onNavigateToPass: () => void;
  onNavigateToDriver?: () => void;
}

export const Home: React.FC<HomeProps> = ({
  user,
  onNavigateToBook,
  onNavigateToTracking,
  onNavigateToWallet,
  onNavigateToSos,
  onNavigateToPass,
  onNavigateToDriver,
}) => {
  const firstName = getFriendlyFirstName(user?.fullName);

  const [co2SavedKg, setCo2SavedKg] = useState<number>(0);
  const [balanceLkr, setBalanceLkr] = useState<number>(0);
  const [upcomingBooking, setUpcomingBooking] = useState<MyBooking | null>(null);
  const [nextScheduledTrip, setNextScheduledTrip] = useState<ShuttleTrip | null>(null);
  const [corridorPath, setCorridorPath] = useState<MapCoordinate[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    async function loadHomeData() {
      try {
        const [walletData, bookings, trips] = await Promise.all([
          walletApi.getBalance().catch(() => null),
          bookingApi.getMyBookings().catch(() => [] as MyBooking[]),
          bookingApi.getTrips().catch(() => [] as ShuttleTrip[]),
        ]);

        if (!isMounted) return;

        if (walletData) {
          setBalanceLkr(walletData.balanceLkr ?? 0);
          setCo2SavedKg(walletData.co2SavedKg ?? 0);
        }

        let resolvedTripId = 1;
        if (bookings && bookings.length > 0) {
          const active = bookings.find(
            (b) => b.status === 'confirmed' || b.status === 'boarded'
          );
          const chosen = active || bookings[0];
          setUpcomingBooking(chosen);
          resolvedTripId = chosen.tripId;
        } else if (trips && trips.length > 0) {
          resolvedTripId = trips[0].id;
        }

        if (trips && trips.length > 0) {
          setNextScheduledTrip(trips[0]);
        }

        const coords = await safetyApi.getCorridor(resolvedTripId).catch(() => []);
        if (isMounted && Array.isArray(coords) && coords.length > 0) {
          setCorridorPath(coords);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadHomeData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Format trip departure date/time for display
  const formatDeparture = (dateStr?: string) => {
    if (!dateStr) return 'Today, 5:30 PM';
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' (' + d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ')';
    } catch {
      return 'Today, 5:30 PM';
    }
  };

  const targetTripId = upcomingBooking?.tripId || nextScheduledTrip?.id || 1;
  const originDisplay = upcomingBooking?.originName || nextScheduledTrip?.originName || 'Kaduwela Interchange';
  const destDisplay = upcomingBooking?.destinationName || nextScheduledTrip?.destinationName || 'Colombo Fort CBD';
  const routeNameDisplay = upcomingBooking?.routeName || nextScheduledTrip?.routeName || 'Kaduwela Express (Line 14-B)';

  return (
    <div className="flex flex-col w-full max-w-md mx-auto px-4 pb-24 gap-4 font-sans">
      {/* Welcome Header Section */}
      <section className="mt-2 flex flex-col gap-0.5">
        <h1 className="text-2xl font-bold text-on-surface tracking-tight">
          Hello, {firstName}!
        </h1>
        <p className="text-xs text-on-surface-variant flex items-center gap-1.5 font-medium">
          <span className="material-symbols-outlined text-primary text-[18px]">eco</span>
          You've saved <span className="text-primary font-bold">{co2SavedKg}kg</span> of CO₂ this month with corporate transit.
        </p>
      </section>

      {/* Next Ride Spotlight Card - FULL CARD CLICKABLE TO LIVE TRACKING */}
      <section
        onClick={() => onNavigateToTracking(targetTripId)}
        className="relative overflow-hidden bg-primary-container rounded-2xl p-4 shadow-md text-on-primary-container transition-all active:scale-[0.99] border border-primary/20 cursor-pointer hover:shadow-lg group"
      >
        <div className="absolute -right-8 -top-8 opacity-20 pointer-events-none">
          <svg fill="currentColor" height="140" viewBox="0 0 100 100" width="140">
            <path d="M50 0 L100 50 L50 100 L0 50 Z"></path>
          </svg>
        </div>

        <div className="relative z-10 flex flex-col gap-3">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider opacity-85">
                {upcomingBooking ? 'Your Confirmed Commute' : 'Next Shuttle Scheduled'}
              </span>
              <h2 className="text-xl font-bold mt-0.5">
                {formatDeparture(upcomingBooking?.departAt || nextScheduledTrip?.departAt)}
              </h2>
            </div>
            <div className="bg-surface-container-lowest/20 backdrop-blur-md p-2 rounded-xl group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-on-primary-container text-[22px]">
                directions_bus
              </span>
            </div>
          </div>

          {/* Route stops timeline */}
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center">
              <div className="w-2.5 h-2.5 rounded-full bg-on-primary-container"></div>
              <div className="w-0.5 h-7 bg-on-primary-container/30 my-0.5"></div>
              <div className="w-2.5 h-2.5 rounded-full border-2 border-on-primary-container"></div>
            </div>
            <div className="flex flex-col gap-2 flex-1">
              <div className="text-xs font-medium leading-none truncate">{originDisplay}</div>
              <div className="text-xs font-bold leading-none truncate">{destDisplay}</div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-1 pt-2 border-t border-on-primary-container/20">
            <div className="text-[11px] font-semibold opacity-90 truncate max-w-[200px]">
              {routeNameDisplay}
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onNavigateToTracking(targetTripId);
              }}
              className="bg-surface-container-lowest text-primary px-3.5 py-1.5 rounded-full text-xs font-bold shadow-sm hover:bg-surface-bright active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
            >
              <span>Live Telematics</span>
              <span className="material-symbols-outlined text-[16px]">radar</span>
            </button>
          </div>
        </div>
      </section>

      {/* Corporate Commute Pass Banner - OPENS CORPORATE PASS */}
      <div
        onClick={onNavigateToPass}
        className="bg-surface-container-lowest border border-surface-container-high/60 p-3.5 rounded-xl flex items-center justify-between shadow-sm cursor-pointer hover:bg-surface-container-low transition-all active:scale-[0.99] group"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
            <span className="material-symbols-outlined text-[20px]">badge</span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-on-surface">Corporate Commute Pass</span>
              <span className="bg-primary-fixed text-on-primary-fixed text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                Active Tier 1
              </span>
            </div>
            <span className="text-[11px] text-on-surface-variant">
              {user?.companyName ? `${user.companyName} Corporate Fleet Access` : 'Corporate Mobility Pass (NFC & QR)'}
            </span>
          </div>
        </div>
        <span className="material-symbols-outlined text-outline text-[20px] group-hover:translate-x-0.5 transition-transform">
          chevron_right
        </span>
      </div>

      {/* Quick Action Bento Grid */}
      <section className="grid grid-cols-2 gap-3">
        <div
          onClick={onNavigateToBook}
          className="bg-surface-container-low p-3.5 rounded-xl flex flex-col gap-2 shadow-sm transition-all hover:bg-surface-container-high cursor-pointer group border border-outline-variant/20 active:scale-[0.98]"
        >
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined text-[20px]">add_circle</span>
          </div>
          <div>
            <div className="text-xs font-bold text-on-surface">Book Shuttle</div>
            <div className="text-[11px] text-on-surface-variant">Find seat on route</div>
          </div>
        </div>

        <div
          onClick={onNavigateToWallet}
          className="bg-surface-container-low p-3.5 rounded-xl flex flex-col gap-2 shadow-sm transition-all hover:bg-surface-container-high cursor-pointer group border border-outline-variant/20 active:scale-[0.98]"
        >
          <div className="w-9 h-9 rounded-full bg-secondary/10 flex items-center justify-center text-secondary group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
          </div>
          <div>
            <div className="text-xs font-bold text-on-surface">Wallet & ESG</div>
            <div className="text-[11px] text-on-surface-variant">Balance: LKR {balanceLkr.toFixed(2)}</div>
          </div>
        </div>
      </section>

      {/* Driver Mode Banner */}
      {onNavigateToDriver && (
        <div
          onClick={onNavigateToDriver}
          className="bg-surface-container-lowest border border-surface-container-high/60 p-3.5 rounded-xl flex items-center justify-between shadow-sm cursor-pointer hover:bg-surface-container-low transition-all active:scale-[0.99] group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center text-secondary group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[20px]">directions_car</span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-on-surface">Driver Dashboard</span>
                <span className="bg-secondary-fixed text-on-secondary-fixed text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                  Carpool Mode
                </span>
              </div>
              <span className="text-[11px] text-on-surface-variant">
                Publish rides, scan passenger passes & track navigation
              </span>
            </div>
          </div>
          <span className="material-symbols-outlined text-outline text-[20px] group-hover:translate-x-0.5 transition-transform">
            chevron_right
          </span>
        </div>
      )}

      {/* Live Map Preview Card — Real PostGIS Corridor on Leaflet */}
      <section
        onClick={() => onNavigateToTracking(targetTripId)}
        className="relative rounded-2xl overflow-hidden shadow-md border border-outline-variant/20 cursor-pointer group bg-surface-container-lowest"
      >
        <div className="relative h-44 w-full pointer-events-none">
          <SharedRouteMap
            routePolyline={corridorPath}
            markers={
              corridorPath.length >= 2
                ? [
                    { lat: corridorPath[0].lat, lng: corridorPath[0].lng, label: originDisplay, color: '#15803d' },
                    {
                      lat: corridorPath[corridorPath.length - 1].lat,
                      lng: corridorPath[corridorPath.length - 1].lng,
                      label: destDisplay,
                      color: '#005db7',
                    },
                  ]
                : []
            }
            heightClass="h-44"
          />
        </div>
        <div className="px-3.5 py-2.5 bg-surface-container-lowest border-t border-outline-variant/20 flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-[10px] font-semibold text-primary uppercase tracking-wider block">
              Active Telematics Stream
            </span>
            <div className="text-xs font-bold text-on-surface truncate">{routeNameDisplay}</div>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-secondary group-hover:underline shrink-0 ml-2">
            View Live <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
          </span>
        </div>
      </section>

      {/* Employee Account Banner */}
      <section className="bg-surface-container-lowest p-3.5 rounded-xl border border-outline-variant/20 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs uppercase border border-primary/20">
            {getAvatarInitials(user?.fullName)}
          </div>
          <div>
            <div className="text-xs font-bold text-on-surface">{user?.fullName || 'Authenticated Employee'}</div>
            <div className="text-[11px] text-on-surface-variant truncate max-w-[200px]">
              {user?.email || ''}
            </div>
          </div>
        </div>

        <span className="text-[10px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full uppercase tracking-wider">
          {user?.id ? `Verified #${user.id}` : 'Verified'}
        </span>
      </section>
    </div>
  );
};
