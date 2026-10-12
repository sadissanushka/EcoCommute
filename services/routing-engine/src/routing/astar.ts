import { RoadGraph } from '../graph/graph.js';
import { LatLng } from '../types/index.js';
import { MinPriorityQueue } from './priorityQueue.js';
import { haversineDistanceMeters } from './haversine.js';

export interface AStarResult {
  distanceM: number;
  etaSeconds: number;
  nodePath: string[];
  path: LatLng[];
  nodesExpanded: number;
}

export interface AStarSearchOptions {
  mode?: 'distance' | 'time';
  /** Max assumed speed in km/h for admissible time heuristic (default: 120 km/h) */
  maxSpeedKmh?: number;
}

/**
 * Computes the optimal path between startNodeId and targetNodeId using the A* algorithm
 * with an admissible Haversine distance heuristic.
 */
export function findShortestPathAStar(
  graph: RoadGraph,
  startNodeId: string,
  targetNodeId: string,
  options: AStarSearchOptions = { mode: 'distance' }
): AStarResult | null {
  const mode = options.mode || 'distance';
  const maxSpeedKmh = options.maxSpeedKmh || 120;
  const maxSpeedMs = Math.max((maxSpeedKmh * 1000) / 3600, 1.0);

  const startNode = graph.getNode(startNodeId);
  const targetNode = graph.getNode(targetNodeId);

  if (!startNode || !targetNode) {
    return null;
  }

  // Trivial case: origin is destination
  if (startNodeId === targetNodeId) {
    return {
      distanceM: 0,
      etaSeconds: 0,
      nodePath: [startNodeId],
      path: [{ lat: startNode.lat, lng: startNode.lng }],
      nodesExpanded: 1,
    };
  }

  /**
   * Admissible heuristic h(n):
   * - For 'distance': straight-line haversine distance in meters.
   * - For 'time': haversine distance divided by maximum possible road speed.
   */
  const heuristic = (nodePos: LatLng): number => {
    const distM = haversineDistanceMeters(nodePos, targetNode);
    if (mode === 'time') {
      return distM / maxSpeedMs;
    }
    return distM;
  };

  // gScore: shortest known cost from start to node
  const gScore = new Map<string, number>();
  // cameFrom: track back-pointers and individual edge metrics for path reconstruction
  const cameFrom = new Map<
    string,
    { prevNodeId: string; edgeDistance: number; edgeTime: number }
  >();

  const openSet = new MinPriorityQueue<string>();
  const closedSet = new Set<string>();

  gScore.set(startNodeId, 0);
  const initialH = heuristic(startNode);
  openSet.push(startNodeId, initialH);

  let nodesExpanded = 0;
  let reachedTarget = false;

  while (!openSet.isEmpty()) {
    const currentElem = openSet.pop()!;
    const currentNodeId = currentElem.item;

    if (closedSet.has(currentNodeId)) {
      continue;
    }
    closedSet.add(currentNodeId);

    if (currentNodeId === targetNodeId) {
      reachedTarget = true;
      break;
    }

    nodesExpanded++;

    const currentG = gScore.get(currentNodeId);
    if (currentG === undefined) {
      continue;
    }

    const neighbors = graph.getNeighbors(currentNodeId);
    for (const neighbor of neighbors) {
      const edgeDistance = neighbor.distanceM;
      const speedMs = Math.max((neighbor.speedKmh * 1000) / 3600, 1.0);
      const edgeTime = edgeDistance / speedMs;

      const edgeCost = mode === 'time' ? edgeTime : edgeDistance;
      const tentativeG = currentG + edgeCost;

      const existingG = gScore.get(neighbor.targetNodeId);
      if (existingG === undefined || tentativeG < existingG) {
        gScore.set(neighbor.targetNodeId, tentativeG);
        cameFrom.set(neighbor.targetNodeId, {
          prevNodeId: currentNodeId,
          edgeDistance,
          edgeTime,
        });

        const neighborPos = graph.getNode(neighbor.targetNodeId);
        const h = neighborPos ? heuristic(neighborPos) : 0;
        const fScore = tentativeG + h;

        openSet.push(neighbor.targetNodeId, fScore);
      }
    }
  }

  if (!reachedTarget) {
    return null;
  }

  // Reconstruct path
  const nodePath: string[] = [];
  let curr: string | undefined = targetNodeId;
  let totalDistanceM = 0;
  let totalEtaSeconds = 0;

  while (curr !== undefined) {
    nodePath.unshift(curr);
    const step = cameFrom.get(curr);
    if (step) {
      totalDistanceM += step.edgeDistance;
      totalEtaSeconds += step.edgeTime;
      curr = step.prevNodeId;
    } else {
      break;
    }
  }

  const path: LatLng[] = nodePath.map((id) => {
    const loc = graph.getNode(id)!;
    return { lat: loc.lat, lng: loc.lng };
  });

  return {
    distanceM: Math.round(totalDistanceM * 10) / 10,
    etaSeconds: Math.round(totalEtaSeconds),
    nodePath,
    path,
    nodesExpanded,
  };
}
