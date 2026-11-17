import request from 'supertest';
import { RoadGraph } from '../src/graph/graph.js';
import { seedColomboNetworkIntoGraph } from '../src/graph/seedColombo.js';
import { findShortestPathDijkstra } from '../src/routing/dijkstra.js';
import { findShortestPathBidirectional } from '../src/routing/bidirectional.js';
import { createServer } from '../src/api/server.js';

describe('Phase 5 Stretch: Bidirectional Search (Dijkstra / A*)', () => {
  test('matches Dijkstra optimality on Colombo road network in both distance and time modes', () => {
    const graph = new RoadGraph();
    seedColomboNetworkIntoGraph(graph);

    const pairs: [string, string][] = [
      ['fort', 'uom'],
      ['malabe', 'fort'],
      ['kottawa', 'wellawatte'],
      ['homagama', 'kollupitiya'],
    ];

    for (const [s, t] of pairs) {
      const dijkDist = findShortestPathDijkstra(graph, s, t, { mode: 'distance' });
      const biDist = findShortestPathBidirectional(graph, s, t, { mode: 'distance' });
      expect(biDist).not.toBeNull();
      expect(biDist!.distanceM).toBe(dijkDist!.distanceM);
      expect(biDist!.nodePath[0]).toBe(s);
      expect(biDist!.nodePath[biDist!.nodePath.length - 1]).toBe(t);

      const dijkTime = findShortestPathDijkstra(graph, s, t, { mode: 'time' });
      const biTime = findShortestPathBidirectional(graph, s, t, { mode: 'time' });
      expect(biTime).not.toBeNull();
      expect(biTime!.etaSeconds).toBe(dijkTime!.etaSeconds);
    }
  });

  test('strictly respects one-way directed edges in backward search', () => {
    const graph = new RoadGraph();
    graph.addNode({ id: 'A', lat: 6.93, lng: 79.84 });
    graph.addNode({ id: 'B', lat: 6.92, lng: 79.85 });
    graph.addNode({ id: 'C', lat: 6.91, lng: 79.86 });

    // One-way A -> B -> C
    graph.addEdge({ id: 'e1', source: 'A', target: 'B', distanceM: 1000, speedKmh: 40, isOneway: true });
    graph.addEdge({ id: 'e2', source: 'B', target: 'C', distanceM: 1000, speedKmh: 40, isOneway: true });

    const forward = findShortestPathBidirectional(graph, 'A', 'C');
    expect(forward).not.toBeNull();
    expect(forward!.distanceM).toBe(2000);

    // Reverse C -> A must be unreachable
    const reverse = findShortestPathBidirectional(graph, 'C', 'A');
    expect(reverse).toBeNull();
  });

  test('handles origin === destination and disconnected nodes gracefully', () => {
    const graph = new RoadGraph();
    graph.addNode({ id: 'A', lat: 6.93, lng: 79.84 });
    graph.addNode({ id: 'ISLAND', lat: 6.80, lng: 79.95 });

    const same = findShortestPathBidirectional(graph, 'A', 'A');
    expect(same).not.toBeNull();
    expect(same!.distanceM).toBe(0);
    expect(same!.nodePath).toEqual(['A']);

    const unreachable = findShortestPathBidirectional(graph, 'A', 'ISLAND');
    expect(unreachable).toBeNull();
  });

  test('expands fewer nodes than standard Dijkstra on a 25x25 urban grid', () => {
    const graph = new RoadGraph();
    const rows = 25;
    const cols = 25;
    const step = 0.003;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        graph.addNode({ id: `${r}_${c}`, lat: 6.9 + r * step, lng: 79.85 + c * step });
      }
    }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (r + 1 < rows) {
          graph.addEdge({ id: `v_${r}_${c}`, source: `${r}_${c}`, target: `${r + 1}_${c}`, distanceM: 350, speedKmh: 45, isOneway: false });
        }
        if (c + 1 < cols) {
          graph.addEdge({ id: `h_${r}_${c}`, source: `${r}_${c}`, target: `${r}_${c + 1}`, distanceM: 350, speedKmh: 45, isOneway: false });
        }
      }
    }

    const dijk = findShortestPathDijkstra(graph, '0_0', '24_24', { mode: 'distance' });
    const bi = findShortestPathBidirectional(graph, '0_0', '24_24', { mode: 'distance' });

    expect(bi).not.toBeNull();
    expect(bi!.distanceM).toBe(dijk!.distanceM);
    expect(bi!.nodesExpanded).toBeLessThan(dijk!.nodesExpanded);
  });

  test('POST /route API supports algorithm="bidirectional"', async () => {
    const graph = new RoadGraph();
    seedColomboNetworkIntoGraph(graph);
    const app = createServer(graph);

    const res = await request(app)
      .post('/route')
      .send({
        origin: { lat: 6.9344, lng: 79.8428 },
        destination: { lat: 6.7969, lng: 79.9018 },
        algorithm: 'bidirectional',
        mode: 'distance',
      });

    expect(res.status).toBe(200);
    expect(res.body.algorithm).toBe('bidirectional');
    expect(res.body.distanceM).toBeGreaterThan(0);
    expect(res.body.nodeCount).toBeGreaterThanOrEqual(2);
  });
});

