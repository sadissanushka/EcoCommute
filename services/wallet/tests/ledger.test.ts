import { LedgerService, LedgerError } from '../src/ledger/ledgerService';

describe('Step 1.4: Double-Entry Ledger Service & Balancing Checks', () => {
  let mockClient: any;
  let mockPool: any;
  let ledgerService: LedgerService;

  beforeEach(() => {
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    mockPool = {
      query: jest.fn(),
      connect: jest.fn().mockResolvedValue(mockClient),
    };
    ledgerService = new LedgerService(mockPool as any);
  });

  describe('postTransaction balance validation', () => {
    it('rejects unbalanced transactions before reaching database', async () => {
      const unbalancedLegs: any = [
        {
          accountId: 1,
          amountMinor: 5000,
          direction: 'CREDIT',
          reason: 'trip_share',
          idempotencyKey: 'k-1',
        },
        {
          accountId: 2,
          amountMinor: 3000, // Debit 3000 != Credit 5000
          direction: 'DEBIT',
          reason: 'trip_share',
          idempotencyKey: 'k-2',
        },
      ];

      await expect(
        ledgerService.postTransaction({ legs: unbalancedLegs })
      ).rejects.toThrow(LedgerError);

      expect(mockPool.connect).not.toHaveBeenCalled();
    });

    it('rejects invalid or negative amounts', async () => {
      const invalidLegs: any = [
        {
          accountId: 1,
          amountMinor: -100,
          direction: 'CREDIT',
          reason: 'trip_share',
          idempotencyKey: 'k-1',
        },
        {
          accountId: 2,
          amountMinor: -100,
          direction: 'DEBIT',
          reason: 'trip_share',
          idempotencyKey: 'k-2',
        },
      ];

      await expect(
        ledgerService.postTransaction({ legs: invalidLegs })
      ).rejects.toThrow('Amount must be a positive integer');
    });

    it('rejects float amounts to prevent financial rounding leaks', async () => {
      const floatLegs: any = [
        {
          accountId: 1,
          amountMinor: 10.5,
          direction: 'CREDIT',
          reason: 'trip_share',
          idempotencyKey: 'k-1',
        },
        {
          accountId: 2,
          amountMinor: 10.5,
          direction: 'DEBIT',
          reason: 'trip_share',
          idempotencyKey: 'k-2',
        },
      ];

      await expect(
        ledgerService.postTransaction({ legs: floatLegs })
      ).rejects.toThrow(LedgerError);
    });

    it('successfully posts balanced multi-legged transaction', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // check existing idempotency
        .mockResolvedValueOnce({
          rows: [
            {
              id: 10,
              txnId: 'txn-123',
              accountId: 1,
              tripId: 5,
              userId: 101,
              amountMinor: '4000',
              direction: 'DEBIT',
              reason: 'trip_share',
              idempotencyKey: 'k-1',
              createdAt: new Date(),
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 11,
              txnId: 'txn-123',
              accountId: 2,
              tripId: 5,
              userId: 102,
              amountMinor: '4000',
              direction: 'CREDIT',
              reason: 'trip_share',
              idempotencyKey: 'k-2',
              createdAt: new Date(),
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const res = await ledgerService.postTransaction({
        txnId: 'txn-123',
        legs: [
          {
            accountId: 1,
            amountMinor: 4000,
            direction: 'DEBIT',
            reason: 'trip_share',
            idempotencyKey: 'k-1',
          },
          {
            accountId: 2,
            amountMinor: 4000,
            direction: 'CREDIT',
            reason: 'trip_share',
            idempotencyKey: 'k-2',
          },
        ],
      });

      expect(res.txnId).toBe('txn-123');
      expect(res.entries).toHaveLength(2);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('returns existing entries on idempotent duplicate call', async () => {
      const existingEntries = [
        {
          id: 50,
          txnId: 'txn-already-posted',
          accountId: 1,
          tripId: 10,
          userId: 1,
          amountMinor: '5000',
          direction: 'CREDIT',
          reason: 'topup',
          idempotencyKey: 'key-existing-1',
          createdAt: new Date(),
        },
      ];

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: existingEntries }) // select by idempotency key
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const res = await ledgerService.postTransaction({
        legs: [
          {
            accountId: 1,
            amountMinor: 5000,
            direction: 'CREDIT',
            reason: 'topup',
            idempotencyKey: 'key-existing-1',
          },
          {
            accountId: 2,
            amountMinor: 5000,
            direction: 'DEBIT',
            reason: 'topup',
            idempotencyKey: 'key-existing-2',
          },
        ],
      });

      expect(res.txnId).toBe('txn-already-posted');
      expect(res.entries[0].amountMinor).toBe(5000);
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });
  });

  describe('getBalance calculations', () => {
    it('retrieves and parses minor and major currency values correctly', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            accountId: 1,
            ownerType: 'user',
            ownerId: 99,
            currency: 'LKR',
            balanceMinor: '125000',
            entryCount: 4,
            lastActivityAt: new Date('2026-10-19T10:00:00Z'),
          },
        ],
      });

      const balance = await ledgerService.getBalance(1);
      expect(balance.balanceMinor).toBe(125000);
      expect(balance.balanceLkr).toBe(1250.0);
      expect(balance.currency).toBe('LKR');
      expect(balance.entryCount).toBe(4);
    });
  });
});
