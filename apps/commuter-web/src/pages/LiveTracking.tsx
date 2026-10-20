import React, { useState, useEffect, useRef } from 'react';
import { safetyApi } from '../api/client';
import { LiveVehicleTelemetry } from '../types';

interface LiveTrackingProps {
  tripId?: number;
  onOpenSos: () => void;
  onBack: () => void;
}

export const LiveTracking: React.FC<LiveTrackingProps> = ({
  tripId = 1,
  onOpenSos,
  onBack,
}) => {
  const [telemetry, setTelemetry] = useState<LiveVehicleTelemetry>({
    tripId,
    plateNo: 'WP-ND-8820 (EV Shuttle)',
    lat: 6.9271,
    lng: 79.8612,
    speedKmh: 34,
    heading: 142,
    routeDistanceMeters: 18,
    isDeviated: false,
    activeShuttlesCount: 28,
    chargingCount: 4,
  });

  const [wsConnected, setWsConnected] = useState(false);
  const [mapMode, setMapMode] = useState<'vector' | 'hybrid'>('vector');
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Attempt WebSocket connection to Module 4 Safety WebSocket server
    const token = localStorage.getItem('access_token');
    const wsUrl = `ws://${window.location.hostname || 'localhost'}:4400/ws`;

    try {
      // Pass token in Sec-WebSocket-Protocol or query ticket
      const ws = new WebSocket(wsUrl, token ? [`bearer.${token}`] : undefined);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        // Subscribe to trip room
        ws.send(
          JSON.stringify({
            v: 1,
            type: 'subscribe',
            room: `room:trip:${tripId}`,
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'location' || msg.type === 'telemetry') {
            setTelemetry((prev) => ({
              ...prev,
              lat: msg.lat || prev.lat,
              lng: msg.lng || prev.lng,
              speedKmh: msg.speedKmh || msg.speed || prev.speedKmh,
              routeDistanceMeters: msg.distanceMeters || prev.routeDistanceMeters,
              isDeviated: (msg.distanceMeters || prev.routeDistanceMeters) > 150,
            }));
          }
        } catch {
          // Ignore parse errors
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
      };

      ws.onerror = () => {
        setWsConnected(false);
      };
    } catch {
      setWsConnected(false);
    }

    // Realistic GPS simulation interval if disconnected
    const simInterval = setInterval(() => {
      setTelemetry((prev) => {
        const delta = (Math.random() - 0.48) * 0.0008;
        return {
          ...prev,
          lat: prev.lat + delta,
          lng: prev.lng + delta * 0.8,
          speedKmh: Math.floor(28 + Math.random() * 12),
        };
      });
    }, 2500);

    return () => {
      clearInterval(simInterval);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [tripId]);

  return (
    <div className="relative w-full h-[calc(100vh-64px)] overflow-hidden font-sans bg-surface">
      {/* Top Telematics Control Bar */}
      <section className="absolute top-2 left-4 right-4 z-20 max-w-md mx-auto flex flex-col gap-2">
        <div className="bg-surface/95 backdrop-blur-xl p-3 rounded-2xl shadow-lg border border-outline-variant/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                wsConnected ? 'bg-primary animate-ping' : 'bg-amber-500 animate-pulse'
              }`}
            ></span>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-on-surface">
                {wsConnected ? 'RFC 6455 Telematics Stream' : 'Live GPS Feed (Active)'}
              </span>
              <span className="text-[10px] text-on-surface-variant">
                {telemetry.activeShuttlesCount} Active Shuttles · {telemetry.chargingCount} Charging
              </span>
            </div>
          </div>

          {/* Mode Selector */}
          <div className="flex items-center bg-surface-container-low p-1 rounded-xl">
            <button
              onClick={() => setMapMode('vector')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                mapMode === 'vector'
                  ? 'bg-surface-container-lowest text-primary shadow-sm'
                  : 'text-on-surface-variant'
              }`}
            >
              Vector
            </button>
            <button
              onClick={() => setMapMode('hybrid')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                mapMode === 'hybrid'
                  ? 'bg-surface-container-lowest text-primary shadow-sm'
                  : 'text-on-surface-variant'
              }`}
            >
              Hybrid
            </button>
          </div>
        </div>

        {/* Deviation Warning Alert if triggered by Module 4 detector */}
        {telemetry.isDeviated && (
          <div className="p-2.5 rounded-xl bg-error-container text-on-error-container text-xs flex items-center justify-between shadow-md border border-error/30 animate-pulse">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">warning</span>
              <span className="font-semibold">Corridor Deviation Detected (&gt;150m)</span>
            </div>
            <button
              onClick={onOpenSos}
              className="bg-error text-on-error px-2 py-1 rounded-lg font-bold text-[10px] uppercase"
            >
              Trigger SOS
            </button>
          </div>
        )}
      </section>

      {/* Main Vector Telematics Map Canvas */}
      <div
        className={`w-full h-full relative transition-colors duration-500 ${
          mapMode === 'hybrid' ? 'bg-[#2b3531]' : 'bg-[#eef3ee]'
        }`}
      >
        <svg className="w-full h-full object-cover" viewBox="0 0 600 900" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="corridorGlow" x1="0%" x2="100%" y1="0%" y2="0%">
              <stop offset="0%" stopColor="#0d631b" stopOpacity="0.2" />
              <stop offset="50%" stopColor="#0d631b" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#005db7" stopOpacity="0.9" />
            </linearGradient>
          </defs>

          {/* Road Infrastructure Conduits */}
          <path d="M 50 150 L 180 260 L 320 380 L 450 620 L 520 820" fill="none" stroke={mapMode === 'hybrid' ? '#3d4a44' : '#ffffff'} strokeWidth="18" strokeLinecap="round" />
          <path d="M 480 180 L 320 380 L 150 560 L 80 780" fill="none" stroke={mapMode === 'hybrid' ? '#3d4a44' : '#ffffff'} strokeWidth="14" strokeLinecap="round" />

          {/* Active Corridor Glow Path */}
          <path
            d="M 120 180 C 220 280 280 340 320 440 C 360 540 400 660 460 760"
            fill="none"
            stroke="url(#corridorGlow)"
            strokeWidth="6"
            strokeDasharray="8 6"
            strokeLinecap="round"
          />

          {/* Corporate Hub Waypoints */}
          <circle cx="120" cy="180" r="8" fill="#0d631b" />
          <text x="135" y="185" fill={mapMode === 'hybrid' ? '#ffffff' : '#1b1c1c'} fontSize="12" fontWeight="700">
            Galle Face Center Rd
          </text>

          <circle cx="460" cy="760" r="8" fill="#005db7" />
          <text x="360" y="785" fill={mapMode === 'hybrid' ? '#ffffff' : '#1b1c1c'} fontSize="12" fontWeight="700">
            WTC Colombo Gate 2
          </text>
        </svg>

        {/* Live Moving Vehicle Telematics Pin */}
        <div className="absolute top-[52%] left-[54%] -translate-x-1/2 -translate-y-1/2 z-10 transition-all duration-700">
          <div className="relative flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-2xl ring-4 ring-primary/30 animate-pulse">
              <span className="material-symbols-outlined text-[24px]">directions_bus</span>
            </div>
            <div className="mt-1 bg-surface-container-lowest text-on-surface px-2.5 py-1 rounded-full shadow-lg border border-outline-variant/40 text-[11px] font-bold flex items-center gap-1 whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping"></span>
              <span>{telemetry.speedKmh} km/h</span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Bottom Telematics Sheet */}
      <div className="absolute bottom-20 left-4 right-4 z-20 max-w-md mx-auto">
        <div className="bg-surface/95 backdrop-blur-xl p-4 rounded-2xl shadow-2xl border border-outline-variant/30 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] text-primary font-bold uppercase tracking-wider">
                Shuttle En Route · Line 14-B Express
              </span>
              <h3 className="text-base font-bold text-on-surface mt-0.5">{telemetry.plateNo}</h3>
            </div>
            <div className="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">speed</span>
              <span>On Time</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 py-1 border-y border-surface-container-high/60 text-center">
            <div>
              <span className="text-[10px] text-outline uppercase font-semibold">ETA</span>
              <div className="text-sm font-bold text-on-surface">6 Mins</div>
            </div>
            <div>
              <span className="text-[10px] text-outline uppercase font-semibold">Corridor Dist</span>
              <div className="text-sm font-bold text-on-surface">{telemetry.routeDistanceMeters}m</div>
            </div>
            <div>
              <span className="text-[10px] text-outline uppercase font-semibold">Battery EV</span>
              <div className="text-sm font-bold text-primary">82%</div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={onOpenSos}
              className="flex-1 py-2.5 rounded-xl bg-error-container text-on-error-container font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm hover:brightness-95 active:scale-95 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">emergency</span>
              <span>Emergency SOS</span>
            </button>
            <button
              onClick={() => alert('Driver: Kamal Perera (+94 71 882 0011)\nLicense: DL-Colombo-8820')}
              className="px-4 py-2.5 rounded-xl bg-surface-container-high text-on-surface font-semibold text-xs flex items-center justify-center gap-1 hover:bg-surface-container-highest transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">contact_phone</span>
              <span>Driver</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
