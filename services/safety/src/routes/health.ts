import { Router, Request, Response } from 'express';
import { checkDbConnection } from '../db/pool';

export const healthRouter = Router();

// Liveness probe (process is running)
healthRouter.get('/healthz', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'safety-tracking-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Readiness probe (DB reachable)
healthRouter.get('/readyz', async (_req: Request, res: Response) => {
  const dbOk = await checkDbConnection();
  if (dbOk) {
    res.status(200).json({
      status: 'ready',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } else {
    res.status(503).json({
      status: 'degraded',
      database: 'disconnected',
      timestamp: new Date().toISOString(),
    });
  }
});

// Legacy /health endpoint
healthRouter.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'safety-tracking-service',
    timestamp: new Date().toISOString(),
  });
});
