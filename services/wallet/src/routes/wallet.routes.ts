import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { LedgerService, LedgerError } from '../ledger/ledgerService';
import { requireAuth, requireRole } from '../middleware/auth';

export const walletRouter = Router();
const ledgerService = new LedgerService();

/**
 * GET /wallet/balance
 * Returns the current wallet balance for the authenticated user or company.
 */
walletRouter.get('/balance', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const balance = await ledgerService.getBalanceByOwner('user', userId, 'LKR');
    res.json({ data: balance });
  } catch (err: any) {
    if (err instanceof LedgerError) {
      res.status(404).json({
        error: { code: err.code, message: err.message, details: err.details },
      });
      return;
    }
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: err.message, details: {} },
    });
  }
});

/**
 * GET /wallet/transactions
 * Returns paginated transaction history for the authenticated user's wallet.
 */
walletRouter.get('/transactions', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const limit = Math.min(100, parseInt(req.query.limit as string || '20', 10));
    const offset = Math.max(0, parseInt(req.query.offset as string || '0', 10));

    const account = await ledgerService.getOrCreateAccount('user', userId, 'LKR');
    const history = await ledgerService.getTransactionHistory(account.id, limit, offset);

    res.json({
      data: {
        accountId: account.id,
        limit,
        offset,
        total: history.total,
        entries: history.entries,
      },
    });
  } catch (err: any) {
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: err.message, details: {} },
    });
  }
});

/**
 * POST /wallet/topup
 * Simulated top-up endpoint for employer subsidy or development credit.
 */
walletRouter.post('/topup', requireAuth, async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      targetUserId: z.number().int().positive().optional(),
      amountMinor: z.number().int().positive('Amount must be positive integer minor units (LKR cents)'),
      idempotencyKey: z.string().min(8),
    });

    const validated = schema.parse(req.body);
    // If targetUserId is provided, require admin role; otherwise top up caller's own wallet
    const targetUserId = validated.targetUserId ?? req.user!.userId;
    if (validated.targetUserId && validated.targetUserId !== req.user!.userId) {
      if (req.user!.role !== 'admin') {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Only admins can top up wallets for other users',
            details: {},
          },
        });
        return;
      }
    }

    const result = await ledgerService.topupWallet({
      ownerType: 'user',
      ownerId: targetUserId,
      amountMinor: validated.amountMinor,
      idempotencyKey: validated.idempotencyKey,
    });

    res.status(201).json({
      data: {
        message: 'Wallet successfully topped up',
        txnId: result.txnId,
        account: result.newBalance,
      },
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid top-up parameters', details: err.flatten() },
      });
      return;
    }
    if (err instanceof LedgerError) {
      res.status(400).json({
        error: { code: err.code, message: err.message, details: err.details },
      });
      return;
    }
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: err.message, details: {} },
    });
  }
});

/**
 * POST /wallet/settle-trip
 * Executes atomic double-entry settlement for a completed carpool trip.
 * Debits all passenger wallets and credits the driver's wallet.
 */
walletRouter.post('/settle-trip', requireAuth, async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      tripId: z.number().int().positive(),
      driverUserId: z.number().int().positive(),
      passengerSplits: z.array(
        z.object({
          userId: z.number().int().positive(),
          shareMinor: z.number().int().nonnegative(),
        })
      ).min(1),
    });

    const validated = schema.parse(req.body);

    const result = await ledgerService.settleTripSplit({
      tripId: validated.tripId,
      driverUserId: validated.driverUserId,
      passengerSplits: validated.passengerSplits,
    });

    res.status(200).json({
      data: {
        message: 'Trip settled successfully',
        txnId: result.txnId,
        totalSettledMinor: result.totalSettledMinor,
        totalSettledLkr: Number((result.totalSettledMinor / 100).toFixed(2)),
        entriesCount: result.entries.length,
      },
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid settlement parameters', details: err.flatten() },
      });
      return;
    }
    if (err instanceof LedgerError) {
      res.status(400).json({
        error: { code: err.code, message: err.message, details: err.details },
      });
      return;
    }
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: err.message, details: {} },
    });
  }
});
