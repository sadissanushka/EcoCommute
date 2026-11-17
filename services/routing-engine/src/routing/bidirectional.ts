import { RoadGraph } from '../graph/graph.js';
import { LatLng } from '../types/index.js';
import { MinPriorityQueue } from './priorityQueue.js';
import { haversineDistanceMeters } from './haversine.js';

export interface BidirectionalResult {
  distanceM: number;
  etaSeconds: number;
  nodePath: string[];
  path: LatLng[];
  nodesExpanded: number;
}

export interface BidirectionalSearchOptions {
  mode?: 'distance' | 'time';
  maxSpeedKmh?: number;
  useHeuristic?: boolean;
}

/**
 * Bidirectional A* / Dijkstra Shortest Path (Module 1 — Phase 5 Stretch Goal)
 * Runs simultaneous forward search from `startNodeId` and backward search from `targetNodeId`
 * using Ikeda's consistent symmetric potential:
 *   p_f(v) = (h(v, target) - h(v, start)) / 2
 *   p_b(v) = -p_f(v)
 * Since p_f(v) + p_b(v) = 0, stopping when topF + topB >= bestCost guarantees 100% optimality.
 */
export function findShortestPathBidirectional(
  graph: RoadGraph,
  startNodeId: string,
  targetNodeId: string,
  options: BidirectionalSearchOptions = { mode: 'distance', useHeuristic: true }
): BidirectionalResult | null {
  const mode = options.mode || 'distance';
  const useHeuristic = options.useHeuristic !== false;
  const maxSpeedKmh = options.maxSpeedKmh || 120;
  const maxSpeedMs = Math.max((maxSpeedKmh * 1000) / 3600, 1.0);

  const startNode = graph.getNode(startNodeId);
  const targetNode = graph.getNode(targetNodeId);
  if (!startNode || !targetNode) {
    return null;
  }

  if (startNodeId === targetNodeId) {
    return {
      distanceM: 0,
      etaSeconds: 0,
      nodePath: [startNodeId],
      path: [{ lat: startNode.lat, lng: startNode.lng }],
      nodesExpanded: 1,
    };
  }

  const potentialF = (nodePos: LatLng): number => {
    if (!useHeuristic) return 0;
    const hT = haversineDistanceMeters(nodePos, targetNode);
    const hS = haversineDistanceMeters(nodePos, startNode);
    const diff = (hT - hS) * 0.5;
    return mode === 'time' ? diff / maxSpeedMs : diff;
  };

  const distF = new Map<string, number>();
  const distB = new Map<string, number>();
  const visitedF = new Set<string>();
  const visitedB = new Set<string>();
  const cameFromF = new Map<string, { prevNodeId: string; edgeDistance: number; edgeTime: number }>();
  const cameFromB = new Map<string, { nextNodeId: string; edgeDistance: number; edgeTime: number }>();

  const pqF = new MinPriorityQueue<string>();
  const pqB = new MinPriorityQueue<string>();

  distF.set(startNodeId, 0);
  distB.set(targetNodeId, 0);
  pqF.push(startNodeId, potentialF(startNode));
  pqB.push(targetNodeId, -potentialF(targetNode));

  let bestCost = Infinity;
  let meetingNode: string | null = null;
  let nodesExpanded = 0;

  while (!pqF.isEmpty() && !pqB.isEmpty()) {
    const topF = pqF.peek()!.priority;
    const topB = pqB.peek()!.priority;

    if (topF + topB >= bestCost) {
      break;
    }

    // Expand whichever frontier has the smaller reduced priority
    if (topF <= topB) {
      const current = pqF.pop()!.item;
      if (visitedF.has(current)) continue;
      visitedF.add(current);
      nodesExpanded++;

      const currentCost = distF.get(current)!;
      if (distB.has(current)) {
        const total = currentCost + distB.get(current)!;
        if (total < bestCost) {
          bestCost = total;
          meetingNode = current;
        }
      }

      for (const neighbor of graph.getNeighbors(current)) {
        const edgeDistance = neighbor.distanceM;
        const speedMs = Math.max((neighbor.speedKmh * 1000) / 3600, 1.0);
        const edgeTime = edgeDistance / speedMs;
        const edgeCost = mode === 'time' ? edgeTime : edgeDistance;
        const newCost = currentCost + edgeCost;

        const prevBest = distF.get(neighbor.targetNodeId);
        if (prevBest === undefined || newCost < prevBest) {
          distF.set(neighbor.targetNodeId, newCost);
          cameFromF.set(neighbor.targetNodeId, {
            prevNodeId: current,
            edgeDistance,
            edgeTime,
          });
          const pos = graph.getNode(neighbor.targetNodeId);
          pqF.push(neighbor.targetNodeId, newCost + (pos ? potentialF(pos) : 0));

          if (distB.has(neighbor.targetNodeId)) {
            const candidate = newCost + distB.get(neighbor.targetNodeId)!;
            if (candidate < bestCost) {
              bestCost = candidate;
              meetingNode = neighbor.targetNodeId;
            }
          }
        }
      }
    } else {
      const current = pqB.pop()!.item;
      if (visitedB.has(current)) continue;
      visitedB.add(current);
      nodesExpanded++;

      const currentCost = distB.get(current)!;
      if (distF.has(current)) {
        const total = distF.get(current)! + currentCost;
        if (total < bestCost) {
          bestCost = total;
          meetingNode = current;
        }
      }

      for (const prevNeighbor of graph.getReverseNeighbors(current)) {
        const edgeDistance = prevNeighbor.distanceM;
        const speedMs = Math.max((prevNeighbor.speedKmh * 1000) / 3600, 1.0);
        const edgeTime = edgeDistance / speedMs;
        const edgeCost = mode === 'time' ? edgeTime : edgeDistance;
        const newCost = currentCost + edgeCost;

        const prevBest = distB.get(prevNeighbor.targetNodeId);
        if (prevBest === undefined || newCost < prevBest) {
          distB.set(prevNeighbor.targetNodeId, newCost);
          cameFromB.set(prevNeighbor.targetNodeId, {
            nextNodeId: current,
            edgeDistance,
            edgeTime,
          });
          const pos = graph.getNode(prevNeighbor.targetNodeId);
          pqB.push(prevNeighbor.targetNodeId, newCost - (pos ? potentialF(pos) : 0));

          if (distF.has(prevNeighbor.targetNodeId)) {
            const candidate = distF.get(prevNeighbor.targetNodeId)! + newCost;
            if (candidate < bestCost) {
              bestCost = candidate;
              meetingNode = prevNeighbor.targetNodeId;
            }
          }
        }
      }
    }
  }

  if (!meetingNode || bestCost === Infinity) {
    return null;
  }

  // Reconstruct forward half: startNodeId -> meetingNode
  const forwardPath: string[] = [];
  let totalDistanceM = 0;
  let totalEtaSeconds = 0;

  let curr: string | undefined = meetingNode;
  while (curr !== undefined) {
    forwardPath.unshift(curr);
    const step = cameFromF.get(curr);
    if (step) {
      totalDistanceM += step.edgeDistance;
      totalEtaSeconds += step.edgeTime;
      curr = step.prevNodeId;
    } else {
      break;
    }
  }

  // Reconstruct backward half: meetingNode -> targetNodeId
  const backwardPath: string[] = [];
  let backCurr: string | undefined = meetingNode;
  while (backCurr !== undefined) {
    const step = cameFromB.get(backCurr);
    if (step) {
      totalDistanceM += step.edgeDistance;
      totalEtaSeconds += step.edgeTime;
      backwardPath.push(step.nextNodeId);
      backCurr = step.nextNodeId;
    } else {
      break;
    }
  }

  const nodePath = [...forwardPath, ...backwardPath];
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

