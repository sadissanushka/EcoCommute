import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AuthUser, WsTicket } from '../types';

export const ticketRouter = Router();

// In-memory single-use ticket store (ticket -> WsTicket)
export const ticketStore = new Map<string, WsTicket>();

// Periodic cleanup of expired tickets
setInterval(() => {
  const now = Date.now();
  for (const [ticket, data] of ticketStore.entries()) {
    if (data.expiresAt < now) {
      ticketStore.delete(ticket);
    }
  }
}, 10000).unref();

export function redeemTicket(ticket: string): WsTicket | null {
  const data = ticketStore.get(ticket);
  if (!data) return null;
  ticketStore.delete(ticket); // strictly single-use
  if (data.expiresAt < Date.now()) return null;
  return data;
}

export function verifyJwtToken(token: string): AuthUser | null {
  try {
    const payload = jwt.verify(token, config.jwtSecret) as any;
    return {
      id: payload.id || payload.sub || payload.userId,
      email: payload.email,
      role: payload.role || 'employee',
      companyId: payload.companyId || payload.company_id || 1,
    };
  } catch {
    return null;
  }
}

// Generate single-use 30-second ticket for WebSocket handshake
ticketRouter.post('/ticket', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Bearer token required' });
  }

  const token = authHeader.split(' ')[1];
  const user = verifyJwtToken(token);
  if (!user) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid or expired token' });
  }

  const ticket = uuidv4();
  const expiresAt = Date.now() + config.wsTicketTtlSec * 1000;

  ticketStore.set(ticket, {
    ticket,
    userId: user.id,
    email: user.email,
    role: user.role,
    companyId: user.companyId,
    expiresAt,
  });

  return res.status(201).json({
    ticket,
    expiresIn: config.wsTicketTtlSec,
    expiresAt: new Date(expiresAt).toISOString(),
  });
});
