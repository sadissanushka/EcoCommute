import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { RoadGraph } from '../graph/graph.js';
import { findShortestPathDijkstra } from '../routing/dijkstra.js';
import { findShortestPathAStar } from '../routing/astar.js';
import { pool } from '../graph/db.js';
import { RouteOverlapMatcher } from '../matching/matcher.js';
import { MultiStopOptimizer } from '../matching/multiStop.js';

export function createRouter(graph: RoadGraph): Router {
  const router = Router();
  const matcher = new RouteOverlapMatcher(2500); // 2.5 km detour threshold limit

  const RouteSchema = z.object({
    origin: z.object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    }),
    destination: z.object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    }),
    mode: z.enum(['distance', 'time']).optional().default('distance'),
    algorithm: z.enum(['dijkstra', 'astar']).optional().default('dijkstra'),
  });

  const RideOfferSchema = z.object({
    type: z.enum(['offer', 'request']),
    userId: z.string().min(1),
    userName: z.string().optional(),
    origin: z.object({ lat: z.number(), lng: z.number() }),
    destination: z.object({ lat: z.number(), lng: z.number() }),
    timeWindowStart: z.string().optional(),
    timeWindowEnd: z.string().optional(),
    womenOnly: z.boolean().optional().default(false),
    seats: z.number().int().positive().optional().default(1),
    vehicle: z.string().optional(),
  });

  const MultiStopSchema = z.object({
    origin: z.object({ id: z.string().optional(), name: z.string().optional(), lat: z.number(), lng: z.number() }),
    destination: z.object({ id: z.string().optional(), name: z.string().optional(), lat: z.number(), lng: z.number() }).optional(),
    stops: z.array(
      z.object({
        id: z.string().optional(),
        name: z.string().optional(),
        lat: z.number(),
        lng: z.number(),
        riderId: z.string().optional(),
      })
    ).min(1),
  });

  // 1. Health check & Graph Topology (Step 1.3)
  router.get('/health', async (_req: Request, res: Response) => {
    let dbStatus = 'disconnected';
    try {
      await pool.query('SELECT 1');
      dbStatus = 'connected';
    } catch {
      dbStatus = 'offline (in-memory standalone mode active)';
    }

    res.json({
      status: 'ok',
      service: 'routing-engine',
      module: 'Module 1: Ride Matching & Custom Navigation Engine',
      author: 'Thisera WSSA (244208R)',
      db: dbStatus,
      graph: {
        nodeCount: graph.nodeCount,
        edgeCount: graph.edgeCount,
        spatialIndex: 'GiST (PostGIS) / R-Tree In-Memory',
      },
      capabilities: ['dijkstra', 'astar', 'route-overlap-matcher', 'nearest-neighbour', '2-opt-optimizer'],
      timestamp: new Date().toISOString(),
    });
  });

  // 2. /route endpoint (Cost Oracle — Step 1.4)
  router.post('/route', async (req: Request, res: Response) => {
    const parseResult = RouteSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: 'Invalid request body',
        details: parseResult.error.format(),
      });
      return;
    }

    const { origin, destination, mode, algorithm } = parseResult.data;

    try {
      // Snap origin and destination to nearest nodes (PostGIS KNN or In-Memory Spatial)
      const snappedOrigin = await RoadGraph.snapToNearestNode(origin, graph);
      const snappedDestination = await RoadGraph.snapToNearestNode(destination, graph);

      if (!snappedOrigin || !snappedDestination) {
        res.status(404).json({
          error: 'Could not snap coordinates to road network. Make sure graph is loaded.',
        });
        return;
      }

      // Run selected routing algorithm (Dijkstra or A*)
      const routeResult =
        algorithm === 'astar'
          ? findShortestPathAStar(graph, snappedOrigin.nodeId, snappedDestination.nodeId, { mode })
          : findShortestPathDijkstra(graph, snappedOrigin.nodeId, snappedDestination.nodeId, { mode });

      if (!routeResult) {
        res.status(404).json({
          error: 'No path found between origin and destination in road network',
        });
        return;
      }

      res.json({
        algorithm,
        mode,
        distanceM: routeResult.distanceM,
        etaSeconds: routeResult.etaSeconds,
        path: routeResult.path,
        nodeCount: routeResult.nodePath.length,
        nodesExpanded: routeResult.nodesExpanded,
        snappedOrigin,
        snappedDestination,
      });
    } catch (err) {
      console.error('[Route API] Error computing route:', err);
      res.status(500).json({ error: 'Internal server error while computing route' });
    }
  });

  // 3. /rides endpoint — Create & List Ride Offers and Requests (Step 3.4)
  router.post('/rides', (req: Request, res: Response) => {
    const parseResult = RideOfferSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: 'Invalid ride submission', details: parseResult.error.format() });
      return;
    }

    const data = parseResult.data;
    const id = `${data.type}-${Date.now()}`;

    if (data.type === 'offer') {
      const offer = {
        id,
        userId: data.userId,
        userName: data.userName || 'Corporate Driver',
        origin: data.origin,
        destination: data.destination,
        timeWindowStart: data.timeWindowStart || '08:00 AM',
        womenOnly: data.womenOnly,
        seatsAvailable: data.seats,
        vehicle: data.vehicle || 'Standard Vehicle',
      };
      matcher.addOffer(offer);
      res.status(201).json({ message: 'Ride offer published successfully', data: offer });
    } else {
      const request = {
        id,
        userId: data.userId,
        userName: data.userName || 'Commuter Employee',
        origin: data.origin,
        destination: data.destination,
        timeWindowStart: data.timeWindowStart || '08:00 AM',
        womenOnly: data.womenOnly,
        seatsNeeded: data.seats,
      };
      matcher.addRequest(request);
      res.status(201).json({ message: 'Ride request published successfully', data: request });
    }
  });

  router.get('/rides', (_req: Request, res: Response) => {
    res.json({
      offers: matcher.getOffers(),
      requests: matcher.getRequests(),
    });
  });

  // 4. /matches endpoint — Ranked Candidate Matches with Detour Limit (Step 3.3 & 3.4)
  router.get('/matches', (req: Request, res: Response) => {
    const { requestId, offerId } = req.query;

    if (requestId) {
      const matches = matcher.findMatchesForRequest(requestId as string);
      res.json({
        requestId,
        matchesCount: matches.length,
        matches,
      });
      return;
    }

    if (offerId) {
      const matches = matcher.findMatchesForOffer(offerId as string);
      res.json({
        offerId,
        matchesCount: matches.length,
        matches,
      });
      return;
    }

    // Default: Return matches for all active requests
    const allMatches = matcher.getRequests().flatMap((r) => matcher.findMatchesForRequest(r.id));
    res.json({
      matchesCount: allMatches.length,
      matches: allMatches,
    });
  });

  router.post('/matches', (req: Request, res: Response) => {
    const { offer, request } = req.body;
    if (!offer || !request) {
      res.status(400).json({ error: 'Both offer and request objects are required to evaluate match' });
      return;
    }

    const evaluation = matcher.evaluateMatch(offer, request);
    if (!evaluation) {
      res.status(200).json({
        matched: false,
        reason: 'Detour threshold exceeded (> 2,500m) or incompatible gender preference filter',
      });
      return;
    }

    res.json({
      matched: true,
      match: evaluation,
    });
  });

  // 5. /multi-stop/order endpoint — NN + 2-opt Tour Optimization (Step 3.1 & 3.2)
  router.post('/multi-stop/order', (req: Request, res: Response) => {
    const parseResult = MultiStopSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: 'Invalid multi-stop parameters', details: parseResult.error.format() });
      return;
    }

    const { origin, destination, stops } = parseResult.data;
    const originPoint = { id: origin.id || 'origin', name: origin.name || 'Origin', lat: origin.lat, lng: origin.lng };
    const destPoint = destination
      ? { id: destination.id || 'dest', name: destination.name || 'Destination', lat: destination.lat, lng: destination.lng }
      : undefined;
    const stopPoints = stops.map((s, idx) => ({
      id: s.id || `stop-${idx + 1}`,
      name: s.name || `Waypoint ${idx + 1}`,
      lat: s.lat,
      lng: s.lng,
      riderId: s.riderId,
    }));

    const result = MultiStopOptimizer.optimizeMultiStopTour(originPoint, stopPoints, destPoint);
    res.json({
      algorithm: 'Nearest-Neighbour + 2-opt Heuristic',
      ...result,
    });
  });

  // 6. GeoJSON export for Map Plot (Figure 6.3)
  router.get('/graph-geojson', async (_req: Request, res: Response) => {
    try {
      const edgeFeatures: any[] = [];
      const nodeFeatures: any[] = [];

      for (const [nodeId, loc] of graph.nodes.entries()) {
        nodeFeatures.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [loc.lng, loc.lat] },
          properties: { id: nodeId },
        });

        const neighbors = graph.getNeighbors(nodeId);
        for (const neighbor of neighbors) {
          const targetLoc = graph.getNode(neighbor.targetNodeId);
          if (targetLoc) {
            edgeFeatures.push({
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: [
                  [loc.lng, loc.lat],
                  [targetLoc.lng, targetLoc.lat],
                ],
              },
              properties: {
                source: nodeId,
                target: neighbor.targetNodeId,
                distanceM: neighbor.distanceM,
                speedKmh: neighbor.speedKmh,
                isOneway: neighbor.isOneway,
              },
            });
          }
        }
      }

      res.json({
        type: 'FeatureCollection',
        metadata: {
          nodeCount: nodeFeatures.length,
          edgeCount: edgeFeatures.length,
          crs: 'EPSG:4326',
        },
        features: [...edgeFeatures, ...nodeFeatures],
      });
    } catch (err) {
      console.error('[GeoJSON] Error generating GeoJSON:', err);
      res.status(500).json({ error: 'Failed to generate graph GeoJSON' });
    }
  });

  // 7. OpenAPI Specification
  router.get('/openapi.json', (_req: Request, res: Response) => {
    res.json({
      openapi: '3.0.3',
      info: {
        title: 'Corporate Shuttle — Module 1 Navigation & Routing Engine',
        version: '1.0.0',
        description: 'Custom Dijkstra & A* routing engine, ride matcher, and multi-stop 2-opt optimizer (Thisera WSSA - 244208R).',
      },
      servers: [
        { url: 'http://localhost:3000', description: 'Local Routing Engine' },
        { url: 'http://localhost:8080', description: 'Gateway Edge' },
      ],
      paths: {
        '/route': {
          post: {
            tags: ['Routing'],
            summary: 'Compute optimal route between origin and destination',
            description: 'Snaps GPS coordinates and computes optimal path using Dijkstra or A* search.',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['origin', 'destination'],
                    properties: {
                      origin: {
                        type: 'object',
                        properties: { lat: { type: 'number', example: 6.9344 }, lng: { type: 'number', example: 79.8428 } },
                        required: ['lat', 'lng'],
                      },
                      destination: {
                        type: 'object',
                        properties: { lat: { type: 'number', example: 6.7969 }, lng: { type: 'number', example: 79.9018 } },
                        required: ['lat', 'lng'],
                      },
                      mode: { type: 'string', enum: ['distance', 'time'], default: 'distance' },
                      algorithm: { type: 'string', enum: ['dijkstra', 'astar'], default: 'astar' },
                    },
                  },
                },
              },
            },
            responses: {
              '200': { description: 'Route calculated successfully' },
            },
          },
        },
        '/rides': {
          get: { tags: ['Matching'], summary: 'List active ride offers and commuter requests' },
          post: { tags: ['Matching'], summary: 'Publish a ride offer or ride request' },
        },
        '/matches': {
          get: { tags: ['Matching'], summary: 'Get ranked candidate matches for a ride request or offer' },
          post: { tags: ['Matching'], summary: 'Evaluate match overlap, detour added, and gender filters' },
        },
        '/multi-stop/order': {
          post: { tags: ['Multi-Stop'], summary: 'Optimize visiting order of multiple pickup stops using NN + 2-opt' },
        },
        '/health': {
          get: { tags: ['System'], summary: 'Health check and graph topology statistics' },
        },
      },
    });
  });

  // 8. Swagger UI Endpoint (Figure 6.5)
  router.get('/docs', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Module 1 Routing Engine — Swagger UI</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css" />
  <style>
    body { margin: 0; background: #0f172a; color: #f8fafc; font-family: Inter, system-ui, sans-serif; }
    .topbar { display: none !important; }
    .header-banner {
      background: linear-gradient(135deg, #1e293b, #0f172a);
      border-bottom: 1px solid #334155;
      padding: 16px 32px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .header-title { font-size: 20px; font-weight: 700; color: #38bdf8; display: flex; align-items: center; gap: 10px; }
    .header-badge { background: #0369a1; color: #e0f2fe; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; }
    .swagger-ui { filter: invert(88%) hue-rotate(180deg); }
    .swagger-ui .wrapper { max-width: 1200px; padding: 24px; }
  </style>
</head>
<body>
  <div class="header-banner">
    <div class="header-title">
      <span>🚗 Module 1: Navigation, Matching & Multi-Stop Engine</span>
      <span class="header-badge">Thisera WSSA - 244208R</span>
    </div>
    <div style="font-size: 13px; color: #94a3b8;">
      Corporate Employee Shuttle Platform &bull; Stack Kings Group 05
    </div>
  </div>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function() {
      SwaggerUIBundle({
        url: "/openapi.json",
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis],
        layout: "BaseLayout",
        defaultModelsExpandDepth: 1,
        docExpansion: "full"
      });
    };
  </script>
</body>
</html>`);
  });

  // 9. Interactive Road Graph Map Plot (Figure 6.3)
  router.get('/map', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Figure 6.3: Colombo Road Graph Network Map Plot</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Plus Jakarta Sans', sans-serif; background: #090d16; color: #f1f5f9; overflow: hidden; height: 100vh; width: 100vw; }
    #map { height: 100vh; width: 100vw; background: #0b1120; }
    .overlay-panel {
      position: absolute; top: 20px; left: 20px; z-index: 1000;
      background: rgba(15, 23, 42, 0.94); backdrop-filter: blur(12px);
      border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 16px;
      padding: 20px 24px; max-width: 440px; box-shadow: 0 20px 40px rgba(0,0,0,0.6);
    }
    .badge { display: inline-flex; align-items: center; background: rgba(14, 165, 233, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4); padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; margin-bottom: 8px; }
    h1 { font-size: 18px; font-weight: 800; color: #ffffff; margin-bottom: 4px; }
    p.subtitle { font-size: 12px; color: #94a3b8; margin-bottom: 14px; }
    .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
    .stat-box { background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(148, 163, 184, 0.15); border-radius: 10px; padding: 10px; }
    .stat-label { font-size: 10px; font-weight: 600; color: #94a3b8; text-transform: uppercase; margin-bottom: 2px; }
    .stat-value { font-family: 'JetBrains Mono', monospace; font-size: 20px; font-weight: 700; color: #38bdf8; }
    .btn-action { width: 100%; background: #0284c7; color: #ffffff; border: none; padding: 10px; border-radius: 8px; font-weight: 700; font-size: 12px; cursor: pointer; transition: all 0.2s; }
    .btn-action:hover { background: #0369a1; }
  </style>
</head>
<body>
  <div id="map"></div>
  <div class="overlay-panel">
    <div class="badge">Figure 6.3 &bull; Module 1 Evaluation (Thisera WSSA)</div>
    <h1>Colombo Road Graph Network</h1>
    <p class="subtitle">OpenStreetMap Colombo Arterial Network with Dijkstra & A* Shortest Path Evaluation.</p>
    <div class="stats-grid">
      <div class="stat-box">
        <div class="stat-label">Road Vertices</div>
        <div class="stat-value" id="node-count">${graph.nodeCount}</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">Road Segments</div>
        <div class="stat-value" id="edge-count">${graph.edgeCount}</div>
      </div>
    </div>
    <button class="btn-action" id="btn-demo-route">⚡ Overlay Live A* Route (Fort ➔ Moratuwa)</button>
  </div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const map = L.map('map', { zoomControl: false }).setView([6.88, 79.88], 12);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri'
    }).addTo(map);

    let routeLayer = null;

    fetch('/graph-geojson')
      .then(r => r.json())
      .then(data => {
        L.geoJSON(data, {
          style: () => ({ color: '#0d631b', weight: 3.5, opacity: 0.8 }),
          pointToLayer: (feature, latlng) => L.circleMarker(latlng, { radius: 4, fillColor: '#0284c7', color: '#ffffff', weight: 1.5, fillOpacity: 0.9 })
        }).addTo(map);
      });

    document.getElementById('btn-demo-route').addEventListener('click', () => {
      fetch('/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: { lat: 6.9344, lng: 79.8428 },
          destination: { lat: 6.7969, lng: 79.9018 },
          algorithm: 'astar',
          mode: 'distance'
        })
      })
      .then(r => r.json())
      .then(res => {
        if (routeLayer) map.removeLayer(routeLayer);
        const latlngs = res.path.map(p => [p.lat, p.lng]);
        routeLayer = L.polyline(latlngs, { color: '#ba1a1a', weight: 6, opacity: 0.95 }).addTo(map);
        map.fitBounds(routeLayer.getBounds(), { padding: [60, 60] });
      });
    });
  </script>
</body>
</html>`);
  });

  return router;
}
