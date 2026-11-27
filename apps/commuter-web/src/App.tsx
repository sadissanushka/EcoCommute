
import React, { useState, useEffect } from 'react';

import { MapStudio } from './pages/MapStudio';
import { Home } from './pages/Home';
import { SeatSelection } from './pages/SeatSelection';
import { LiveTracking } from './pages/LiveTracking';
import { EmergencySos } from './pages/EmergencySos';
import { Wallet } from './pages/Wallet';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { RideMatching } from './pages/RideMatching';
import { BookRide } from './pages/BookRide';
import { MyBookings } from './pages/MyBookings';
import { DriverDashboard } from './pages/DriverDashboard';
import { StartRide } from './pages/StartRide';
import { RecentRides } from './pages/RecentRides';
import { CorporatePass } from './pages/CorporatePass';
import { CommutePreferences } from './pages/CommutePreferences';
import { ScanPassengerPass } from './pages/ScanPassengerPass';
import { ActiveDriverNavigation } from './pages/ActiveDriverNavigation';
import { PublishRideModal } from './pages/PublishRideModal';
import { Settings } from './pages/Settings';

import { User, getAvatarInitials } from './types';
import {
  getCachedUser,
  clearSession,
  authApi,
  getAccessToken,
} from './api/client';

export const App: React.FC = () => {
  // Navigation View State
  const [viewMode, setViewMode] = useState<
    | 'map'
    | 'home'
    | 'rides'
    | 'booking'
    | 'seats'
    | 'tracking'
    | 'wallet'
    | 'sos'
    | 'bookings'
    | 'driver'
    | 'start-ride'
    | 'scan-pass'
    | 'driver-nav'
    | 'recent-rides'
    | 'pass'
    | 'preferences'
    | 'settings'
    | 'login'
    | 'register'
  >(() => {
    return getCachedUser() ? 'home' : 'login';
  });

  const [selectedTripId, setSelectedTripId] = useState<number>(1);
  const [selectedPartySize, setSelectedPartySize] = useState<number>(1);
  const [showPublishModal, setShowPublishModal] = useState<boolean>(false);

  const [registrationNotice, setRegistrationNotice] = useState<{
    email: string;
    message: string;
  } | null>(null);

  // Authenticated User State
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    return getCachedUser();
  });

  // Verify and sync authenticated employee session on tab mount
  useEffect(() => {
    const token = getAccessToken();

    if (token) {
      authApi
        .getMe()
        .then((verifiedUser) => {
          if (verifiedUser) {
            setCurrentUser(verifiedUser);
          }
        })
        .catch(() => {
          handleLogout();
        });
    }
  }, []);

  const handleLogout = () => {
    clearSession();
    setCurrentUser(null);
    setViewMode('login');
  };

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setViewMode('home');
  };

  // If on Login view or unauthenticated
  if (viewMode === 'login' || (!currentUser && viewMode !== 'register')) {
    return (
      <div className="relative w-full min-h-screen bg-surface">
        <Login
          initialEmail={registrationNotice?.email}
          registrationNotice={registrationNotice?.message}
          onSuccess={(user) => {
            setRegistrationNotice(null);
            handleLoginSuccess(user);
          }}
          onGoToRegister={() => {
            setRegistrationNotice(null);
            setViewMode('register');
          }}
        />
      </div>
    );
  }

  // If on Register view
  if (viewMode === 'register') {
    return (
      <div className="relative w-full min-h-screen bg-surface">
        <Register
          onSuccess={(_user, registeredEmail) => {
            setRegistrationNotice({
              email: registeredEmail,
              message: `Registration successful for ${registeredEmail}! Please sign in.`,
            });
            setViewMode('login');
          }}
          onGoToLogin={() => setViewMode('login')}
        />
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
            <span className="material-symbols-outlined text-[16px] text-primary">
              dashboard
            </span>
            <span>Commuter Hub</span>
          </button>

          <button
            onClick={() => setViewMode('settings')}
            title="Settings"
            aria-label="Settings"
            className="w-9 h-9 flex items-center justify-center rounded-full bg-surface-container-lowest/90 backdrop-blur-md text-on-surface shadow-lg border border-outline-variant/30 hover:bg-surface-container active:scale-95 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">
              settings
            </span>
          </button>
        </div>

        <MapStudio />
      </div>
    );
  }

  // Commuter Hub and Auxiliary Flows
  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans">
      {/* Header with Screen Title and User Profile / Logout */}
      <header className="fixed top-0 w-full z-40 bg-surface/85 backdrop-blur-xl pt-safe shadow-[0_1px_8px_rgba(0,0,0,0.04)] border-b border-surface-container-high/50">
        <div className="h-16 px-4 flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-2">
            {viewMode !== 'home' ? (
              <button
                onClick={() => setViewMode('home')}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors cursor-pointer text-xs font-semibold"
                title="Back to Hub"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                <span>Hub</span>
              </button>
            ) : (
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[20px]">directions_bus</span>
              </div>
            )}

            <span className="font-bold text-base text-on-surface">
              {viewMode === 'booking'
                ? 'Find Your Shuttle'
                : viewMode === 'seats'
                  ? 'Seat Selection'
                  : viewMode === 'driver'
                    ? 'Driver Dashboard'
                    : viewMode === 'start-ride'
                      ? 'Start Active Ride'
                      : viewMode === 'scan-pass'
                        ? 'Scan Passenger Pass'
                        : viewMode === 'driver-nav'
                          ? 'Driver HUD Navigation'
                          : viewMode === 'tracking'
                            ? 'Live Telematics'
                            : viewMode === 'sos'
                              ? 'Emergency SOS'
                              : viewMode === 'wallet'
                                ? 'Wallet & ESG'
                                : viewMode === 'bookings'
                                  ? 'My Bookings'
                                  : viewMode === 'pass'
                                    ? 'Corporate Pass'
                                    : viewMode === 'settings'
                                      ? 'Settings'
                                      : viewMode === 'preferences'
                                        ? 'Commute Preferences'
                                        : 'Home'}
            </span>
          </div>

          {/* Right Header: Profile Avatar and Settings Gear Button */}
          <div className="flex items-center gap-2">
            {/* Profile Avatar Pill */}
            <button
              type="button"
              onClick={() => setViewMode('settings')}
              className="w-8 h-8 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-xs uppercase select-none cursor-pointer hover:bg-primary/20 transition-colors"
              title={currentUser?.fullName || 'User Profile'}
            >
              {getAvatarInitials(currentUser?.fullName)}
            </button>

            <button
              type="button"
              onClick={() => setViewMode('settings')}
              title="Settings"
              aria-label="Open Settings"
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                viewMode === 'settings' || viewMode === 'preferences'
                  ? 'bg-primary/10 text-primary'
                  : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[22px]">
                settings
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Page Body */}
      <div className="pt-16 pb-20 flex-1 flex flex-col">
        {viewMode === 'home' && (
          <Home
            user={currentUser}
            onNavigateToBook={() => setViewMode('booking')}
            onNavigateToTracking={(tripId) => {
              setSelectedTripId(tripId);
              setViewMode('tracking');
            }}
            onNavigateToWallet={() => setViewMode('wallet')}
            onNavigateToSos={() => setViewMode('sos')}
            onNavigateToPass={() => setViewMode('pass')}
            onNavigateToDriver={() => setViewMode('driver')}
          />
        )}

        {viewMode === 'booking' && (
          <BookRide
            onSelectTrip={(tripId, partySize) => {
              setSelectedTripId(tripId);
              setSelectedPartySize(partySize || 1);
              setViewMode('seats');
            }}
            onNavigateHome={() => setViewMode('home')}
            onNavigateToBookings={() => setViewMode('bookings')}
          />
        )}

        {viewMode === 'seats' && (
          <SeatSelection
            tripId={selectedTripId}
            partySize={selectedPartySize}
            onBookingSuccess={() => setViewMode('bookings')}
            onBack={() => setViewMode('booking')}
            onNavigateToBookings={() => setViewMode('bookings')}
          />
        )}

        {viewMode === 'tracking' && (
          <LiveTracking
            tripId={selectedTripId || undefined}
            onOpenSos={() => setViewMode('sos')}
            onBack={() => setViewMode('home')}
            onNavigateToBooking={() => setViewMode('booking')}
          />
        )}

        {viewMode === 'sos' && (
          <EmergencySos onBack={() => setViewMode('home')} />
        )}

        {viewMode === 'rides' && <RideMatching user={currentUser} />}

        {viewMode === 'wallet' && <Wallet />}

        {viewMode === 'bookings' && (
          <MyBookings
            user={currentUser}
            onBack={() => setViewMode('home')}
            onNavigateToFindShuttle={() => setViewMode('booking')}
          />
        )}

        {viewMode === 'driver' && (
          <DriverDashboard
            onPublishClick={() => setShowPublishModal(true)}
            onStartRideClick={() => setViewMode('start-ride')}
            onScanPassClick={() => setViewMode('scan-pass')}
            onNavigationClick={() => setViewMode('driver-nav')}
          />
        )}

        {viewMode === 'start-ride' && (
          <StartRide
            onBack={() => setViewMode('driver')}
            onScanPassClick={() => setViewMode('scan-pass')}
            onNavigationClick={() => setViewMode('driver-nav')}
          />
        )}

        {viewMode === 'scan-pass' && (
          <ScanPassengerPass
            onBack={() => setViewMode('driver')}
            onNavigateToNavigation={() => setViewMode('driver-nav')}
          />
        )}

        {viewMode === 'driver-nav' && (
          <ActiveDriverNavigation
            onBack={() => setViewMode('driver')}
            onScanPassClick={() => setViewMode('scan-pass')}
            tripId={selectedTripId}
          />
        )}

        {viewMode === 'recent-rides' && (
          <RecentRides onBack={() => setViewMode('home')} />
        )}

        {viewMode === 'pass' && (
          <CorporatePass user={currentUser} onBack={() => setViewMode('home')} />
        )}

        {viewMode === 'preferences' && (
          <CommutePreferences
            user={currentUser}
            onUserUpdated={(updated) => setCurrentUser(updated)}
            onBack={() => setViewMode('settings')}
          />
        )}

        {viewMode === 'settings' && (
          <Settings
            user={currentUser}
            onUserUpdated={(updated) => setCurrentUser(updated)}
            onLogout={handleLogout}
            onNavigateToPreferences={() => setViewMode('preferences')}
            onNavigateToPass={() => setViewMode('pass')}
            onNavigateToWallet={() => setViewMode('wallet')}
            onNavigateToSos={() => setViewMode('sos')}
          />
        )}
      </div>

      {/* Publish Carpool Ride Modal */}
      <PublishRideModal
        isOpen={showPublishModal}
        onClose={() => setShowPublishModal(false)}
        onPublished={() => {
          setViewMode('driver');
        }}
      />

      {/* Floating Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-surface/90 backdrop-blur-xl border-t border-outline-variant/30 pb-safe shadow-[0_-2px_12px_rgba(0,0,0,0.05)]">
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
          <button
            onClick={() => setViewMode('home')}
            className={`flex-1 flex flex-col items-center justify-center py-1 transition-all ${viewMode === 'home'
              ? 'text-primary font-bold'
              : 'text-on-surface-variant'
              }`}
          >
            <span className="material-symbols-outlined text-[22px]">
              home
            </span>
            <span className="text-[11px] mt-0.5">Home</span>
          </button>

          <button
            onClick={() => setViewMode('driver')}
            className={`flex-1 flex flex-col items-center justify-center py-1 transition-all ${viewMode === 'driver' || viewMode === 'start-ride' || viewMode === 'scan-pass' || viewMode === 'driver-nav'
              ? 'text-primary font-bold'
              : 'text-on-surface-variant'
              }`}
          >
            <span className="material-symbols-outlined text-[22px]">
              directions_car
            </span>
            <span className="text-[11px] mt-0.5">Driver</span>
          </button>

          <button
            onClick={() => setViewMode('bookings')}
            className={`flex-1 flex flex-col items-center justify-center py-1 transition-all ${viewMode === 'bookings'
              ? 'text-primary font-bold'
              : 'text-on-surface-variant'
              }`}
          >
            <span className="material-symbols-outlined text-[22px]">
              confirmation_number
            </span>
            <span className="text-[11px] mt-0.5">Bookings</span>
          </button>

          <button
            onClick={() => setViewMode('tracking')}
            className={`flex-1 flex flex-col items-center justify-center py-1 transition-all ${viewMode === 'tracking'
              ? 'text-primary font-bold'
              : 'text-on-surface-variant'
              }`}
          >
            <span className="material-symbols-outlined text-[22px]">
              radar
            </span>
            <span className="text-[11px] mt-0.5">Tracking</span>
          </button>

          <button
            onClick={() => setViewMode('wallet')}
            className={`flex-1 flex flex-col items-center justify-center py-1 transition-all ${viewMode === 'wallet'
              ? 'text-primary font-bold'
              : 'text-on-surface-variant'
              }`}
          >
            <span className="material-symbols-outlined text-[22px]">
              account_balance_wallet
            </span>
            <span className="text-[11px] mt-0.5">Wallet</span>
          </button>

          <button
            onClick={() => setViewMode('sos')}
            className="flex flex-col items-center justify-center -mt-4 p-2 rounded-full active:scale-95 transition-transform"
          >
            <div className="w-12 h-12 rounded-full bg-error text-on-error flex items-center justify-center shadow-lg shadow-error/30">
              <span className="material-symbols-outlined text-[24px]">
                emergency
              </span>
            </div>
            <span className="text-[10px] font-bold text-error mt-0.5 uppercase">
              SOS
            </span>
          </button>
        </div>
      </nav>
    </div>
  );
};

export default App;
