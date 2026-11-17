import React, { useEffect, useState } from 'react';
import { routingApi, RideMatchItem } from '../api/client';
import { SharedRouteMap } from '../components/SharedRouteMap';
import { User } from '../types';

interface RideMatchingProps {
  user: User | null;
}

const CORRIDOR_PRESETS = [
  { label: 'Malabe Tech Park', lat: 6.904, lng: 79.954 },
  { label: 'Battaramulla Junction', lat: 6.898, lng: 79.921 },
  { label: 'Kottawa Highway', lat: 6.841, lng: 79.965 },
  { label: 'Colombo Fort CBD', lat: 6.9344, lng: 79.8428 },
  { label: 'Moratuwa UoM', lat: 6.7969, lng: 79.9018 },
];

export const RideMatching: React.FC<RideMatchingProps> = ({ user }) => {
  const [mode, setMode] = useState<'request' | 'offer'>('request');
  const [originIdx, setOriginIdx] = useState(1);
  const [destIdx, setDestIdx] = useState(3);
  const [timeWindow, setTimeWindow] = useState('08:00 AM');
  const [recurring, setRecurring] = useState(true);
  const [womenOnly, setWomenOnly] = useState(false);
  const [seats, setSeats] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [matches, setMatches] = useState<RideMatchItem[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<RideMatchItem | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadMatches = async (rideId?: string) => {
    const list = await routingApi.getMatches(rideId);
    setMatches(list);
    if (list.length > 0) setSelectedMatch(list[0]);
  };

  useEffect(() => {
    loadMatches();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setStatusMessage(null);
    const orig = CORRIDOR_PRESETS[originIdx];
    const dest = CORRIDOR_PRESETS[destIdx];

    const res = await routingApi.publishRide({
      type: mode,
      userId: String(user?.id || 'user-demo'),
      userName: user?.fullName || 'Anushka Thisera',
      origin: { lat: orig.lat, lng: orig.lng },
      destination: { lat: dest.lat, lng: dest.lng },
      timeWindowStart: timeWindow,
      womenOnly,
      seats,
      vehicle: mode === 'offer' ? 'Corporate Carpool Sedan' : undefined,
    });

    setStatusMessage(res.message || 'Ride published!');
    await loadMatches(res?.data?.id);
    setSubmitting(false);
  };

  const handleConfirmMatch = async (match: RideMatchItem) => {
    const res = await routingApi.confirmMatch(match.offerId, match.requestId, 1);
    setMatches((prev) =>
      prev.map((m) =>
        m.offerId === match.offerId && m.requestId === match.requestId
          ? { ...m, status: 'confirmed' }
          : m
      )
    );
    setStatusMessage(
      res.routeBoundaryPublished
        ? 'Match confirmed & safety corridor published to Module 4!'
        : 'Match confirmed!'
    );
  };

  const previewPath = selectedMatch?.plannedPath || [
    CORRIDOR_PRESETS[originIdx],
    CORRIDOR_PRESETS[destIdx],
  ];

  return (
    <div className="max-w-lg mx-auto w-full px-4 py-4 space-y-4">
      <div className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/30 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-bold text-on-surface">Carpool Ride Matching</h2>
            <p className="text-xs text-on-surface-variant">
              Detour-bounded overlap scoring &amp; women-only filter
            </p>
          </div>
          <div className="flex rounded-xl bg-surface-container p-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => setMode('request')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                mode === 'request' ? 'bg-primary text-on-primary shadow' : 'text-on-surface-variant'
              }`}
            >
              Find Ride
            </button>
            <button
              type="button"
              onClick={() => setMode('offer')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                mode === 'offer' ? 'bg-primary text-on-primary shadow' : 'text-on-surface-variant'
              }`}
            >
              Offer Ride
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="font-semibold text-on-surface-variant">Origin</span>
              <select
                value={originIdx}
                onChange={(e) => setOriginIdx(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-2.5 py-2 font-medium"
              >
                {CORRIDOR_PRESETS.map((p, idx) => (
                  <option key={p.label} value={idx}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="font-semibold text-on-surface-variant">Destination</span>
              <select
                value={destIdx}
                onChange={(e) => setDestIdx(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-2.5 py-2 font-medium"
              >
                {CORRIDOR_PRESETS.map((p, idx) => (
                  <option key={p.label} value={idx}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="font-semibold text-on-surface-variant">Time Window</span>
              <input
                type="text"
                value={timeWindow}
                onChange={(e) => setTimeWindow(e.target.value)}
                className="mt-1 w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-2.5 py-2 font-medium"
              />
            </label>
            <label className="block">
              <span className="font-semibold text-on-surface-variant">
                {mode === 'offer' ? 'Seats Offered' : 'Seats Needed'}
              </span>
              <input
                type="number"
                min={1}
                max={4}
                value={seats}
                onChange={(e) => setSeats(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-2.5 py-2 font-medium"
              />
            </label>
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 font-medium text-on-surface cursor-pointer">
              <input
                type="checkbox"
                checked={recurring}
                onChange={(e) => setRecurring(e.target.checked)}
              />
              <span>Recurring weekday commute</span>
            </label>
            <label className="flex items-center gap-2 font-medium text-on-surface cursor-pointer">
              <input
                type="checkbox"
                checked={womenOnly}
                onChange={(e) => setWomenOnly(e.target.checked)}
              />
              <span>Women-only match</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-xl bg-primary text-on-primary font-bold shadow hover:bg-primary-container transition-all cursor-pointer disabled:opacity-50"
          >
            {submitting
              ? 'Computing Route Overlap...'
              : mode === 'request'
              ? 'Search Ranked Matches'
              : 'Publish Carpool Offer'}
          </button>
        </form>

        {statusMessage && (
          <div className="mt-3 p-2.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-medium">
            {statusMessage}
          </div>
        )}
      </div>

      {/* Shared MapLibre/Leaflet Component Preview (Contract C10) */}
      <SharedRouteMap
        routePolyline={previewPath}
        markers={[
          { lat: previewPath[0].lat, lng: previewPath[0].lng, label: 'A', color: '#0d631b' },
          {
            lat: previewPath[previewPath.length - 1].lat,
            lng: previewPath[previewPath.length - 1].lng,
            label: 'B',
            color: '#ba1a1a',
          },
        ]}
        heightClass="h-48"
      />

      {/* Ranked Match Result List */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
          Ranked Candidate Matches ({matches.length})
        </h3>

        {matches.length === 0 ? (
          <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 text-xs text-on-surface-variant text-center">
            No matches within the 2,500m detour limit for the selected preferences.
          </div>
        ) : (
          matches.map((m) => (
            <div
              key={`${m.offerId}-${m.requestId}`}
              onClick={() => setSelectedMatch(m)}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer bg-surface-container-lowest ${
                selectedMatch?.offerId === m.offerId && selectedMatch?.requestId === m.requestId
                  ? 'border-primary shadow-md'
                  : 'border-outline-variant/30'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-bold text-on-surface">{m.driverName}</div>
                  <div className="text-[11px] text-on-surface-variant">{m.driverVehicle}</div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-extrabold">
                  {m.overlapPct}% overlap
                </span>
              </div>

              <div className="mt-2.5 flex items-center justify-between text-[11px] text-on-surface-variant">
                <span>Detour added: +{m.detourAddedM} m</span>
                <span className="text-emerald-700 font-semibold">
                  -{m.co2SavedKg} kg CO₂ saved
                </span>
              </div>

              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  disabled={m.status === 'confirmed'}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleConfirmMatch(m);
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    m.status === 'confirmed'
                      ? 'bg-emerald-100 text-emerald-800 cursor-default'
                      : 'bg-primary text-on-primary hover:bg-primary-container'
                  }`}
                >
                  {m.status === 'confirmed' ? 'Confirmed ✓' : 'Confirm Match'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
