import React, { useState } from 'react';

interface DriverDashboardProps {
  onPublishClick?: () => void;
  onStartRideClick?: () => void;
}

export const DriverDashboard: React.FC<DriverDashboardProps> = ({
  onPublishClick,
  onStartRideClick,
}) => {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'completed'>('upcoming');

  const upcomingRides = [
    {
      id: 1,
      time: 'Tomorrow, 08:30 AM',
      seats: '3 Seats Available',
      origin: '128 Oakwood Gardens, North Suburbs',
      destination: 'Tech District, Building C (Dialog HQ)',
      status: 'Confirmed',
      passengers: ['Sarah K.', 'Marcus L.', 'Elena R.'],
    },
    {
      id: 2,
      time: 'Tomorrow, 05:45 PM',
      seats: '2 Seats Available',
      origin: 'Tech District, Building C (Dialog HQ)',
      destination: '128 Oakwood Gardens, North Suburbs',
      status: 'Scheduled',
      passengers: ['Sarah K.', 'Dinesh P.'],
    },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-on-surface dark:text-white">Driver Dashboard</h1>
          <p className="text-sm text-on-surface-variant dark:text-outline-variant">
            Manage your carpool community & vehicle assignments
          </p>
        </div>
        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
          🚗
        </div>
      </div>

      {/* Reimbursement & Ledger Card */}
      <div className="bg-primary text-on-primary p-6 rounded-2xl shadow-sm space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-white/80">
          Monthly Fuel Reimbursement Balance
        </div>
        <div className="text-3xl font-bold tracking-tight text-white">LKR 14,850.00</div>
        <div className="flex items-center gap-3 text-xs text-white/90">
          <span className="bg-white/20 px-3 py-1 rounded-full font-medium">12 Rides Shared</span>
          <span className="bg-white/20 px-3 py-1 rounded-full font-medium">85 kg CO₂ Saved</span>
        </div>
      </div>

      {/* Action Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          onClick={onPublishClick}
          className="flex items-center gap-4 p-5 bg-surface-container-lowest dark:bg-surface-container border border-outline-variant/30 rounded-2xl hover:bg-surface-container-low dark:hover:bg-surface-container-high transition text-left shadow-sm"
        >
          <div className="w-12 h-12 rounded-xl bg-primary text-on-primary flex items-center justify-center font-bold text-xl">
            +
          </div>
          <div>
            <div className="font-bold text-on-surface dark:text-white">Publish a Ride</div>
            <div className="text-xs text-on-surface-variant dark:text-outline-variant">Share your commute and split costs</div>
          </div>
        </button>

        <button
          onClick={onStartRideClick}
          className="flex items-center gap-4 p-5 bg-surface-container-lowest dark:bg-surface-container border border-outline-variant/30 rounded-2xl hover:bg-surface-container-low dark:hover:bg-surface-container-high transition text-left shadow-sm"
        >
          <div className="w-12 h-12 rounded-xl bg-secondary text-on-secondary flex items-center justify-center font-bold text-xl">
            ▶
          </div>
          <div>
            <div className="font-bold text-on-surface dark:text-white">Start Active Ride</div>
            <div className="text-xs text-on-surface-variant dark:text-outline-variant">Launch live telematics & boarding OTP</div>
          </div>
        </button>
      </div>

      {/* Upcoming Rides */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-on-surface dark:text-white">Upcoming Scheduled Rides</h2>
          <span className="text-xs text-primary font-semibold">Active Sync</span>
        </div>

        {upcomingRides.map((ride) => (
          <div
            key={ride.id}
            className="p-5 bg-surface-container-lowest dark:bg-surface-container border border-outline-variant/30 rounded-2xl shadow-sm space-y-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-primary">{ride.time}</span>
                <div className="text-sm text-on-surface-variant dark:text-outline-variant mt-0.5">{ride.seats}</div>
              </div>
              <span className="text-xs bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 rounded-md font-semibold">
                {ride.status}
              </span>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-primary" />
                <span className="text-on-surface dark:text-white font-medium">{ride.origin}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-secondary" />
                <span className="text-on-surface dark:text-white font-medium">{ride.destination}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-outline-variant/20 flex items-center justify-between text-xs">
              <span className="text-on-surface-variant dark:text-outline-variant">
                Confirmed Passengers: <strong>{ride.passengers.join(', ')}</strong>
              </span>
              <button
                onClick={onStartRideClick}
                className="px-3 py-1.5 bg-primary hover:bg-primary-container text-on-primary font-semibold rounded-lg shadow-sm transition"
              >
                Open Ride
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
