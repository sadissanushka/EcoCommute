/**
 * EcoCommute - Module 1: In-Memory Road Graph & Routing Engine
 * Author: Anushka Thisera (sadissanushka <ssinindu@gmail.com>)
 * Features: Dijkstra & A* Pathfinding, Snap-to-Graph, Haversine Geometry
 */

export interface RoadNode {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface RoadEdge {
  u: string;
  v: string;
  dist: number; // in meters
  speed: number; // km/h
  oneway?: boolean;
}

export interface CorridorPreset {
  id: string;
  name: string;
  desc: string;
  originNode: string;
  destNode: string;
}

export interface RouteResult {
  pathNodes: RoadNode[];
  coordinates: [number, number][]; // [lat, lng] for Leaflet
  distanceMeters: number;
  durationSeconds: number;
  co2SavedKg: number;
  nodesExpanded: number;
  algorithm: 'Dijkstra' | 'A*';
}

// Realistic Colombo & Western Corridor Road Network (Module 1)
export const COLOMBO_NODES: Record<string, RoadNode> = {
  fort: { id: 'fort', name: 'Colombo Fort (CBD Gate 1)', lat: 6.9344, lng: 79.8428 },
  galle_face: { id: 'galle_face', name: 'Galle Face Center Rd', lat: 6.9220, lng: 79.8490 },
  kollupitiya: { id: 'kollupitiya', name: 'Kollupitiya Junction', lat: 6.9065, lng: 79.8510 },
  cinnamon_gardens: { id: 'cinnamon_gardens', name: 'Colombo 07 (Cinnamon Gardens)', lat: 6.9050, lng: 79.8700 },
  bambalapitiya: { id: 'bambalapitiya', name: 'Bambalapitiya Junction', lat: 6.8920, lng: 79.8550 },
  borella: { id: 'borella', name: 'Borella Junction', lat: 6.9150, lng: 79.8780 },
  rajagiriya: { id: 'rajagiriya', name: 'Rajagiriya Gateway', lat: 6.9090, lng: 79.8940 },
  battaramulla: { id: 'battaramulla', name: 'Battaramulla IT/Admin Hub', lat: 6.8980, lng: 79.9210 },
  wellawatte: { id: 'wellawatte', name: 'Wellawatte Canal Corridor', lat: 6.8740, lng: 79.8590 },
  nugegoda: { id: 'nugegoda', name: 'Nugegoda Flyover', lat: 6.8650, lng: 79.8970 },
  dehiwala: { id: 'dehiwala', name: 'Dehiwala Marine Drive', lat: 6.8520, lng: 79.8640 },
  mount_lavinia: { id: 'mount_lavinia', name: 'Mount Lavinia Hotel Rd', lat: 6.8350, lng: 79.8670 },
  ratmalana: { id: 'ratmalana', name: 'Ratmalana Airport Hub', lat: 6.8200, lng: 79.8730 },
  maharagama: { id: 'maharagama', name: 'Maharagama Clock Tower', lat: 6.8480, lng: 79.9270 },
  kottawa: { id: 'kottawa', name: 'Kottawa Expressway Hub', lat: 6.8410, lng: 79.9650 },
  moratuwa_town: { id: 'moratuwa_town', name: 'Moratuwa Town Cross', lat: 6.7730, lng: 79.8820 },
  uom: { id: 'uom', name: 'University of Moratuwa (Katubedda)', lat: 6.7969, lng: 79.9018 },
  malabe: { id: 'malabe', name: 'Malabe Tech Horizon', lat: 6.9040, lng: 79.9540 },
  homagama: { id: 'homagama', name: 'Homagama Green Tech City', lat: 6.8420, lng: 80.0020 },
};

export const COLOMBO_EDGES: RoadEdge[] = [
  { u: 'fort', v: 'galle_face', dist: 1600, speed: 45 },
  { u: 'galle_face', v: 'kollupitiya', dist: 1800, speed: 50 },
  { u: 'kollupitiya', v: 'bambalapitiya', dist: 1700, speed: 45 },
  { u: 'kollupitiya', v: 'cinnamon_gardens', dist: 2200, speed: 40 },
  { u: 'fort', v: 'borella', dist: 4300, speed: 45 },
  { u: 'cinnamon_gardens', v: 'borella', dist: 1500, speed: 40 },
  { u: 'borella', v: 'rajagiriya', dist: 2100, speed: 50 },
  { u: 'rajagiriya', v: 'battaramulla', dist: 3200, speed: 55 },
  { u: 'battaramulla', v: 'malabe', dist: 3800, speed: 55 },
  { u: 'bambalapitiya', v: 'wellawatte', dist: 2100, speed: 45 },
  { u: 'bambalapitiya', v: 'nugegoda', dist: 5100, speed: 45 },
  { u: 'cinnamon_gardens', v: 'nugegoda', dist: 5400, speed: 45 },
  { u: 'wellawatte', v: 'dehiwala', dist: 2500, speed: 45 },
  { u: 'dehiwala', v: 'mount_lavinia', dist: 1900, speed: 45 },
  { u: 'mount_lavinia', v: 'ratmalana', dist: 1800, speed: 50 },
  { u: 'ratmalana', v: 'moratuwa_town', dist: 5300, speed: 50 },
  { u: 'ratmalana', v: 'uom', dist: 3900, speed: 40 },
  { u: 'moratuwa_town', v: 'uom', dist: 3100, speed: 40 },
  { u: 'nugegoda', v: 'maharagama', dist: 3800, speed: 50 },
  { u: 'maharagama', v: 'kottawa', dist: 4200, speed: 55 },
  { u: 'kottawa', v: 'homagama', dist: 4500, speed: 60 },
  { u: 'kottawa', v: 'uom', dist: 8900, speed: 55 },
  { u: 'rajagiriya', v: 'nugegoda', dist: 5200, speed: 45 },
  { u: 'battaramulla', v: 'kottawa', dist: 7800, speed: 60 },
];

export const CORRIDOR_PRESETS: CorridorPreset[] = [
  {
    id: 'corridor-1',
    name: 'Fort CBD ➔ Moratuwa UoM',
    desc: 'Galle Road coastal commuter arterial (18.2 km)',
    originNode: 'fort',
    destNode: 'uom',
  },
  {
    id: 'corridor-2',
    name: 'Bambalapitiya ➔ Battaramulla',
    desc: 'Marine arterial to administrative capital (10.4 km)',
    originNode: 'bambalapitiya',
    destNode: 'battaramulla',
  },
  {
    id: 'corridor-3',
    name: 'Dehiwala ➔ Colombo 07',
    desc: 'Suburban commuter to Cinnamon Gardens (9.8 km)',
    originNode: 'dehiwala',
    destNode: 'cinnamon_gardens',
  },
  {
    id: 'corridor-4',
    name: 'Kottawa ➔ Fort CBD',
    desc: 'High-speed expressway inbound corridor (19.4 km)',
    originNode: 'kottawa',
    destNode: 'fort',
  },
];

// Haversine distance in meters
export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Snaps any clicked coordinate on the map to the nearest intersection
export function findNearestNode(lat: number, lng: number): RoadNode {
  let closest = Object.values(COLOMBO_NODES)[0];
  let minDistance = Infinity;

  for (const node of Object.values(COLOMBO_NODES)) {
    const dist = haversineMeters(lat, lng, node.lat, node.lng);
    if (dist < minDistance) {
      minDistance = dist;
      closest = node;
    }
  }

  return closest;
}

// Graph Adjacency List Builder
function buildAdjacencyList(): Map<string, { target: string; dist: number; duration: number }[]> {
  const adj = new Map<string, { target: string; dist: number; duration: number }[]>();
  for (const key of Object.keys(COLOMBO_NODES)) {
    adj.set(key, []);
  }

  for (const edge of COLOMBO_EDGES) {
    const speedMs = (edge.speed * 1000) / 3600;
    const durationSec = edge.dist / speedMs;

    adj.get(edge.u)?.push({ target: edge.v, dist: edge.dist, duration: durationSec });
    if (!edge.oneway) {
      adj.get(edge.v)?.push({ target: edge.u, dist: edge.dist, duration: durationSec });
    }
  }

  return adj;
}

const graphAdjacency = buildAdjacencyList();

// Dijkstra Shortest Path Search
export function findShortestPath(
  startId: string,
  endId: string,
  useAStar: boolean = true
): RouteResult {
  const distances = new Map<string, number>();
  const previous = new Map<string, string | null>();
  const visited = new Set<string>();

  for (const key of Object.keys(COLOMBO_NODES)) {
    distances.set(key, Infinity);
    previous.set(key, null);
  }

  distances.set(startId, 0);

  // Priority queue simulated via sorted array for lightweight bundle
  const queue: { id: string; priority: number }[] = [{ id: startId, priority: 0 }];
  let nodesExpanded = 0;

  const targetNode = COLOMBO_NODES[endId];

  while (queue.length > 0) {
    queue.sort((a, b) => a.priority - b.priority);
    const { id: current } = queue.shift()!;

    if (visited.has(current)) continue;
    visited.add(current);
    nodesExpanded++;

    if (current === endId) break;

    const neighbors = graphAdjacency.get(current) || [];
    const currentDist = distances.get(current) || 0;

    for (const neighbor of neighbors) {
      if (visited.has(neighbor.target)) continue;

      const alt = currentDist + neighbor.dist;
      if (alt < (distances.get(neighbor.target) || Infinity)) {
        distances.set(neighbor.target, alt);
        previous.set(neighbor.target, current);

        let priority = alt;
        if (useAStar && targetNode) {
          const neighborNode = COLOMBO_NODES[neighbor.target];
          // Admissible Haversine Heuristic
          const h = haversineMeters(neighborNode.lat, neighborNode.lng, targetNode.lat, targetNode.lng);
          priority = alt + h;
        }

        queue.push({ id: neighbor.target, priority });
      }
    }
  }

  // Reconstruct path
  const pathIds: string[] = [];
  let curr: string | null = endId;
  while (curr !== null) {
    pathIds.unshift(curr);
    curr = previous.get(curr) || null;
  }

  const pathNodes = pathIds.map((id) => COLOMBO_NODES[id]).filter(Boolean);
  const coordinates: [number, number][] = pathNodes.map((n) => [n.lat, n.lng]);

  const totalDist = distances.get(endId) || 0;
  const avgSpeedMs = (48 * 1000) / 3600; // ~48 km/h average
  const totalDuration = totalDist / avgSpeedMs;

  // DEFRA 2024 Avoided CO2 metric (0.171 kg CO2e / km vs 70% shuttle reduction)
  const co2SavedKg = Number(((totalDist / 1000) * 0.171 * 0.72).toFixed(2));

  return {
    pathNodes,
    coordinates,
    distanceMeters: totalDist,
    durationSeconds: Math.round(totalDuration),
    co2SavedKg,
    nodesExpanded,
    algorithm: useAStar ? 'A*' : 'Dijkstra',
  };
}

// Generate smooth spline waypoints along polyline for realistic vehicle animation
export function generateInterpolatedPath(
  coords: [number, number][],
  samplesPerSegment: number = 8
): [number, number][] {
  if (coords.length < 2) return coords;

  const result: [number, number][] = [];
  for (let i = 0; i < coords.length - 1; i++) {
    const [lat1, lng1] = coords[i];
    const [lat2, lng2] = coords[i + 1];

    for (let step = 0; step < samplesPerSegment; step++) {
      const t = step / samplesPerSegment;
      result.push([lat1 + (lat2 - lat1) * t, lng1 + (lng2 - lng1) * t]);
    }
  }

  result.push(coords[coords.length - 1]);
  return result;
}

// Creates a custom location from map click or user search
export function createCustomLocation(name: string, lat: number, lng: number): RoadNode {
  const nearest = findNearestNode(lat, lng);
  const id = `custom_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  return {
    id,
    name,
    lat,
    lng,
    nearestNodeId: nearest.id,
  } as RoadNode;
}

// Multi-Stop Route Finder: Calculates shortest path across N custom locations
export function findMultiStopRoute(
  stops: RoadNode[],
  useAStar: boolean = true
): RouteResult {
  if (stops.length < 2) {
    return {
      pathNodes: stops,
      coordinates: stops.map((s) => [s.lat, s.lng]),
      distanceMeters: 0,
      durationSeconds: 0,
      co2SavedKg: 0,
      nodesExpanded: 0,
      algorithm: useAStar ? 'A*' : 'Dijkstra',
    };
  }

  let totalDist = 0;
  let totalDuration = 0;
  let totalNodesExpanded = 0;
  const combinedCoordinates: [number, number][] = [];
  const combinedPathNodes: RoadNode[] = [];

  for (let i = 0; i < stops.length - 1; i++) {
    const fromStop = stops[i];
    const toStop = stops[i + 1];

    const fromId =
      (fromStop as any).nearestNodeId ||
      (COLOMBO_NODES[fromStop.id]
        ? fromStop.id
        : findNearestNode(fromStop.lat, fromStop.lng).id);
    const toId =
      (toStop as any).nearestNodeId ||
      (COLOMBO_NODES[toStop.id]
        ? toStop.id
        : findNearestNode(toStop.lat, toStop.lng).id);

    const leg = findShortestPath(fromId, toId, useAStar);

    totalDist += leg.distanceMeters;
    totalDuration += leg.durationSeconds;
    totalNodesExpanded += leg.nodesExpanded;

    const legCoords: [number, number][] = [
      [fromStop.lat, fromStop.lng],
      ...leg.coordinates,
      [toStop.lat, toStop.lng],
    ];

    for (let c = 0; c < legCoords.length; c++) {
      if (
        combinedCoordinates.length === 0 ||
        combinedCoordinates[combinedCoordinates.length - 1][0] !== legCoords[c][0] ||
        combinedCoordinates[combinedCoordinates.length - 1][1] !== legCoords[c][1]
      ) {
        combinedCoordinates.push(legCoords[c]);
      }
    }

    if (i === 0) {
      combinedPathNodes.push(fromStop);
    }
    combinedPathNodes.push(
      ...leg.pathNodes.filter((n) => n.id !== fromId && n.id !== toId)
    );
    combinedPathNodes.push(toStop);
  }

  const co2SavedKg = Number(((totalDist / 1000) * 0.171 * 0.72).toFixed(2));

  return {
    pathNodes: combinedPathNodes,
    coordinates: combinedCoordinates,
    distanceMeters: totalDist,
    durationSeconds: totalDuration,
    co2SavedKg,
    nodesExpanded: totalNodesExpanded,
    algorithm: useAStar ? 'A*' : 'Dijkstra',
  };
}
