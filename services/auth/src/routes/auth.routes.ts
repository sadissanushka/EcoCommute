import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { z } from 'zod';
import { pool } from '../db/pool';
import { requireAuth, JwtUserPayload } from '../middleware/auth';

export const authRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-for-dev-change-in-prod-2026!';
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || '15m') as any;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'super-secret-refresh-key-for-dev-2026!';
const JWT_REFRESH_EXPIRES_IN = (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as any;

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(2),
  role: z.enum(['employee', 'driver', 'admin', 'policymaker']).default('employee'),
  gender: z.string().optional(),
  companyId: z.number().int().positive().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateTokens(user: { id: number; email: string; role: string; company_id: number | null; corporate_verified: boolean }) {
  const payload: JwtUserPayload = {
    sub: user.id.toString(),
    userId: user.id,
    email: user.email,
    role: user.role as any,
    companyId: user.company_id,
    corporateVerified: user.corporate_verified,
    verified: user.corporate_verified,
  };

  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  const rawRefreshToken = crypto.randomBytes(40).toString('hex');
  const refreshToken = jwt.sign({ sub: user.id.toString(), jti: rawRefreshToken }, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });

  return { accessToken, refreshToken, rawRefreshToken };
}

// POST /auth/register
authRouter.post('/register', async (req: Request, res: Response) => {
  const parseResult = registerSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid registration payload',
        details: parseResult.error.flatten().fieldErrors,
      },
    });
    return;
  }

  const { email, password, fullName, role, gender, companyId } = parseResult.data;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check if email already registered
    const existing = await client.query('SELECT id FROM core.users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      res.status(409).json({
        error: {
          code: 'USER_EXISTS',
          message: 'User with this email is already registered',
          details: { email },
        },
      });
      return;
    }

    // Determine company from email domain if companyId not provided
    let resolvedCompanyId = companyId || null;
    if (!resolvedCompanyId) {
      const emailDomain = email.split('@')[1];
      const compRes = await client.query(
        'SELECT id FROM core.companies WHERE $1 = ANY(email_domains) LIMIT 1',
        [emailDomain]
      );
      if (compRes.rows.length > 0) {
        resolvedCompanyId = compRes.rows[0].id;
      }
    }

    // Insert user into core.users
    const userRes = await client.query(
      `INSERT INTO core.users (company_id, email, full_name, role, gender, corporate_verified)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, company_id, email, full_name, role, corporate_verified, created_at`,
      [resolvedCompanyId, email.toLowerCase(), fullName, role, gender || null, false]
    );
    const newUser = userRes.rows[0];

    // Hash password and store in auth.credentials
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    await client.query(
      `INSERT INTO auth.credentials (user_id, password_hash)
       VALUES ($1, $2)`,
      [newUser.id, passwordHash]
    );

    const { accessToken, refreshToken, rawRefreshToken } = generateTokens(newUser);
    const hashedRefresh = hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await client.query(
      `INSERT INTO auth.refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [newUser.id, hashedRefresh, expiresAt]
    );

    await client.query('COMMIT');

    res.status(201).json({
      user: {
        id: newUser.id,
        email: newUser.email,
        fullName: newUser.full_name,
        role: newUser.role,
        companyId: newUser.company_id,
        corporateVerified: newUser.corporate_verified,
        createdAt: newUser.created_at,
      },
      tokens: {
        accessToken,
        refreshToken,
        tokenType: 'Bearer',
        expiresIn: 900,
      },
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Registration error:', err);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to register user',
        details: { error: err.message },
      },
    });
  } finally {
    client.release();
  }
});

// POST /auth/login
authRouter.post('/login', async (req: Request, res: Response) => {
  const parseResult = loginSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid login credentials format',
        details: parseResult.error.flatten().fieldErrors,
      },
    });
    return;
  }

  const { email, password } = parseResult.data;

  try {
    const userRes = await pool.query(
      `SELECT u.id, u.company_id, u.email, u.full_name, u.role, u.corporate_verified,
              c.password_hash, c.failed_attempts, c.locked_until
       FROM core.users u
       JOIN auth.credentials c ON c.user_id = u.id
       WHERE u.email = $1`,
      [email.toLowerCase()]
    );

    if (userRes.rows.length === 0) {
      res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
          details: {},
        },
      });
      return;
    }

    const user = userRes.rows[0];

    // Check account lockout
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      res.status(429).json({
        error: {
          code: 'ACCOUNT_LOCKED',
          message: 'Account temporarily locked due to too many failed attempts. Try again later.',
          details: { lockedUntil: user.locked_until },
        },
      });
      return;
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      const failed = user.failed_attempts + 1;
      let lockedUntil: Date | null = null;
      if (failed >= 5) {
        lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 min lock
      }

      await pool.query(
        'UPDATE auth.credentials SET failed_attempts = $1, locked_until = $2, updated_at = now() WHERE user_id = $3',
        [failed, lockedUntil, user.id]
      );

      res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
          details: { attemptsRemaining: Math.max(0, 5 - failed) },
        },
      });
      return;
    }

    // Reset failed attempts & update last login
    await pool.query(
      'UPDATE auth.credentials SET failed_attempts = 0, locked_until = NULL, last_login_at = now(), updated_at = now() WHERE user_id = $1',
      [user.id]
    );

    const { accessToken, refreshToken, rawRefreshToken } = generateTokens(user);
    const hashedRefresh = hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await pool.query(
      `INSERT INTO auth.refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, hashedRefresh, expiresAt]
    );

    res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        companyId: user.company_id,
        corporateVerified: user.corporate_verified,
      },
      tokens: {
        accessToken,
        refreshToken,
        tokenType: 'Bearer',
        expiresIn: 900,
      },
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Login failed',
        details: { error: err.message },
      },
    });
  }
});

// POST /auth/refresh
authRouter.post('/refresh', async (req: Request, res: Response) => {
  const parseResult = refreshSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Missing or invalid refreshToken',
        details: parseResult.error.flatten().fieldErrors,
      },
    });
    return;
  }

  const { refreshToken } = parseResult.data;

  try {
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as { sub: string; jti: string };
    const hashed = hashToken(decoded.jti);

    const tokenRes = await pool.query(
      `SELECT r.id, r.user_id, r.expires_at, r.revoked,
              u.email, u.full_name, u.role, u.company_id, u.corporate_verified
       FROM auth.refresh_tokens r
       JOIN core.users u ON u.id = r.user_id
       WHERE r.token_hash = $1`,
      [hashed]
    );

    if (tokenRes.rows.length === 0 || tokenRes.rows[0].revoked || new Date(tokenRes.rows[0].expires_at) < new Date()) {
      res.status(401).json({
        error: {
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Refresh token is expired, revoked, or invalid',
          details: {},
        },
      });
      return;
    }

    const row = tokenRes.rows[0];

    // Revoke old refresh token (rotation)
    await pool.query('UPDATE auth.refresh_tokens SET revoked = true WHERE id = $1', [row.id]);

    // Issue new token pair
    const tokens = generateTokens({
      id: row.user_id,
      email: row.email,
      role: row.role,
      company_id: row.company_id,
      corporate_verified: row.corporate_verified,
    });

    const newHashed = hashToken(tokens.rawRefreshToken);
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await pool.query(
      'INSERT INTO auth.refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [row.user_id, newHashed, newExpiresAt]
    );

    res.status(200).json({
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenType: 'Bearer',
        expiresIn: 900,
      },
    });
  } catch (err: any) {
    res.status(401).json({
      error: {
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Failed to verify refresh token',
        details: { reason: err.message },
      },
    });
  }
});

// POST /auth/logout
authRouter.post('/logout', async (req: Request, res: Response) => {
  const { refreshToken } = req.body || {};
  if (refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as { jti: string };
      const hashed = hashToken(decoded.jti);
      await pool.query('UPDATE auth.refresh_tokens SET revoked = true WHERE token_hash = $1', [hashed]);
    } catch {
      // Ignore invalid token during logout
    }
  }

  res.status(200).json({ success: true, message: 'Logged out successfully' });
});

// GET /auth/me
authRouter.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const userRes = await pool.query(
      `SELECT u.id, u.company_id, c.name AS company_name, u.email, u.full_name,
              u.role, u.gender, u.corporate_verified, u.created_at
       FROM core.users u
       LEFT JOIN core.companies c ON c.id = u.company_id
       WHERE u.id = $1`,
      [req.user!.userId]
    );

    if (userRes.rows.length === 0) {
      res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User profile not found',
          details: {},
        },
      });
      return;
    }

    res.status(200).json({ user: userRes.rows[0] });
  } catch (err: any) {
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch user profile',
        details: { error: err.message },
      },
    });
  }
});
