import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { bookingRouter } from './routes/booking.routes';
import { pool } from './db/pool';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

// Health check
app.get('/health', async (_req: Request, res: Response) => {
  try {
    const dbRes = await pool.query('SELECT 1 as alive');
    res.status(200).json({
      status: 'ok',
      service: 'booking-service',
      timestamp: new Date().toISOString(),
      database: dbRes.rows.length > 0 ? 'connected' : 'disconnected',
    });
  } catch (err: any) {
    res.status(503).json({
      status: 'error',
      service: 'booking-service',
      timestamp: new Date().toISOString(),
      database: 'unreachable',
      error: err.message,
    });
  }
});

// Mount booking endpoints
app.use('/', bookingRouter);

// Global 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'The requested booking resource was not found',
      details: {},
    },
  });
});

// Global error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled booking error:', err);
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
    console.log(`🚌 Booking Service listening on port ${PORT}`);
  });
}

export default app;
