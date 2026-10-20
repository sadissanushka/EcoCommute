import React, { useState, useEffect } from 'react';
import { bookingApi } from '../api/client';
import { ShuttleTrip } from '../types';

interface BookRideProps {
  onSelectTrip: (tripId: number) => void;
  onNavigateHome: () => void;
}

export const BookRide: React.FC<BookRideProps> = ({ onSelectTrip, onNavigateHome }) => {
  const [trips, setTrips] = useState<ShuttleTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickup, setPickup] = useState('Galle Face Center Rd, Colombo 03');
  const [destination, setDestination] = useState('WTC Colombo 01 (Port City Corridor)');
  const [selectedTripIndex, setSelectedTripIndex] = useState(0);

  useEffect(() => {
    bookingApi.getTrips().then((res) => {
      setTrips(res);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, []);

  const activeTrip = trips[selectedTripIndex] || null;

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

        {/* Live Shuttle Telematics Pin */}
        <div className="absolute top-[42%] left-[48%] -translate-x-1/2 -translate-y-1/2 cursor-pointer z-10">
          <div className="flex flex-col items-center group">
            <div className="bg-secondary text-on-secondary px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 border border-white/30 animate-bounce">
              <span className="material-symbols-outlined text-[16px]">directions_bus</span>
              <span className="text-xs font-bold whitespace-nowrap">8 min away</span>
            </div>
            <div className="w-2.5 h-2.5 bg-secondary rotate-45 -mt-1 shadow-sm"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-secondary/40 animate-ping mt-1"></div>
          </div>
        </div>
      </div>

      {/* Top Section: Minimal Unified Floating Search Pill & Quick Chips */}
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

      {/* Lower Section: Elevated Floating Bottom Card Module */}
      <div className="absolute bottom-20 left-4 right-4 z-20 max-w-md mx-auto">
        <div className="bg-surface/95 backdrop-blur-xl rounded-2xl shadow-2xl p-4 flex flex-col gap-3 border border-white/60">
          {/* Top Row: Metric Widgets */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-surface-container-lowest p-3 rounded-xl shadow-sm flex flex-col gap-1 border border-outline-variant/30">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">
                  CO2 SAVED
                </span>
                <span className="material-symbols-outlined text-primary text-[18px]">eco</span>
              </div>
              <span className="text-xl font-bold text-primary leading-tight">12.4kg</span>
            </div>

            <div className="bg-surface-container-lowest p-3 rounded-xl shadow-sm flex flex-col gap-1 border border-outline-variant/30">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">
                  CAPACITY
                </span>
                <span className="material-symbols-outlined text-secondary text-[18px]">group</span>
              </div>
              <span className="text-xl font-bold text-secondary leading-tight">
                {activeTrip ? `${Math.round(((14 - activeTrip.availableSeats) / 14) * 100)}%` : '86%'}
              </span>
            </div>
          </div>

          {/* Active Departure Banner */}
          <div className="bg-primary text-on-primary rounded-xl p-3 shadow-lg flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 bg-on-primary/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-[26px]">directions_bus</span>
              </div>
              <div className="truncate">
                <h3 className="text-base font-bold leading-tight">
                  {activeTrip?.routeName || 'Line 14-B Express'}
                </h3>
                <p className="text-xs opacity-90 leading-normal">
                  Departing in <span className="font-bold underline underline-offset-2">3 mins</span> (11 seats free)
                </p>
              </div>
            </div>

            <button
              onClick={() => onSelectTrip(activeTrip?.id || 1)}
              className="bg-on-primary text-primary px-4 py-2 rounded-full text-xs font-bold shadow-md hover:brightness-110 active:scale-95 transition-all flex-shrink-0 ml-2 cursor-pointer"
            >
              BOOK NOW
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
