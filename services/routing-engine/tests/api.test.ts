import request from 'supertest';
import { RoadGraph } from '../src/graph/graph.js';
import { createServer } from '../src/api/server.js';
import { pool } from '../src/graph/db.js';

describe('Routing Engine API Endpoints', () => {
  let graph: RoadGraph;
  let app: ReturnType<typeof createServer>;

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(() => {
    graph = new RoadGraph();

    // Node 1: Fort (6.9344, 79.8428)
    graph.addNode({ id: '1', lat: 6.9344, lng: 79.8428 });
    // Node 2: Slave Island (6.9218, 79.8533)
    graph.addNode({ id: '2', lat: 6.9218, lng: 79.8533 });

    graph.addEdge({
      id: 'e1',
      source: '1',
      target: '2',
      distanceM: 1800,
      speedKmh: 45,
      isOneway: false,
    });

    app = createServer(graph);
  });

  test('GET /health returns service status and graph info', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('routing-engine');
    expect(res.body.graph.nodeCount).toBe(2);
    expect(res.body.graph.edgeCount).toBe(2); // bidirectional
  });

  test('POST /route fails with 400 on invalid coordinates', async () => {
    const res = await request(app)
      .post('/route')
      .send({
        origin: { lat: 999, lng: 79.8 }, // Invalid latitude > 90
        destination: { lat: 6.92, lng: 79.85 },
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request body');
  });

  test('POST /route fails with 400 on missing parameters', async () => {
    const res = await request(app)
      .post('/route')
      .send({});

    expect(res.status).toBe(400);
  });

  test('POST /route fails with 400 on unsupported algorithm', async () => {
    const res = await request(app)
      .post('/route')
      .send({
        origin: { lat: 6.92, lng: 79.85 },
        destination: { lat: 6.93, lng: 79.86 },
        algorithm: 'floyd-warshall',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request body');
  });

  test('POST /route computes route using A* when snapped nodes exist', async () => {
    jest.spyOn(RoadGraph, 'snapToNearestNode').mockImplementation(async (pt) => {
      if (Math.abs(pt.lat - 6.9344) < 0.01) {
        return { nodeId: '1', distanceM: 5, location: { lat: 6.9344, lng: 79.8428 } };
      }
      return { nodeId: '2', distanceM: 10, location: { lat: 6.9218, lng: 79.8533 } };
    });

    const res = await request(app)
      .post('/route')
      .send({
        origin: { lat: 6.9344, lng: 79.8428 },
        destination: { lat: 6.9218, lng: 79.8533 },
        algorithm: 'astar',
        mode: 'distance',
      });

    expect(res.status).toBe(200);
    expect(res.body.algorithm).toBe('astar');
    expect(res.body.distanceM).toBe(1800);
    expect(res.body.nodeCount).toBe(2);
    expect(res.body.nodesExpanded).toBeGreaterThan(0);
  });
});
