import React, { useState } from 'react';
import { MapStudio } from './pages/MapStudio';
import { Home } from './pages/Home';
import { SeatSelection } from './pages/SeatSelection';
import { LiveTracking } from './pages/LiveTracking';
import { EmergencySos } from './pages/EmergencySos';
import { Wallet } from './pages/Wallet';
import { User } from './types';

export const App: React.FC = () => {
  // Default directly into Map Studio for a clean, standalone React Map experience
  const [viewMode, setViewMode] = useState<'map' | 'home' | 'seats' | 'tracking' | 'wallet' | 'sos'>('map');
  const [selectedTripId, setSelectedTripId] = useState<number>(1);

  const demoUser: User = {
    id: 1,
    email: 'anushka.thisera@syscolabs.com',
    fullName: 'Anushka Thisera',
    companyId: 1,
    companyName: 'Sysco LABS',
    role: 'commuter',
    verified: true,
  };

  // If on Map Studio (Primary Clean UI requested)
  if (viewMode === 'map') {
    return (
      <div className="relative w-full h-screen overflow-hidden">
        {/* Floating Switcher Pill (Top Right) */}
        <div className="absolute top-3.5 right-4 z-40">
          <button
            onClick={() => setViewMode('home')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-lowest/90 backdrop-blur-md text-on-surface shadow-lg border border-outline-variant/30 text-xs font-bold hover:bg-surface-container active:scale-95 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px] text-primary">dashboard</span>
            <span>Commuter Hub</span>
          </button>
        </div>

        <MapStudio />
      </div>
    );
  }

  // Commuter Hub and Auxiliary Flows
  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans">
      {/* Header */}
      <header className="fixed top-0 w-full z-40 bg-surface/85 backdrop-blur-xl pt-safe shadow-[0_1px_8px_rgba(0,0,0,0.04)] border-b border-surface-container-high/50">
        <div className="h-16 px-4 flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('map')}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-primary text-on-primary text-xs font-bold shadow-sm hover:bg-primary-container cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">map</span>
              <span>Map Studio</span>
            </button>
            <span className="font-bold text-base text-on-surface">
              {viewMode === 'seats'
                ? 'Seat Selection'
                : viewMode === 'tracking'
                ? 'Live Telematics'
                : viewMode === 'sos'
                ? 'Emergency SOS'
                : viewMode === 'wallet'
                ? 'Wallet & ESG'
                : 'Commuter Hub'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-xs uppercase">
              AT
            </div>
          </div>
        </div>
      </header>

      <div className="pt-16 pb-20 flex-1 flex flex-col">
        {viewMode === 'home' && (
          <Home
            user={demoUser}
            onNavigateToBook={() => setViewMode('map')}
            onNavigateToTracking={() => setViewMode('tracking')}
            onNavigateToWallet={() => setViewMode('wallet')}
            onNavigateToSos={() => setViewMode('sos')}
          />
        )}

        {viewMode === 'seats' && (
          <SeatSelection
            tripId={selectedTripId}
            onBookingSuccess={() => setViewMode('map')}
            onBack={() => setViewMode('map')}
          />
        )}

        {viewMode === 'tracking' && (
          <LiveTracking
            tripId={1}
            onOpenSos={() => setViewMode('sos')}
            onBack={() => setViewMode('map')}
          />
        )}

        {viewMode === 'sos' && <EmergencySos onBack={() => setViewMode('map')} />}

        {viewMode === 'wallet' && <Wallet />}
      </div>

      {/* Floating Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-surface/90 backdrop-blur-xl border-t border-outline-variant/30 pb-safe shadow-[0_-2px_12px_rgba(0,0,0,0.05)]">
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
          <button
            onClick={() => setViewMode('map')}
            className="flex-1 flex flex-col items-center justify-center py-1 transition-all text-on-surface-variant hover:text-primary"
          >
            <span className="material-symbols-outlined text-[22px]">explore</span>
            <span className="text-[11px] mt-0.5">Map</span>
          </button>

          <button
            onClick={() => setViewMode('home')}
            className={`flex-1 flex flex-col items-center justify-center py-1 transition-all ${
              viewMode === 'home' ? 'text-primary font-bold' : 'text-on-surface-variant'
            }`}
          >
            <span className="material-symbols-outlined text-[22px]">grid_view</span>
            <span className="text-[11px] mt-0.5">Hub</span>
          </button>

          <button
            onClick={() => setViewMode('tracking')}
            className={`flex-1 flex flex-col items-center justify-center py-1 transition-all ${
              viewMode === 'tracking' ? 'text-primary font-bold' : 'text-on-surface-variant'
            }`}
          >
            <span className="material-symbols-outlined text-[22px]">radar</span>
            <span className="text-[11px] mt-0.5">Tracking</span>
          </button>

          <button
            onClick={() => setViewMode('wallet')}
            className={`flex-1 flex flex-col items-center justify-center py-1 transition-all ${
              viewMode === 'wallet' ? 'text-primary font-bold' : 'text-on-surface-variant'
            }`}
          >
            <span className="material-symbols-outlined text-[22px]">account_balance_wallet</span>
            <span className="text-[11px] mt-0.5">Wallet</span>
          </button>

          <button
            onClick={() => setViewMode('sos')}
            className="flex flex-col items-center justify-center -mt-4 p-2 rounded-full active:scale-95 transition-transform"
          >
            <div className="w-12 h-12 rounded-full bg-error text-on-error flex items-center justify-center shadow-lg shadow-error/30">
              <span className="material-symbols-outlined text-[24px]">emergency</span>
            </div>
            <span className="text-[10px] font-bold text-error mt-0.5 uppercase">SOS</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

export default App;
