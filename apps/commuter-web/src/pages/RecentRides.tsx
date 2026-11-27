import React, { useState } from 'react';

interface RecentRidesProps {
  onBack?: () => void;
}

export const RecentRides: React.FC<RecentRidesProps> = ({ onBack }) => {
  const [filter, setFilter] = useState<'all' | 'completed' | 'upcoming'>('all');

  const rides = [
    {
      id: 1,
      type: 'Corporate Shuttle',
      date: 'Today, 8:15 AM',
      pickup: 'Barnes Place, Colombo 07',
      dropoff: 'Dialog Axiata HQ (Tower 2)',
      co2Offset: '-2.4 kg CO₂',
      fareLkr: 'Corporate Subsidized',
      status: 'completed',
    },
    {
      id: 2,
      type: 'Carpool Share',
      date: 'Yesterday, 5:45 PM',
      pickup: 'Dialog Axiata HQ (Tower 2)',
      dropoff: 'Malabe IT Park Junction',
      co2Offset: '-3.8 kg CO₂',
      fareLkr: 'Rs. 250 (Ledger)',
      status: 'completed',
    },
    {
      id: 3,
      type: 'Corporate Shuttle',
      date: 'Tomorrow, 8:00 AM',
      pickup: 'Moratuwa Bus Stand Hub',
      dropoff: 'Colombo Fort Terminal',
      co2Offset: '-2.8 kg CO₂',
      fareLkr: 'Corporate Subsidized',
      status: 'upcoming',
    },
  ];

  const filtered = rides.filter((r) => filter === 'all' || r.status === filter);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-on-surface dark:text-white">Recent Rides & Commutes</h1>
        <p className="text-xs text-on-surface-variant dark:text-outline-variant mt-0.5">
          Your verified corporate commute history & carbon emission abatement log.
        </p>
      </div>

      {/* ESG Lifetime Impact Summary Card */}
      <div className="bg-surface-container-lowest dark:bg-surface-container border border-outline-variant/30 rounded-2xl p-6 shadow-sm flex items-center justify-between">
        <div className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">
            ESG Lifetime Commute Impact
          </span>
          <div className="text-2xl font-bold text-on-surface dark:text-white">34 Completed Rides</div>
          <div className="text-xs text-on-surface-variant dark:text-outline-variant">
            <strong className="text-primary font-bold">142.8 kg CO₂</strong> abated from road emissions
          </div>
        </div>
        <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-xl font-bold">
          🌿
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        {(['all', 'completed', 'upcoming'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition ${
              filter === tab
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container-low dark:bg-surface-container text-on-surface-variant dark:text-outline-variant hover:text-on-surface'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Rides List */}
      <div className="space-y-3">
        {filtered.map((ride) => (
          <div
            key={ride.id}
            className="p-5 bg-surface-container-lowest dark:bg-surface-container border border-outline-variant/30 rounded-2xl shadow-sm space-y-3"
          >
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-secondary">{ride.type}</span>
                <span className="text-on-surface-variant dark:text-outline-variant">&bull;</span>
                <span className="text-on-surface-variant dark:text-outline-variant font-medium">{ride.date}</span>
              </div>
              <span className="font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                {ride.co2Offset}
              </span>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-secondary" />
                <span className="text-on-surface dark:text-white font-medium">{ride.pickup}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                <span className="text-on-surface dark:text-white font-medium">{ride.dropoff}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-outline-variant/20 flex items-center justify-between text-xs text-on-surface-variant dark:text-outline-variant">
              <span>Payment / Subsidy: <strong>{ride.fareLkr}</strong></span>
              <span className="text-primary font-semibold capitalize">{ride.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
