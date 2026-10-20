import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
const BOOKING_SERVICE_URL = process.env.BOOKING_SERVICE_URL || 'http://localhost:3002';
const ROUTING_SERVICE_URL = process.env.ROUTING_SERVICE_URL || 'http://localhost:3000';
const WALLET_SERVICE_URL = process.env.WALLET_SERVICE_URL || 'http://localhost:8083';
const SAFETY_SERVICE_URL = process.env.SAFETY_SERVICE_URL || 'http://localhost:4400';
const ANALYTICS_SERVICE_URL = process.env.ANALYTICS_SERVICE_URL || 'http://localhost:8085';

// 1. Security Headers & CORS
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));

// 2. Request Correlation ID
app.use((req: Request, res: Response, next: NextFunction) => {
  const requestId = (req.headers['x-request-id'] as string) || uuidv4();
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
});

// 3. Global Rate Limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP, please try again after 15 minutes',
      details: {},
    },
  },
});
app.use(limiter);

// 4. Gateway Healthcheck
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
    routes: {
      auth: AUTH_SERVICE_URL,
      booking: BOOKING_SERVICE_URL,
      routing: ROUTING_SERVICE_URL,
      wallet: WALLET_SERVICE_URL,
      safety: SAFETY_SERVICE_URL,
      analytics: ANALYTICS_SERVICE_URL,
    },
  });
});

// 5. Proxy Helper
function buildProxy(target: string, pathRewriteRule?: Record<string, string>) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: pathRewriteRule,
    on: {
      error: (err, _req, res) => {
        console.error(`Proxy error targeting ${target}:`, err);
        const clientRes = res as Response;
        if (!clientRes.headersSent) {
          clientRes.status(502).json({
            error: {
              code: 'BAD_GATEWAY',
              message: 'Downstream microservice is unavailable',
              details: { target, error: err.message },
            },
          });
        }
      },
    },
  });
}

// 6. Microservice Routing Table

// Auth Service (/auth, /api/v1/auth)
app.use(
  ['/auth', '/api/v1/auth'],
  buildProxy(AUTH_SERVICE_URL, {
    '^/api/v1/auth': '/auth',
  })
);

// Booking Service (/trips, /bookings, /vehicles, /shuttle-routes)
app.use(
  ['/trips', '/api/v1/trips'],
  buildProxy(BOOKING_SERVICE_URL, {
    '^/api/v1/trips': '/trips',
  })
);
app.use(
  ['/bookings', '/api/v1/bookings'],
  buildProxy(BOOKING_SERVICE_URL, {
    '^/api/v1/bookings': '/bookings',
  })
);
app.use(
  ['/vehicles', '/api/v1/vehicles'],
  buildProxy(BOOKING_SERVICE_URL, {
    '^/api/v1/vehicles': '/vehicles',
  })
);

// Routing Service (/route, /rides, /matches)
app.use(
  ['/route', '/api/v1/route'],
  buildProxy(ROUTING_SERVICE_URL, {
    '^/api/v1/route': '/route',
  })
);
app.use(
  ['/rides', '/api/v1/rides'],
  buildProxy(ROUTING_SERVICE_URL, {
    '^/api/v1/rides': '/rides',
  })
);
app.use(
  ['/matches', '/api/v1/matches'],
  buildProxy(ROUTING_SERVICE_URL, {
    '^/api/v1/matches': '/matches',
  })
);

// Microservices proxy routing: Wallet & Carbon, Safety & Real-time, Analytics
app.use(['/wallet', '/api/v1/wallet'], buildProxy(WALLET_SERVICE_URL));
app.use(['/carbon', '/api/v1/carbon'], buildProxy(WALLET_SERVICE_URL));
app.use(['/fair-split', '/api/v1/fair-split'], buildProxy(WALLET_SERVICE_URL));
app.use(['/safety', '/api/v1/safety'], buildProxy(SAFETY_SERVICE_URL));
app.use(['/otp', '/api/v1/otp'], buildProxy(SAFETY_SERVICE_URL));
app.use(['/sos', '/api/v1/sos'], buildProxy(SAFETY_SERVICE_URL));
app.use(['/analytics', '/api/v1/analytics'], buildProxy(ANALYTICS_SERVICE_URL));

// 7. Global 404 Fallback
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: 'No endpoint mapped for requested path',
      details: {},
    },
  });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🌐 API Gateway listening on port ${PORT}`);
  });
}

export default app;
