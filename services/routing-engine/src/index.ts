import dotenv from 'dotenv';
import { RoadGraph } from './graph/graph.js';
import { testDbConnection } from './graph/db.js';
import { createServer } from './api/server.js';

dotenv.config();

const PORT = parseInt(process.env.PORT || '3000', 10);

async function main() {
  console.log('--- Initializing Module 1: Routing Engine ---');

  const graph = new RoadGraph();

  const isDbReady = await testDbConnection();
  if (isDbReady) {
    try {
      await graph.loadFromPostgres();
    } catch {
      console.warn('[Graph] PostGIS load failed. Loading in-memory Colombo road network.');
      graph.loadColomboSeedNetwork();
    }
  } else {
    console.warn('[DB] PostgreSQL is not reachable at startup. Loading in-memory Colombo road network for standalone operation.');
    graph.loadColomboSeedNetwork();
  }

  const app = createServer(graph);

  app.listen(PORT, () => {
    console.log(`[Server] Routing engine listening on port ${PORT}`);
    console.log(`[Server] Health check: http://localhost:${PORT}/health`);
    console.log(`[Server] Swagger Docs: http://localhost:${PORT}/docs`);
    console.log(`[Server] Map View:     http://localhost:${PORT}/map`);
  });
}

main().catch((err) => {
  console.error('[Fatal] Failed to start routing engine:', err);
  process.exit(1);
});
