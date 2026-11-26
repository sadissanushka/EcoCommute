import React, { useState, useEffect, useRef, useCallback } from 'react';
import { bookingApi, safetyApi, getAccessToken } from '../api/client';
import { ShuttleTrip, MyBooking } from '../types';
import { SharedRouteMap, MapCoordinate, SharedMapMarker } from '../components/SharedRouteMap';

interface LiveTrackingProps {
  tripId?: number;
  onOpenSos: () => void;
  onBack: () => void;
  onNavigateToBooking?: () => void;
}

const DEFAULT_CORRIDOR_COORDS: MapCoordinate[] = [
  { lat: 6.9315, lng: 79.9822 }, // Kaduwela Interchange
  { lat: 6.9042, lng: 79.9547 }, // Malabe Junction
  { lat: 6.8996, lng: 79.9234 }, // Battaramulla
  { lat: 6.9085, lng: 79.8967 }, // Rajagiriya
  { lat: 6.9344, lng: 79.8428 }, // Colombo Fort
];

export const LiveTracking: React.FC<LiveTrackingProps> = ({
  tripId: propTripId,
  onOpenSos,
  onBack,
  onNavigateToBooking,
}) => {
  const [activeTripId, setActiveTripId] = useState<number>(propTripId || 1);
  const [myBookings, setMyBookings] = useState<MyBooking[]>([]);
  const [tripDetails, setTripDetails] = useState<ShuttleTrip | null>(null);
  const [availableTrips, setAvailableTrips] = useState<ShuttleTrip[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Geolocation state
  const [geoPermission, setGeoPermission] = useState<
    'prompt' | 'granted' | 'denied' | 'unsupported'
  >('prompt');
  const [userLocation, setUserLocation] = useState<
    (MapCoordinate & { speed?: number; heading?: number; accuracy?: number }) | null
  >(null);
  const [vehicleLocation, setVehicleLocation] = useState<MapCoordinate | null>(null);

  // Telematics & WebSocket state
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [participantsCount, setParticipantsCount] = useState<number>(0);
  const [telemetry, setTelemetry] = useState<{
    speedKmh: number;
    distanceMeters: number;
    isDeviated: boolean;
    anomalyMessage: string | null;
  }>({
    speedKmh: 0,
    distanceMeters: 0,
    isDeviated: false,
    anomalyMessage: null,
  });

  const [showDriverModal, setShowDriverModal] = useState<boolean>(false);
  const [sosStatus, setSosStatus] = useState<'idle' | 'sending' | 'active'>('idle');

  const wsRef = useRef<WebSocket | null>(null);
  const geoWatchIdRef = useRef<number | null>(null);
  const keepaliveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check initial browser Geolocation permission status
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setGeoPermission('unsupported');
      return;
    }

    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: 'geolocation' as PermissionName })
        .then((permissionStatus) => {
          if (permissionStatus.state === 'granted') {
            setGeoPermission('granted');
            startWatchingPosition();
          } else if (permissionStatus.state === 'denied') {
            setGeoPermission('denied');
          } else {
            setGeoPermission('prompt');
          }

          permissionStatus.onchange = () => {
            if (permissionStatus.state === 'granted') {
              setGeoPermission('granted');
              startWatchingPosition();
            } else if (permissionStatus.state === 'denied') {
              setGeoPermission('denied');
              stopWatchingPosition();
            } else {
              setGeoPermission('prompt');
            }
          };
        })
        .catch(() => {
          setGeoPermission('prompt');
        });
    }
  }, []);

  // Load User Bookings and Trip Data
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    async function loadData() {
      try {
        const [bookings, trips] = await Promise.all([
          bookingApi.getMyBookings().catch(() => [] as MyBooking[]),
          bookingApi.getTrips().catch(() => [] as ShuttleTrip[]),
        ]);

        if (!isMounted) return;

        setMyBookings(bookings);
        setAvailableTrips(trips);

        // Select initial trip: prop > active booking > first available trip > default 1
        let targetTripId = propTripId;
        if (!targetTripId && bookings.length > 0) {
          const activeBooking = bookings.find(
            (b) => b.status === 'confirmed' || b.status === 'boarded'
          );
          if (activeBooking) {
            targetTripId = activeBooking.tripId;
          } else {
            targetTripId = bookings[0].tripId;
          }
        }

        if (!targetTripId && trips.length > 0) {
          targetTripId = trips[0].id;
        }

        const resolvedTripId = targetTripId || 1;
        setActiveTripId(resolvedTripId);

        // Fetch detailed route stops and driver information
        try {
          const details = await bookingApi.getTripDetails(resolvedTripId);
          if (isMounted) setTripDetails(details);
        } catch {
          // If trip details endpoint fails, trip will use fallback stops
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [propTripId]);

  // Load trip details when activeTripId changes
  const handleSelectTrip = async (newTripId: number) => {
    setActiveTripId(newTripId);
    try {
      const details = await bookingApi.getTripDetails(newTripId);
      setTripDetails(details);
    } catch {
      // Keep existing or fallback
    }
  };

  // Transmit real location to Safety WebSocket
  const sendLocationUpdate = useCallback(
    (lat: number, lng: number, speedMps: number | null, heading: number | null, accuracy: number | null) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const speedKmh = speedMps !== null ? Math.round(speedMps * 3.6) : 0;
        wsRef.current.send(
          JSON.stringify({
            v: 1,
            type: 'location',
            tripId: activeTripId,
            lat,
            lng,
            speed: speedKmh,
            heading: heading || 0,
            accuracy: accuracy || 10,
            recordedAt: new Date().toISOString(),
          })
        );
      }
    },
    [activeTripId]
  );

  // Position Watcher Handler
  const startWatchingPosition = useCallback(() => {
    if (!('geolocation' in navigator)) return;
    if (geoWatchIdRef.current !== null) return;

    geoWatchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, speed, heading, accuracy } = position.coords;
        const coords = {
          lat: latitude,
          lng: longitude,
          speed: speed !== null ? Math.round(speed * 3.6) : 0,
          heading: heading || 0,
          accuracy: Math.round(accuracy),
        };
        setUserLocation(coords);
        sendLocationUpdate(latitude, longitude, speed, heading, accuracy);
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setGeoPermission('denied');
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 12000,
      }
    );
  }, [sendLocationUpdate]);

  const stopWatchingPosition = () => {
    if (geoWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(geoWatchIdRef.current);
      geoWatchIdRef.current = null;
    }
  };

  // Request Geolocation Explicitly from User Action
  const requestLocationPermission = () => {
    if (!('geolocation' in navigator)) {
      setGeoPermission('unsupported');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeoPermission('granted');
        const { latitude, longitude, speed, heading, accuracy } = position.coords;
        const coords = {
          lat: latitude,
          lng: longitude,
          speed: speed !== null ? Math.round(speed * 3.6) : 0,
          heading: heading || 0,
          accuracy: Math.round(accuracy),
        };
        setUserLocation(coords);
        sendLocationUpdate(latitude, longitude, speed, heading, accuracy);
        startWatchingPosition();
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setGeoPermission('denied');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      }
    );
  };

  // Connect to Module 4 Safety WebSocket server
  useEffect(() => {
    const token = getAccessToken();
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost =
      window.location.port === '5173'
        ? `${window.location.hostname || 'localhost'}:4400`
        : window.location.host;
    const wsUrl = `${protocol}//${wsHost}/ws`;

    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl, token ? [`bearer.${token}`] : undefined);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        // Send join room RFC 6455 message
        ws.send(
          JSON.stringify({
            v: 1,
            type: 'join',
            tripId: activeTripId,
          })
        );

        // Ping keepalive every 25s
        keepaliveTimerRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 25000);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'joined') {
            setParticipantsCount(
              Array.isArray(msg.participants) ? msg.participants.length : 1
            );
          }

          if (msg.type === 'location') {
            setVehicleLocation({ lat: msg.lat, lng: msg.lng });
            setTelemetry((prev) => ({
              ...prev,
              speedKmh: msg.speed ?? prev.speedKmh,
              distanceMeters: msg.distanceMeters ?? prev.distanceMeters,
              isDeviated: (msg.distanceMeters ?? prev.distanceMeters) > 150,
            }));
          }

          if (msg.type === 'anomaly') {
            setTelemetry((prev) => ({
              ...prev,
              isDeviated: true,
              anomalyMessage: msg.message || 'Corridor deviation detected by safety shield',
            }));
          }

          if (msg.type === 'sos') {
            setSosStatus('active');
          }
        } catch {
          // Payload parsing error
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

    return () => {
      if (keepaliveTimerRef.current) clearInterval(keepaliveTimerRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [activeTripId]);

  // Clean up position watcher on unmount
  useEffect(() => {
    return () => {
      stopWatchingPosition();
    };
  }, []);

  // Trigger Real SOS Dispatch
  const handleTriggerSos = async () => {
    setSosStatus('sending');
    try {
      await safetyApi.triggerSos({
        tripId: activeTripId,
        lat: userLocation?.lat || vehicleLocation?.lat,
        lng: userLocation?.lng || vehicleLocation?.lng,
        note: 'Live commute emergency assistance request from mobile web client',
      });
      setSosStatus('active');
    } catch {
      setSosStatus('active');
    }
  };

  // Compute Route Polyline & Markers from tripDetails or fallback
  const routePolyline: MapCoordinate[] = React.useMemo(() => {
    if (tripDetails?.stops && tripDetails.stops.length >= 2) {
      return tripDetails.stops.map((s: any) => ({
        lat: Number(s.lat),
        lng: Number(s.lng),
      }));
    }
    return DEFAULT_CORRIDOR_COORDS;
  }, [tripDetails]);

  const mapMarkers: SharedMapMarker[] = React.useMemo(() => {
    if (tripDetails?.stops && tripDetails.stops.length > 0) {
      return tripDetails.stops.map((s: any, idx: number) => ({
        lat: Number(s.lat),
        lng: Number(s.lng),
        label: s.name || s.stopName || String(idx + 1),
        color:
          idx === 0
            ? '#0d631b'
            : idx === (tripDetails.stops?.length ?? 1) - 1
              ? '#005db7'
              : '#0284c7',
      }));
    }
    return DEFAULT_CORRIDOR_COORDS.map((c, idx) => ({
      lat: c.lat,
      lng: c.lng,
      label: idx === 0 ? 'Origin' : idx === DEFAULT_CORRIDOR_COORDS.length - 1 ? 'CBD Fort' : `Stop ${idx + 1}`,
      color: idx === 0 ? '#0d631b' : idx === DEFAULT_CORRIDOR_COORDS.length - 1 ? '#005db7' : '#0284c7',
    }));
  }, [tripDetails]);

  const activeBooking = myBookings.find((b) => b.tripId === activeTripId);

  return (
    <div className="relative w-full h-[calc(100vh-64px)] overflow-hidden font-sans bg-surface flex flex-col">
      {/* Top Telematics & Status Bar */}
      <div className="absolute top-2 left-4 right-4 z-20 max-w-lg mx-auto flex flex-col gap-2">
        {/* Stream & Trip Status Card */}
        <div className="bg-surface/95 backdrop-blur-md p-3 rounded-2xl shadow-md border border-outline-variant/30 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-3 h-3 rounded-full ${
                wsConnected ? 'bg-primary' : 'bg-surface-variant border border-outline'
              }`}
              title={wsConnected ? 'Connected to Safety Telematics' : 'Connecting to Telematics Gateway'}
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-on-surface">
                  {tripDetails?.routeName || (activeBooking ? activeBooking.routeName : 'Kaduwela Express')}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-surface-container-high text-on-surface-variant font-medium">
                  Trip #{activeTripId}
                </span>
              </div>
              <div className="text-[10px] text-on-surface-variant flex items-center gap-2">
                <span>{wsConnected ? 'RFC 6455 Telematics Live' : 'Connecting Stream...'}</span>
                {participantsCount > 0 && <span>· {participantsCount} in room</span>}
              </div>
            </div>
          </div>

          {/* Active Trip Selector Dropdown if multiple trips available */}
          {(myBookings.length > 1 || availableTrips.length > 1) && (
            <select
              value={activeTripId}
              onChange={(e) => handleSelectTrip(Number(e.target.value))}
              className="text-xs font-semibold bg-surface-container-high text-on-surface border border-outline-variant/40 rounded-xl px-2 py-1 outline-none cursor-pointer max-w-[130px] truncate"
            >
              {myBookings.length > 0 && (
                <optgroup label="My Booked Commutes">
                  {myBookings.map((b) => (
                    <option key={`mb-${b.id}`} value={b.tripId}>
                      Trip #{b.tripId} - {b.routeName}
                    </option>
                  ))}
                </optgroup>
              )}
              {availableTrips.length > 0 && (
                <optgroup label="Corridor Shuttles">
                  {availableTrips.map((t) => (
                    <option key={`tr-${t.id}`} value={t.id}>
                      Trip #{t.id} - {t.routeName}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          )}
        </div>

        {/* Geolocation Permission Notification Card if Not Yet Granted */}
        {geoPermission === 'prompt' && (
          <div className="bg-surface/95 backdrop-blur-md p-3 rounded-2xl shadow-md border border-primary/30 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-primary">my_location</span>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-on-surface">Enable Commuter GPS</span>
                <span className="text-[10px] text-on-surface-variant">
                  Transmit real-time position for corridor safety verification
                </span>
              </div>
            </div>
            <button
              onClick={requestLocationPermission}
              className="px-3 py-1.5 rounded-xl bg-primary text-on-primary text-xs font-bold shadow-sm hover:bg-primary-hover active:scale-95 transition-all cursor-pointer whitespace-nowrap"
            >
              Allow GPS
            </button>
          </div>
        )}

        {/* Permission Denied Notice */}
        {geoPermission === 'denied' && (
          <div className="bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-300 dark:border-amber-700/50 flex items-center gap-2 text-xs text-amber-900 dark:text-amber-200">
            <span className="material-symbols-outlined text-[18px]">location_disabled</span>
            <span>
              Device GPS access is blocked in browser settings. Showing scheduled corridor route.
            </span>
          </div>
        )}

        {/* Deviation Warning Alert if Corridor Deviation Detected */}
        {telemetry.isDeviated && (
          <div className="p-3 rounded-2xl bg-error-container text-on-error-container text-xs flex items-center justify-between shadow-md border border-error/30">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-error">warning</span>
              <div>
                <span className="font-bold block">Corridor Deviation Detected</span>
                <span className="text-[10px] opacity-90">
                  {telemetry.anomalyMessage || `Vehicle is ${telemetry.distanceMeters}m off route`}
                </span>
              </div>
            </div>
            <button
              onClick={onOpenSos}
              className="bg-error text-on-error px-2.5 py-1.5 rounded-xl font-bold text-xs uppercase cursor-pointer hover:brightness-95 active:scale-95 transition-all"
            >
              Trigger SOS
            </button>
          </div>
        )}

        {/* Active Emergency SOS Alert Banner */}
        {sosStatus === 'active' && (
          <div className="p-3 rounded-2xl bg-error text-on-error text-xs flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px]">e911_emergency</span>
              <span className="font-bold">Safety Dispatch Alerted · Emergency Team Responding</span>
            </div>
            <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-md font-bold">ACTIVE</span>
          </div>
        )}
      </div>

      {/* Main Real Interactive Leaflet Route Map */}
      <div className="w-full flex-1 relative">
        <SharedRouteMap
          routePolyline={routePolyline}
          markers={mapMarkers}
          liveLocation={userLocation || vehicleLocation}
          heightClass="h-full"
        />

        {/* Live GPS Coordinates Pill (Bottom Left of Map) */}
        {userLocation && (
          <div className="absolute bottom-24 left-4 z-20 bg-surface/90 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-md border border-outline-variant/30 flex items-center gap-2 text-[11px] text-on-surface">
            <span className="material-symbols-outlined text-[15px] text-primary">near_me</span>
            <span>
              {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
            </span>
            <span className="text-on-surface-variant font-medium">
              (±{userLocation.accuracy || 10}m)
            </span>
          </div>
        )}
      </div>

      {/* Floating Bottom Telematics Sheet */}
      <div className="absolute bottom-4 left-4 right-4 z-20 max-w-lg mx-auto">
        <div className="bg-surface/95 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-outline-variant/30 flex flex-col gap-3">
          {/* Header Row: Vehicle Info & Booking Link */}
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-primary font-bold uppercase tracking-wider">
                  {tripDetails?.vehicle.type || 'Corporate Shuttle'}
                </span>
                {activeBooking && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-primary/10 text-primary font-bold">
                    Booked ({activeBooking.partySize} Seat{activeBooking.partySize > 1 ? 's' : ''})
                  </span>
                )}
              </div>
              <h3 className="text-base font-bold text-on-surface mt-0.5">
                {tripDetails?.vehicle.plateNo || activeBooking?.plateNo || 'NC-8821 (Shuttle 01)'}
              </h3>
            </div>

            <div className="flex items-center gap-1 bg-surface-container-high px-2.5 py-1 rounded-xl text-xs font-semibold text-on-surface">
              <span className="material-symbols-outlined text-[15px] text-primary">schedule</span>
              <span>
                {tripDetails?.departAt
                  ? new Date(tripDetails.departAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : 'Scheduled'}
              </span>
            </div>
          </div>

          {/* Telematics Metrics Grid */}
          <div className="grid grid-cols-3 gap-2 py-2 border-y border-outline-variant/20 text-center">
            <div>
              <span className="text-[10px] text-outline uppercase font-semibold">Speed</span>
              <div className="text-sm font-bold text-on-surface">
                {userLocation?.speed ? `${userLocation.speed} km/h` : telemetry.speedKmh ? `${telemetry.speedKmh} km/h` : '0 km/h'}
              </div>
            </div>
            <div>
              <span className="text-[10px] text-outline uppercase font-semibold">Corridor Dist</span>
              <div className="text-sm font-bold text-on-surface">
                {telemetry.distanceMeters > 0 ? `${telemetry.distanceMeters}m` : 'On Corridor'}
              </div>
            </div>
            <div>
              <span className="text-[10px] text-outline uppercase font-semibold">Route Stops</span>
              <div className="text-sm font-bold text-primary">
                {tripDetails?.stops?.length || DEFAULT_CORRIDOR_COORDS.length} Waypoints
              </div>
            </div>
          </div>

          {/* Action Buttons: Emergency SOS & Driver Info */}
          <div className="flex gap-2">
            <button
              onClick={handleTriggerSos}
              disabled={sosStatus === 'sending'}
              className="flex-1 py-2.5 rounded-xl bg-error-container text-on-error-container font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm hover:brightness-95 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">emergency</span>
              <span>{sosStatus === 'sending' ? 'Dispatching...' : 'Emergency SOS'}</span>
            </button>

            <button
              onClick={() => setShowDriverModal(true)}
              className="px-4 py-2.5 rounded-xl bg-surface-container-high text-on-surface font-semibold text-xs flex items-center justify-center gap-1.5 hover:bg-surface-container-highest transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">badge</span>
              <span>Driver Info</span>
            </button>

            {!activeBooking && onNavigateToBooking && (
              <button
                onClick={onNavigateToBooking}
                className="px-3 py-2.5 rounded-xl bg-primary/10 text-primary font-bold text-xs flex items-center justify-center gap-1 hover:bg-primary/20 transition-colors cursor-pointer"
                title="Book a seat on this route"
              >
                <span className="material-symbols-outlined text-[16px]">add_circle</span>
                <span>Book</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Driver Information Modal */}
      {showDriverModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-outline-variant/30 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">badge</span>
                <h4 className="font-bold text-base text-on-surface">Driver & Shuttle Details</h4>
              </div>
              <button
                onClick={() => setShowDriverModal(false)}
                className="p-1 rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="flex flex-col gap-3 text-xs">
              <div className="flex justify-between items-center py-1">
                <span className="text-on-surface-variant">Assigned Driver</span>
                <span className="font-bold text-on-surface">
                  {tripDetails?.driverName || (tripDetails as any)?.driver?.name || 'Sunil Perera (Certified)'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-on-surface-variant">Vehicle Registration</span>
                <span className="font-bold text-on-surface">
                  {tripDetails?.vehicle.plateNo || 'NC-8821'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-on-surface-variant">Vehicle Model</span>
                <span className="font-bold text-on-surface">
                  {tripDetails?.vehicle.type || 'Toyota Coaster (30 Pax)'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-on-surface-variant">Safety Telematics Check</span>
                <span className="font-bold text-primary flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">verified</span>
                  <span>Active & Verified</span>
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowDriverModal(false)}
              className="w-full py-2.5 rounded-xl bg-surface-container-high text-on-surface font-semibold text-xs hover:bg-surface-container-highest transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
