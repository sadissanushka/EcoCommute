import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export type UserRole = 'employee' | 'driver' | 'admin' | 'policymaker';

export interface JwtUserPayload {
  sub: string;             // user id as string
  userId: number;          // numeric user id
  email: string;
  role: UserRole;
  companyId: number | null;
  corporateVerified: boolean;
  verified: boolean;       // M4 OTP verification flag
  iat?: number;
  exp?: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtUserPayload;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-for-dev-change-in-prod-2026!';

export function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
    return parts[1];
  }
  return null;
}

export function signJwtToken(payload: Omit<JwtUserPayload, 'iat' | 'exp'>, expiresIn: string = '15m'): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: expiresIn as any });
}

export function verifyJwtToken(token: string): JwtUserPayload {
  return jwt.verify(token, JWT_SECRET) as JwtUserPayload;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing or malformed Authorization header with Bearer token',
        details: {},
      },
    });
    return;
  }

  try {
    const payload = verifyJwtToken(token);
    req.user = payload;
    next();
  } catch (err: any) {
    res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token',
        details: { reason: err.message },
      },
    });
  }
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required prior to role verification',
          details: {},
        },
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. Requires one of roles: [${allowedRoles.join(', ')}]`,
          details: { currentRole: req.user.role, requiredRoles: allowedRoles },
        },
      });
      return;
    }

    next();
  };
}

export function requireVerified(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
        details: {},
      },
    });
    return;
  }

  if (!req.user.verified && !req.user.corporateVerified) {
    res.status(403).json({
      error: {
        code: 'UNVERIFIED_CORPORATE_EMAIL',
        message: 'Account requires corporate email OTP verification',
        details: {},
      },
    });
    return;
  }

  next();
}
