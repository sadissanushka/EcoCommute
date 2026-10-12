import { RoadGraph } from '../src/graph/graph.js';
import { findShortestPathDijkstra } from '../src/routing/dijkstra.js';
import { findShortestPathAStar } from '../src/routing/astar.js';

describe('A* Routing Engine', () => {
  let graph: RoadGraph;

  beforeEach(() => {
    graph = new RoadGraph();

    // Node A (Origin): 6.9271, 79.8612 (Colombo Fort)
    graph.addNode({ id: '1', lat: 6.9271, lng: 79.8612 });
    // Node B (Intermediate): 6.9250, 79.8630
    graph.addNode({ id: '2', lat: 6.9250, lng: 79.8630 });
    // Node C (Destination): 6.9200, 79.8650 (Galle Face)
    graph.addNode({ id: '3', lat: 6.9200, lng: 79.8650 });
    // Node D (Alternative longer detour)
    graph.addNode({ id: '4', lat: 6.9300, lng: 79.8700 });
    // Node E (Far isolated disconnected node)
    graph.addNode({ id: '99', lat: 7.2906, lng: 80.6337 }); // Kandy

    // Edges:
    // 1 -> 2 (500m, 40 km/h)
    graph.addEdge({
      id: 'e1',
      source: '1',
      target: '2',
      distanceM: 500,
      speedKmh: 40,
      isOneway: false,
    });

    // 2 -> 3 (600m, 40 km/h)
    graph.addEdge({
      id: 'e2',
      source: '2',
      target: '3',
      distanceM: 600,
      speedKmh: 40,
      isOneway: false,
    });

    // 1 -> 4 (800m, 80 km/h - bypass)
    graph.addEdge({
      id: 'e3',
      source: '1',
      target: '4',
      distanceM: 800,
      speedKmh: 80,
      isOneway: false,
    });

    // 4 -> 3 (700m, 80 km/h - bypass)
    graph.addEdge({
      id: 'e4',
      source: '4',
      target: '3',
      distanceM: 700,
      speedKmh: 80,
      isOneway: false,
    });
  });

  test('calculates optimal shortest path by distance', () => {
    const astarResult = findShortestPathAStar(graph, '1', '3', { mode: 'distance' });
    const dijkstraResult = findShortestPathDijkstra(graph, '1', '3', { mode: 'distance' });

    expect(astarResult).not.toBeNull();
    expect(dijkstraResult).not.toBeNull();
    expect(astarResult!.distanceM).toBe(1100);
    // Path optimality matches Dijkstra
    expect(astarResult!.distanceM).toBe(dijkstraResult!.distanceM);
    expect(astarResult!.nodePath).toEqual(['1', '2', '3']);
    expect(astarResult!.path.length).toBe(3);
  });

  test('calculates fastest path by time considering road speed limits', () => {
    const astarResult = findShortestPathAStar(graph, '1', '3', { mode: 'time' });
    const dijkstraResult = findShortestPathDijkstra(graph, '1', '3', { mode: 'time' });

    expect(astarResult).not.toBeNull();
    expect(dijkstraResult).not.toBeNull();
    // 1 -> 4 -> 3 is faster at 80 km/h
    expect(astarResult!.nodePath).toEqual(['1', '4', '3']);
    expect(astarResult!.etaSeconds).toBe(dijkstraResult!.etaSeconds);
  });

  test('expands fewer or equal nodes compared to Dijkstra on a grid network', () => {
    // Construct a 4x4 coordinate grid
    const gridGraph = new RoadGraph();
    const rows = 4;
    const cols = 4;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const id = `${r}_${c}`;
        gridGraph.addNode({
          id,
          lat: 6.9000 + r * 0.005,
          lng: 79.8500 + c * 0.005,
        });
      }
    }

    // Connect adjacent grid cells horizontally and vertically
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const curr = `${r}_${c}`;
        if (r + 1 < rows) {
          const down = `${r + 1}_${c}`;
          gridGraph.addEdge({
            id: `v_${curr}_${down}`,
            source: curr,
            target: down,
            distanceM: 550,
            speedKmh: 40,
            isOneway: false,
          });
        }
        if (c + 1 < cols) {
          const right = `${r}_${c + 1}`;
          gridGraph.addEdge({
            id: `h_${curr}_${right}`,
            source: curr,
            target: right,
            distanceM: 550,
            speedKmh: 40,
            isOneway: false,
          });
        }
      }
    }

    const startId = '0_0';
    const goalId = '3_3';

    const dijkstraResult = findShortestPathDijkstra(gridGraph, startId, goalId, { mode: 'distance' });
    const astarResult = findShortestPathAStar(gridGraph, startId, goalId, { mode: 'distance' });

    expect(dijkstraResult).not.toBeNull();
    expect(astarResult).not.toBeNull();
    expect(astarResult!.distanceM).toBe(dijkstraResult!.distanceM);

    // Goal-directed search expands fewer or equal nodes than blind uniform Dijkstra
    expect(astarResult!.nodesExpanded).toBeLessThanOrEqual(dijkstraResult!.nodesExpanded);
  });

  test('respects one-way edge constraints', () => {
    const onewayGraph = new RoadGraph();
    onewayGraph.addNode({ id: '10', lat: 6.9, lng: 79.8 });
    onewayGraph.addNode({ id: '20', lat: 6.91, lng: 79.81 });

    onewayGraph.addEdge({
      id: 'oe1',
      source: '10',
      target: '20',
      distanceM: 300,
      speedKmh: 50,
      isOneway: true,
    });

    // 10 -> 20 should succeed
    const forwardResult = findShortestPathAStar(onewayGraph, '10', '20');
    expect(forwardResult).not.toBeNull();
    expect(forwardResult!.distanceM).toBe(300);

    // 20 -> 10 must fail
    const reverseResult = findShortestPathAStar(onewayGraph, '20', '10');
    expect(reverseResult).toBeNull();
  });

  test('handles disconnected graph gracefully without throwing', () => {
    const unreachable = findShortestPathAStar(graph, '1', '99');
    expect(unreachable).toBeNull();
  });

  test('handles origin equals destination', () => {
    const trivial = findShortestPathAStar(graph, '1', '1');
    expect(trivial).not.toBeNull();
    expect(trivial!.distanceM).toBe(0);
    expect(trivial!.etaSeconds).toBe(0);
    expect(trivial!.nodePath).toEqual(['1']);
  });
});
