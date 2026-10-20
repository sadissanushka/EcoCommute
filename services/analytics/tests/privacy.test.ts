import {
  sampleLaplaceNoise,
  computeNoiseProfile,
  privatizeCount,
  privatizeSum,
} from '../src/privacy/laplace';
import { applyKAnonymity } from '../src/privacy/kAnonymity';
import { PrivacyBudgetService, BudgetExhaustedError } from '../src/privacy/budgetLedger';

describe('Step 4.2 & 4.3: Differential Privacy & k-Anonymity Engine', () => {
  describe('Laplace Noise Mechanism & Variance Verification', () => {
    it('verifies empirical variance approaches theoretical variance 2 * (scale)^2', () => {
      // Epsilon = 1.0, Sensitivity = 2.0 -> scale b = 2.0
      // Theoretical variance = 2 * (2.0)^2 = 8.0
      const epsilon = 1.0;
      const sensitivity = 2.0;
      const scale = sensitivity / epsilon; // 2.0
      const theoreticalVariance = 2 * Math.pow(scale, 2); // 8.0

      const samples = 2500;
      let sum = 0;
      let sumSq = 0;

      for (let i = 0; i < samples; i++) {
        const x = sampleLaplaceNoise(scale);
        sum += x;
        sumSq += x * x;
      }

      const mean = sum / samples;
      const empiricalVariance = sumSq / samples - Math.pow(mean, 2);

      // Mean should be close to 0 (Laplace is symmetric around 0)
      expect(Math.abs(mean)).toBeLessThan(0.3);
      // Empirical variance should be within 20% of theoretical 8.0 with 2500 samples
      expect(empiricalVariance).toBeGreaterThan(6.0);
      expect(empiricalVariance).toBeLessThan(10.0);
    });

    it('computes noise profile correctly without touching data', () => {
      const profile = computeNoiseProfile(2.0, 1.0);
      expect(profile.scale).toBe(0.5); // 1.0 / 2.0
      expect(profile.theoreticalVariance).toBe(0.5); // 2 * (0.5)^2 = 0.5
      expect(profile.errorBound95Pct).toBeCloseTo(1.4979, 2); // 0.5 * ln(20) = 1.4979
    });

    it('privatizes counts ensuring non-negativity and integer outputs', () => {
      for (let i = 0; i < 50; i++) {
        const res = privatizeCount(10, 1.0, 2);
        expect(res.noisyCount).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(res.noisyCount)).toBe(true);
      }
    });

    it('privatizes sums ensuring bounded sensitivity clamping', () => {
      const res = privatizeSum(150.5, 1.0, 30.0, 2);
      expect(res.noisySum).toBeGreaterThanOrEqual(0);
      expect(typeof res.noisySum).toBe('number');
    });
  });

  describe('k-Anonymity Generalisation & Suppression', () => {
    it('suppresses cells strictly below threshold k and releases cells >= k', () => {
      const cells = [
        { originZoneId: 1, destZoneId: 2, timeBucket: 'morning', rawCount: 15 },
        { originZoneId: 1, destZoneId: 3, timeBucket: 'morning', rawCount: 4 }, // < 5 -> suppressed
        { originZoneId: 2, destZoneId: 4, timeBucket: 'morning', rawCount: 2 }, // < 5 -> suppressed
        { originZoneId: 3, destZoneId: 1, timeBucket: 'morning', rawCount: 5 }, // == 5 -> released
      ];

      const report = applyKAnonymity(cells, 5);

      expect(report.kThreshold).toBe(5);
      expect(report.totalCells).toBe(4);
      expect(report.releasedCells).toBe(2);
      expect(report.suppressedCells).toBe(2);
      expect(report.utilityLossPct).toBe(50.0);

      expect(report.cells[0].isSuppressed).toBe(false);
      expect(report.cells[0].displayCount).toBe(15);

      expect(report.cells[1].isSuppressed).toBe(true);
      expect(report.cells[1].displayCount).toBe('<5');

      expect(report.cells[2].isSuppressed).toBe(true);
      expect(report.cells[2].displayCount).toBe('<5');

      expect(report.cells[3].isSuppressed).toBe(false);
      expect(report.cells[3].displayCount).toBe(5);
    });
  });

  describe('PrivacyBudgetService & Caching (Mitigating Averaging Attacks)', () => {
    let mockPool: any;
    let budgetService: PrivacyBudgetService;

    beforeEach(() => {
      mockPool = {
        query: jest.fn(),
      };
      budgetService = new PrivacyBudgetService(mockPool, 3.0);
    });

    it('returns cached result and spends 0 budget on repeated identical queries', async () => {
      // 1. Mock cache lookup to hit existing cached query
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{ cached_result: { flows: [{ id: 1, count: 25 }] } }],
        })
        .mockResolvedValueOnce({
          rows: [{ total_spent: '1.0', query_count: 1 }],
        });

      const generator = jest.fn();
      const res = await budgetService.executePrivatizedQuery(
        'policymaker-1',
        'flows',
        { from: '2026-07-01' },
        1.0,
        generator
      );

      expect(res.isCached).toBe(true);
      expect(res.data).toEqual({ flows: [{ id: 1, count: 25 }] });
      expect(generator).not.toHaveBeenCalled(); // No noise re-sampling
    });

    it('rejects query when requested epsilon exceeds remaining budget', async () => {
      // 1. Cache miss
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        // 2. Budget lookup: 2.5 already spent of 3.0 -> only 0.5 left
        .mockResolvedValueOnce({
          rows: [{ total_spent: '2.5', query_count: 2 }],
        });

      // Request 1.0 epsilon when only 0.5 remains
      await expect(
        budgetService.executePrivatizedQuery(
          'policymaker-exhausted',
          'flows',
          { from: '2026-08-01' },
          1.0,
          async () => ({ result: 'test' })
        )
      ).rejects.toThrow(BudgetExhaustedError);
    });
  });
});
