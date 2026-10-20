import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { RoadGraph } from '../graph/graph.js';
import { findShortestPathDijkstra } from '../routing/dijkstra.js';
import { findShortestPathAStar } from '../routing/astar.js';
import { pool } from '../graph/db.js';

export function createRouter(graph: RoadGraph): Router {
  const router = Router();

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

  // 1. Health check
  router.get('/health', async (_req: Request, res: Response) => {
    let dbStatus = 'disconnected';
    try {
      await pool.query('SELECT 1');
      dbStatus = 'connected';
    } catch {
      dbStatus = 'error';
    }

    res.json({
      status: 'ok',
      service: 'routing-engine',
      db: dbStatus,
      graph: {
        nodeCount: graph.nodeCount,
        edgeCount: graph.edgeCount,
      },
      timestamp: new Date().toISOString(),
    });
  });

  // 2. /route endpoint (cost oracle)
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
      // 1. Snap origin and destination to nearest nodes
      const snappedOrigin = await RoadGraph.snapToNearestNode(origin);
      const snappedDestination = await RoadGraph.snapToNearestNode(destination);

      if (!snappedOrigin || !snappedDestination) {
        res.status(404).json({
          error: 'Could not snap coordinates to road network. Make sure graph is loaded.',
        });
        return;
      }

      // 2. Run selected routing algorithm
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

  // 3. GeoJSON export for Map Plot (Figure 6.3)
  router.get('/graph-geojson', async (_req: Request, res: Response) => {
    try {
      const edgesQuery = await pool.query(`
        SELECT id, distance_m, speed_kmh, is_oneway, ST_AsGeoJSON(geom) as geojson
        FROM road_edges;
      `);
      const nodesQuery = await pool.query(`
        SELECT id, ST_AsGeoJSON(geom) as geojson
        FROM road_nodes;
      `);

      const edgeFeatures = edgesQuery.rows.map((r) => ({
        type: 'Feature',
        geometry: JSON.parse(r.geojson),
        properties: {
          id: r.id,
          distanceM: parseFloat(r.distance_m),
          speedKmh: parseFloat(r.speed_kmh),
          isOneway: r.is_oneway,
        },
      }));

      const nodeFeatures = nodesQuery.rows.map((r) => ({
        type: 'Feature',
        geometry: JSON.parse(r.geojson),
        properties: { id: r.id },
      }));

      res.json({
        type: 'FeatureCollection',
        metadata: {
          nodeCount: nodesQuery.rows.length,
          edgeCount: edgesQuery.rows.length,
          crs: 'EPSG:4326',
        },
        features: [...edgeFeatures, ...nodeFeatures],
      });
    } catch (err) {
      console.error('[GeoJSON] Error generating GeoJSON:', err);
      res.status(500).json({ error: 'Failed to generate graph GeoJSON' });
    }
  });

  // 4. OpenAPI Specification
  router.get('/openapi.json', (_req: Request, res: Response) => {
    res.json({
      openapi: '3.0.3',
      info: {
        title: 'Corporate Shuttle — Module 1 Navigation & Routing Engine',
        version: '1.0.0',
        description: 'Custom Dijkstra & A* routing engine on OpenStreetMap PostGIS graph for Module 1 (Thisera WSSA - 244208R).',
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
            description: 'Snaps GPS coordinates to nearest PostGIS road nodes and computes optimal path using Dijkstra or A* search algorithm.',
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
                        properties: {
                          lat: { type: 'number', example: 6.931298 },
                          lng: { type: 'number', example: 79.84231 },
                        },
                        required: ['lat', 'lng'],
                      },
                      destination: {
                        type: 'object',
                        properties: {
                          lat: { type: 'number', example: 6.930258 },
                          lng: { type: 'number', example: 79.842521 },
                        },
                        required: ['lat', 'lng'],
                      },
                      mode: { type: 'string', enum: ['distance', 'time'], default: 'distance', example: 'distance' },
                      algorithm: { type: 'string', enum: ['dijkstra', 'astar'], default: 'dijkstra', example: 'dijkstra' },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Route calculated successfully',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        algorithm: { type: 'string', example: 'dijkstra' },
                        distanceM: { type: 'number', example: 120 },
                        etaSeconds: { type: 'number', example: 6 },
                        path: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              lat: { type: 'number', example: 6.931298 },
                              lng: { type: 'number', example: 79.84231 },
                            },
                          },
                        },
                        nodeCount: { type: 'integer', example: 8 },
                        nodesExpanded: { type: 'integer', example: 8 },
                        snappedOrigin: { type: 'object' },
                        snappedDestination: { type: 'object' },
                      },
                    },
                  },
                },
              },
              '400': { description: 'Invalid coordinate or parameter schema' },
              '404': { description: 'No path found or coordinates could not snap to graph' },
            },
          },
        },
        '/health': {
          get: {
            tags: ['System'],
            summary: 'Health check and graph topology statistics',
            responses: {
              '200': {
                description: 'Health status with node and edge counts',
              },
            },
          },
        },
      },
    });
  });

  // 5. Swagger UI Endpoint (Figure 6.5)
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
    .swagger-ui .scheme-container { background: transparent; box-shadow: none; }
  </style>
</head>
<body>
  <div class="header-banner">
    <div class="header-title">
      <span>🚗 Figure 6.5: Module 1 Navigation & Routing Engine — Swagger API Contract</span>
      <span class="header-badge">POST /route</span>
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

  // 6. Interactive Road Graph Map Plot (Figure 6.3)
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
    
    /* Overlay Header Card */
    .overlay-panel {
      position: absolute;
      top: 20px;
      left: 20px;
      z-index: 1000;
      background: rgba(15, 23, 42, 0.92);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(56, 189, 248, 0.3);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6), 0 0 25px rgba(56, 189, 248, 0.15);
      border-radius: 16px;
      padding: 22px 26px;
      max-width: 480px;
      pointer-events: auto;
    }
    
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(14, 165, 233, 0.15);
      color: #38bdf8;
      border: 1px solid rgba(56, 189, 248, 0.4);
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 12px;
    }
    .badge::before {
      content: "";
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #38bdf8;
      box-shadow: 0 0 8px #38bdf8;
    }

    h1 {
      font-size: 20px;
      font-weight: 800;
      color: #ffffff;
      line-height: 1.3;
      margin-bottom: 6px;
    }
    
    p.subtitle {
      font-size: 12.5px;
      color: #94a3b8;
      margin-bottom: 18px;
      line-height: 1.4;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 18px;
    }
    .stat-box {
      background: rgba(30, 41, 59, 0.7);
      border: 1px solid rgba(148, 163, 184, 0.15);
      border-radius: 10px;
      padding: 12px 14px;
    }
    .stat-box.primary {
      border-color: rgba(56, 189, 248, 0.4);
      background: linear-gradient(135deg, rgba(14, 165, 233, 0.12), rgba(30, 41, 59, 0.8));
    }
    .stat-box.emerald {
      border-color: rgba(52, 211, 153, 0.4);
      background: linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(30, 41, 59, 0.8));
    }
    .stat-label {
      font-size: 11px;
      font-weight: 600;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 4px;
    }
    .stat-value {
      font-family: 'JetBrains Mono', monospace;
      font-size: 24px;
      font-weight: 700;
      color: #ffffff;
    }
    .stat-value.cyan { color: #38bdf8; text-shadow: 0 0 12px rgba(56, 189, 248, 0.4); }
    .stat-value.green { color: #34d399; text-shadow: 0 0 12px rgba(52, 211, 153, 0.4); }
    .stat-sub {
      font-size: 10.5px;
      color: #64748b;
      margin-top: 2px;
    }

    .meta-list {
      border-top: 1px solid rgba(148, 163, 184, 0.15);
      padding-top: 14px;
      font-size: 12px;
      color: #cbd5e1;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .meta-key { color: #64748b; font-size: 11.5px; }
    .meta-val {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11.5px;
      color: #e2e8f0;
      background: rgba(15, 23, 42, 0.6);
      padding: 2px 6px;
      border-radius: 4px;
    }

    /* Legend Box */
    .legend-box {
      position: absolute;
      bottom: 24px;
      right: 24px;
      z-index: 1000;
      background: rgba(15, 23, 42, 0.92);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(148, 163, 184, 0.2);
      border-radius: 12px;
      padding: 14px 18px;
      font-size: 12px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    }
    .legend-title {
      font-weight: 700;
      margin-bottom: 8px;
      color: #f8fafc;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 6px;
      color: #94a3b8;
    }
    .legend-color {
      width: 18px;
      height: 4px;
      border-radius: 2px;
    }
    .legend-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    /* Live Route Demonstration Panel */
    .route-action-box {
      margin-top: 16px;
      display: flex;
      gap: 8px;
    }
    .btn-action {
      flex: 1;
      background: #0284c7;
      color: #ffffff;
      border: none;
      padding: 10px 14px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: all 0.2s;
    }
    .btn-action:hover { background: #0369a1; transform: translateY(-1px); }
  </style>
</head>
<body>
  <div id="map"></div>

  <!-- Figure 6.3 Header Card -->
  <div class="overlay-panel">
    <div class="badge">Figure 6.3 &bull; Module 1 Evaluation</div>
    <h1>Colombo Road Graph Network</h1>
    <p class="subtitle">OpenStreetMap Drivable Road Topology Ingested in PostGIS for Dijkstra & A* Path Computation.</p>
    
    <div class="stats-grid">
      <div class="stat-box primary">
        <div class="stat-label">Total Vertices (Nodes)</div>
        <div class="stat-value cyan" id="node-count">5,188</div>
        <div class="stat-sub">routing.road_nodes (GiST)</div>
      </div>
      <div class="stat-box emerald">
        <div class="stat-label">Total Segments (Edges)</div>
        <div class="stat-value green" id="edge-count">5,113</div>
        <div class="stat-sub">9,863 directed edges</div>
      </div>
    </div>

    <div class="meta-list">
      <div class="meta-row">
        <span class="meta-key">Spatial Reference</span>
        <span class="meta-val">EPSG:4326 (WGS 84)</span>
      </div>
      <div class="meta-row">
        <span class="meta-key">PostGIS Spatial Index</span>
        <span class="meta-val">GiST (geom)</span>
      </div>
      <div class="meta-row">
        <span class="meta-key">Router Engine</span>
        <span class="meta-val">Custom Dijkstra / A* (TypeScript)</span>
      </div>
      <div class="meta-row">
        <span class="meta-key">Corridor</span>
        <span class="meta-val">Colombo Metropolitan Area & South</span>
      </div>
    </div>

    <div class="route-action-box">
      <button class="btn-action" id="btn-demo-route">⚡ Overlay Live Dijkstra Route</button>
      <button class="btn-action" style="background: #334155;" id="btn-center">🎯 Focus Colombo</button>
    </div>
  </div>

  <!-- Legend -->
  <div class="legend-box">
    <div class="legend-title">Graph Layer Legend</div>
    <div class="legend-item">
      <div class="legend-dot" style="background: #38bdf8; box-shadow: 0 0 6px #38bdf8;"></div>
      <span>Road Vertices (road_nodes)</span>
    </div>
    <div class="legend-item">
      <div class="legend-color" style="background: #f59e0b;"></div>
      <span>Road Segments (road_edges)</span>
    </div>
    <div class="legend-item">
      <div class="legend-color" style="background: #10b981; height: 6px; box-shadow: 0 0 8px #10b981;"></div>
      <span>Computed Shortest Path (Dijkstra)</span>
    </div>
  </div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    // Initialize Leaflet map with dark CARTO tiles
    const map = L.map('map', {
      zoomControl: false,
      preferCanvas: true
    }).setView([6.9312, 79.8423], 14);

    L.control.zoom({ position: 'bottomleft' }).addTo(map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map);

    let routeLayer = null;

    // Load GeoJSON features from server
    fetch('/graph-geojson')
      .then(r => r.json())
      .then(data => {
        if (data.metadata) {
          document.getElementById('node-count').innerText = data.metadata.nodeCount.toLocaleString();
          document.getElementById('edge-count').innerText = data.metadata.edgeCount.toLocaleString();
        }

        // Add edges
        L.geoJSON(data, {
          filter: function(feature) {
            return feature.geometry.type === 'LineString';
          },
          style: function(feature) {
            return {
              color: '#f59e0b',
              weight: 2.2,
              opacity: 0.75
            };
          }
        }).addTo(map);

        // Add nodes as subtle circles
        L.geoJSON(data, {
          filter: function(feature) {
            return feature.geometry.type === 'Point';
          },
          pointToLayer: function(feature, latlng) {
            return L.circleMarker(latlng, {
              radius: 2.5,
              fillColor: '#38bdf8',
              color: '#0284c7',
              weight: 1,
              opacity: 0.9,
              fillOpacity: 0.8
            });
          }
        }).addTo(map);
      })
      .catch(err => console.error("Error loading graph GeoJSON:", err));

    // Live Dijkstra route overlay handler
    document.getElementById('btn-demo-route').addEventListener('click', () => {
      fetch('/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: { lat: 6.931298, lng: 79.84231 },
          destination: { lat: 6.930258, lng: 79.842521 },
          algorithm: 'dijkstra',
          mode: 'distance'
        })
      })
      .then(r => r.json())
      .then(res => {
        if (routeLayer) map.removeLayer(routeLayer);
        const latlngs = res.path.map(p => [p.lat, p.lng]);
        routeLayer = L.polyline(latlngs, {
          color: '#10b981',
          weight: 6,
          opacity: 0.95
        }).addTo(map);
        map.fitBounds(routeLayer.getBounds(), { padding: [120, 120] });
      })
      .catch(err => alert("Error computing route: " + err));
    });

    document.getElementById('btn-center').addEventListener('click', () => {
      map.setView([6.9312, 79.8423], 15);
    });
  </script>
</body>
</html>`);
  });

  return router;
}
