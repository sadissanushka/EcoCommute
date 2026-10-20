import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { RoadGraph } from '../graph/graph.js';
import { createRouter } from './routes.js';

export function createServer(graph: RoadGraph): Express {
  const app = express();

  app.use(cors());

  // Windows cURL single-quote stripper & resilient JSON parser
  app.use(
    express.json({
      verify: (req: any, _res: any, buf: Buffer) => {
        let text = buf.toString().trim();
        // If string begins and ends with single quote from Windows CMD
        if (text.startsWith("'") && text.endsWith("'")) {
          text = text.substring(1, text.length - 1);
          req.rawBody = text;
        }
      },
    })
  );

  // Fallback text body parser if JSON content-type with single quotes failed standard parse
  app.use(express.text({ type: '*/*' }));
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (typeof req.body === 'string' && req.body.trim().startsWith('{')) {
      try {
        let clean = req.body.trim();
        if (clean.startsWith("'") && clean.endsWith("'")) {
          clean = clean.substring(1, clean.length - 1);
        }
        req.body = JSON.parse(clean);
      } catch {
        // Continue to validator
      }
    }
    next();
  });

  const router = createRouter(graph);
  app.use('/api/v1', router);
  app.use('/', router); // Support root path /route and /health

  return app;
}
