import request from 'supertest';
import { app } from '../src/server';
import { pool } from '../src/db/pool';
import { mailerService } from '../src/services/mailer';

describe('Step 1.5 & 1.6: Corporate Email OTP Verification Suite', () => {
  beforeAll(async () => {
    // Clean up any test records in safety.otp_requests
    try {
      await pool.query(`DELETE FROM safety.otp_requests WHERE email LIKE '%@syscolabs.com'`);
    } catch {
      // offline fallback
    }
  });

  afterAll(async () => {
    try {
      await pool.query(`DELETE FROM safety.otp_requests WHERE email LIKE '%@syscolabs.com'`);
    } catch {
      // offline fallback
    }
    await pool.end();
  });

  beforeEach(() => {
    mailerService.clearSentMails();
  });

  describe('POST /safety/otp/request', () => {
    it('rejects an invalid corporate domain with 400', async () => {
      const res = await request(app)
        .post('/safety/otp/request')
        .send({ email: 'user@gmail.com' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_DOMAIN');
    });

    it('generates an OTP for an authorized domain and dispatches email', async () => {
      const email = `emp.test.${Date.now()}@syscolabs.com`;
      const res = await request(app)
        .post('/safety/otp/request')
        .send({ email });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.expiresInMinutes).toBe(10);

      // Verify email dispatch
      const sent = mailerService.getSentMails();
      expect(sent.length).toBe(1);
      expect(sent[0].to).toBe(email);
      expect(sent[0].text).toMatch(/\d{6}/);
    });

    it('enforces 60-second rate limiting per email address', async () => {
      const email = `ratelimit.${Date.now()}@syscolabs.com`;

      // Request 1
      const res1 = await request(app)
        .post('/safety/otp/request')
        .send({ email });
      expect(res1.status).toBe(200);

      // Request 2 immediately
      const res2 = await request(app)
        .post('/safety/otp/request')
        .send({ email });
      expect(res2.status).toBe(429);
      expect(res2.body.error).toBe('RATE_LIMIT_EXCEEDED');
    });
  });

  describe('POST /safety/otp/confirm', () => {
    it('successfully confirms a valid 6-digit OTP and verifies the user', async () => {
      const email = `confirm.ok.${Date.now()}@syscolabs.com`;

      // 1. Request code
      const reqRes = await request(app)
        .post('/safety/otp/request')
        .send({ email });
      expect(reqRes.status).toBe(200);

      // Extract OTP from dispatched email
      const sent = mailerService.getSentMails();
      const match = sent[0].text.match(/\b\d{6}\b/);
      expect(match).not.toBeNull();
      const otp = match![0];

      // 2. Confirm code
      const confirmRes = await request(app)
        .post('/safety/otp/confirm')
        .send({ email, otp });

      expect(confirmRes.status).toBe(200);
      expect(confirmRes.body.status).toBe('verified');
      expect(confirmRes.body.corporateVerified).toBe(true);
    });

    it('decrements remaining attempts on incorrect code entry', async () => {
      const email = `confirm.fail.${Date.now()}@syscolabs.com`;

      await request(app)
        .post('/safety/otp/request')
        .send({ email });

      // Wrong code entry
      const failRes = await request(app)
        .post('/safety/otp/confirm')
        .send({ email, otp: '000000' });

      expect(failRes.status).toBe(400);
      expect(failRes.body.error).toBe('INVALID_OTP');
      expect(failRes.body.attemptsRemaining).toBe(4);
    });

    it('rejects an already consumed code upon reuse', async () => {
      const email = `confirm.reuse.${Date.now()}@syscolabs.com`;

      await request(app)
        .post('/safety/otp/request')
        .send({ email });

      const sent = mailerService.getSentMails();
      const otp = sent[0].text.match(/\b\d{6}\b/)![0];

      // First confirmation consumes the token
      const res1 = await request(app)
        .post('/safety/otp/confirm')
        .send({ email, otp });
      expect(res1.status).toBe(200);

      // Replay attempt must be rejected
      const res2 = await request(app)
        .post('/safety/otp/confirm')
        .send({ email, otp });
      expect(res2.status).toBe(400);
      expect(res2.body.error).toBe('INVALID_OR_EXPIRED_OTP');
    });
  });
});
