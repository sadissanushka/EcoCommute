/**
 * Module 3: Append-Only Double-Entry Ledger Service
 * 
 * Rules:
 * 1. Append-only: Updates, Deletes, and Truncates are rejected by database triggers.
 * 2. Balance consistency: sum(CREDIT) === sum(DEBIT) for every transaction ID (txn_id).
 * 3. Idempotency: All entries require unique idempotency_key. Duplicate keys are idempotent.
 * 4. Money representation: Strict 64-bit integer minor units (LKR cents).
 */

import { Pool, PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db/pool';

export interface WalletAccount {
  id: number;
  ownerType: 'user' | 'company' | 'system';
  ownerId: number;
  currency: string;
  createdAt: Date;
}

export interface AccountBalance {
  accountId: number;
  ownerType: 'user' | 'company' | 'system';
  ownerId: number;
  currency: string;
  balanceMinor: number;
  balanceLkr: number;
  entryCount: number;
  lastActivityAt: Date | null;
}

export interface LedgerLegInput {
  accountId: number;
  userId?: number;
  tripId?: number;
  amountMinor: number;
  direction: 'CREDIT' | 'DEBIT';
  reason: 'trip_share' | 'fuel_reimbursement' | 'topup' | 'adjustment';
  idempotencyKey: string;
}

export interface PostTransactionParams {
  txnId?: string;
  legs: LedgerLegInput[];
  notes?: string;
}

export interface LedgerEntryRecord {
  id: number;
  txnId: string;
  accountId: number;
  tripId: number | null;
  userId: number | null;
  amountMinor: number;
  direction: 'CREDIT' | 'DEBIT';
  reason: string;
  idempotencyKey: string;
  createdAt: Date;
}

export class LedgerError extends Error {
  constructor(public code: string, message: string, public details: Record<string, any> = {}) {
    super(message);
    this.name = 'LedgerError';
  }
}

export class LedgerService {
  constructor(private readonly dbPool: Pool = pool) {}

  /**
   * Retrieves or lazily creates a wallet account for a user, company, or system entity.
   */
  async getOrCreateAccount(
    ownerType: 'user' | 'company' | 'system',
    ownerId: number,
    currency = 'LKR',
    client?: PoolClient
  ): Promise<WalletAccount> {
    const runner = client || this.dbPool;

    // Fast path: find existing
    const existing = await runner.query(
      `SELECT id, owner_type AS "ownerType", owner_id AS "ownerId", currency, created_at AS "createdAt"
       FROM wallet.accounts
       WHERE owner_type = $1 AND owner_id = $2 AND currency = $3`,
      [ownerType, ownerId, currency]
    );

    if (existing.rows.length > 0) {
      return existing.rows[0];
    }

    // Insert new account
    const inserted = await runner.query(
      `INSERT INTO wallet.accounts (owner_type, owner_id, currency)
       VALUES ($1, $2, $3)
       ON CONFLICT (owner_type, owner_id, currency) DO UPDATE SET currency = EXCLUDED.currency
       RETURNING id, owner_type AS "ownerType", owner_id AS "ownerId", currency, created_at AS "createdAt"`,
      [ownerType, ownerId, currency]
    );

    return inserted.rows[0];
  }

  /**
   * Reads derived balance from calculated view wallet.account_balances
   */
  async getBalance(accountId: number): Promise<AccountBalance> {
    const res = await this.dbPool.query(
      `SELECT 
         account_id AS "accountId",
         owner_type AS "ownerType",
         owner_id AS "ownerId",
         currency,
         balance_minor::BIGINT AS "balanceMinor",
         entry_count::INT AS "entryCount",
         last_activity_at AS "lastActivityAt"
       FROM wallet.account_balances
       WHERE account_id = $1`,
      [accountId]
    );

    if (res.rows.length === 0) {
      throw new LedgerError('ACCOUNT_NOT_FOUND', `Account with ID ${accountId} not found`);
    }

    const row = res.rows[0];
    const balanceMinor = parseInt(row.balanceMinor, 10);
    return {
      accountId: row.accountId,
      ownerType: row.ownerType,
      ownerId: row.ownerId,
      currency: row.currency,
      balanceMinor,
      balanceLkr: Number((balanceMinor / 100).toFixed(2)),
      entryCount: row.entryCount,
      lastActivityAt: row.lastActivityAt,
    };
  }

  /**
   * Reads derived balance by owner type and owner id
   */
  async getBalanceByOwner(
    ownerType: 'user' | 'company' | 'system',
    ownerId: number,
    currency = 'LKR'
  ): Promise<AccountBalance> {
    const account = await this.getOrCreateAccount(ownerType, ownerId, currency);
    return this.getBalance(account.id);
  }

  /**
   * Posts an atomic, balanced, idempotent multi-legged double-entry transaction.
   * Enforces:
   * 1. sum(CREDITS) === sum(DEBITS)
   * 2. Atomic commit (all legs inserted or none)
   * 3. Idempotent deduplication via idempotency_key
   */
  async postTransaction(params: PostTransactionParams): Promise<{ txnId: string; entries: LedgerEntryRecord[] }> {
    const { legs } = params;
    const txnId = params.txnId || uuidv4();

    if (!legs || legs.length === 0) {
      throw new LedgerError('EMPTY_TRANSACTION', 'Transaction must contain at least two balancing legs');
    }

    // 1. Double-entry arithmetic validation
    let totalCredits = 0;
    let totalDebits = 0;

    for (const leg of legs) {
      if (!Number.isInteger(leg.amountMinor) || leg.amountMinor <= 0) {
        throw new LedgerError('INVALID_AMOUNT', `Amount must be a positive integer in minor units: ${leg.amountMinor}`);
      }
      if (leg.direction === 'CREDIT') {
        totalCredits += leg.amountMinor;
      } else if (leg.direction === 'DEBIT') {
        totalDebits += leg.amountMinor;
      } else {
        throw new LedgerError('INVALID_DIRECTION', `Direction must be CREDIT or DEBIT`);
      }
    }

    if (totalCredits !== totalDebits) {
      throw new LedgerError(
        'UNBALANCED_TRANSACTION',
        `Transaction is not balanced: total credits (${totalCredits}) != total debits (${totalDebits})`
      );
    }

    const client = await this.dbPool.connect();
    try {
      await client.query('BEGIN');

      // 2. Check for existing idempotency keys
      const keys = legs.map((l) => l.idempotencyKey);
      const existing = await client.query(
        `SELECT id, txn_id AS "txnId", account_id AS "accountId", trip_id AS "tripId",
                user_id AS "userId", amount_minor AS "amountMinor", direction, reason,
                idempotency_key AS "idempotencyKey", created_at AS "createdAt"
         FROM wallet.ledger_entries
         WHERE idempotency_key = ANY($1::text[])`,
        [keys]
      );

      if (existing.rows.length > 0) {
        // Already posted; verify all legs exist or return existing
        await client.query('COMMIT');
        return {
          txnId: existing.rows[0].txnId,
          entries: existing.rows.map((r: any) => ({
            ...r,
            amountMinor: parseInt(r.amountMinor, 10),
          })),
        };
      }

      // 3. Insert each leg
      const insertedEntries: LedgerEntryRecord[] = [];
      for (const leg of legs) {
        const insertRes = await client.query(
          `INSERT INTO wallet.ledger_entries (
             txn_id, account_id, trip_id, user_id, amount_minor, direction, reason, idempotency_key
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING id, txn_id AS "txnId", account_id AS "accountId", trip_id AS "tripId",
                     user_id AS "userId", amount_minor AS "amountMinor", direction, reason,
                     idempotency_key AS "idempotencyKey", created_at AS "createdAt"`,
          [
            txnId,
            leg.accountId,
            leg.tripId || null,
            leg.userId || null,
            leg.amountMinor,
            leg.direction,
            leg.reason,
            leg.idempotencyKey,
          ]
        );

        const row = insertRes.rows[0];
        insertedEntries.push({
          ...row,
          amountMinor: parseInt(row.amountMinor, 10),
        });
      }

      await client.query('COMMIT');
      return { txnId, entries: insertedEntries };
    } catch (err: any) {
      await client.query('ROLLBACK');
      if (err.code === '23505') {
        // Unique violation on idempotency_key
        throw new LedgerError('DUPLICATE_IDEMPOTENCY_KEY', 'Duplicate idempotency key detected concurrently');
      }
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Settles a shared carpool trip between driver and multiple passengers.
   * Atomic operation:
   * 1. DEBIT each passenger wallet
   * 2. CREDIT driver wallet equal to the exact sum of passenger debits
   */
  async settleTripSplit(params: {
    tripId: number;
    driverUserId: number;
    passengerSplits: Array<{ userId: number; shareMinor: number }>;
  }): Promise<{ txnId: string; totalSettledMinor: number; entries: LedgerEntryRecord[] }> {
    const { tripId, driverUserId, passengerSplits } = params;

    const validSplits = passengerSplits.filter((s) => s.shareMinor > 0);
    if (validSplits.length === 0) {
      return { txnId: uuidv4(), totalSettledMinor: 0, entries: [] };
    }

    const client = await this.dbPool.connect();
    try {
      // 1. Get or create driver account
      const driverAccount = await this.getOrCreateAccount('user', driverUserId, 'LKR', client);

      // 2. Build passenger DEBIT legs and calculate total credit
      const legs: LedgerLegInput[] = [];
      let totalPassengerSumMinor = 0;

      for (const split of validSplits) {
        const passengerAccount = await this.getOrCreateAccount('user', split.userId, 'LKR', client);
        totalPassengerSumMinor += split.shareMinor;

        legs.push({
          accountId: passengerAccount.id,
          userId: split.userId,
          tripId,
          amountMinor: split.shareMinor,
          direction: 'DEBIT',
          reason: 'trip_share',
          idempotencyKey: `trip:${tripId}:settle:passenger:${split.userId}`,
        });
      }

      // 3. Driver CREDIT leg
      legs.push({
        accountId: driverAccount.id,
        userId: driverUserId,
        tripId,
        amountMinor: totalPassengerSumMinor,
        direction: 'CREDIT',
        reason: 'trip_share',
        idempotencyKey: `trip:${tripId}:settle:driver:${driverUserId}`,
      });

      const txnId = `trip-settle-${tripId}`;
      const res = await this.postTransaction({ txnId, legs });

      return {
        txnId: res.txnId,
        totalSettledMinor: totalPassengerSumMinor,
        entries: res.entries,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Top-up simulated employer subsidy or user balance.
   */
  async topupWallet(params: {
    ownerType: 'user' | 'company';
    ownerId: number;
    amountMinor: number;
    systemFundingAccountName?: string;
    idempotencyKey: string;
  }): Promise<{ txnId: string; newBalance: AccountBalance }> {
    const { ownerType, ownerId, amountMinor, idempotencyKey } = params;

    if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
      throw new LedgerError('INVALID_AMOUNT', 'Top-up amount must be a positive integer in minor units');
    }

    const client = await this.dbPool.connect();
    try {
      // System Treasury Account (source of funds)
      const systemAccount = await this.getOrCreateAccount('system', 1, 'LKR', client);
      // Destination user/company account
      const destAccount = await this.getOrCreateAccount(ownerType, ownerId, 'LKR', client);

      const txnId = uuidv4();
      const legs: LedgerLegInput[] = [
        {
          accountId: systemAccount.id,
          amountMinor,
          direction: 'DEBIT',
          reason: 'topup',
          idempotencyKey: `${idempotencyKey}:system_debit`,
        },
        {
          accountId: destAccount.id,
          userId: ownerType === 'user' ? ownerId : undefined,
          amountMinor,
          direction: 'CREDIT',
          reason: 'topup',
          idempotencyKey: `${idempotencyKey}:dest_credit`,
        },
      ];

      await this.postTransaction({ txnId, legs });
      const newBalance = await this.getBalance(destAccount.id);

      return { txnId, newBalance };
    } finally {
      client.release();
    }
  }

  /**
   * Fetches paginated transaction history for an account
   */
  async getTransactionHistory(
    accountId: number,
    limit = 50,
    offset = 0
  ): Promise<{ total: number; entries: LedgerEntryRecord[] }> {
    const countRes = await this.dbPool.query(
      `SELECT COUNT(*)::INT AS total FROM wallet.ledger_entries WHERE account_id = $1`,
      [accountId]
    );

    const res = await this.dbPool.query(
      `SELECT 
         id, txn_id AS "txnId", account_id AS "accountId", trip_id AS "tripId",
         user_id AS "userId", amount_minor::BIGINT AS "amountMinor", direction, reason,
         idempotency_key AS "idempotencyKey", created_at AS "createdAt"
       FROM wallet.ledger_entries
       WHERE account_id = $1
       ORDER BY created_at DESC, id DESC
       LIMIT $2 OFFSET $3`,
      [accountId, limit, offset]
    );

    return {
      total: countRes.rows[0]?.total || 0,
      entries: res.rows.map((r: any) => ({
        ...r,
        amountMinor: parseInt(r.amountMinor, 10),
      })),
    };
  }
}
