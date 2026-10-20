import React from 'react';
import { User } from '../types';

interface HomeProps {
  user: User | null;
  onNavigateToBook: () => void;
  onNavigateToTracking: (tripId: number) => void;
  onNavigateToWallet: () => void;
  onNavigateToSos: () => void;
}

export const Home: React.FC<HomeProps> = ({
  user,
  onNavigateToBook,
  onNavigateToTracking,
  onNavigateToWallet,
  onNavigateToSos,
}) => {
  const firstName = user?.fullName ? user.fullName.split(' ')[0] : 'Commuter';

  return (
    <div className="flex flex-col w-full max-w-md mx-auto px-4 pb-24 gap-4 font-sans">
      {/* Welcome Header Section */}
      <section className="mt-2 flex flex-col gap-0.5">
        <h1 className="text-2xl font-bold text-on-surface tracking-tight">
          Hello, {firstName}!
        </h1>
        <p className="text-xs text-on-surface-variant flex items-center gap-1.5 font-medium">
          <span className="material-symbols-outlined text-primary text-[18px]">eco</span>
          You've saved <span className="text-primary font-bold">12.4kg</span> of CO₂ this month with corporate transit.
        </p>
      </section>

      {/* Next Ride Spotlight Card */}
      <section className="relative overflow-hidden bg-primary-container rounded-2xl p-4 shadow-md text-on-primary-container transition-transform active:scale-[0.99] border border-primary/20">
        <div className="absolute -right-8 -top-8 opacity-20 pointer-events-none">
          <svg fill="currentColor" height="140" viewBox="0 0 100 100" width="140">
            <path d="M50 0 L100 50 L50 100 L0 50 Z"></path>
          </svg>
        </div>

        <div className="relative z-10 flex flex-col gap-3">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider opacity-85">
                Next Corporate Ride Scheduled
              </span>
              <h2 className="text-xl font-bold mt-0.5">Today, 5:30 PM</h2>
            </div>
            <div className="bg-surface-container-lowest/20 backdrop-blur-md p-2 rounded-xl">
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
              <div className="text-xs font-medium leading-none">Corporate Park (East Wing)</div>
              <div className="text-xs font-bold leading-none">Green Valley Residence (Port City)</div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-1 pt-2 border-t border-on-primary-container/20">
            <div className="flex -space-x-2">
              <div className="w-7 h-7 rounded-full bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center text-[10px] font-bold border-2 border-primary-container">
                ST
              </div>
              <div className="w-7 h-7 rounded-full bg-surface-container-highest text-on-surface flex items-center justify-center text-[10px] font-bold border-2 border-primary-container">
                KP
              </div>
              <div className="w-7 h-7 rounded-full bg-primary text-on-primary flex items-center justify-center text-[10px] font-bold border-2 border-primary-container">
                +3
              </div>
            </div>

            <button
              onClick={() => onNavigateToTracking(1)}
              className="bg-surface-container-lowest text-primary px-4 py-1.5 rounded-full text-xs font-bold shadow-sm hover:bg-surface-bright active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
            >
              <span>Live Telematics</span>
              <span className="material-symbols-outlined text-[16px]">radar</span>
            </button>
          </div>
        </div>
      </section>

      {/* Corporate Commute Pass Banner */}
      <div className="bg-surface-container-lowest border border-surface-container-high/60 p-3.5 rounded-xl flex items-center justify-between shadow-sm cursor-pointer hover:bg-surface-container-low transition-all">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-[20px]">badge</span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-on-surface">Corporate Commute Pass</span>
              <span className="bg-primary-fixed text-on-primary-fixed text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                Active Tier 1
              </span>
            </div>
            <span className="text-[11px] text-on-surface-variant">Sysco LABS Corporate Fleet Access</span>
          </div>
        </div>
        <span className="material-symbols-outlined text-outline text-[20px]">chevron_right</span>
      </div>

      {/* Quick Action Bento Grid */}
      <section className="grid grid-cols-2 gap-3">
        <div
          onClick={onNavigateToBook}
          className="bg-surface-container-low p-3.5 rounded-xl flex flex-col gap-2 shadow-sm transition-all hover:bg-surface-container-high cursor-pointer group border border-outline-variant/20"
        >
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined text-[20px]">add_circle</span>
          </div>
          <div>
            <div className="text-xs font-bold text-on-surface">Book Shuttle</div>
            <div className="text-[11px] text-on-surface-variant">Find seat on Line 14-B</div>
          </div>
        </div>

        <div
          onClick={onNavigateToWallet}
          className="bg-surface-container-low p-3.5 rounded-xl flex flex-col gap-2 shadow-sm transition-all hover:bg-surface-container-high cursor-pointer group border border-outline-variant/20"
        >
          <div className="w-9 h-9 rounded-full bg-secondary/10 flex items-center justify-center text-secondary group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
          </div>
          <div>
            <div className="text-xs font-bold text-on-surface">Wallet & Emissions</div>
            <div className="text-[11px] text-on-surface-variant">Balance: LKR 428.50</div>
          </div>
        </div>
      </section>

      {/* Live Map Preview Card */}
      <section
        onClick={() => onNavigateToTracking(1)}
        className="relative rounded-2xl overflow-hidden shadow-md h-36 border border-outline-variant/20 cursor-pointer group"
      >
        <div className="absolute inset-0 bg-[#eef3ee] flex items-center justify-center">
          <svg className="w-full h-full object-cover" viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg">
            <path d="M 0 100 Q 150 40 250 120 T 400 80" fill="none" stroke="#0d631b" strokeWidth="4" strokeDasharray="6 4" />
            <circle cx="150" cy="70" r="8" fill="#0d631b" />
            <circle cx="150" cy="70" r="14" fill="#0d631b" fillOpacity="0.2" className="animate-ping" />
            <circle cx="280" cy="110" r="5" fill="#005db7" />
          </svg>
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest via-transparent to-transparent"></div>
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">Active Corridor</span>
            <div className="text-xs font-bold text-on-surface">Line 14-B Express Telematics</div>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-secondary group-hover:underline">
            View Live <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
          </span>
        </div>
      </section>

      {/* Employee Account Banner */}
      <section className="bg-surface-container-lowest p-3.5 rounded-xl border border-outline-variant/20 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs uppercase border border-primary/20">
            {user?.fullName ? user.fullName.split(' ').map(n => n[0]).join('').slice(0, 2) : 'ST'}
          </div>
          <div>
            <div className="text-xs font-bold text-on-surface">{user?.fullName || 'Sarah Taylor'}</div>
            <div className="text-[11px] text-on-surface-variant truncate max-w-[200px]">
              {user?.email || 'sarah.taylor@syscolabs.com'}
            </div>
          </div>
        </div>

        <span className="text-[10px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full uppercase tracking-wider">
          Verified
        </span>
      </section>
    </div>
  );
};
