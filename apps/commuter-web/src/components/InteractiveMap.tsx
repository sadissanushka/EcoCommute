import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { RoadNode, COLOMBO_NODES, findNearestNode, createCustomLocation } from '../lib/graph';

export interface InteractiveMapProps {
  waypoints: RoadNode[];
  routeCoordinates: [number, number][];
  onAddWaypoint: (node: RoadNode) => void;
  onUpdateWaypoint: (index: number, updated: RoadNode) => void;
  onRemoveWaypoint: (index: number) => void;
  vehiclePosition: [number, number] | null;
  baseMapType?: 'esri' | 'osm' | 'dark';
  isDropMode?: boolean;
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  waypoints,
  routeCoordinates,
  onAddWaypoint,
  onUpdateWaypoint,
  onRemoveWaypoint,
  vehiclePosition,
  baseMapType = 'esri',
  isDropMode = false,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const casingPolylineRef = useRef<L.Polyline | null>(null);
  const waypointMarkersRef = useRef<L.Marker[]>([]);
  const vehicleMarkerRef = useRef<L.Marker | null>(null);
  const nodeMarkersLayerRef = useRef<L.LayerGroup | null>(null);

  // References to keep event listeners up to date with props without re-initializing Leaflet
  const waypointsRef = useRef(waypoints);
  waypointsRef.current = waypoints;

  const onAddWaypointRef = useRef(onAddWaypoint);
  onAddWaypointRef.current = onAddWaypoint;

  const onUpdateWaypointRef = useRef(onUpdateWaypoint);
  onUpdateWaypointRef.current = onUpdateWaypoint;

  const onRemoveWaypointRef = useRef(onRemoveWaypoint);
  onRemoveWaypointRef.current = onRemoveWaypoint;

  const isDropModeRef = useRef(isDropMode);
  isDropModeRef.current = isDropMode;

  // Custom HTML Pin Icons
  const createPinIcon = (label: string, bgClass: string, isIntermediate: boolean = false) => {
    return L.divIcon({
      className: 'custom-map-pin',
      html: `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%);">
          <div style="min-width: 28px; height: 28px; padding: 0 5px; border-radius: 14px; background-color: ${bgClass}; color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: ${
            isIntermediate ? '11px' : '13px'
          }; box-shadow: 0 4px 14px rgba(0,0,0,0.3); border: 2.5px solid white;">
            ${label}
          </div>
          <div style="width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 7px solid ${bgClass}; margin-top: -2px;"></div>
        </div>
      `,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });
  };

  const createVehicleIcon = () => {
    return L.divIcon({
      className: 'custom-vehicle-pin',
      html: `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -50%);">
          <div style="width: 38px; height: 38px; border-radius: 50%; background-color: #0d631b; color: white; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 16px rgba(13,99,27,0.45); border: 2.5px solid white;">
            <span style="font-family: 'Material Symbols Outlined'; font-size: 20px;">directions_bus</span>
          </div>
          <div style="position: absolute; width: 46px; height: 46px; border-radius: 50%; border: 2px solid #0d631b; opacity: 0.6; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
        </div>
      `,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });
  };

  // 1. Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [6.8950, 79.8800],
      zoom: 12,
      zoomControl: false,
    });

    const getTileUrl = (type: 'esri' | 'osm' | 'dark') => {
      switch (type) {
        case 'osm':
          return 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
        case 'dark':
          return 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';
        case 'esri':
        default:
          return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';
      }
    };

    const getAttribution = (type: 'esri' | 'osm' | 'dark') => {
      if (type === 'osm') {
        return '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors';
      }
      return 'Tiles &copy; Esri &mdash; StreetMap &amp; OpenStreetMap contributors';
    };

    const tile = L.tileLayer(getTileUrl(baseMapType), {
      attribution: getAttribution(baseMapType),
      maxZoom: 19,
    }).addTo(map);
    tileLayerRef.current = tile;

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Click handler to drop custom locations directly onto the map
    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      const nearest = findNearestNode(lat, lng);
      const stopNumber = waypointsRef.current.length;
      const customLocation = createCustomLocation(
        `Custom Stop ${stopNumber} (near ${nearest.name})`,
        lat,
        lng
      );
      onAddWaypointRef.current(customLocation);
    });

    // Layer for predefined road hubs
    const nodeLayer = L.layerGroup().addTo(map);
    nodeMarkersLayerRef.current = nodeLayer;

    // Render road nodes as interactive click waypoints
    Object.values(COLOMBO_NODES).forEach((node) => {
      const circle = L.circleMarker([node.lat, node.lng], {
        radius: 5,
        fillColor: '#ffffff',
        fillOpacity: 0.9,
        color: '#0d631b',
        weight: 2,
      });

      circle.bindTooltip(`<b>${node.name}</b><br/>Click to add as stop`, {
        direction: 'top',
        className: 'leaflet-custom-tooltip',
      });

      circle.on('click', (ev) => {
        L.DomEvent.stopPropagation(ev);
        onAddWaypointRef.current(node);
      });

      nodeLayer.addLayer(circle);
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Dynamic Tile Layer Switcher
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      tileLayerRef.current.remove();
    }

    const getTileUrl = (type: 'esri' | 'osm' | 'dark') => {
      switch (type) {
        case 'osm':
          return 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
        case 'dark':
          return 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';
        case 'esri':
        default:
          return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';
      }
    };

    const getAttribution = (type: 'esri' | 'osm' | 'dark') => {
      if (type === 'osm') {
        return '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors';
      }
      return 'Tiles &copy; Esri &mdash; StreetMap &amp; OpenStreetMap contributors';
    };

    const tile = L.tileLayer(getTileUrl(baseMapType), {
      attribution: getAttribution(baseMapType),
      maxZoom: 19,
    }).addTo(map);

    tileLayerRef.current = tile;
  }, [baseMapType]);

  // Adjust cursor style when Drop Mode is active
  useEffect(() => {
    if (mapContainerRef.current) {
      if (isDropMode) {
        mapContainerRef.current.style.cursor = 'crosshair';
      } else {
        mapContainerRef.current.style.cursor = '';
      }
    }
  }, [isDropMode]);

  // 2. Render and sync all Waypoint Markers (A, 1, 2, ..., B)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear previous markers
    waypointMarkersRef.current.forEach((marker) => marker.remove());
    waypointMarkersRef.current = [];

    const total = waypoints.length;

    waypoints.forEach((wp, idx) => {
      let label: string;
      let bgColor: string;
      const isOrigin = idx === 0;
      const isDestination = idx === total - 1 && total > 1;

      if (isOrigin) {
        label = 'A';
        bgColor = '#0d631b'; // Primary Emerald
      } else if (isDestination) {
        label = 'B';
        bgColor = '#ba1a1a'; // Crimson Red
      } else {
        label = `${idx}`;
        bgColor = '#0284c7'; // Blue/Sky
      }

      const marker = L.marker([wp.lat, wp.lng], {
        icon: createPinIcon(label, bgColor, !isOrigin && !isDestination),
        draggable: true,
        title: wp.name,
      }).addTo(map);

      // Bind interactive popup
      const popupDiv = document.createElement('div');
      popupDiv.className = 'p-1 text-xs font-sans';
      popupDiv.innerHTML = `
        <div style="font-weight: 700; margin-bottom: 2px;">${label}. ${wp.name}</div>
        <div style="font-size: 10px; color: #64748b; margin-bottom: 6px;">
          Lat: ${wp.lat.toFixed(4)}, Lng: ${wp.lng.toFixed(4)}
        </div>
        <div style="display: flex; gap: 4px;">
          ${
            total > 2
              ? `<button id="delete-stop-btn-${idx}" style="background-color: #fee2e2; color: #dc2626; border: 1px solid #fecaca; border-radius: 6px; padding: 2px 8px; font-weight: 600; cursor: pointer; font-size: 11px;">Remove Stop</button>`
              : ''
          }
        </div>
      `;

      marker.bindPopup(popupDiv);

      marker.on('popupopen', () => {
        const delBtn = document.getElementById(`delete-stop-btn-${idx}`);
        if (delBtn) {
          delBtn.onclick = () => {
            onRemoveWaypointRef.current(idx);
          };
        }
      });

      // Draggable marker logic
      marker.on('dragend', (e: any) => {
        const { lat, lng } = e.target.getLatLng();
        const nearest = findNearestNode(lat, lng);
        const updated: RoadNode = {
          ...wp,
          lat,
          lng,
          name: wp.id.startsWith('custom_') ? `Custom Pin (${lat.toFixed(3)}, ${lng.toFixed(3)})` : wp.name,
          nearestNodeId: nearest.id,
        } as any;
        onUpdateWaypointRef.current(idx, updated);
      });

      waypointMarkersRef.current.push(marker);
    });
  }, [waypoints]);

  // 3. Update Route Polyline
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (casingPolylineRef.current) {
      casingPolylineRef.current.remove();
      casingPolylineRef.current = null;
    }
    if (routePolylineRef.current) {
      routePolylineRef.current.remove();
      routePolylineRef.current = null;
    }

    if (routeCoordinates.length >= 2) {
      // White casing outline
      casingPolylineRef.current = L.polyline(routeCoordinates, {
        color: '#ffffff',
        weight: 9,
        lineCap: 'round',
        lineJoin: 'round',
        opacity: 0.95,
      }).addTo(map);

      // Primary corridor line
      routePolylineRef.current = L.polyline(routeCoordinates, {
        color: '#0d631b',
        weight: 5,
        lineCap: 'round',
        lineJoin: 'round',
        dashArray: '8, 6',
        opacity: 1,
      }).addTo(map);

      // Fit map bounds to view all route waypoints nicely
      const bounds = L.latLngBounds(routeCoordinates);
      map.fitBounds(bounds, { padding: [70, 70], maxZoom: 14 });
    }
  }, [routeCoordinates]);

  // 4. Update Moving Vehicle Simulation Marker
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (vehiclePosition) {
      if (vehicleMarkerRef.current) {
        vehicleMarkerRef.current.setLatLng(vehiclePosition);
      } else {
        vehicleMarkerRef.current = L.marker(vehiclePosition, {
          icon: createVehicleIcon(),
          zIndexOffset: 1000,
        }).addTo(map);
      }
    } else if (vehicleMarkerRef.current) {
      vehicleMarkerRef.current.remove();
      vehicleMarkerRef.current = null;
    }
  }, [vehiclePosition]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="w-full h-full z-0" />
    </div>
  );
};
