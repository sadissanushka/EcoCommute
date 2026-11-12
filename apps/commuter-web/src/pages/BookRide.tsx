import React, { useState, useEffect } from 'react';
import { bookingApi } from '../api/client';
import { ShuttleTrip, WaitlistEntry } from '../types';

interface BookRideProps {
  onSelectTrip: (tripId: number, partySize: number) => void;
  onNavigateHome: () => void;
  onNavigateToBookings?: () => void;
}

export const BookRide: React.FC<BookRideProps> = ({
  onSelectTrip,
  onNavigateHome,
  onNavigateToBookings,
}) => {
  const [trips, setTrips] = useState<ShuttleTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [travelDate, setTravelDate] = useState('');
  const [partySize, setPartySize] = useState<number>(1);

  const [selectedTripIndex, setSelectedTripIndex] = useState(0);

  // Waitlist state
  const [joiningWaitlistTripId, setJoiningWaitlistTripId] = useState<number | null>(null);
  const [waitlistSuccess, setWaitlistSuccess] = useState<WaitlistEntry | null>(null);

  // Initial load: retrieve real scheduled trips from the backend.
  useEffect(() => {
    let isMounted = true;

    const loadInitialTrips = async () => {
      try {
        setLoading(true);
        setSearchError(null);

        const results = await bookingApi.getTrips();

        if (isMounted) {
          setTrips(results);
          setSelectedTripIndex(0);
        }
      } catch (error) {
        if (isMounted) {
          setTrips([]);
          setSearchError(
            error instanceof Error
              ? error.message
              : 'Unable to load shuttle trips.'
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadInitialTrips();

    return () => {
      isMounted = false;
    };
  }, []);

  // Search using the employee's entered locations, travel date, and party size.
  const handleSearch = async () => {
    if (!pickup.trim() || !destination.trim()) {
      setSearchError('Please enter both pickup and destination locations.');
      return;
    }

    if (pickup.trim().toLowerCase() === destination.trim().toLowerCase()) {
      setSearchError('Pickup and destination cannot be the same.');
      return;
    }

    try {
      setLoading(true);
      setSearchError(null);
      setWaitlistSuccess(null);
      setTrips([]);
      setSelectedTripIndex(0);

      const results = await bookingApi.getTrips({
        origin: pickup.trim(),
        destination: destination.trim(),
        date: travelDate || undefined,
        seatsNeeded: partySize,
      });

      setTrips(results);
    } catch (error) {
      setTrips([]);
      setSearchError(
        error instanceof Error
          ? error.message
          : 'Unable to search for shuttle trips.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleJoinWaitlist = async (tripId: number) => {
    try {
      setJoiningWaitlistTripId(tripId);
      setSearchError(null);
      const entry = await bookingApi.joinWaitlist(tripId, partySize);
      setWaitlistSuccess(entry);
    } catch (err: any) {
      setSearchError(err.message || 'Failed to join waitlist.');
    } finally {
      setJoiningWaitlistTripId(null);
    }
  };

  return (
    <div className="relative w-full h-[calc(100vh-64px)] overflow-hidden font-sans">
      {/* Expansive Stylized Route Map Canvas */}
      <div className="absolute inset-0 z-0 bg-[#eef3ee]">
        <svg className="w-full h-full object-cover" viewBox="0 0 400 800" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="routeGrad" x1="0%" x2="100%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="#0d631b" />
              <stop offset="100%" stopColor="#2e7d32" />
            </linearGradient>
            <linearGradient id="secRouteGrad" x1="0%" x2="100%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="#005db7" />
              <stop offset="100%" stopColor="#64a1ff" />
            </linearGradient>
          </defs>

          {/* Road Network Grid */}
          <path d="M -20 120 C 100 130 180 180 210 280 C 230 360 170 420 180 520 C 190 600 280 660 420 700" fill="none" stroke="#ffffff" strokeLinecap="round" strokeWidth="16" />
          <path d="M 420 140 C 320 190 260 250 210 280 C 150 320 90 320 -20 340" fill="none" stroke="#ffffff" strokeLinecap="round" strokeWidth="12" />
          <path d="M 80 820 C 90 700 120 580 180 520 C 240 460 330 430 420 410" fill="none" stroke="#ffffff" strokeLinecap="round" strokeWidth="14" />

          {/* Active Bus Route Polylines */}
          <path d="M 100 220 C 140 230 180 260 210 280 C 240 330 200 400 180 520 C 160 620 250 670 320 680" fill="none" stroke="url(#routeGrad)" strokeDasharray="6 6" strokeLinecap="round" strokeWidth="6" />
          <path d="M 360 240 C 290 270 230 310 180 520 C 140 610 100 680 90 750" fill="none" stroke="url(#secRouteGrad)" strokeDasharray="6 6" strokeLinecap="round" strokeWidth="5" />

          {/* Waypoints */}
          <circle cx="100" cy="220" r="7" fill="#0d631b" />
          <circle cx="100" cy="220" r="3" fill="#ffffff" />
          <circle cx="320" cy="680" r="7" fill="#ba1a1a" />
          <circle cx="320" cy="680" r="3" fill="#ffffff" />
        </svg>
      </div>

      {/* Top Section: Search Panel with Party Size */}
      <div className="relative z-20 px-4 pt-3 flex flex-col gap-2 max-w-md mx-auto">
        <div className="bg-surface/95 backdrop-blur-xl rounded-2xl shadow-xl p-3 flex flex-col gap-2 border border-white/60">
          <div className="bg-surface-container-low rounded-xl p-2 flex flex-col gap-1 border border-outline-variant/30">
            {/* Pickup */}
            <div className="relative flex items-center">
              <div className="w-6 flex justify-center items-center">
                <div className="w-2.5 h-2.5 rounded-full bg-primary ring-4 ring-primary/20"></div>
              </div>
              <input
                type="text"
                value={pickup}
                onChange={(e) => setPickup(e.target.value)}
                placeholder="Pickup location"
                className="w-full bg-transparent pl-2 pr-8 py-1 text-xs font-semibold text-on-surface outline-none"
              />
              <span className="material-symbols-outlined absolute right-2 text-primary text-[18px]">
                my_location
              </span>
            </div>

            {/* Divider */}
            <div className="flex items-center pl-3">
              <div className="w-px h-2.5 bg-outline-variant"></div>
              <div className="flex-1 ml-4 h-px bg-outline-variant/20"></div>
            </div>

            {/* Drop-off */}
            <div className="relative flex items-center">
              <div className="w-6 flex justify-center items-center">
                <div className="w-2.5 h-2.5 rounded-full bg-secondary ring-4 ring-secondary/20"></div>
              </div>
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Where to?"
                className="w-full bg-transparent pl-2 pr-8 py-1 text-xs font-semibold text-on-surface outline-none"
              />
              <span className="material-symbols-outlined absolute right-2 text-on-surface-variant text-[18px]">
                search
              </span>
            </div>
          </div>

          {/* Travel Date & Party Size Row */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            {/* Travel Date */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface-container-lowest rounded-xl border border-outline-variant/30">
              <span className="material-symbols-outlined text-primary text-[16px]">
                calendar_month
              </span>
              <input
                type="date"
                value={travelDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setTravelDate(e.target.value)}
                className="w-full bg-transparent text-xs font-semibold text-on-surface outline-none"
              />
            </div>

            {/* Party Size Selector (1-6) */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface-container-lowest rounded-xl border border-outline-variant/30">
              <span className="material-symbols-outlined text-primary text-[16px]">
                group
              </span>
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-bold text-on-surface">Riders:</span>
                <select
                  value={partySize}
                  onChange={(e) => setPartySize(parseInt(e.target.value, 10))}
                  aria-label="Number of riders"
                  className="bg-transparent text-xs font-bold text-primary outline-none cursor-pointer"
                >
                  {[1, 2, 3, 4, 5, 6].map((num) => (
                    <option key={num} value={num}>
                      {num} {num === 1 ? 'person' : 'people'}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Search Button */}
          <button
            type="button"
            onClick={handleSearch}
            disabled={loading}
            className="w-full bg-primary text-on-primary rounded-xl py-2.5 text-xs font-bold shadow-md hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            {loading ? 'SEARCHING...' : `SEARCH SHUTTLES (FOR ${partySize})`}
          </button>

          {/* Quick Chips */}
          <div className="flex gap-2 overflow-x-auto pt-0.5 no-scrollbar">
            <button
              onClick={() => setDestination('Home - Colombo 07')}
              className="flex items-center gap-1.5 px-3 py-1 bg-surface-container-highest/80 rounded-full text-xs text-on-surface-variant hover:bg-primary-container hover:text-on-primary-container transition-colors shadow-sm cursor-pointer"
            >
              <span className="material-symbols-outlined text-[15px]">home</span>
              <span>Home</span>
            </button>
            <button
              onClick={() => setDestination('WTC Colombo 01')}
              className="flex items-center gap-1.5 px-3 py-1 bg-surface-container-highest/80 rounded-full text-xs text-on-surface-variant hover:bg-primary-container hover:text-on-primary-container transition-colors shadow-sm cursor-pointer"
            >
              <span className="material-symbols-outlined text-[15px]">work</span>
              <span>Work</span>
            </button>
            <button
              onClick={() => setDestination('Port City Tech Hub')}
              className="flex items-center gap-1.5 px-3 py-1 bg-surface-container-highest/80 rounded-full text-xs text-on-surface-variant hover:bg-primary-container hover:text-on-primary-container transition-colors shadow-sm cursor-pointer"
            >
              <span className="material-symbols-outlined text-[15px]">apartment</span>
              <span>Tech Hub</span>
            </button>
          </div>
        </div>
      </div>

      {/* Lower Section: Search Results */}
      <div className="absolute bottom-20 left-4 right-4 z-20 max-w-md mx-auto">
        <div className="bg-surface/95 backdrop-blur-xl rounded-2xl shadow-2xl p-4 flex flex-col gap-3 border border-white/60 max-h-[45vh] overflow-y-auto">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-on-surface">Available Shuttles</h2>
            <span className="text-xs text-on-surface-variant">{trips.length} found</span>
          </div>

          {/* Waitlist Success Banner */}
          {waitlistSuccess && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 font-bold">
                <span className="material-symbols-outlined text-amber-600 text-[18px]">hourglass_top</span>
                <span>Waitlist Enrollment Confirmed!</span>
              </div>
              <p>
                You are <strong>#{waitlistSuccess.position}</strong> in line for a party of {waitlistSuccess.partySize}. If a reservation is cancelled, you will be automatically promoted.
              </p>
              {onNavigateToBookings && (
                <button
                  type="button"
                  onClick={onNavigateToBookings}
                  className="mt-1 text-primary font-bold underline text-left cursor-pointer"
                >
                  View in My Bookings →
                </button>
              )}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="py-6 text-center">
              <div className="animate-spin w-7 h-7 border-4 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
              <p className="text-sm text-on-surface-variant">Finding available shuttles...</p>
            </div>
          )}

          {/* Error */}
          {!loading && searchError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-sm font-semibold text-red-700">Notice</p>
              <p className="text-xs text-red-600 mt-1">{searchError}</p>
            </div>
          )}

          {/* No Results */}
          {!loading && !searchError && trips.length === 0 && (
            <div className="py-6 text-center">
              <span className="material-symbols-outlined text-3xl text-on-surface-variant">directions_bus</span>
              <p className="text-sm font-semibold text-on-surface mt-2">No shuttles found</p>
              <p className="text-xs text-on-surface-variant mt-1">Try adjusting your travel date or party size.</p>
            </div>
          )}

          {/* Trip Cards */}
          {!loading && !searchError && trips.map((trip, index) => {
            const hasSufficientSeats = trip.availableSeats >= partySize;

            return (
              <div
                key={trip.id}
                className={`rounded-xl border p-3 flex flex-col gap-2 ${
                  selectedTripIndex === index
                    ? 'border-primary bg-primary/5'
                    : 'border-outline-variant/50 bg-surface-container-lowest'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedTripIndex(index)}
                  className="text-left w-full cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-bold text-sm text-on-surface">
                        {trip.routeName || `Shuttle Trip #${trip.id}`}
                      </h3>
                      <p className="text-xs text-on-surface-variant mt-0.5">
                        {trip.originName} → {trip.destinationName}
                      </p>
                    </div>

                    <span
                      className={`text-xs font-bold whitespace-nowrap px-2 py-0.5 rounded-full ${
                        hasSufficientSeats
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {trip.availableSeats} seats left
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-on-surface-variant">
                    <span>
                      <span className="material-symbols-outlined text-[14px] align-middle mr-1">schedule</span>
                      {trip.departAt ? new Date(trip.departAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Time unavailable'}
                    </span>
                    <span>{trip.vehicle?.type || 'Shuttle'}</span>
                  </div>
                </button>

                {hasSufficientSeats ? (
                  <button
                    type="button"
                    onClick={() => onSelectTrip(trip.id, partySize)}
                    className="w-full bg-primary text-on-primary rounded-xl px-4 py-2 text-xs font-bold shadow-md hover:brightness-110 active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">event_seat</span>
                    <span>SELECT SEATS ({partySize} {partySize === 1 ? 'PERSON' : 'PEOPLE'})</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleJoinWaitlist(trip.id)}
                    disabled={joiningWaitlistTripId === trip.id}
                    className="w-full bg-amber-600 text-white rounded-xl px-4 py-2 text-xs font-bold shadow-md hover:bg-amber-700 active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[16px]">hourglass_top</span>
                    <span>{joiningWaitlistTripId === trip.id ? 'JOINING WAITLIST...' : `JOIN WAITLIST (PARTY OF ${partySize})`}</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
