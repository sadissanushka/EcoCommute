import { RoadGraph } from '../graph/graph.js';
import { LatLng } from '../types/index.js';
import { MinPriorityQueue } from './priorityQueue.js';

export interface DijkstraResult {
  distanceM: number;
  etaSeconds: number;
  nodePath: string[];
  path: LatLng[];
  nodesExpanded: number;
}

export interface SearchOptions {
  mode?: 'distance' | 'time';
}

export function findShortestPathDijkstra(
  graph: RoadGraph,
  startNodeId: string,
  targetNodeId: string,
  options: SearchOptions = { mode: 'distance' }
): DijkstraResult | null {
  const mode = options.mode || 'distance';

  if (!graph.getNode(startNodeId) || !graph.getNode(targetNodeId)) {
    return null;
  }

  if (startNodeId === targetNodeId) {
    const node = graph.getNode(startNodeId)!;
    return {
      distanceM: 0,
      etaSeconds: 0,
      nodePath: [startNodeId],
      path: [{ lat: node.lat, lng: node.lng }],
      nodesExpanded: 1,
    };
  }

  // Cost map: stores the best known cost (distance or time) from start
  const costSoFar = new Map<string, number>();
  // Predecessor map: stores { prevNodeId, edgeDistance, edgeTime }
  const cameFrom = new Map<
    string,
    { prevNodeId: string; edgeDistance: number; edgeTime: number }
  >();

  const pq = new MinPriorityQueue<string>();

  costSoFar.set(startNodeId, 0);
  pq.push(startNodeId, 0);

  let nodesExpanded = 0;
  let reachedTarget = false;

  while (!pq.isEmpty()) {
    const currentElem = pq.pop()!;
    const currentNodeId = currentElem.item;
    const currentCost = currentElem.priority;

    nodesExpanded++;

    if (currentNodeId === targetNodeId) {
      reachedTarget = true;
      break;
    }

    // Skip if we found a better route already
    if (currentCost > (costSoFar.get(currentNodeId) ?? Infinity)) {
      continue;
    }

    const neighbors = graph.getNeighbors(currentNodeId);
    for (const neighbor of neighbors) {
      const edgeDistance = neighbor.distanceM;
      // time in seconds = distance / (speed in m/s)
      const speedMs = Math.max((neighbor.speedKmh * 1000) / 3600, 1.0);
      const edgeTime = edgeDistance / speedMs;

      const edgeCost = mode === 'time' ? edgeTime : edgeDistance;
      const newCost = currentCost + edgeCost;

      const existingCost = costSoFar.get(neighbor.targetNodeId);
      if (existingCost === undefined || newCost < existingCost) {
        costSoFar.set(neighbor.targetNodeId, newCost);
        cameFrom.set(neighbor.targetNodeId, {
          prevNodeId: currentNodeId,
          edgeDistance,
          edgeTime,
        });
        pq.push(neighbor.targetNodeId, newCost);
      }
    }
  }

  if (!reachedTarget) {
    return null; // Unreachable
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
