import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';

import { walletRouter } from './routes/wallet.routes';
import { carbonRouter } from './routes/carbon.routes';
import { fairSplitRouter } from './routes/fairSplit.routes';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

export const app = express();
const PORT = process.env.PORT || 8083;

// Security & Parsing Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Request logging & request-id tracking
app.use((req: Request, _res: Response, next: NextFunction) => {
  if (!req.headers['x-request-id']) {
    req.headers['x-request-id'] = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  next();
});

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'wallet-carbon-service',
    module: 3,
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Mount Routes
app.use('/wallet', walletRouter);
app.use('/carbon', carbonRouter);
app.use('/fair-split', fairSplitRouter);

// 404 Handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'The requested resource was not found on Wallet & Carbon Service',
      details: {},
    },
  });
});

// Global Error Handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled Wallet Service Error:', err);
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
    console.log(`🌿 Wallet & Carbon Service running on port ${PORT}`);
  });
}
