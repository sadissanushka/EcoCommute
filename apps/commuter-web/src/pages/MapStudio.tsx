import React, { useState, useEffect, useRef } from 'react';
import { InteractiveMap } from '../components/InteractiveMap';
import {
  COLOMBO_NODES,
  CORRIDOR_PRESETS,
  RoadNode,
  CorridorPreset,
  findShortestPath,
  generateInterpolatedPath,
  RouteResult,
} from '../lib/graph';

export const MapStudio: React.FC = () => {
  const [originNode, setOriginNode] = useState<RoadNode>(COLOMBO_NODES.fort);
  const [destNode, setDestNode] = useState<RoadNode>(COLOMBO_NODES.uom);
  const [activePreset, setActivePreset] = useState<string>('corridor-1');
  const [selectionMode, setSelectionMode] = useState<'origin' | 'dest'>('dest');
  const [useAStar, setUseAStar] = useState<boolean>(true);
  const [baseMapType, setBaseMapType] = useState<'esri' | 'osm' | 'dark'>('esri');
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);

  // Simulation State
  const [isSimulating, setIsSimulating] = useState(false);
  const [simIndex, setSimIndex] = useState(0);
  const [simSpeed, setSimSpeed] = useState(42);
  const [interpolatedPoints, setInterpolatedPoints] = useState<[number, number][]>([]);

  // Detour Threshold Slider (Module 1 matching feature)
  const [detourThresholdM, setDetourThresholdM] = useState(1500);

  // Compute shortest path whenever origin, destination, or algorithm changes
  useEffect(() => {
    if (originNode && destNode) {
      const result = findShortestPath(originNode.id, destNode.id, useAStar);
      setRouteResult(result);

      const smoothPoints = generateInterpolatedPath(result.coordinates, 12);
      setInterpolatedPoints(smoothPoints);
      setSimIndex(0);
      setIsSimulating(false);
    }
  }, [originNode, destNode, useAStar]);

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
    }, 150);

    return () => clearInterval(interval);
  }, [isSimulating, interpolatedPoints]);

  const handleSelectPreset = (preset: CorridorPreset) => {
    setActivePreset(preset.id);
    setOriginNode(COLOMBO_NODES[preset.originNode]);
    setDestNode(COLOMBO_NODES[preset.destNode]);
  };

  const handleSwapPoints = () => {
    const temp = originNode;
    setOriginNode(destNode);
    setDestNode(temp);
    setActivePreset('');
  };

  const handleSelectNodeFromMap = (node: RoadNode, type: 'origin' | 'dest') => {
    if (type === 'origin') {
      setOriginNode(node);
      setSelectionMode('dest');
    } else {
      setDestNode(node);
      setSelectionMode('origin');
    }
    setActivePreset('');
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
          originNode={originNode}
          destNode={destNode}
          routeCoordinates={routeResult?.coordinates || []}
          onSelectNode={handleSelectNodeFromMap}
          selectionMode={selectionMode}
          vehiclePosition={currentVehiclePos}
          baseMapType={baseMapType}
        />
      </div>

      {/* 2. Top Header & Floating Search Card */}
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
                  Map Studio
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

            {/* Algorithm Mode Switcher */}
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

        {/* Unified Origin & Destination Selector Pill */}
        <div className="bg-surface/95 backdrop-blur-xl p-3 rounded-2xl shadow-xl border border-white/60 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 flex flex-col gap-1.5">
              {/* Pickup Point */}
              <div
                onClick={() => setSelectionMode('origin')}
                className={`flex items-center gap-2 p-1.5 rounded-xl border transition-all cursor-pointer ${
                  selectionMode === 'origin'
                    ? 'bg-primary/5 border-primary ring-1 ring-primary/30'
                    : 'bg-surface-container-low border-outline-variant/30'
                }`}
              >
                <div className="w-6 h-6 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-xs shrink-0">
                  A
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[9px] uppercase font-bold text-outline block leading-none">
                    Origin (Pickup)
                  </span>
                  <span className="text-xs font-bold text-on-surface truncate block">
                    {originNode.name}
                  </span>
                </div>
              </div>

              {/* Destination Point */}
              <div
                onClick={() => setSelectionMode('dest')}
                className={`flex items-center gap-2 p-1.5 rounded-xl border transition-all cursor-pointer ${
                  selectionMode === 'dest'
                    ? 'bg-secondary/5 border-secondary ring-1 ring-secondary/30'
                    : 'bg-surface-container-low border-outline-variant/30'
                }`}
              >
                <div className="w-6 h-6 rounded-full bg-error text-on-error flex items-center justify-center font-bold text-xs shrink-0">
                  B
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[9px] uppercase font-bold text-outline block leading-none">
                    Destination (Drop-off)
                  </span>
                  <span className="text-xs font-bold text-on-surface truncate block">
                    {destNode.name}
                  </span>
                </div>
              </div>
            </div>

            {/* Swap Button */}
            <button
              onClick={handleSwapPoints}
              title="Swap origin and destination"
              className="w-10 h-10 rounded-2xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface flex items-center justify-center shadow-sm active:scale-90 transition-transform cursor-pointer shrink-0"
            >
              <span className="material-symbols-outlined text-[20px]">swap_vert</span>
            </button>
          </div>

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

      {/* 3. Floating Bottom Telematics & Route Analytics Card */}
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
              <span className="text-[9px] font-bold text-outline uppercase block">Nodes</span>
              <span className="text-sm font-extrabold text-secondary">
                {routeResult ? `${routeResult.nodesExpanded}` : '--'}
              </span>
            </div>
          </div>

          {/* Simulation Progress & Detour Threshold */}
          {isSimulating ? (
            <div className="bg-primary-container/10 p-3 rounded-2xl border border-primary/20 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-primary">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-primary animate-ping"></span>
                  EV Shuttle In Transit: {simSpeed} km/h
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
                <span>Detour Filter:</span>
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
              <span>{isSimulating ? 'Pause Shuttle' : 'Simulate Shuttle Ride'}</span>
            </button>

            <button
              onClick={() => {
                alert(
                  `Corridor Confirmed!\nOrigin: ${originNode.name}\nDestination: ${destNode.name}\nDistance: ${(
                    (routeResult?.distanceMeters || 0) / 1000
                  ).toFixed(1)} km\nCO2 Saved: ${routeResult?.co2SavedKg} kg`
                );
              }}
              className="px-4 py-3 rounded-2xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-bold text-xs flex items-center justify-center gap-1 shadow-sm active:scale-95 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">bookmark_add</span>
              <span>Select</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
