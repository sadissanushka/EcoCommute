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
function buildProxy(
  pathFilter: string | string[],
  target: string,
  pathRewriteRule?: Record<string, string>
) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathFilter,
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
  buildProxy(['/auth', '/api/v1/auth'], AUTH_SERVICE_URL, {
    '^/api/v1/auth': '/auth',
  })
);

// Booking Service (/trips, /bookings, /vehicles, /shuttle-routes)
app.use(
  buildProxy(['/trips', '/api/v1/trips'], BOOKING_SERVICE_URL, {
    '^/api/v1/trips': '/trips',
  })
);
app.use(
  buildProxy(['/bookings', '/api/v1/bookings'], BOOKING_SERVICE_URL, {
    '^/api/v1/bookings': '/bookings',
  })
);
app.use(
  buildProxy(['/vehicles', '/api/v1/vehicles'], BOOKING_SERVICE_URL, {
    '^/api/v1/vehicles': '/vehicles',
  })
);

// Routing Service (/route, /rides, /matches)
app.use(
  buildProxy(['/route', '/api/v1/route'], ROUTING_SERVICE_URL, {
    '^/api/v1/route': '/route',
  })
);
app.use(
  buildProxy(['/rides', '/api/v1/rides'], ROUTING_SERVICE_URL, {
    '^/api/v1/rides': '/rides',
  })
);
app.use(
  buildProxy(['/matches', '/api/v1/matches'], ROUTING_SERVICE_URL, {
    '^/api/v1/matches': '/matches',
  })
);

// Microservices proxy routing: Wallet & Carbon, Safety & Real-time, Analytics
app.use(
  buildProxy(['/wallet', '/api/v1/wallet'], WALLET_SERVICE_URL, {
    '^/api/v1/wallet': '/wallet',
  })
);
app.use(
  buildProxy(['/carbon', '/api/v1/carbon'], WALLET_SERVICE_URL, {
    '^/api/v1/carbon': '/carbon',
  })
);
app.use(
  buildProxy(['/fair-split', '/api/v1/fair-split'], WALLET_SERVICE_URL, {
    '^/api/v1/fair-split': '/fair-split',
  })
);
app.use(
  buildProxy(['/safety', '/api/v1/safety'], SAFETY_SERVICE_URL, {
    '^/api/v1/safety': '/safety',
  })
);
app.use(
  buildProxy(['/otp', '/api/v1/otp'], SAFETY_SERVICE_URL, {
    '^/api/v1/otp': '/otp',
  })
);
app.use(
  buildProxy(['/sos', '/api/v1/sos'], SAFETY_SERVICE_URL, {
    '^/api/v1/sos': '/sos',
  })
);
app.use(
  buildProxy(['/analytics', '/api/v1/analytics'], ANALYTICS_SERVICE_URL, {
    '^/api/v1/analytics': '/analytics',
  })
);

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
