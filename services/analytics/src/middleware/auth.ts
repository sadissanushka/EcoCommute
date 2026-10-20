import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_dev_jwt_key_32chars_min';

export interface AuthenticatedUser {
  userId: number;
  email: string;
  role: 'employee' | 'driver' | 'admin' | 'policymaker';
  companyId?: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid Authorization header',
        details: {},
      },
    });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = {
      userId: decoded.userId || decoded.sub,
      email: decoded.email,
      role: decoded.role || 'employee',
      companyId: decoded.companyId,
    };
    next();
  } catch (err: any) {
    res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Token verification failed or token expired',
        details: { reason: err.message },
      },
    });
  }
}

export function requireRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions for this analytics resource',
          details: { requiredRoles: allowedRoles, currentRole: req.user?.role },
        },
      });
      return;
    }
    next();
  };
}
