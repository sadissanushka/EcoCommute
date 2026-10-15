import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';

import { analyticsRouter } from './routes/analytics.routes';
import { govRouter } from './routes/gov.routes';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

export const app = express();
const PORT = process.env.PORT || 8085;

// Security & Parsing
app.use(helmet());
app.use(cors());
app.use(express.json());

// Request tracking
app.use((req: Request, _res: Response, next: NextFunction) => {
  if (!req.headers['x-request-id']) {
    req.headers['x-request-id'] = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  next();
});

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'analytics-privacy-service',
    module: 5,
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Mount Routes
app.use('/analytics', analyticsRouter);
app.use('/gov', govRouter);

// 404 Handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'The requested resource was not found on Analytics & Privacy Service',
      details: {},
    },
  });
});

// Global Error Handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled Analytics Service Error:', err);
  res.status(err.status || 500).json({
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message || 'An unexpected error occurred',
      details: process.env.NODE_ENV === 'development' ? err.stack : {},
    },
  });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`📊 Analytics & Privacy Service running on port ${PORT}`);
  });
}
