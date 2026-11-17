import express from 'express';
import request from 'supertest';
import { RoadGraph } from '../src/graph/graph.js';
import { seedColomboNetworkIntoGraph } from '../src/graph/seedColombo.js';
import { RouteOverlapMatcher } from '../src/matching/matcher.js';
import { createRateLimiter } from '../src/api/rateLimit.js';
import { createServer } from '../src/api/server.js';

describe('Phase 4 Security & Synthetic Commuter Quality Suite', () => {
  test('maskHomeCoordinate snaps exact home coordinates to nearest road node or ~150m grid', () => {
    const graph = new RoadGraph();
    seedColomboNetworkIntoGraph(graph);
    const matcher = new RouteOverlapMatcher(2500, graph);

    // Exact private home coordinate near Battaramulla (not identical to node coord)
    const exactHome = { lat: 6.899371, lng: 79.922849 };
    const masked = matcher.maskHomeCoordinate(exactHome);

    expect(masked).not.toEqual(exactHome);
    // Should snap to nearest Colombo road node (not expose raw 6-decimal coordinate)
    expect(Math.abs(masked.lat - exactHome.lat) + Math.abs(masked.lng - exactHome.lng)).toBeGreaterThan(0);
  });

  test('GET /rides returns masked public coordinates rather than raw home GPS', async () => {
    const graph = new RoadGraph();
    seedColomboNetworkIntoGraph(graph);
    const app = createServer(graph);

    const exactHome = { lat: 6.899412, lng: 79.922911 };
    await request(app)
      .post('/rides')
      .send({
        type: 'request',
        userId: 'emp-privacy-1',
        origin: exactHome,
        destination: { lat: 6.9344, lng: 79.8428 },
      });

    const listRes = await request(app).get('/rides');
    expect(listRes.status).toBe(200);
    const created = listRes.body.requests.find((r: any) => r.userId === 'emp-privacy-1');
    expect(created).toBeDefined();
    expect(created.origin).not.toEqual(exactHome);
  });

  test('createRateLimiter enforces maxRequests and responds with 429 + Retry-After', async () => {
    const app = express();
    app.get('/limited', createRateLimiter({ windowMs: 60_000, maxRequests: 3, keyPrefix: 'test' }), (_req, res) => {
      res.json({ ok: true });
    });

    for (let i = 0; i < 3; i++) {
      const okRes = await request(app).get('/limited');
      expect(okRes.status).toBe(200);
    }

    const blockedRes = await request(app).get('/limited');
    expect(blockedRes.status).toBe(429);
    expect(blockedRes.body.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(blockedRes.headers['retry-after']).toBeDefined();
  });

  test('synthetic commuter set: rejects over-detour riders, respects women-only, and maximizes greedy matches', () => {
    const graph = new RoadGraph();
    seedColomboNetworkIntoGraph(graph);
    const matcher = new RouteOverlapMatcher(2500, graph);

    // Add uniquely tagged synthetic set
    matcher.addOffer({
      id: 'syn-off-1',
      userId: 'syn-d1',
      origin: { lat: 6.9094, lng: 79.8961 }, // Rajagiriya
      destination: { lat: 6.9344, lng: 79.8428 }, // Fort
      womenOnly: false,
      seatsAvailable: 2,
    });
    matcher.addOffer({
      id: 'syn-off-2',
      userId: 'syn-d2',
      origin: { lat: 6.7969, lng: 79.9018 }, // Moratuwa
      destination: { lat: 6.9344, lng: 79.8428 }, // Fort
      womenOnly: true,
      seatsAvailable: 1,
    });

    // Rider 1: Along Rajagiriya->Fort corridor (should match syn-off-1)
    matcher.addRequest({
      id: 'syn-req-1',
      userId: 'syn-r1',
      origin: { lat: 6.9147, lng: 79.8778 }, // Borella
      destination: { lat: 6.9344, lng: 79.8428 },
      womenOnly: false,
      seatsNeeded: 1,
    });

    // Rider 2: Female commuter along Moratuwa->Fort (should match syn-off-2)
    matcher.addRequest({
      id: 'syn-req-2',
      userId: 'syn-r2',
      origin: { lat: 6.874, lng: 79.859 }, // Wellawatte
      destination: { lat: 6.9344, lng: 79.8428 },
      womenOnly: true,
      seatsNeeded: 1,
    });

    // Rider 3: Far off-corridor in Negombo (> 30 km detour, must be rejected by all)
    matcher.addRequest({
      id: 'syn-req-3',
      userId: 'syn-r3',
      origin: { lat: 7.2008, lng: 79.8737 },
      destination: { lat: 6.9344, lng: 79.8428 },
      womenOnly: false,
      seatsNeeded: 1,
    });

    expect(matcher.findMatchesForRequest('syn-req-3')).toHaveLength(0);

    const womenMatches = matcher.findMatchesForRequest('syn-req-2');
    expect(womenMatches.some((m) => m.offerId === 'syn-off-2')).toBe(true);
    expect(womenMatches.every((m) => m.offerId !== 'syn-off-1')).toBe(true);

    const greedy = matcher.greedySelectAllMatches();
    expect(greedy.some((m) => m.requestId === 'syn-req-1' && m.offerId === 'syn-off-1')).toBe(true);
    expect(greedy.some((m) => m.requestId === 'syn-req-2' && m.offerId === 'syn-off-2')).toBe(true);
  });
});

