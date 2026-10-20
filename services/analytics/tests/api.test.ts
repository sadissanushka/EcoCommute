import request from 'supertest';
import { app } from '../src/index';
import { pool } from '../src/db/pool';

describe('Analytics & Privacy Service HTTP Endpoints', () => {
  afterAll(async () => {
    await pool.end();
  });

  describe('GET /health', () => {
    it('returns healthy status and module 5 metadata', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.module).toBe(5);
      expect(res.body.service).toBe('analytics-privacy-service');
    });
  });

  describe('Authentication & Access Control Enforcement', () => {
    it('rejects unauthenticated requests to /analytics/summary with 401', async () => {
      const res = await request(app).get('/analytics/summary');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects unauthenticated requests to /gov/flows with 401', async () => {
      const res = await request(app).get('/gov/flows');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });
});
