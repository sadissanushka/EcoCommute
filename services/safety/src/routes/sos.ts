import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { sosService } from '../services/sosService';
import { verifyJwtToken } from './ticket';

export const sosRouter = Router();

// Middleware to extract authenticated user from Authorization header
function authenticate(req: Request, res: Response, next: () => void) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Bearer token required' });
  }
  const token = authHeader.split(' ')[1];
  const user = verifyJwtToken(token);
  if (!user) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid token' });
  }
  (req as any).user = user;
  next();
}

const TriggerSosSchema = z.object({
  tripId: z.number().int().positive().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  note: z.string().max(500).optional(),
});

const ResolveSosSchema = z.object({
  note: z.string().min(3).max(1000),
});

/**
 * POST /sos
 * Triggers manual emergency SOS event.
 */
sosRouter.post('/', authenticate, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const parseResult = TriggerSosSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'INVALID_INPUT', message: parseResult.error.message });
  }

  const { tripId, lat, lng, note } = parseResult.data;

  const event = await sosService.triggerSos({
    tripId,
    userId: user.id,
    trigger: 'manual',
    lat,
    lng,
    companyId: user.companyId,
    note,
  });

  return res.status(201).json({
    status: 'success',
    event,
    message: 'Emergency SOS activated. Safety dispatchers have been notified.',
  });
});

/**
 * POST /sos/:id/ack
 * Acknowledges open SOS event (Admin only).
 */
sosRouter.post('/:id/ack', authenticate, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'INVALID_ID', message: 'Invalid SOS event ID' });
  }

  const event = await sosService.acknowledgeSos(id, user.id);
  if (!event) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'SOS event not found' });
  }

  return res.status(200).json({ status: 'acknowledged', event });
});

/**
 * POST /sos/:id/resolve
 * Resolves SOS event with incident resolution note (Admin only).
 */
sosRouter.post('/:id/resolve', authenticate, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'INVALID_ID', message: 'Invalid SOS event ID' });
  }

  const parseResult = ResolveSosSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'INVALID_NOTE', message: 'Resolution note required' });
  }

  const event = await sosService.resolveSos(id, user.id, parseResult.data.note);
  if (!event) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'SOS event not found' });
  }

  return res.status(200).json({ status: 'resolved', event });
});

/**
 * GET /sos/active
 * Lists open or acknowledged SOS events.
 */
sosRouter.get('/active', authenticate, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const events = await sosService.getActiveEvents(user.companyId);
  return res.status(200).json({ count: events.length, events });
});
