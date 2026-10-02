import { server } from './server';
import { config } from './config';
import { pool } from './db/pool';

server.listen(config.port, () => {
  console.log(`[SafetyService] HTTP & WebSocket Server running on port ${config.port} (${config.nodeEnv})`);
  console.log(`[SafetyService] WS endpoint: ws://localhost:${config.port}/ws`);
});

const gracefulShutdown = async () => {
  console.log('[SafetyService] Shutting down gracefully...');
  server.close(async () => {
    await pool.end();
    console.log('[SafetyService] PostgreSQL pool closed. Process terminated.');
    process.exit(0);
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
