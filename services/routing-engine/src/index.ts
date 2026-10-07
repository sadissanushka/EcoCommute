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
    } catch (err) {
      console.warn('[Graph] Could not load graph from PostGIS yet. Server will start with empty graph:', err);
    }
  } else {
    console.warn('[DB] PostgreSQL is not reachable at startup. Please ensure Docker container is running.');
  }

  const app = createServer(graph);

  app.listen(PORT, () => {
    console.log(`[Server] Routing engine listening on port ${PORT}`);
    console.log(`[Server] Health check: http://localhost:${PORT}/health`);
  });
}

main().catch((err) => {
  console.error('[Fatal] Failed to start routing engine:', err);
  process.exit(1);
});
