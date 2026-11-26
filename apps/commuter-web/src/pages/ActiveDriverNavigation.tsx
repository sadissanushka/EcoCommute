import React, { useState, useEffect } from 'react';
import { SharedRouteMap, MapCoordinate } from '../components/SharedRouteMap';
import { safetyApi } from '../api/client';

interface ActiveDriverNavigationProps {
  onBack: () => void;
  onScanPassClick?: () => void;
  tripId?: number;
}

export const ActiveDriverNavigation: React.FC<ActiveDriverNavigationProps> = ({
  onBack,
  onScanPassClick,
  tripId = 1,
}) => {
  const [speed, setSpeed] = useState<number>(0);
  const [routePolyline, setRoutePolyline] = useState<MapCoordinate[]>([]);
  const [currentPos, setCurrentPos] = useState<{ lat: number; lng: number } | null>(null);
  const [currentTurn, setCurrentTurn] = useState({
    icon: 'turn_right',
    distanceM: 250,
    instruction: 'Follow designated commuter corridor',
    target: 'Express Transit Lane',
  });

  useEffect(() => {
    safetyApi.getCorridor(tripId)
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setRoutePolyline(data);
          if (!currentPos) {
            setCurrentPos(data[0]);
          }
        }
      })
      .catch((err) => console.warn('Failed to fetch corridor for navigation:', err));
  }, [tripId]);

  useEffect(() => {
    let watchId: number | null = null;
    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const spdKmh = pos.coords.speed !== null && pos.coords.speed >= 0
            ? Math.round(pos.coords.speed * 3.6)
            : 0;
          setSpeed(spdKmh);
          setCurrentPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (err) => {
          console.warn('Geolocation unavailable:', err.message);
          setSpeed(0);
        },
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 5000 }
      );
    }
    return () => {
      if (watchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, []);

  return (
    <div className="relative w-full h-[calc(100vh-64px)] overflow-hidden font-sans bg-surface flex flex-col">
      {/* Top Floating Turn-by-Turn HUD Card */}
      <div className="absolute top-3 left-4 right-4 z-30 max-w-md mx-auto">
        <div className="bg-primary text-on-primary rounded-2xl shadow-xl p-3.5 flex items-center justify-between gap-3 border border-white/20">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[32px] text-primary-fixed font-bold">
                {currentTurn.icon}
              </span>
            </div>
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold tracking-tight">{currentTurn.distanceM}m</span>
                <span className="text-xs opacity-85">then turn</span>
              </div>
              <p className="text-xs font-semibold leading-tight">{currentTurn.instruction}</p>
              <p className="text-[10px] opacity-75">{currentTurn.target}</p>
            </div>
          </div>

          <button
            onClick={onBack}
            className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors"
            title="Exit Navigation"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      </div>

      {/* Floating Speed Indicator (Top Left) */}
      <div className="absolute left-4 top-24 z-20 flex flex-col items-center">
        <div className="bg-surface/95 backdrop-blur-md shadow-md rounded-xl px-3 py-1.5 flex flex-col items-center text-center border border-outline-variant/30">
          <span className="text-2xl font-bold text-on-surface leading-none">{speed}</span>
          <span className="text-[9px] uppercase font-bold text-on-surface-variant tracking-wider mt-0.5">
            KM/H
          </span>
        </div>
        <div className="mt-1 bg-surface-container-high px-2 py-0.5 rounded shadow-sm text-center">
          <span className="text-[9px] text-tertiary font-bold tracking-tight">LIMIT 50</span>
        </div>
      </div>

      {/* Floating Map Layer Controls (Top Right) */}
      <div className="absolute right-4 top-24 z-20 flex flex-col gap-2">
        <button
          className="w-10 h-10 rounded-xl bg-surface/95 backdrop-blur-md shadow-md flex items-center justify-center text-on-surface active:scale-95 transition-transform border border-outline-variant/30"
          title="Recenter"
        >
          <span className="material-symbols-outlined text-[20px]">my_location</span>
        </button>
        {onScanPassClick && (
          <button
            onClick={onScanPassClick}
            className="w-10 h-10 rounded-xl bg-primary text-on-primary shadow-md flex items-center justify-center active:scale-95 transition-transform"
            title="Scan Passenger"
          >
            <span className="material-symbols-outlined text-[20px]">qr_code_scanner</span>
          </button>
        )}
      </div>

      {/* Main Map View */}
      <div className="w-full flex-1 relative">
        <SharedRouteMap
          routePolyline={routePolyline}
          markers={
            routePolyline.length >= 2
              ? [
                  { lat: routePolyline[0].lat, lng: routePolyline[0].lng, label: 'Origin', color: '#0d631b' },
                  { lat: routePolyline[routePolyline.length - 1].lat, lng: routePolyline[routePolyline.length - 1].lng, label: 'Destination', color: '#005db7' },
                ]
              : []
          }
          liveLocation={currentPos ? { lat: currentPos.lat, lng: currentPos.lng, heading: 90 } : undefined}
          heightClass="h-full"
        />
      </div>

      {/* Floating Bottom Navigation Info Sheet */}
      <div className="absolute bottom-4 left-4 right-4 z-20 max-w-md mx-auto">
        <div className="bg-surface/95 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-outline-variant/30 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] text-primary font-bold uppercase tracking-wider">
                Next Waypoint Stop
              </span>
              <h3 className="text-base font-bold text-on-surface mt-0.5">
                Colombo Fort WTC (Gate 2)
              </h3>
            </div>
            <div className="bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 px-2.5 py-1 rounded-xl text-xs font-bold">
              8 mins remaining
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 py-2 border-y border-outline-variant/20 text-center">
            <div>
              <span className="text-[10px] text-outline uppercase font-semibold">Remaining</span>
              <div className="text-sm font-bold text-on-surface">4.2 km</div>
            </div>
            <div>
              <span className="text-[10px] text-outline uppercase font-semibold">ETA</span>
              <div className="text-sm font-bold text-on-surface">09:12 AM</div>
            </div>
            <div>
              <span className="text-[10px] text-outline uppercase font-semibold">Corridor Shield</span>
              <div className="text-sm font-bold text-primary">Engaged</div>
            </div>
          </div>

          <div className="flex gap-2">
            {onScanPassClick && (
              <button
                onClick={onScanPassClick}
                className="flex-1 py-2.5 rounded-xl bg-surface-container-high text-on-surface font-semibold text-xs flex items-center justify-center gap-1.5 hover:bg-surface-container-highest transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">qr_code_scanner</span>
                <span>Scan Rider</span>
              </button>
            )}
            <button
              onClick={onBack}
              className="flex-1 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm hover:bg-primary-hover active:scale-95 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">flag</span>
              <span>End Route</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
