import express, { Express } from 'express';
import cors from 'cors';
import { RoadGraph } from '../graph/graph.js';
import { createRouter } from './routes.js';

export function createServer(graph: RoadGraph): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  const router = createRouter(graph);
  app.use('/api/v1', router);
  app.use('/', router); // Support root path /route and /health

  return app;
}
