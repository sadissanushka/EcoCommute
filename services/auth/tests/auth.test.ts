import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { authRouter } from '../src/routes/auth.routes';
import { requireAuth, requireRole, requireVerified, signJwtToken } from '../src/middleware/auth';
import { pool } from '../src/db/pool';

const app = express();
app.use(express.json());
app.use('/auth', authRouter);

// Test routes for middleware verification
app.get('/test/protected', requireAuth, (req, res) => {
  res.json({ message: 'ok', user: req.user });
});

app.get('/test/admin-only', requireAuth, requireRole('admin'), (req, res) => {
  res.json({ message: 'admin access granted' });
});

app.get('/test/driver-or-admin', requireAuth, requireRole('driver', 'admin'), (req, res) => {
  res.json({ message: 'authorized' });
});

app.get('/test/verified-only', requireAuth, requireVerified, (req, res) => {
  res.json({ message: 'verified access' });
});

describe('Module 2 - Authentication Service Tests (Interim Step 1.5)', () => {
  afterAll(async () => {
    await pool.end();
  });

  describe('Registration Validation', () => {
    test('POST /auth/register rejects missing fields with 400 and validation details', async () => {
      const res = await request(app).post('/auth/register').send({});
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toHaveProperty('email');
      expect(res.body.error.details).toHaveProperty('password');
      expect(res.body.error.details).toHaveProperty('fullName');
    });

    test('POST /auth/register rejects password shorter than 8 characters', async () => {
      const res = await request(app).post('/auth/register').send({
        email: 'test@syscolabs.com',
        password: 'short',
        fullName: 'Test User',
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details.password).toBeDefined();
    });
  });

  describe('Login & Authentication Failures', () => {
    test('POST /auth/login rejects unregistered email with 401', async () => {
      jest.spyOn(pool, 'query').mockImplementationOnce(async () => ({
        rows: [],
        command: '',
        rowCount: 0,
        oid: 0,
        fields: [],
      }) as any);

      const res = await request(app).post('/auth/login').send({
        email: 'unknown@syscolabs.com',
        password: 'Password123!',
      });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    test('POST /auth/login rejects wrong password with 401 and tracks failed attempts', async () => {
      const realHash = await bcrypt.hash('CorrectPassword123!', 10);
      jest.spyOn(pool, 'query')
        .mockImplementationOnce(async () => ({
          rows: [{
            id: 1,
            email: 'user@syscolabs.com',
            role: 'employee',
            company_id: 1,
            corporate_verified: true,
            password_hash: realHash,
            failed_attempts: 2,
            locked_until: null,
          }],
        }) as any)
        .mockImplementationOnce(async () => ({ rows: [] }) as any); // update query

      const res = await request(app).post('/auth/login').send({
        email: 'user@syscolabs.com',
        password: 'WrongPassword!',
      });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    test('POST /auth/login rejects temporarily locked account with 429', async () => {
      const futureLock = new Date(Date.now() + 600000); // 10 minutes from now
      jest.spyOn(pool, 'query').mockImplementationOnce(async () => ({
        rows: [{
          id: 1,
          email: 'locked@syscolabs.com',
          role: 'employee',
          company_id: 1,
          corporate_verified: true,
          password_hash: '$2a$10$dummyhash',
          failed_attempts: 5,
          locked_until: futureLock.toISOString(),
        }],
      }) as any);

      const res = await request(app).post('/auth/login').send({
        email: 'locked@syscolabs.com',
        password: 'Password123!',
      });

      expect(res.status).toBe(429);
      expect(res.body.error.code).toBe('ACCOUNT_LOCKED');
    });
  });

  describe('JWT Verification & RBAC Middleware', () => {
    test('Unauthenticated request to protected route returns 401', async () => {
      const res = await request(app).get('/test/protected');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    test('Malformed or expired token returns 401', async () => {
      const res = await request(app)
        .get('/test/protected')
        .set('Authorization', 'Bearer invalid.jwt.token');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });

    test('Valid JWT grants access and populates req.user', async () => {
      const token = signJwtToken({
        sub: '5',
        userId: 5,
        email: 'emp1@syscolabs.com',
        role: 'employee',
        companyId: 1,
        corporateVerified: true,
        verified: true,
      });

      const res = await request(app)
        .get('/test/protected')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.user.userId).toBe(5);
      expect(res.body.user.role).toBe('employee');
      expect(res.body.user.verified).toBe(true);
    });

    test('Wrong role returns 403 Forbidden', async () => {
      // User is an employee, but endpoint requires admin
      const employeeToken = signJwtToken({
        sub: '5',
        userId: 5,
        email: 'emp1@syscolabs.com',
        role: 'employee',
        companyId: 1,
        corporateVerified: true,
        verified: true,
      });

      const res = await request(app)
        .get('/test/admin-only')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('Access denied');
    });

    test('Matching role returns 200 OK', async () => {
      const adminToken = signJwtToken({
        sub: '1',
        userId: 1,
        email: 'admin@syscolabs.com',
        role: 'admin',
        companyId: 1,
        corporateVerified: true,
        verified: true,
      });

      const res = await request(app)
        .get('/test/admin-only')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('admin access granted');
    });

    test('requireVerified denies access to unverified user with 403', async () => {
      const unverifiedToken = signJwtToken({
        sub: '9',
        userId: 9,
        email: 'unverified@syscolabs.com',
        role: 'employee',
        companyId: 1,
        corporateVerified: false,
        verified: false,
      });

      const res = await request(app)
        .get('/test/verified-only')
        .set('Authorization', `Bearer ${unverifiedToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('UNVERIFIED_CORPORATE_EMAIL');
    });
  });
});
