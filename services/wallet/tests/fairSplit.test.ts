import {
  calculateFairSplit,
  allocateLargestRemainder,
  calculateShapleySplit,
} from '../src/calculator/fairSplit';

describe('Step 1.6: Fair-Split Cost Sharing Engine & Property Tests', () => {
  describe('allocateLargestRemainder (Hamilton-Hare exact balance)', () => {
    it('distributes minor units with zero rounding discrepancy', () => {
      // 1000 cents split among weights [1, 1, 1]
      // 1000 / 3 = 333.33 -> [334, 333, 333]
      const shares = allocateLargestRemainder(1000, [1, 1, 1]);
      expect(shares).toEqual([334, 333, 333]);
      expect(shares.reduce((a, b) => a + b, 0)).toBe(1000);
    });

    it('allocates correctly when weights are proportional to detours', () => {
      const shares = allocateLargestRemainder(5000, [2.5, 5.0, 7.5]);
      expect(shares.reduce((a, b) => a + b, 0)).toBe(5000);
      expect(shares[0]).toBeLessThan(shares[1]);
      expect(shares[1]).toBeLessThan(shares[2]);
    });
  });

  describe('calculateFairSplit detour-weighted properties', () => {
    it('evaluates hand-worked fair split example correctly', () => {
      // Total trip fuel cost: 1,500 LKR = 150,000 cents
      // Driver solo direct cost: 900 LKR = 90,000 cents
      // Shared extra: 60,000 cents
      // Passenger 1 detour: 1.0 km, Passenger 2 detour: 3.0 km
      const result = calculateFairSplit({
        totalTripCostMinor: 150000,
        driverSoloCostMinor: 90000,
        passengers: [
          { userId: 'rider-1', marginalDetourKm: 1.0 },
          { userId: 'rider-2', marginalDetourKm: 3.0 },
        ],
      });

      expect(result.sharedExtraCostMinor).toBe(60000);
      expect(result.driverReimbursementMinor).toBe(60000);
      expect(result.isExactBalance).toBe(true);

      const sumShares = result.passengers.reduce((acc, p) => acc + p.finalShareMinor, 0);
      expect(sumShares).toBe(60000);

      // Rider 2 caused 3x detour of Rider 1 -> Rider 2 pays 3x
      expect(result.passengers[0].finalShareMinor).toBe(15000); // 150.00 LKR
      expect(result.passengers[1].finalShareMinor).toBe(45000); // 450.00 LKR
    });

    it('handles single passenger edge-case (passenger pays 100% of shared extra)', () => {
      const result = calculateFairSplit({
        totalTripCostMinor: 120000,
        driverSoloCostMinor: 80000,
        passengers: [{ userId: 'solo-rider', marginalDetourKm: 2.5 }],
      });

      expect(result.sharedExtraCostMinor).toBe(40000);
      expect(result.passengers[0].finalShareMinor).toBe(40000);
      expect(result.isExactBalance).toBe(true);
    });

    it('applies floor epsilon for zero-detour pickup passenger', () => {
      const result = calculateFairSplit({
        totalTripCostMinor: 100000,
        driverSoloCostMinor: 70000,
        passengers: [
          { userId: 'rider-on-route', marginalDetourKm: 0.0 }, // 0 detour pickup
          { userId: 'rider-detour', marginalDetourKm: 2.0 },
        ],
        epsilonFloorKm: 0.2,
      });

      expect(result.sharedExtraCostMinor).toBe(30000);
      expect(result.passengers[0].weight).toBe(0.2); // clamped to floor
      expect(result.passengers[0].finalShareMinor).toBeGreaterThan(0);
      expect(result.isExactBalance).toBe(true);
    });

    it('handles company subsidy correctly', () => {
      const result = calculateFairSplit({
        totalTripCostMinor: 100000,
        driverSoloCostMinor: 60000,
        passengers: [{ userId: 'emp-1', marginalDetourKm: 2.0 }],
        companySubsidyPct: 50, // 50% paid by company
      });

      expect(result.sharedExtraCostMinor).toBe(40000);
      expect(result.passengers[0].finalShareMinor).toBe(40000);
      expect(result.passengers[0].subsidizedMinor).toBe(20000);
      expect(result.passengers[0].netPassengerPayMinor).toBe(20000);
      expect(result.companySubsidyPaidMinor).toBe(20000);
    });

    it('property test: 50 random test cases always maintain exact sum(shares) === sharedExtraCostMinor', () => {
      for (let i = 0; i < 50; i++) {
        const total = Math.floor(Math.random() * 500000) + 10000;
        const driverSolo = Math.floor(Math.random() * total);
        const numPassengers = Math.floor(Math.random() * 6) + 1; // 1 to 6 riders

        const passengers = Array.from({ length: numPassengers }, (_, idx) => ({
          userId: `user-${idx}`,
          marginalDetourKm: Number((Math.random() * 8).toFixed(2)),
        }));

        const result = calculateFairSplit({
          totalTripCostMinor: total,
          driverSoloCostMinor: driverSolo,
          passengers,
        });

        const expectedShared = total - driverSolo;
        expect(result.sharedExtraCostMinor).toBe(expectedShared);

        const sumShares = result.passengers.reduce((acc, p) => acc + p.finalShareMinor, 0);
        expect(sumShares).toBe(expectedShared);
        expect(result.isExactBalance).toBe(true);
      }
    });
  });

  describe('calculateShapleySplit (Cooperative Game Cost Allocation)', () => {
    it('computes symmetric Shapley values when passengers cause equal marginal costs', () => {
      // 3 passengers with identical subcoalition costs
      const costFn = (subset: number[]) => {
        if (subset.length === 1) return 100;
        if (subset.length === 2) return 180;
        if (subset.length === 3) return 240;
        return 0;
      };

      const shapley = calculateShapleySplit(costFn, 3);
      expect(shapley).toHaveLength(3);
      expect(shapley[0]).toBeCloseTo(80, 1);
      expect(shapley[1]).toBeCloseTo(80, 1);
      expect(shapley[2]).toBeCloseTo(80, 1);
      // Efficiency axiom: sum of Shapley values equals grand coalition cost v(N)
      const sum = shapley.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(240, 1);
    });
  });
});
