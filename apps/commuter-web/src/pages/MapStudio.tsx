import React, { useState, useEffect } from 'react';
import { InteractiveMap } from '../components/InteractiveMap';
import {
  COLOMBO_NODES,
  CORRIDOR_PRESETS,
  RoadNode,
  CorridorPreset,
  findMultiStopRoute,
  generateInterpolatedPath,
  RouteResult,
  createCustomLocation,
} from '../lib/graph';

export const MapStudio: React.FC = () => {
  // Array of stops/waypoints (Origin = index 0, Destination = last index)
  const [waypoints, setWaypoints] = useState<RoadNode[]>([
    COLOMBO_NODES.fort,
    COLOMBO_NODES.uom,
  ]);
  const [activePreset, setActivePreset] = useState<string>('corridor-1');
  const [useAStar, setUseAStar] = useState<boolean>(true);
  const [baseMapType, setBaseMapType] = useState<'esri' | 'osm' | 'dark'>('esri');
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [isDropMode, setIsDropMode] = useState<boolean>(false);
  const [showAddMenu, setShowAddMenu] = useState<boolean>(false);
  const [isWaypointsExpanded, setIsWaypointsExpanded] = useState<boolean>(true);

  // Simulation State
  const [isSimulating, setIsSimulating] = useState(false);
  const [simIndex, setSimIndex] = useState(0);
  const [simSpeed, setSimSpeed] = useState(42);
  const [interpolatedPoints, setInterpolatedPoints] = useState<[number, number][]>([]);

  // Detour Threshold Slider (Module 1 matching feature)
  const [detourThresholdM, setDetourThresholdM] = useState(1500);

  // Recompute route whenever waypoints or algorithm changes
  useEffect(() => {
    if (waypoints.length >= 2) {
      const result = findMultiStopRoute(waypoints, useAStar);
      setRouteResult(result);

      const smoothPoints = generateInterpolatedPath(result.coordinates, 10);
      setInterpolatedPoints(smoothPoints);
      setSimIndex(0);
      setIsSimulating(false);
    }
  }, [waypoints, useAStar]);

  // Simulation timer
  useEffect(() => {
    if (!isSimulating || interpolatedPoints.length === 0) return;

    const interval = setInterval(() => {
      setSimIndex((prev) => {
        if (prev >= interpolatedPoints.length - 1) {
          setIsSimulating(false);
          return 0;
        }
        return prev + 1;
      });
      // Vary speed realistically
      setSimSpeed(Math.floor(38 + Math.random() * 14));
    }, 140);

    return () => clearInterval(interval);
  }, [isSimulating, interpolatedPoints]);

  const handleSelectPreset = (preset: CorridorPreset) => {
    setActivePreset(preset.id);
    setWaypoints([COLOMBO_NODES[preset.originNode], COLOMBO_NODES[preset.destNode]]);
  };

  const handleSwapOriginDest = () => {
    if (waypoints.length < 2) return;
    const newWaypoints = [...waypoints];
    const first = newWaypoints[0];
    newWaypoints[0] = newWaypoints[newWaypoints.length - 1];
    newWaypoints[newWaypoints.length - 1] = first;
    setWaypoints(newWaypoints);
    setActivePreset('');
  };

  const handleAddWaypoint = (node: RoadNode) => {
    // Insert before final destination so origin and destination bookend the route
    if (waypoints.length >= 2) {
      const updated = [...waypoints];
      updated.splice(updated.length - 1, 0, node);
      setWaypoints(updated);
    } else {
      setWaypoints([...waypoints, node]);
    }
    setActivePreset('');
    setShowAddMenu(false);
  };

  const handleUpdateWaypoint = (index: number, updated: RoadNode) => {
    const nextWaypoints = [...waypoints];
    nextWaypoints[index] = updated;
    setWaypoints(nextWaypoints);
    setActivePreset('');
  };

  const handleRemoveWaypoint = (index: number) => {
    if (waypoints.length <= 2) return;
    const nextWaypoints = waypoints.filter((_, idx) => idx !== index);
    setWaypoints(nextWaypoints);
    setActivePreset('');
  };

  const handleMoveWaypoint = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= waypoints.length) return;

    const updated = [...waypoints];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setWaypoints(updated);
    setActivePreset('');
  };

  const handleAddPredefinedStop = (nodeKey: string) => {
    const node = COLOMBO_NODES[nodeKey];
    if (node) {
      handleAddWaypoint(node);
    }
  };

  const currentVehiclePos =
    isSimulating && interpolatedPoints.length > 0 ? interpolatedPoints[simIndex] : null;

  const simProgressPct =
    interpolatedPoints.length > 0
      ? Math.round((simIndex / (interpolatedPoints.length - 1)) * 100)
      : 0;

  return (
    <div className="relative w-full h-screen overflow-hidden font-sans bg-surface select-none">
      {/* 1. Full-Screen Interactive Leaflet Map Layer */}
      <div className="absolute inset-0 z-0">
        <InteractiveMap
          waypoints={waypoints}
          routeCoordinates={routeResult?.coordinates || []}
          onAddWaypoint={handleAddWaypoint}
          onUpdateWaypoint={handleUpdateWaypoint}
          onRemoveWaypoint={handleRemoveWaypoint}
          vehiclePosition={currentVehiclePos}
          baseMapType={baseMapType}
          isDropMode={isDropMode}
        />
      </div>

      {/* 2. Drop Mode Banner Notification */}
      {isDropMode && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-40 bg-secondary text-on-secondary px-4 py-2 rounded-full shadow-2xl border border-white/40 flex items-center gap-2 animate-bounce">
          <span className="material-symbols-outlined text-[18px]">add_location_alt</span>
          <span className="text-xs font-bold tracking-wide">
            Click anywhere on the map to add a custom stop
          </span>
          <button
            onClick={() => setIsDropMode(false)}
            className="ml-2 w-5 h-5 rounded-full bg-black/20 hover:bg-black/30 flex items-center justify-center text-xs cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* 3. Top Header & Floating Multi-Stop Card */}
      <div className="absolute top-3 left-3 right-3 z-30 max-w-lg mx-auto flex flex-col gap-2">
        {/* Brand Bar */}
        <div className="bg-surface/90 backdrop-blur-xl px-4 py-2.5 rounded-2xl shadow-lg border border-white/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary text-on-primary flex items-center justify-center shadow-sm">
              <span className="material-symbols-outlined text-[20px]">explore</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm text-primary tracking-tight">EcoCommute</span>
                <span className="text-[10px] bg-primary-fixed text-on-primary-fixed font-bold px-1.5 py-0.2 rounded-full uppercase">
                  Multi-Stop Studio
                </span>
              </div>
              <span className="text-[11px] text-on-surface-variant font-medium">
                Colombo &amp; Western Corridor
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Tile Map Style Switcher (ESRI vs OSM vs Dark) */}
            <div className="flex items-center bg-surface-container-low p-0.5 rounded-xl border border-outline-variant/30">
              <button
                onClick={() => setBaseMapType('esri')}
                title="ESRI Clean Street Map (Zero Watermarks)"
                className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  baseMapType === 'esri'
                    ? 'bg-secondary text-on-secondary shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                ESRI
              </button>
              <button
                onClick={() => setBaseMapType('osm')}
                title="OpenStreetMap Standard"
                className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  baseMapType === 'osm'
                    ? 'bg-secondary text-on-secondary shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                OSM
              </button>
            </div>

            {/* Algorithm Switcher */}
            <div className="flex items-center bg-surface-container-low p-0.5 rounded-xl border border-outline-variant/30">
              <button
                onClick={() => setUseAStar(true)}
                className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  useAStar
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                A*
              </button>
              <button
                onClick={() => setUseAStar(false)}
                className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  !useAStar
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Dijkstra
              </button>
            </div>
          </div>
        </div>

        {/* Multi-Stop Routing Manager Card */}
        <div className="bg-surface/95 backdrop-blur-xl p-3 rounded-2xl shadow-xl border border-white/60 flex flex-col gap-2">
          {/* Header of Stops with Add and Collapse */}
          <div className="flex items-center justify-between pb-1 border-b border-outline-variant/30">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-[18px]">route</span>
              <span className="text-xs font-bold text-on-surface">
                Route Corridor ({waypoints.length} Stops)
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Toggle Drop Pin Mode */}
              <button
                onClick={() => setIsDropMode(!isDropMode)}
                title="Click on map to drop custom pin"
                className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  isDropMode
                    ? 'bg-secondary text-on-secondary shadow-md'
                    : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">pin_drop</span>
                <span>{isDropMode ? 'Pinning...' : 'Drop Pin'}</span>
              </button>

              {/* Add Stop Button */}
              <button
                onClick={() => setShowAddMenu(!showAddMenu)}
                className="px-2.5 py-1 rounded-xl bg-primary text-on-primary text-xs font-bold flex items-center gap-1 shadow-sm hover:bg-primary-container transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">add_circle</span>
                <span>Add Stop</span>
              </button>

              {/* Swap Origin / Destination */}
              <button
                onClick={handleSwapOriginDest}
                title="Reverse corridor direction"
                className="w-7 h-7 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface flex items-center justify-center transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">swap_vert</span>
              </button>

              {/* Collapse/Expand Toggle */}
              <button
                onClick={() => setIsWaypointsExpanded(!isWaypointsExpanded)}
                className="w-7 h-7 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface flex items-center justify-center transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {isWaypointsExpanded ? 'expand_less' : 'expand_more'}
                </span>
              </button>
            </div>
          </div>

          {/* Quick Hub Selector Dropdown (when Add Stop is clicked) */}
          {showAddMenu && (
            <div className="p-2.5 bg-surface-container-lowest rounded-xl border border-primary/30 flex flex-col gap-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-on-surface">
                <span>Select Colombo Hub or Custom Location:</span>
                <button
                  onClick={() => setShowAddMenu(false)}
                  className="text-outline hover:text-on-surface text-xs"
                >
                  ✕
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1">
                {Object.values(COLOMBO_NODES).map((node) => (
                  <button
                    key={node.id}
                    onClick={() => handleAddPredefinedStop(node.id)}
                    className="p-1.5 text-left text-[11px] rounded-lg bg-surface hover:bg-primary/10 hover:text-primary border border-outline-variant/30 truncate font-medium cursor-pointer transition-colors"
                  >
                    📍 {node.name}
                  </button>
                ))}
              </div>
              <div className="pt-1 border-t border-outline-variant/20 flex items-center justify-between">
                <span className="text-[10px] text-outline">Or click anywhere on map</span>
                <button
                  onClick={() => {
                    setIsDropMode(true);
                    setShowAddMenu(false);
                  }}
                  className="text-[11px] font-bold text-secondary flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">pin_drop</span>
                  Click Map to Place
                </button>
              </div>
            </div>
          )}

          {/* Waypoints List (Origin, Waypoints 1...N, Destination) */}
          {isWaypointsExpanded && (
            <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
              {waypoints.map((wp, idx) => {
                const isOrigin = idx === 0;
                const isDest = idx === waypoints.length - 1;
                const badgeLabel = isOrigin ? 'A' : isDest ? 'B' : `${idx}`;
                const badgeBg = isOrigin
                  ? 'bg-primary text-on-primary'
                  : isDest
                  ? 'bg-error text-on-error'
                  : 'bg-secondary text-on-secondary';

                return (
                  <div
                    key={`${wp.id}-${idx}`}
                    className="flex items-center justify-between p-1.5 rounded-xl bg-surface-container-low border border-outline-variant/30 hover:border-outline-variant transition-all"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div
                        className={`w-6 h-6 rounded-full ${badgeBg} flex items-center justify-center font-bold text-xs shrink-0 shadow-sm`}
                      >
                        {badgeLabel}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[9px] uppercase font-bold text-outline block leading-none">
                          {isOrigin ? 'Origin (Pickup)' : isDest ? 'Destination (Drop-off)' : `Stop ${idx}`}
                        </span>
                        <span className="text-xs font-bold text-on-surface truncate block">
                          {wp.name}
                        </span>
                      </div>
                    </div>

                    {/* Reorder and Delete Controls */}
                    <div className="flex items-center gap-1 shrink-0 ml-1">
                      {idx > 0 && (
                        <button
                          onClick={() => handleMoveWaypoint(idx, 'up')}
                          title="Move Up"
                          className="w-5 h-5 rounded hover:bg-surface-container-high text-on-surface-variant flex items-center justify-center text-xs cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[14px]">arrow_upward</span>
                        </button>
                      )}
                      {idx < waypoints.length - 1 && (
                        <button
                          onClick={() => handleMoveWaypoint(idx, 'down')}
                          title="Move Down"
                          className="w-5 h-5 rounded hover:bg-surface-container-high text-on-surface-variant flex items-center justify-center text-xs cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[14px]">arrow_downward</span>
                        </button>
                      )}
                      {waypoints.length > 2 && (
                        <button
                          onClick={() => handleRemoveWaypoint(idx)}
                          title="Remove Stop"
                          className="w-5 h-5 rounded hover:bg-error/20 text-error flex items-center justify-center text-xs cursor-pointer ml-0.5"
                        >
                          <span className="material-symbols-outlined text-[14px]">delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Quick Corridor Presets Bar */}
          <div className="flex gap-1.5 overflow-x-auto pt-1 no-scrollbar">
            {CORRIDOR_PRESETS.map((p) => {
              const isSelected = activePreset === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => handleSelectPreset(p)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all shadow-sm cursor-pointer ${
                    isSelected
                      ? 'bg-primary text-on-primary font-bold'
                      : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                  }`}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. Floating Bottom Telematics & Multi-Stop Route Analytics Card */}
      <div className="absolute bottom-4 left-3 right-3 z-30 max-w-lg mx-auto">
        <div className="bg-surface/95 backdrop-blur-xl p-4 rounded-3xl shadow-2xl border border-white/60 flex flex-col gap-3">
          {/* Top Row: Path Metrics Grid */}
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="bg-surface-container-lowest p-2 rounded-2xl border border-outline-variant/30">
              <span className="text-[9px] font-bold text-outline uppercase block">Distance</span>
              <span className="text-sm font-extrabold text-on-surface">
                {routeResult ? `${(routeResult.distanceMeters / 1000).toFixed(1)} km` : '--'}
              </span>
            </div>

            <div className="bg-surface-container-lowest p-2 rounded-2xl border border-outline-variant/30">
              <span className="text-[9px] font-bold text-outline uppercase block">ETA</span>
              <span className="text-sm font-extrabold text-primary">
                {routeResult ? `${Math.round(routeResult.durationSeconds / 60)} min` : '--'}
              </span>
            </div>

            <div className="bg-surface-container-lowest p-2 rounded-2xl border border-outline-variant/30">
              <span className="text-[9px] font-bold text-outline uppercase block">CO2 Saved</span>
              <span className="text-sm font-extrabold text-emerald-700 flex items-center justify-center gap-0.5">
                <span className="material-symbols-outlined text-[13px]">eco</span>
                {routeResult ? `${routeResult.co2SavedKg}kg` : '--'}
              </span>
            </div>

            <div className="bg-surface-container-lowest p-2 rounded-2xl border border-outline-variant/30">
              <span className="text-[9px] font-bold text-outline uppercase block">Stops</span>
              <span className="text-sm font-extrabold text-secondary">
                {waypoints.length}
              </span>
            </div>
          </div>

          {/* Simulation Progress & Detour Threshold */}
          {isSimulating ? (
            <div className="bg-primary-container/10 p-3 rounded-2xl border border-primary/20 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-primary">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-primary animate-ping"></span>
                  EV Shuttle Multi-Stop Run: {simSpeed} km/h
                </span>
                <span>{simProgressPct}% Completed</span>
              </div>
              <div className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden">
                <div
                  className="bg-primary h-full rounded-full transition-all duration-200"
                  style={{ width: `${simProgressPct}%` }}
                ></div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between px-1 text-xs">
              <div className="flex items-center gap-1.5 text-on-surface-variant font-medium">
                <span className="material-symbols-outlined text-secondary text-[16px]">alt_route</span>
                <span>Detour Radius:</span>
                <span className="font-bold text-on-surface">{detourThresholdM}m</span>
              </div>
              <input
                type="range"
                min="500"
                max="3000"
                step="250"
                value={detourThresholdM}
                onChange={(e) => setDetourThresholdM(parseInt(e.target.value, 10))}
                className="w-32 accent-secondary cursor-pointer"
              />
            </div>
          )}

          {/* Action Row */}
          <div className="flex gap-2">
            <button
              onClick={() => setIsSimulating(!isSimulating)}
              className={`flex-1 py-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all cursor-pointer ${
                isSimulating
                  ? 'bg-amber-600 text-white hover:bg-amber-700'
                  : 'bg-primary text-on-primary hover:bg-primary-container'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">
                {isSimulating ? 'pause_circle' : 'play_arrow'}
              </span>
              <span>{isSimulating ? 'Pause Shuttle' : 'Simulate Shuttle Run'}</span>
            </button>

            <button
              onClick={() => {
                alert(
                  `Multi-Stop Corridor Confirmed!\nTotal Stops: ${waypoints.length}\nOrigin: ${
                    waypoints[0].name
                  }\nDestination: ${waypoints[waypoints.length - 1].name}\nDistance: ${(
                    (routeResult?.distanceMeters || 0) / 1000
                  ).toFixed(1)} km\nCO2 Saved: ${routeResult?.co2SavedKg} kg`
                );
              }}
              className="px-4 py-3 rounded-2xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-bold text-xs flex items-center justify-center gap-1 shadow-sm active:scale-95 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">bookmark_add</span>
              <span>Confirm</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
