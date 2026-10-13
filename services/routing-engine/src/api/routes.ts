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

  return router;
}
