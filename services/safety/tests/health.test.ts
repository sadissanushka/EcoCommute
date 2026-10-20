import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/server';
import { config } from '../src/config';
import { pool } from '../src/db/pool';
import { redeemTicket, ticketStore } from '../src/routes/ticket';

describe('Safety Service Phase 0 Health & Auth API', () => {
  afterAll(async () => {
    await pool.end();
  });

  describe('GET /healthz', () => {
    it('returns 200 with service metadata', async () => {
      const res = await request(app).get('/healthz');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.service).toBe('safety-tracking-service');
      expect(res.body.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('GET /health', () => {
    it('returns 200 with ok status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });

  describe('POST /safety/ticket', () => {
    const validPayload = {
      id: 2,
      email: 'driver1@syscolabs.com',
      role: 'driver',
      companyId: 1,
    };

    it('rejects unauthenticated ticket requests with 401', async () => {
      const res = await request(app).post('/safety/ticket');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('UNAUTHORIZED');
    });

    it('rejects invalid bearer token with 401', async () => {
      const res = await request(app)
        .post('/safety/ticket')
        .set('Authorization', 'Bearer invalid-token-string');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('UNAUTHORIZED');
    });

    it('generates a 30-second single-use ticket for valid JWT', async () => {
      const token = jwt.sign(validPayload, config.jwtSecret, { expiresIn: '1h' });
      const res = await request(app)
        .post('/safety/ticket')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(201);
      expect(res.body.ticket).toBeDefined();
      expect(res.body.expiresIn).toBe(30);

      // Verify ticket can be redeemed exactly once
      const ticket = res.body.ticket;
      const redeemed = redeemTicket(ticket);
      expect(redeemed).not.toBeNull();
      expect(redeemed?.userId).toBe(2);
      expect(redeemed?.role).toBe('driver');

      // Second redemption must fail (single-use)
      const secondRedeem = redeemTicket(ticket);
      expect(secondRedeem).toBeNull();
    });
  });
});
