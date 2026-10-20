import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Navigation, TabType } from './components/Navigation';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Verification } from './pages/Verification';
import { Home } from './pages/Home';
import { BookRide } from './pages/BookRide';
import { SeatSelection } from './pages/SeatSelection';
import { LiveTracking } from './pages/LiveTracking';
import { EmergencySos } from './pages/EmergencySos';
import { Wallet } from './pages/Wallet';
import { authApi, clearSession, getCachedUser } from './api/client';
import { User } from './types';

export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authView, setAuthView] = useState<'login' | 'register' | 'verify'>('login');
  const [verifyEmail, setVerifyEmail] = useState('sarah.taylor@syscolabs.com');
  const [currentTab, setCurrentTab] = useState<TabType>('home');
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);

  useEffect(() => {
    // Check initial user session
    const cached = getCachedUser();
    if (cached) {
      setUser(cached);
    } else {
      authApi.getMe().then((u) => {
        if (u) setUser(u);
      });
    }
  }, []);

  const handleLoginSuccess = (authenticatedUser: User) => {
    setUser(authenticatedUser);
    setCurrentTab('home');
  };

  const handleRegisterSuccess = (newUser: User, email: string) => {
    setVerifyEmail(email);
    setAuthView('verify');
  };

  const handleVerificationSuccess = () => {
    const cached = getCachedUser() || {
      id: 1,
      email: verifyEmail,
      fullName: 'Sarah Taylor',
      companyId: 1,
      companyName: 'Sysco LABS',
      role: 'commuter' as const,
      verified: true,
    };
    setUser(cached);
    setAuthView('login');
    setCurrentTab('home');
  };

  const handleLogout = () => {
    clearSession();
    setUser(null);
    setAuthView('login');
    setCurrentTab('home');
    setSelectedTripId(null);
  };

  // If user is not authenticated, display Auth Flow
  if (!user) {
    if (authView === 'register') {
      return (
        <Register
          onSuccess={handleRegisterSuccess}
          onGoToLogin={() => setAuthView('login')}
        />
      );
    }

    if (authView === 'verify') {
      return (
        <Verification
          email={verifyEmail}
          onSuccess={handleVerificationSuccess}
          onBack={() => setAuthView('register')}
        />
      );
    }

    return (
      <Login
        onSuccess={handleLoginSuccess}
        onGoToRegister={() => setAuthView('register')}
      />
    );
  }

  // Active Screen Renderer for Authenticated Commuter
  const renderScreen = () => {
    // Seat selection sub-view inside Booking flow
    if (selectedTripId !== null) {
      return (
        <SeatSelection
          tripId={selectedTripId}
          onBookingSuccess={() => {
            setSelectedTripId(null);
            setCurrentTab('home');
          }}
          onBack={() => setSelectedTripId(null)}
        />
      );
    }

    switch (currentTab) {
      case 'home':
        return (
          <Home
            user={user}
            onNavigateToBook={() => setCurrentTab('book')}
            onNavigateToTracking={(tripId) => {
              setCurrentTab('tracking');
            }}
            onNavigateToWallet={() => setCurrentTab('wallet')}
            onNavigateToSos={() => setCurrentTab('sos')}
          />
        );

      case 'book':
        return (
          <BookRide
            onSelectTrip={(tripId) => setSelectedTripId(tripId)}
            onNavigateHome={() => setCurrentTab('home')}
          />
        );

      case 'tracking':
        return (
          <LiveTracking
            tripId={1}
            onOpenSos={() => setCurrentTab('sos')}
            onBack={() => setCurrentTab('home')}
          />
        );

      case 'sos':
        return <EmergencySos onBack={() => setCurrentTab('home')} />;

      case 'wallet':
        return <Wallet />;

      default:
        return (
          <Home
            user={user}
            onNavigateToBook={() => setCurrentTab('book')}
            onNavigateToTracking={() => setCurrentTab('tracking')}
            onNavigateToWallet={() => setCurrentTab('wallet')}
            onNavigateToSos={() => setCurrentTab('sos')}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans">
      <Header
        title={
          selectedTripId !== null
            ? 'Seat Reservation'
            : currentTab === 'tracking'
            ? 'Live Telematics'
            : currentTab === 'sos'
            ? 'Emergency Dispatch'
            : currentTab === 'wallet'
            ? 'Commute Wallet & ESG'
            : undefined
        }
        showBack={selectedTripId !== null || currentTab !== 'home'}
        onBack={() => {
          if (selectedTripId !== null) {
            setSelectedTripId(null);
          } else {
            setCurrentTab('home');
          }
        }}
        user={user}
        onLogout={handleLogout}
      />

      <div className="pt-16 flex-1 flex flex-col">{renderScreen()}</div>

      {/* Persistent Bottom Bar */}
      {selectedTripId === null && (
        <Navigation currentTab={currentTab} onSelectTab={setCurrentTab} />
      )}
    </div>
  );
};
export default App;
