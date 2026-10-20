import { LatLng, RoadEdge, RoadNode, SnappedPoint } from '../types/index.js';
import { pool } from './db.js';
import { haversineDistanceMeters } from '../routing/haversine.js';

export interface GraphNeighbor {
  targetNodeId: string;
  distanceM: number;
  speedKmh: number;
  isOneway: boolean;
}

export const COLOMBO_SEED_NODES: RoadNode[] = [
  { id: 'fort', lat: 6.9344, lng: 79.8428 },
  { id: 'galle_face', lat: 6.9220, lng: 79.8490 },
  { id: 'kollupitiya', lat: 6.9065, lng: 79.8510 },
  { id: 'cinnamon_gardens', lat: 6.9050, lng: 79.8700 },
  { id: 'bambalapitiya', lat: 6.8920, lng: 79.8550 },
  { id: 'borella', lat: 6.9150, lng: 79.8780 },
  { id: 'rajagiriya', lat: 6.9090, lng: 79.8940 },
  { id: 'battaramulla', lat: 6.8980, lng: 79.9210 },
  { id: 'wellawatte', lat: 6.8740, lng: 79.8590 },
  { id: 'nugegoda', lat: 6.8650, lng: 79.8970 },
  { id: 'dehiwala', lat: 6.8520, lng: 79.8640 },
  { id: 'mount_lavinia', lat: 6.8350, lng: 79.8670 },
  { id: 'ratmalana', lat: 6.8200, lng: 79.8730 },
  { id: 'maharagama', lat: 6.8480, lng: 79.9270 },
  { id: 'kottawa', lat: 6.8410, lng: 79.9650 },
  { id: 'moratuwa_town', lat: 6.7730, lng: 79.8820 },
  { id: 'uom', lat: 6.7969, lng: 79.9018 },
  { id: 'malabe', lat: 6.9040, lng: 79.9540 },
  { id: 'homagama', lat: 6.8420, lng: 80.0020 },
];

export const COLOMBO_SEED_EDGES: RoadEdge[] = [
  { id: 'e1', source: 'fort', target: 'galle_face', distanceM: 1600, speedKmh: 45, isOneway: false },
  { id: 'e2', source: 'galle_face', target: 'kollupitiya', distanceM: 1800, speedKmh: 50, isOneway: false },
  { id: 'e3', source: 'kollupitiya', target: 'bambalapitiya', distanceM: 1700, speedKmh: 45, isOneway: false },
  { id: 'e4', source: 'kollupitiya', target: 'cinnamon_gardens', distanceM: 2200, speedKmh: 40, isOneway: false },
  { id: 'e5', source: 'fort', target: 'borella', distanceM: 4300, speedKmh: 45, isOneway: false },
  { id: 'e6', source: 'cinnamon_gardens', target: 'borella', distanceM: 1500, speedKmh: 40, isOneway: false },
  { id: 'e7', source: 'borella', target: 'rajagiriya', distanceM: 2100, speedKmh: 50, isOneway: false },
  { id: 'e8', source: 'rajagiriya', target: 'battaramulla', distanceM: 3200, speedKmh: 55, isOneway: false },
  { id: 'e9', source: 'battaramulla', target: 'malabe', distanceM: 3800, speedKmh: 55, isOneway: false },
  { id: 'e10', source: 'bambalapitiya', target: 'wellawatte', distanceM: 2100, speedKmh: 45, isOneway: false },
  { id: 'e11', source: 'bambalapitiya', target: 'nugegoda', distanceM: 5100, speedKmh: 45, isOneway: false },
  { id: 'e12', source: 'cinnamon_gardens', target: 'nugegoda', distanceM: 5400, speedKmh: 45, isOneway: false },
  { id: 'e13', source: 'wellawatte', target: 'dehiwala', distanceM: 2500, speedKmh: 45, isOneway: false },
  { id: 'e14', source: 'dehiwala', target: 'mount_lavinia', distanceM: 1900, speedKmh: 45, isOneway: false },
  { id: 'e15', source: 'mount_lavinia', target: 'ratmalana', distanceM: 1800, speedKmh: 50, isOneway: false },
  { id: 'e16', source: 'ratmalana', target: 'moratuwa_town', distanceM: 5300, speedKmh: 50, isOneway: false },
  { id: 'e17', source: 'ratmalana', target: 'uom', distanceM: 3900, speedKmh: 40, isOneway: false },
  { id: 'e18', source: 'moratuwa_town', target: 'uom', distanceM: 3100, speedKmh: 40, isOneway: false },
  { id: 'e19', source: 'nugegoda', target: 'maharagama', distanceM: 3800, speedKmh: 50, isOneway: false },
  { id: 'e20', source: 'maharagama', target: 'kottawa', distanceM: 4200, speedKmh: 55, isOneway: false },
  { id: 'e21', source: 'kottawa', target: 'homagama', distanceM: 4500, speedKmh: 60, isOneway: false },
  { id: 'e22', source: 'kottawa', target: 'uom', distanceM: 8900, speedKmh: 55, isOneway: false },
  { id: 'e23', source: 'rajagiriya', target: 'nugegoda', distanceM: 5200, speedKmh: 45, isOneway: false },
  { id: 'e24', source: 'battaramulla', target: 'kottawa', distanceM: 7800, speedKmh: 60, isOneway: false },
];

export class RoadGraph {
  public nodes: Map<string, LatLng> = new Map();
  public adjacency: Map<string, GraphNeighbor[]> = new Map();

  public addNode(node: RoadNode): void {
    this.nodes.set(node.id, { lat: node.lat, lng: node.lng });
    if (!this.adjacency.has(node.id)) {
      this.adjacency.set(node.id, []);
    }
  }

  public addEdge(edge: RoadEdge): void {
    if (!this.adjacency.has(edge.source)) {
      this.adjacency.set(edge.source, []);
    }
    this.adjacency.get(edge.source)!.push({
      targetNodeId: edge.target,
      distanceM: edge.distanceM,
      speedKmh: edge.speedKmh,
      isOneway: edge.isOneway,
    });

    if (!edge.isOneway) {
      if (!this.adjacency.has(edge.target)) {
        this.adjacency.set(edge.target, []);
      }
      this.adjacency.get(edge.target)!.push({
        targetNodeId: edge.source,
        distanceM: edge.distanceM,
        speedKmh: edge.speedKmh,
        isOneway: false,
      });
    }
  }

  public getNeighbors(nodeId: string): GraphNeighbor[] {
    return this.adjacency.get(nodeId) || [];
  }

  public getNode(nodeId: string): LatLng | undefined {
    return this.nodes.get(nodeId);
  }

  public get nodeCount(): number {
    return this.nodes.size;
  }

  public get edgeCount(): number {
    let count = 0;
    for (const neighbors of this.adjacency.values()) {
      count += neighbors.length;
    }
    return count;
  }

  public loadColomboSeedNetwork(): void {
    console.log('[Graph] Loading Colombo arterial seed network into memory...');
    for (const n of COLOMBO_SEED_NODES) {
      this.addNode(n);
    }
    for (const e of COLOMBO_SEED_EDGES) {
      this.addEdge(e);
    }
    console.log(`[Graph] In-memory graph ready: ${this.nodeCount} nodes, ${this.edgeCount} directed edges.`);
  }

  /**
   * Load entire graph or region from PostGIS into memory for high-performance routing.
   */
  public async loadFromPostgres(): Promise<void> {
    try {
      console.log('[Graph] Loading nodes from PostGIS...');
      const nodesRes = await pool.query(`
        SELECT id, ST_X(geom) as lng, ST_Y(geom) as lat FROM road_nodes;
      `);
      if (nodesRes.rows.length === 0) {
        throw new Error('road_nodes table is empty');
      }

      for (const row of nodesRes.rows) {
        this.addNode({
          id: String(row.id),
          lat: parseFloat(row.lat),
          lng: parseFloat(row.lng),
        });
      }

      console.log(`[Graph] Loaded ${this.nodes.size} nodes. Loading edges...`);
      const edgesRes = await pool.query(`
        SELECT id, source, target, distance_m, speed_kmh, is_oneway FROM road_edges;
      `);
      for (const row of edgesRes.rows) {
        this.addEdge({
          id: String(row.id),
          source: String(row.source),
          target: String(row.target),
          distanceM: parseFloat(row.distance_m),
          speedKmh: parseFloat(row.speed_kmh),
          isOneway: Boolean(row.is_oneway),
        });
      }
      console.log(`[Graph] Graph ready from PostGIS: ${this.nodeCount} nodes, ${this.edgeCount} directed edges.`);
    } catch (err) {
      console.warn('[Graph] PostGIS query failed or DB unpopulated. Falling back to Colombo seed network:', (err as any).message);
      this.loadColomboSeedNetwork();
    }
  }

  /**
   * In-memory snapping using Haversine formula
   */
  public snapToNearestNodeInMemory(point: LatLng): SnappedPoint | null {
    if (this.nodes.size === 0) return null;
    let closestId: string | null = null;
    let minDistance = Infinity;

    for (const [id, loc] of this.nodes.entries()) {
      const d = haversineDistanceMeters(point, loc);
      if (d < minDistance) {
        minDistance = d;
        closestId = id;
      }
    }

    if (!closestId) return null;
    const loc = this.nodes.get(closestId)!;
    return {
      nodeId: closestId,
      distanceM: Math.round(minDistance),
      location: { lat: loc.lat, lng: loc.lng },
    };
  }

  /**
   * Snap arbitrary GPS coordinates to the nearest road node using PostGIS KNN or in-memory fallback.
   */
  public static async snapToNearestNode(point: LatLng, fallbackGraph?: RoadGraph): Promise<SnappedPoint | null> {
    try {
      const res = await pool.query(
        `SELECT * FROM snap_to_nearest_road_node($1, $2);`,
        [point.lng, point.lat]
      );

      if (res.rows.length > 0) {
        const row = res.rows[0];
        const geomRes = await pool.query(
          `SELECT ST_X(geom) as lng, ST_Y(geom) as lat FROM road_nodes WHERE id = $1;`,
          [row.node_id]
        );
        const geomRow = geomRes.rows[0];

        return {
          nodeId: String(row.node_id),
          distanceM: parseFloat(row.distance_m),
          location: {
            lat: parseFloat(geomRow.lat),
            lng: parseFloat(geomRow.lng),
          },
        };
      }
    } catch {
      // PostGIS not available or failed
    }

    if (fallbackGraph) {
      return fallbackGraph.snapToNearestNodeInMemory(point);
    }
    return null;
  }
}
