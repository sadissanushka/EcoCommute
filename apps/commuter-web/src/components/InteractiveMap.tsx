import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { RoadNode, COLOMBO_NODES } from '../lib/graph';

interface InteractiveMapProps {
  originNode: RoadNode;
  destNode: RoadNode;
  routeCoordinates: [number, number][];
  onSelectNode: (node: RoadNode, type: 'origin' | 'dest') => void;
  selectionMode: 'origin' | 'dest';
  vehiclePosition: [number, number] | null;
  vehicleHeading?: number;
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  originNode,
  destNode,
  routeCoordinates,
  onSelectNode,
  selectionMode,
  vehiclePosition,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const casingPolylineRef = useRef<L.Polyline | null>(null);
  const originMarkerRef = useRef<L.Marker | null>(null);
  const destMarkerRef = useRef<L.Marker | null>(null);
  const vehicleMarkerRef = useRef<L.Marker | null>(null);
  const nodeMarkersLayerRef = useRef<L.LayerGroup | null>(null);

  // Custom HTML Pin Icons
  const createPinIcon = (label: string, bgClass: string) => {
    return L.divIcon({
      className: 'custom-map-pin',
      html: `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%);">
          <div style="width: 32px; height: 32px; border-radius: 50%; background-color: ${bgClass}; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 13px; box-shadow: 0 4px 12px rgba(0,0,0,0.25); border: 2.5px solid white;">
            ${label}
          </div>
          <div style="width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 8px solid ${bgClass}; margin-top: -2px;"></div>
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
          <div style="width: 40px; height: 40px; border-radius: 50%; background-color: #0d631b; color: white; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 16px rgba(13,99,27,0.4); border: 2.5px solid white;">
            <span style="font-family: 'Material Symbols Outlined'; font-size: 22px;">directions_bus</span>
          </div>
          <div style="position: absolute; width: 48px; height: 48px; border-radius: 50%; border: 2px solid #0d631b; opacity: 0.6; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
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

    // Clean free vector tiles (CartoDB Voyager / OSM tiles)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Layer for road nodes
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

      circle.bindTooltip(`<b>${node.name}</b><br/>Click to set waypoint`, {
        direction: 'top',
        className: 'leaflet-custom-tooltip',
      });

      circle.on('click', () => {
        onSelectNode(node, selectionMode);
      });

      nodeLayer.addLayer(circle);
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 2. Update Origin & Destination Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Origin Marker (A)
    if (originMarkerRef.current) {
      originMarkerRef.current.setLatLng([originNode.lat, originNode.lng]);
    } else {
      originMarkerRef.current = L.marker([originNode.lat, originNode.lng], {
        icon: createPinIcon('A', '#0d631b'),
        draggable: true,
      }).addTo(map);

      originMarkerRef.current.on('dragend', (e: any) => {
        const { lat, lng } = e.target.getLatLng();
        onSelectNode({ id: 'custom_origin', name: 'Custom Origin Pin', lat, lng }, 'origin');
      });
    }

    // Destination Marker (B)
    if (destMarkerRef.current) {
      destMarkerRef.current.setLatLng([destNode.lat, destNode.lng]);
    } else {
      destMarkerRef.current = L.marker([destNode.lat, destNode.lng], {
        icon: createPinIcon('B', '#ba1a1a'),
        draggable: true,
      }).addTo(map);

      destMarkerRef.current.on('dragend', (e: any) => {
        const { lat, lng } = e.target.getLatLng();
        onSelectNode({ id: 'custom_dest', name: 'Custom Destination Pin', lat, lng }, 'dest');
      });
    }
  }, [originNode, destNode]);

  // 3. Update Route Polyline
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove old polylines
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

      // Primary emerald corridor line
      routePolylineRef.current = L.polyline(routeCoordinates, {
        color: '#0d631b',
        weight: 5,
        lineCap: 'round',
        lineJoin: 'round',
        dashArray: '8, 6',
        opacity: 1,
      }).addTo(map);

      // Fit map bounds to view route
      const bounds = L.latLngBounds(routeCoordinates);
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
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
