import { LatLng } from '../types/index.js';
import { RoadGraph } from '../graph/graph.js';
import { findShortestPathAStar } from '../routing/astar.js';
import { haversineDistanceMeters } from '../routing/haversine.js';

export interface MultiStopPoint {
  id: string;
  name?: string;
  lat: number;
  lng: number;
  riderId?: string;
  stopType?: 'pickup' | 'dropoff';
}

export interface MultiStopTourResult {
  orderedStops: MultiStopPoint[];
  initialDistanceM: number;
  optimizedDistanceM: number;
  improvementPct: number;
  iterations: number;
  costMetric?: 'road_graph' | 'haversine_fallback';
}

/**
 * Multi-Stop Pickup Ordering Engine (Module 1 — Step 3.1 & 3.2)
 * Algorithms:
 * 1. Nearest-Neighbour (NN) Construction (using road graph path cost when graph is loaded)
 * 2. 2-opt Local Search Tour Improvement
 */
export class MultiStopOptimizer {
  /**
   * Computes point-to-point travel cost in meters using A* on the road graph
   * when available, falling back to spherical Haversine distance when disconnected.
   */
  public static computePairCostMeters(
    a: MultiStopPoint,
    b: MultiStopPoint,
    graph?: RoadGraph | null
  ): number {
    const activeGraph = graph ?? RoadGraph.activeInstance;
    if (activeGraph && activeGraph.nodeCount > 0) {
      let startNode: string | null = null;
      let endNode: string | null = null;
      let minStartDist = Infinity;
      let minEndDist = Infinity;

      for (const [nodeId, loc] of activeGraph.nodes.entries()) {
        const dStart = haversineDistanceMeters({ lat: a.lat, lng: a.lng }, loc);
        if (dStart < minStartDist) {
          minStartDist = dStart;
          startNode = nodeId;
        }
        const dEnd = haversineDistanceMeters({ lat: b.lat, lng: b.lng }, loc);
        if (dEnd < minEndDist) {
          minEndDist = dEnd;
          endNode = nodeId;
        }
      }

      if (startNode && endNode) {
        if (startNode === endNode) {
          return Math.round(haversineDistanceMeters({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng }));
        }
        const route = findShortestPathAStar(activeGraph, startNode, endNode, { mode: 'distance' });
        if (route && route.distanceM > 0) {
          // Include snap-on / snap-off offsets so distinct nearby points remain distinguishable
          return Math.round(route.distanceM + minStartDist * 0.25 + minEndDist * 0.25);
        }
      }
    }

    return Math.round(
      haversineDistanceMeters(
        { lat: a.lat, lng: a.lng },
        { lat: b.lat, lng: b.lng }
      )
    );
  }

  /**
   * Computes the total path distance for an ordered sequence of stops.
   */
  public static calculateTourDistance(stops: MultiStopPoint[], graph?: RoadGraph | null): number {
    let dist = 0;
    for (let i = 0; i < stops.length - 1; i++) {
      dist += MultiStopOptimizer.computePairCostMeters(stops[i], stops[i + 1], graph);
    }
    return Math.round(dist);
  }

  /**
   * Nearest-Neighbour (NN) Construction Heuristic.
   * Starts at origin and greedily visits the closest unvisited stop.
   */
  public static nearestNeighbourTour(
    origin: MultiStopPoint,
    stops: MultiStopPoint[],
    destination?: MultiStopPoint,
    graph?: RoadGraph | null
  ): MultiStopPoint[] {
    const unvisited = [...stops];
    const tour: MultiStopPoint[] = [origin];
    let current = origin;

    while (unvisited.length > 0) {
      let nearestIdx = 0;
      let minDistance = Infinity;

      for (let i = 0; i < unvisited.length; i++) {
        const d = MultiStopOptimizer.computePairCostMeters(current, unvisited[i], graph);
        if (d < minDistance) {
          minDistance = d;
          nearestIdx = i;
        }
      }

      current = unvisited.splice(nearestIdx, 1)[0];
      tour.push(current);
    }

    if (destination) {
      tour.push(destination);
    }

    return tour;
  }

  /**
   * 2-opt Improvement Heuristic.
   * Repeatedly checks if reversing subsegments [i..k] decreases total distance.
   * Stops when no improving swap exists or maxIterations is reached.
   */
  public static twoOptTour(
    initialTour: MultiStopPoint[],
    maxIterations: number = 50,
    graph?: RoadGraph | null
  ): { tour: MultiStopPoint[]; iterations: number } {
    let tour = [...initialTour];
    let improved = true;
    let iteration = 0;

    // Origin (index 0) and Destination (last index) remain fixed
    const startIndex = 1;
    const endIndex = tour.length - 2;

    if (endIndex <= startIndex) {
      return { tour, iterations: 0 };
    }

    while (improved && iteration < maxIterations) {
      improved = false;
      iteration++;

      for (let i = startIndex; i <= endIndex; i++) {
        for (let k = i + 1; k <= endIndex; k++) {
          const d1 =
            MultiStopOptimizer.computePairCostMeters(tour[i - 1], tour[i], graph) +
            MultiStopOptimizer.computePairCostMeters(tour[k], tour[k + 1], graph);

          const d2 =
            MultiStopOptimizer.computePairCostMeters(tour[i - 1], tour[k], graph) +
            MultiStopOptimizer.computePairCostMeters(tour[i], tour[k + 1], graph);

          if (d2 < d1) {
            // Reverse segment from i to k
            const reversedSegment = tour.slice(i, k + 1).reverse();
            tour = [
              ...tour.slice(0, i),
              ...reversedSegment,
              ...tour.slice(k + 1),
            ];
            improved = true;
            break;
          }
        }
        if (improved) break;
      }
    }

    return { tour, iterations: iteration };
  }

  /**
   * Complete optimization pipeline:
   * 1. Constructs initial tour via Nearest Neighbour.
   * 2. Enhances tour using 2-opt algorithm.
   */
  public static optimizeMultiStopTour(
    origin: MultiStopPoint,
    stops: MultiStopPoint[],
    destination?: MultiStopPoint,
    graph?: RoadGraph | null
  ): MultiStopTourResult {
    const activeGraph = graph ?? RoadGraph.activeInstance;
    const costMetric = activeGraph && activeGraph.nodeCount > 0 ? 'road_graph' : 'haversine_fallback';

    // 1. Initial order (as provided)
    const rawTour = [origin, ...stops, ...(destination ? [destination] : [])];
    const initialDistanceM = MultiStopOptimizer.calculateTourDistance(rawTour, activeGraph);

    // 2. Nearest-Neighbour Construction
    const nnTour = MultiStopOptimizer.nearestNeighbourTour(origin, stops, destination, activeGraph);

    // 3. 2-opt Improvement
    const { tour: optimizedTour, iterations } = MultiStopOptimizer.twoOptTour(nnTour, 50, activeGraph);
    const optimizedDistanceM = MultiStopOptimizer.calculateTourDistance(optimizedTour, activeGraph);

    const improvementPct =
      initialDistanceM > 0
        ? Number((((initialDistanceM - optimizedDistanceM) / initialDistanceM) * 100).toFixed(1))
        : 0;

    return {
      orderedStops: optimizedTour,
      initialDistanceM,
      optimizedDistanceM,
      improvementPct: Math.max(0, improvementPct),
      iterations,
      costMetric,
    };
  }
}
