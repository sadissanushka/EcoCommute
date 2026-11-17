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
  geometry?: [number, number][];
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
  {
    u: 'fort',
    v: 'galle_face',
    dist: 1600,
    speed: 45,
    geometry: [
      [6.9344, 79.8428],
      [6.9325, 79.8442],
      [6.9301, 79.8452],
      [6.9275, 79.8456],
      [6.9248, 79.8468],
      [6.922, 79.849],
    ],
  },
  {
    u: 'galle_face',
    v: 'kollupitiya',
    dist: 1800,
    speed: 50,
    geometry: [
      [6.922, 79.849],
      [6.9188, 79.8482],
      [6.9154, 79.8485],
      [6.9118, 79.8492],
      [6.909, 79.8501],
      [6.9065, 79.851],
    ],
  },
  {
    u: 'kollupitiya',
    v: 'bambalapitiya',
    dist: 1700,
    speed: 45,
    geometry: [
      [6.9065, 79.851],
      [6.9032, 79.852],
      [6.8995, 79.8531],
      [6.8958, 79.8541],
      [6.892, 79.855],
    ],
  },
  {
    u: 'kollupitiya',
    v: 'cinnamon_gardens',
    dist: 2200,
    speed: 40,
    geometry: [
      [6.9065, 79.851],
      [6.9092, 79.8538],
      [6.9122, 79.8576],
      [6.9138, 79.862],
      [6.9102, 79.8655],
      [6.907, 79.8682],
      [6.905, 79.87],
    ],
  },
  {
    u: 'fort',
    v: 'borella',
    dist: 4300,
    speed: 45,
    geometry: [
      [6.9344, 79.8428],
      [6.9332, 79.8475],
      [6.9308, 79.855],
      [6.9285, 79.8635],
      [6.9245, 79.8695],
      [6.9195, 79.8748],
      [6.915, 79.878],
    ],
  },
  {
    u: 'cinnamon_gardens',
    v: 'borella',
    dist: 1500,
    speed: 40,
    geometry: [
      [6.905, 79.87],
      [6.9082, 79.8722],
      [6.9114, 79.8752],
      [6.915, 79.878],
    ],
  },
  {
    u: 'borella',
    v: 'rajagiriya',
    dist: 2100,
    speed: 50,
    geometry: [
      [6.915, 79.878],
      [6.9142, 79.8812],
      [6.9125, 79.8842],
      [6.9124, 79.8878],
      [6.9108, 79.8902],
      [6.9092, 79.8925],
      [6.909, 79.894],
    ],
  },
  {
    u: 'rajagiriya',
    v: 'battaramulla',
    dist: 3200,
    speed: 55,
    geometry: [
      [6.909, 79.894],
      [6.9095, 79.8978],
      [6.9082, 79.9035],
      [6.905, 79.9095],
      [6.9012, 79.9155],
      [6.898, 79.921],
    ],
  },
  {
    u: 'battaramulla',
    v: 'malabe',
    dist: 3800,
    speed: 55,
    geometry: [
      [6.898, 79.921],
      [6.9005, 79.9285],
      [6.9032, 79.937],
      [6.9052, 79.9455],
      [6.904, 79.954],
    ],
  },
  {
    u: 'bambalapitiya',
    v: 'wellawatte',
    dist: 2100,
    speed: 45,
    geometry: [
      [6.892, 79.855],
      [6.8875, 79.8562],
      [6.883, 79.8573],
      [6.8785, 79.8582],
      [6.874, 79.859],
    ],
  },
  {
    u: 'bambalapitiya',
    v: 'nugegoda',
    dist: 5100,
    speed: 45,
    geometry: [
      [6.892, 79.855],
      [6.8905, 79.862],
      [6.8855, 79.871],
      [6.879, 79.8795],
      [6.873, 79.8875],
      [6.8685, 79.893],
      [6.865, 79.897],
    ],
  },
  {
    u: 'cinnamon_gardens',
    v: 'nugegoda',
    dist: 5400,
    speed: 45,
    geometry: [
      [6.905, 79.87],
      [6.898, 79.8725],
      [6.8905, 79.875],
      [6.881, 79.88],
      [6.8735, 79.8875],
      [6.865, 79.897],
    ],
  },
  {
    u: 'wellawatte',
    v: 'dehiwala',
    dist: 2500,
    speed: 45,
    geometry: [
      [6.874, 79.859],
      [6.8685, 79.8602],
      [6.863, 79.8615],
      [6.8575, 79.8628],
      [6.852, 79.864],
    ],
  },
  {
    u: 'dehiwala',
    v: 'mount_lavinia',
    dist: 1900,
    speed: 45,
    geometry: [
      [6.852, 79.864],
      [6.8475, 79.8648],
      [6.843, 79.8656],
      [6.839, 79.8663],
      [6.835, 79.867],
    ],
  },
  {
    u: 'mount_lavinia',
    v: 'ratmalana',
    dist: 1800,
    speed: 50,
    geometry: [
      [6.835, 79.867],
      [6.831, 79.8684],
      [6.827, 79.8698],
      [6.8235, 79.8715],
      [6.82, 79.873],
    ],
  },
  {
    u: 'ratmalana',
    v: 'moratuwa_town',
    dist: 5300,
    speed: 50,
    geometry: [
      [6.82, 79.873],
      [6.81, 79.8758],
      [6.798, 79.8785],
      [6.786, 79.8805],
      [6.773, 79.882],
    ],
  },
  {
    u: 'ratmalana',
    v: 'uom',
    dist: 3900,
    speed: 40,
    geometry: [
      [6.82, 79.873],
      [6.812, 79.8755],
      [6.8035, 79.8782],
      [6.7985, 79.8815],
      [6.7975, 79.891],
      [6.7969, 79.9018],
    ],
  },
  {
    u: 'moratuwa_town',
    v: 'uom',
    dist: 3100,
    speed: 40,
    geometry: [
      [6.773, 79.882],
      [6.782, 79.8812],
      [6.7915, 79.881],
      [6.7978, 79.8835],
      [6.7972, 79.8925],
      [6.7969, 79.9018],
    ],
  },
  {
    u: 'nugegoda',
    v: 'maharagama',
    dist: 3800,
    speed: 50,
    geometry: [
      [6.865, 79.897],
      [6.8605, 79.9045],
      [6.856, 79.9125],
      [6.8515, 79.92],
      [6.848, 79.927],
    ],
  },
  {
    u: 'maharagama',
    v: 'kottawa',
    dist: 4200,
    speed: 55,
    geometry: [
      [6.848, 79.927],
      [6.8462, 79.9365],
      [6.8445, 79.9465],
      [6.8428, 79.956],
      [6.841, 79.965],
    ],
  },
  {
    u: 'kottawa',
    v: 'homagama',
    dist: 4500,
    speed: 60,
    geometry: [
      [6.841, 79.965],
      [6.8412, 79.9745],
      [6.8415, 79.984],
      [6.8418, 79.993],
      [6.842, 80.002],
    ],
  },
  {
    u: 'kottawa',
    v: 'uom',
    dist: 8900,
    speed: 55,
    geometry: [
      [6.841, 79.965],
      [6.831, 79.952],
      [6.818, 79.937],
      [6.805, 79.921],
      [6.799, 79.911],
      [6.7969, 79.9018],
    ],
  },
  {
    u: 'rajagiriya',
    v: 'nugegoda',
    dist: 5200,
    speed: 45,
    geometry: [
      [6.909, 79.894],
      [6.9015, 79.892],
      [6.8915, 79.8895],
      [6.881, 79.8905],
      [6.8725, 79.8935],
      [6.865, 79.897],
    ],
  },
  {
    u: 'battaramulla',
    v: 'kottawa',
    dist: 7800,
    speed: 60,
    geometry: [
      [6.898, 79.921],
      [6.888, 79.927],
      [6.876, 79.9345],
      [6.862, 79.9445],
      [6.8505, 79.9555],
      [6.841, 79.965],
    ],
  },
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
function buildAdjacencyList(): Map<
  string,
  { target: string; dist: number; duration: number; geometry?: [number, number][] }[]
> {
  const adj = new Map<
    string,
    { target: string; dist: number; duration: number; geometry?: [number, number][] }[]
  >();
  for (const key of Object.keys(COLOMBO_NODES)) {
    adj.set(key, []);
  }

  for (const edge of COLOMBO_EDGES) {
    const speedMs = (edge.speed * 1000) / 3600;
    const durationSec = edge.dist / speedMs;

    adj.get(edge.u)?.push({
      target: edge.v,
      dist: edge.dist,
      duration: durationSec,
      geometry: edge.geometry,
    });
    if (!edge.oneway) {
      adj.get(edge.v)?.push({
        target: edge.u,
        dist: edge.dist,
        duration: durationSec,
        geometry: edge.geometry ? [...edge.geometry].reverse() : undefined,
      });
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
  const coordinates: [number, number][] = [];

  for (let i = 0; i < pathIds.length - 1; i++) {
    const u = pathIds[i];
    const v = pathIds[i + 1];
    const edge = (graphAdjacency.get(u) || []).find((e) => e.target === v);
    const segmentCoords: [number, number][] =
      edge?.geometry && edge.geometry.length >= 2
        ? edge.geometry
        : [
            [COLOMBO_NODES[u].lat, COLOMBO_NODES[u].lng],
            [COLOMBO_NODES[v].lat, COLOMBO_NODES[v].lng],
          ];

    for (const pt of segmentCoords) {
      if (
        coordinates.length === 0 ||
        coordinates[coordinates.length - 1][0] !== pt[0] ||
        coordinates[coordinates.length - 1][1] !== pt[1]
      ) {
        coordinates.push(pt);
      }
    }
  }

  if (coordinates.length === 0 && pathNodes.length > 0) {
    coordinates.push([pathNodes[0].lat, pathNodes[0].lng]);
  }

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
