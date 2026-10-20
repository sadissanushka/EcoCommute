import { LatLng, RoadEdge, RoadNode, SnappedPoint } from '../types/index.js';
import { pool } from './db.js';
import { haversineDistanceMeters } from '../routing/haversine.js';
import { seedColomboNetworkIntoGraph } from './seedColombo.js';

export interface GraphNeighbor {
  targetNodeId: string;
  distanceM: number;
  speedKmh: number;
  isOneway: boolean;
}

export class RoadGraph {
  public static activeInstance: RoadGraph | null = null;
  public nodes: Map<string, LatLng> = new Map();
  public adjacency: Map<string, GraphNeighbor[]> = new Map();

  constructor() {
    RoadGraph.activeInstance = this;
  }

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

    // If edge is bidirectional, also add reverse edge
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

  /**
   * Load entire graph or region from PostGIS into memory for high-performance routing.
   * If PostGIS is unavailable, loads realistic Colombo arterial network.
   */
  public async loadFromPostgres(): Promise<void> {
    try {
      console.log('[Graph] Attempting to load nodes from PostGIS...');
      const nodesRes = await pool.query(`
        SELECT id, ST_X(geom) as lng, ST_Y(geom) as lat FROM road_nodes;
      `);

      if (nodesRes.rows.length === 0) {
        throw new Error('road_nodes table is empty in PostgreSQL');
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
      console.log(`[Graph] Graph ready: ${this.nodeCount} nodes, ${this.edgeCount} directed edges.`);
    } catch (err) {
      console.warn('[Graph] PostGIS load unavailable or empty. Loading Colombo arterial seed network into memory...');
      seedColomboNetworkIntoGraph(this);
      console.log(`[Graph] In-memory graph ready: ${this.nodeCount} nodes, ${this.edgeCount} directed edges.`);
    }
  }

  /**
   * Snap arbitrary GPS coordinates to the nearest road node using PostGIS KNN
   * with automatic in-memory fallback.
   */
  public static async snapToNearestNode(point: LatLng, graphInstance?: RoadGraph): Promise<SnappedPoint | null> {
    const targetGraph = graphInstance || RoadGraph.activeInstance;

    // 1. Try PostGIS KNN if available
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
        if (geomRes.rows.length > 0) {
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
      }
    } catch {
      // PostGIS query failed or DB disconnected; fall through to in-memory spatial snap
    }

    // 2. In-Memory KNN Snap Fallback using Haversine Distance
    if (!targetGraph || targetGraph.nodes.size === 0) {
      return null;
    }

    let closestNodeId: string | null = null;
    let closestLocation: LatLng = { lat: 0, lng: 0 };
    let minDistanceM = Infinity;

    for (const [nodeId, location] of targetGraph.nodes.entries()) {
      const dist = haversineDistanceMeters(point, location);
      if (dist < minDistanceM) {
        minDistanceM = dist;
        closestNodeId = nodeId;
        closestLocation = location;
      }
    }

    if (closestNodeId) {
      return {
        nodeId: closestNodeId,
        distanceM: Math.round(minDistanceM),
        location: closestLocation,
      };
    }

    return null;
  }
}
