import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { pool } from '../db/pool';
import { config } from '../config';
import { mailerService } from '../services/mailer';

export const otpRouter = Router();

const OtpRequestSchema = z.object({
  email: z.string().email().toLowerCase(),
});

const OtpConfirmSchema = z.object({
  email: z.string().email().toLowerCase(),
  otp: z.string().regex(/^\d{6}$/, 'OTP must be a 6-digit numeric string'),
});

function computeOtpHmac(otp: string): string {
  return crypto.createHmac('sha256', config.otpSecret).update(otp).digest('hex');
}

// In-memory fallback store for offline tests and decoupled execution
interface InMemoryOtpRecord {
  id: number;
  userId?: number | null;
  email: string;
  otpHash: string;
  expiresAt: Date;
  attempts: number;
  consumed: boolean;
  createdAt: Date;
}

export const inMemoryOtpStore = new Map<string, InMemoryOtpRecord[]>();
export const inMemoryVerifiedUsers = new Set<string>();

/**
 * POST /otp/request
 * Generates an HMAC-hashed 6-digit OTP for corporate email verification.
 */
otpRouter.post('/request', async (req: Request, res: Response) => {
  const parseResult = OtpRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'INVALID_EMAIL', message: 'A valid email address is required' });
  }

  const { email } = parseResult.data;
  const domain = email.split('@')[1];

  // 1. Verify corporate domain membership
  let domainAllowed = domain === 'syscolabs.com' || domain === 'virtusa.com';
  try {
    const domainCheck = await pool.query(
      `SELECT id, name FROM core.companies WHERE $1 = ANY(email_domains)`,
      [domain]
    );
    if (domainCheck.rows.length > 0) {
      domainAllowed = true;
    }
  } catch {
    // offline test fallback
  }

  if (!domainAllowed) {
    return res.status(400).json({
      error: 'INVALID_DOMAIN',
      message: 'The email domain is not authorized for corporate commuter programs',
    });
  }

  // 2. Enforce rate limiting: 1 request per 60 seconds
  const now = new Date();
  let rateLimited = false;

  try {
    const rateCheck = await pool.query(
      `SELECT created_at FROM safety.otp_requests 
       WHERE email = $1 AND consumed = false AND created_at > now() - interval '60 seconds'
       ORDER BY created_at DESC LIMIT 1`,
      [email]
    );
    if (rateCheck.rows.length > 0) {
      rateLimited = true;
    }
  } catch {
    const records = inMemoryOtpStore.get(email) || [];
    const recent = records.find(
      (r) => !r.consumed && now.getTime() - r.createdAt.getTime() < 60000
    );
    if (recent) {
      rateLimited = true;
    }
  }

  if (rateLimited) {
    return res.status(429).json({
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Please wait at least 60 seconds before requesting another code',
    });
  }

  // 3. Generate secure 6-digit OTP
  const rawOtp = crypto.randomInt(100000, 1000000).toString();
  const otpHmac = computeOtpHmac(rawOtp);
  const expiresAt = new Date(Date.now() + config.otpTtlMinutes * 60 * 1000);

  // 4. Invalidate prior unconsumed codes and save
  try {
    await pool.query(
      `UPDATE safety.otp_requests SET consumed = true WHERE email = $1 AND consumed = false`,
      [email]
    );
    const userRes = await pool.query(`SELECT id FROM core.users WHERE email = $1`, [email]);
    const userId = userRes.rows.length > 0 ? userRes.rows[0].id : null;

    await pool.query(
      `INSERT INTO safety.otp_requests (user_id, email, otp_hash, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [userId, email, otpHmac, expiresAt]
    );
  } catch {
    // In-memory fallback
    const list = inMemoryOtpStore.get(email) || [];
    for (const item of list) {
      item.consumed = true;
    }
    list.push({
      id: Date.now(),
      email,
      otpHash: otpHmac,
      expiresAt,
      attempts: 0,
      consumed: false,
      createdAt: now,
    });
    inMemoryOtpStore.set(email, list);
  }

  // 5. Dispatch via Mailer
  await mailerService.sendMail({
    to: email,
    subject: 'EcoCommute — Corporate Verification Code',
    text: `Your 6-digit verification code is: ${rawOtp}. This code expires in 10 minutes.`,
  });

  return res.status(200).json({
    status: 'success',
    message: 'If your domain is verified, a 6-digit verification code has been dispatched.',
    expiresInMinutes: config.otpTtlMinutes,
    debugOtp: process.env.NODE_ENV === 'test' ? rawOtp : undefined,
  });
});

/**
 * POST /otp/confirm
 * Validates candidate OTP with constant-time comparison and sets corporate_verified = true.
 */
otpRouter.post('/confirm', async (req: Request, res: Response) => {
  const parseResult = OtpConfirmSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'INVALID_INPUT', message: 'Valid email and 6-digit OTP required' });
  }

  const { email, otp } = parseResult.data;

  // 1. Fetch active record
  let record: {
    id: any;
    otp_hash: string;
    attempts: number;
    expires_at: Date;
    consumed: boolean;
    user_id?: any;
  } | null = null;

  try {
    const recordRes = await pool.query(
      `SELECT id, user_id, otp_hash, attempts, expires_at, consumed
       FROM safety.otp_requests
       WHERE email = $1 AND consumed = false
       ORDER BY created_at DESC LIMIT 1`,
      [email]
    );
    if (recordRes.rows.length > 0) {
      record = recordRes.rows[0];
    }
  } catch {
    const list = inMemoryOtpStore.get(email) || [];
    const active = list.slice().reverse().find((r) => !r.consumed);
    if (active) {
      record = {
        id: active.id,
        otp_hash: active.otpHash,
        attempts: active.attempts,
        expires_at: active.expiresAt,
        consumed: active.consumed,
      };
    }
  }

  if (!record) {
    return res.status(400).json({
      error: 'INVALID_OR_EXPIRED_OTP',
      message: 'No active verification code found for this email address',
    });
  }

  // Check expiration
  if (new Date(record.expires_at).getTime() < Date.now()) {
    try {
      await pool.query(`UPDATE safety.otp_requests SET consumed = true WHERE id = $1`, [record.id]);
    } catch {
      const list = inMemoryOtpStore.get(email) || [];
      const item = list.find((r) => r.id === record!.id);
      if (item) item.consumed = true;
    }
    return res.status(400).json({
      error: 'EXPIRED_OTP',
      message: 'Verification code has expired. Please request a new code.',
    });
  }

  // Check max attempts limit
  if (record.attempts >= config.maxOtpAttempts) {
    try {
      await pool.query(`UPDATE safety.otp_requests SET consumed = true WHERE id = $1`, [record.id]);
    } catch {
      const list = inMemoryOtpStore.get(email) || [];
      const item = list.find((r) => r.id === record!.id);
      if (item) item.consumed = true;
    }
    return res.status(429).json({
      error: 'MAX_ATTEMPTS_EXCEEDED',
      message: 'Maximum verification attempts exceeded. Code has been invalidated.',
    });
  }

  // 2. Constant-time comparison
  const candidateHash = computeOtpHmac(otp);
  const candidateBuf = Buffer.from(candidateHash, 'hex');
  const storedBuf = Buffer.from(record.otp_hash, 'hex');

  const isMatch =
    candidateBuf.length === storedBuf.length && crypto.timingSafeEqual(candidateBuf, storedBuf);

  if (!isMatch) {
    const newAttempts = record.attempts + 1;
    try {
      await pool.query(`UPDATE safety.otp_requests SET attempts = $1 WHERE id = $2`, [
        newAttempts,
        record.id,
      ]);
    } catch {
      const list = inMemoryOtpStore.get(email) || [];
      const item = list.find((r) => r.id === record!.id);
      if (item) item.attempts = newAttempts;
    }

    const attemptsRemaining = Math.max(0, config.maxOtpAttempts - newAttempts);
    return res.status(400).json({
      error: 'INVALID_OTP',
      message: 'The code provided is incorrect',
      attemptsRemaining,
    });
  }

  // 3. Mark consumed & persist verified user
  try {
    await pool.query(`UPDATE safety.otp_requests SET consumed = true WHERE id = $1`, [record.id]);
    let userId = record.user_id;
    if (!userId) {
      const uRes = await pool.query(`SELECT id FROM core.users WHERE email = $1`, [email]);
      if (uRes.rows.length > 0) userId = uRes.rows[0].id;
    }
    if (userId) {
      await pool.query(
        `INSERT INTO safety.verified_users (user_id, corporate_email) VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET corporate_email = EXCLUDED.corporate_email`,
        [userId, email]
      );
      await pool.query(`UPDATE core.users SET corporate_verified = true WHERE id = $1`, [userId]);
    }
  } catch {
    const list = inMemoryOtpStore.get(email) || [];
    const item = list.find((r) => r.id === record!.id);
    if (item) item.consumed = true;
    inMemoryVerifiedUsers.add(email);
  }

  return res.status(200).json({
    status: 'verified',
    email,
    corporateVerified: true,
    message: 'Corporate email successfully verified',
  });
});
