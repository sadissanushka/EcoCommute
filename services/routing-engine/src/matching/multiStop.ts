import { LatLng } from '../types/index.js';
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
}

/**
 * Multi-Stop Pickup Ordering Engine (Module 1 — Step 3.1 & 3.2)
 * Algorithms:
 * 1. Nearest-Neighbour (NN) Construction
 * 2. 2-opt Local Search Tour Improvement
 */
export class MultiStopOptimizer {
  /**
   * Computes the total path distance for an ordered sequence of stops.
   */
  public static calculateTourDistance(stops: MultiStopPoint[]): number {
    let dist = 0;
    for (let i = 0; i < stops.length - 1; i++) {
      dist += haversineDistanceMeters(
        { lat: stops[i].lat, lng: stops[i].lng },
        { lat: stops[i + 1].lat, lng: stops[i + 1].lng }
      );
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
    destination?: MultiStopPoint
  ): MultiStopPoint[] {
    const unvisited = [...stops];
    const tour: MultiStopPoint[] = [origin];
    let current = origin;

    while (unvisited.length > 0) {
      let nearestIdx = 0;
      let minDistance = Infinity;

      for (let i = 0; i < unvisited.length; i++) {
        const d = haversineDistanceMeters(
          { lat: current.lat, lng: current.lng },
          { lat: unvisited[i].lat, lng: unvisited[i].lng }
        );
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
    maxIterations: number = 50
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
            haversineDistanceMeters(
              { lat: tour[i - 1].lat, lng: tour[i - 1].lng },
              { lat: tour[i].lat, lng: tour[i].lng }
            ) +
            haversineDistanceMeters(
              { lat: tour[k].lat, lng: tour[k].lng },
              { lat: tour[k + 1].lat, lng: tour[k + 1].lng }
            );

          const d2 =
            haversineDistanceMeters(
              { lat: tour[i - 1].lat, lng: tour[i - 1].lng },
              { lat: tour[k].lat, lng: tour[k].lng }
            ) +
            haversineDistanceMeters(
              { lat: tour[i].lat, lng: tour[i].lng },
              { lat: tour[k + 1].lat, lng: tour[k + 1].lng }
            );

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
    destination?: MultiStopPoint
  ): MultiStopTourResult {
    // 1. Initial order (as provided or straightforward)
    const rawTour = [origin, ...stops, ...(destination ? [destination] : [])];
    const initialDistanceM = MultiStopOptimizer.calculateTourDistance(rawTour);

    // 2. Nearest-Neighbour Construction
    const nnTour = MultiStopOptimizer.nearestNeighbourTour(origin, stops, destination);

    // 3. 2-opt Improvement
    const { tour: optimizedTour, iterations } = MultiStopOptimizer.twoOptTour(nnTour);
    const optimizedDistanceM = MultiStopOptimizer.calculateTourDistance(optimizedTour);

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
    };
  }
}
