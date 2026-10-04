import { RoadGraph } from '../src/graph/graph.js';
import { findShortestPathDijkstra } from '../src/routing/dijkstra.js';

describe('Dijkstra Routing Engine', () => {
  let graph: RoadGraph;

  beforeEach(() => {
    graph = new RoadGraph();

    // Node A (Origin): 6.9271, 79.8612 (Colombo Fort)
    graph.addNode({ id: '1', lat: 6.9271, lng: 79.8612 });
    // Node B (Intermediate): 6.9250, 79.8630
    graph.addNode({ id: '2', lat: 6.9250, lng: 79.8630 });
    // Node C (Destination): 6.9200, 79.8650 (Galle Face)
    graph.addNode({ id: '3', lat: 6.9200, lng: 79.8650 });
    // Node D (Alternative longer path)
    graph.addNode({ id: '4', lat: 6.9300, lng: 79.8700 });
    // Node E (Isolated disconnected node)
    graph.addNode({ id: '99', lat: 7.2906, lng: 80.6337 }); // Kandy

    // Edges:
    // 1 -> 2 (distance: 500m, speed: 40 km/h, bidirectional)
    graph.addEdge({
      id: 'e1',
      source: '1',
      target: '2',
      distanceM: 500,
      speedKmh: 40,
      isOneway: false,
    });

    // 2 -> 3 (distance: 600m, speed: 40 km/h, bidirectional)
    graph.addEdge({
      id: 'e2',
      source: '2',
      target: '3',
      distanceM: 600,
      speedKmh: 40,
      isOneway: false,
    });

    // 1 -> 4 (distance: 800m, speed: 80 km/h, bidirectional - highway bypass)
    graph.addEdge({
      id: 'e3',
      source: '1',
      target: '4',
      distanceM: 800,
      speedKmh: 80,
      isOneway: false,
    });

    // 4 -> 3 (distance: 700m, speed: 80 km/h, bidirectional - highway bypass)
    graph.addEdge({
      id: 'e4',
      source: '4',
      target: '3',
      distanceM: 700,
      speedKmh: 80,
      isOneway: false,
    });
  });

  test('calculates shortest path by distance', () => {
    // 1 -> 2 -> 3 is 500 + 600 = 1100m
    // 1 -> 4 -> 3 is 800 + 700 = 1500m
    const result = findShortestPathDijkstra(graph, '1', '3', { mode: 'distance' });

    expect(result).not.toBeNull();
    expect(result!.distanceM).toBe(1100);
    expect(result!.nodePath).toEqual(['1', '2', '3']);
    expect(result!.path.length).toBe(3);
    expect(result!.nodesExpanded).toBeGreaterThan(0);
  });

  test('calculates fastest path by time when highway has higher speed', () => {
    // 1 -> 2 -> 3: 500m / (40km/h) + 600m / (40km/h) = 1100m / (11.11 m/s) = 99s
    // 1 -> 4 -> 3: 800m / (80km/h) + 700m / (80km/h) = 1500m / (22.22 m/s) = 67.5s (faster!)
    const result = findShortestPathDijkstra(graph, '1', '3', { mode: 'time' });

    expect(result).not.toBeNull();
    expect(result!.nodePath).toEqual(['1', '4', '3']);
    expect(result!.etaSeconds).toBeLessThan(99);
  });

  test('respects one-way edge constraints', () => {
    const onewayGraph = new RoadGraph();
    onewayGraph.addNode({ id: '10', lat: 6.9, lng: 79.8 });
    onewayGraph.addNode({ id: '20', lat: 6.91, lng: 79.81 });

    // Edge 10 -> 20 is oneway=true
    onewayGraph.addEdge({
      id: 'oe1',
      source: '10',
      target: '20',
      distanceM: 300,
      speedKmh: 50,
      isOneway: true,
    });

    // 10 to 20 should succeed
    const forward = findShortestPathDijkstra(onewayGraph, '10', '20');
    expect(forward).not.toBeNull();
    expect(forward!.nodePath).toEqual(['10', '20']);

    // 20 to 10 should fail (cannot traverse one-way in reverse)
    const reverse = findShortestPathDijkstra(onewayGraph, '20', '10');
    expect(reverse).toBeNull();
  });

  test('handles disconnected graph gracefully without throwing', () => {
    const result = findShortestPathDijkstra(graph, '1', '99');
    expect(result).toBeNull();
  });

  test('handles origin equals destination', () => {
    const result = findShortestPathDijkstra(graph, '1', '1');
    expect(result).not.toBeNull();
    expect(result!.distanceM).toBe(0);
    expect(result!.etaSeconds).toBe(0);
    expect(result!.nodePath).toEqual(['1']);
  });
});
