import React, { useState, useEffect } from 'react';
import { MapStudio } from './pages/MapStudio';
import { Home } from './pages/Home';
import { SeatSelection } from './pages/SeatSelection';
import { LiveTracking } from './pages/LiveTracking';
import { EmergencySos } from './pages/EmergencySos';
import { Wallet } from './pages/Wallet';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { User } from './types';
import { getCachedUser, clearSession } from './api/client';

export const App: React.FC = () => {
  // Navigation View State
  const [viewMode, setViewMode] = useState<
    'map' | 'home' | 'seats' | 'tracking' | 'wallet' | 'sos' | 'login' | 'register'
  >('home');
  const [selectedTripId, setSelectedTripId] = useState<number>(1);

  // Authenticated User State
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    return (
      getCachedUser() || {
        id: 1,
        email: 'anushka.thisera@syscolabs.com',
        fullName: 'Anushka Thisera',
        companyId: 1,
        companyName: 'Sysco LABS',
        role: 'commuter',
        verified: true,
      }
    );
  });

  const handleLogout = () => {
    clearSession();
    setCurrentUser(null);
    setViewMode('login');
  };

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setViewMode('home');
  };

  // If on Login view
  if (viewMode === 'login') {
    return (
      <div className="relative w-full min-h-screen bg-surface">
        <div className="absolute top-4 left-4 z-50">
          <button
            onClick={() => {
              setCurrentUser({
                id: 1,
                email: 'anushka.thisera@syscolabs.com',
                fullName: 'Anushka Thisera',
                companyId: 1,
                companyName: 'Sysco LABS',
                role: 'commuter',
                verified: true,
              });
              setViewMode('home');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-high/90 text-on-surface text-xs font-bold shadow hover:bg-surface-container-highest cursor-pointer transition-all"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            <span>Back to Hub (Demo Mode)</span>
          </button>
        </div>
        <Login onSuccess={handleLoginSuccess} onGoToRegister={() => setViewMode('register')} />
      </div>
    );
  }

  // If on Register view
  if (viewMode === 'register') {
    return (
      <div className="relative w-full min-h-screen bg-surface">
        <Register onSuccess={() => setViewMode('login')} onGoToLogin={() => setViewMode('login')} />
      </div>
    );
  }

  // If on Map Studio (Primary Clean UI)
  if (viewMode === 'map') {
    return (
      <div className="relative w-full h-screen overflow-hidden">
        {/* Floating Switcher Pill & Logout in Map Studio (Top Right) */}
        <div className="absolute top-3.5 right-4 z-40 flex items-center gap-2">
          <button
            onClick={() => setViewMode('home')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-lowest/90 backdrop-blur-md text-on-surface shadow-lg border border-outline-variant/30 text-xs font-bold hover:bg-surface-container active:scale-95 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px] text-primary">dashboard</span>
            <span>Commuter Hub</span>
          </button>

          <button
            onClick={handleLogout}
            title="Log Out"
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-surface-container-lowest/90 backdrop-blur-md text-error shadow-lg border border-error/20 text-xs font-bold hover:bg-error/10 active:scale-95 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">logout</span>
            <span>Log Out</span>
          </button>
        </div>

        <MapStudio />
      </div>
    );
  }

  // Commuter Hub and Auxiliary Flows
  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans">
      {/* Header with Map Studio and User Logout */}
      <header className="fixed top-0 w-full z-40 bg-surface/85 backdrop-blur-xl pt-safe shadow-[0_1px_8px_rgba(0,0,0,0.04)] border-b border-surface-container-high/50">
        <div className="h-16 px-4 flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('map')}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-primary text-on-primary text-xs font-bold shadow-sm hover:bg-primary-container cursor-pointer transition-all"
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

          {/* Right Header: Profile Avatar and Single Logout Button */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleLogout}
              title="Log out of account"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-error hover:bg-error/10 hover:border-error/30 border border-error/20 text-xs font-bold transition-all cursor-pointer active:scale-95 shadow-sm"
            >
              <span className="material-symbols-outlined text-[17px]">logout</span>
              <span>Log Out</span>
            </button>

            {/* Profile Avatar Pill */}
            <div
              className="w-8 h-8 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-xs uppercase select-none"
              title={currentUser?.fullName || 'User Profile'}
            >
              {currentUser?.fullName
                ? currentUser.fullName
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)
                : 'AT'}
            </div>
          </div>
        </div>
      </header>

      {/* Main Page Body */}
      <div className="pt-16 pb-20 flex-1 flex flex-col">
        {viewMode === 'home' && (
          <Home
            user={currentUser}
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
