import http from 'http';
import { RoadGraph } from '../src/graph/graph.js';
import { seedColomboNetworkIntoGraph } from '../src/graph/seedColombo.js';
import { createServer } from '../src/api/server.js';

/**
 * Concurrent /route Load & Latency Benchmark (Module 1 — Step 4.5)
 * Runs N concurrent POST /route requests against the Express routing engine
 * and reports p50, p95, p99 latencies and throughput (req/s).
 */
async function runLoadTest() {
  const graph = new RoadGraph();
  seedColomboNetworkIntoGraph(graph);
  const app = createServer(graph);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const totalRequests = 100;
  const concurrency = 20;
  const latenciesMs: number[] = [];
  let failures = 0;

  const payload = JSON.stringify({
    origin: { lat: 6.9344, lng: 79.8428 },
    destination: { lat: 6.7969, lng: 79.9018 },
    algorithm: 'astar',
    mode: 'distance',
  });

  const startedAt = performance.now();

  for (let batch = 0; batch < totalRequests; batch += concurrency) {
    const tasks = Array.from({ length: Math.min(concurrency, totalRequests - batch) }, async () => {
      const t0 = performance.now();
      const res = await fetch(`${baseUrl}/route`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      });
      if (!res.ok) failures++;
      latenciesMs.push(performance.now() - t0);
    });
    await Promise.all(tasks);
  }

  const totalElapsedMs = performance.now() - startedAt;
  latenciesMs.sort((a, b) => a - b);

  const p50 = latenciesMs[Math.floor(latenciesMs.length * 0.5)] || 0;
  const p95 = latenciesMs[Math.floor(latenciesMs.length * 0.95)] || 0;
  const p99 = latenciesMs[Math.floor(latenciesMs.length * 0.99)] || 0;
  const rps = (totalRequests / (totalElapsedMs / 1000)).toFixed(1);

  console.log('=== Module 1 /route Concurrent Load Benchmark ===');
  console.log(`Requests: ${totalRequests} (concurrency=${concurrency}), Failures: ${failures}`);
  console.log(`Total Elapsed: ${totalElapsedMs.toFixed(1)} ms | Throughput: ${rps} req/s`);
  console.log(`Latency p50: ${p50.toFixed(2)} ms | p95: ${p95.toFixed(2)} ms | p99: ${p99.toFixed(2)} ms`);

  server.close();
}

runLoadTest().catch((err) => {
  console.error('Load test failed:', err);
  process.exit(1);
});

