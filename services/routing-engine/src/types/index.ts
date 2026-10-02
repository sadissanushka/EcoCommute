export interface LatLng {
  lat: number;
  lng: number;
}

export interface RoadNode {
  id: string; // BIGINT as string to avoid JS 64-bit float precision loss
  lat: number;
  lng: number;
}

export interface RoadEdge {
  id: string;
  source: string;
  target: string;
  distanceM: number;
  speedKmh: number;
  isOneway: boolean;
  geom?: LatLng[];
}

export interface RouteRequest {
  origin: LatLng;
  destination: LatLng;
  mode?: 'distance' | 'time';
  algorithm?: 'dijkstra' | 'astar';
}

export interface RouteResponse {
  distanceM: number;
  etaSeconds: number;
  path: LatLng[];
  nodeCount?: number;
  nodesExpanded?: number;
}

export interface SnappedPoint {
  nodeId: string;
  distanceM: number;
  location: LatLng;
}
