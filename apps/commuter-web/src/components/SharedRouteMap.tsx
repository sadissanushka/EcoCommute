import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

export interface MapCoordinate {
  lat: number;
  lng: number;
}

export interface SharedMapMarker {
  lat: number;
  lng: number;
  label?: string;
  color?: string;
}

export interface SharedHeatPoint {
  lat: number;
  lng: number;
  weight: number;
}

export interface SharedRouteMapProps {
  routePolyline?: MapCoordinate[];
  markers?: SharedMapMarker[];
  liveLocation?: (MapCoordinate & { heading?: number }) | null;
  heatLayer?: SharedHeatPoint[];
  /** Self-hosted tile URL template (defaults to OSM / self-hosted tileserver-gl) */
  style?: string;
  heightClass?: string;
}

/**
 * Shared Reusable Map Component (Module 1 — Step 4.2 / Contract C10)
 * Consumed by Module 1 (Ride Matching), Module 2 (Trip Route Preview),
 * Module 4 (Live Tracking), and Module 5 (Corridor Heatmaps).
 */
export const SharedRouteMap: React.FC<SharedRouteMapProps> = ({
  routePolyline = [],
  markers = [],
  liveLocation = null,
  heatLayer = [],
  style,
  heightClass = 'h-64',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const liveMarkerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [6.904, 79.88],
      zoom: 12,
      zoomControl: false,
    });

    const resolvedTileUrl =
      style ||
      (import.meta as any).env?.VITE_SELF_HOSTED_TILES_URL ||
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';

    L.tileLayer(resolvedTileUrl, {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    layerGroupRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
      liveMarkerRef.current = null;
    };
  }, [style]);

  // Render route polyline, static markers, and optional heat circles
  useEffect(() => {
    const map = mapRef.current;
    const group = layerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();
    const boundsPoints: [number, number][] = [];

    if (routePolyline.length >= 2) {
      const latLngs = routePolyline.map((p) => [p.lat, p.lng] as [number, number]);
      L.polyline(latLngs, { color: '#0d631b', weight: 5, opacity: 0.9 }).addTo(group);
      boundsPoints.push(...latLngs);
    }

    markers.forEach((m, idx) => {
      const color = m.color || (idx === 0 ? '#0d631b' : '#0284c7');
      const icon = L.divIcon({
        className: 'shared-map-pin',
        html: `<div style="width:24px;height:24px;border-radius:50%;background:${color};color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);transform:translate(-50%,-50%);">${m.label || idx + 1}</div>`,
        iconSize: [0, 0],
      });
      L.marker([m.lat, m.lng], { icon }).addTo(group);
      boundsPoints.push([m.lat, m.lng]);
    });

    heatLayer.forEach((pt) => {
      L.circleMarker([pt.lat, pt.lng], {
        radius: Math.max(8, Math.min(28, pt.weight * 4)),
        fillColor: '#f59e0b',
        color: '#d97706',
        weight: 1,
        fillOpacity: 0.35,
      }).addTo(group);
      boundsPoints.push([pt.lat, pt.lng]);
    });

    if (boundsPoints.length > 0) {
      map.fitBounds(L.latLngBounds(boundsPoints), { padding: [30, 30], maxZoom: 15 });
    }
  }, [routePolyline, markers, heatLayer]);

  // Render live-location marker feed (Module 4 integration hook)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!liveLocation) {
      if (liveMarkerRef.current) {
        map.removeLayer(liveMarkerRef.current);
        liveMarkerRef.current = null;
      }
      return;
    }

    const icon = L.divIcon({
      className: 'shared-live-marker',
      html: `<div style="width:16px;height:16px;border-radius:50%;background:#16a34a;border:3px solid #fff;box-shadow:0 0 0 6px rgba(22,163,74,0.25);transform:translate(-50%,-50%);"></div>`,
      iconSize: [0, 0],
    });

    if (!liveMarkerRef.current) {
      liveMarkerRef.current = L.marker([liveLocation.lat, liveLocation.lng], { icon }).addTo(map);
    } else {
      liveMarkerRef.current.setLatLng([liveLocation.lat, liveLocation.lng]);
    }
  }, [liveLocation]);

  return (
    <div
      ref={containerRef}
      className={`w-full ${heightClass} rounded-2xl overflow-hidden border border-outline-variant/30 bg-surface-container-low`}
    />
  );
};

