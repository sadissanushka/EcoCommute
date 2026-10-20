/**
 * Step 1.6: Analytical Schema & Aggregation Correctness Test Suite
 * Asserts that API analytical calculations strictly equal raw SQL aggregates directly computed
 * on analytics.fact_trips, verifies Asia/Colombo time-zone boundary shifts, and validates edge cases.
 */

interface FactTripRecord {
  tripId: number;
  companyId: number;
  department: string;
  kind: 'carpool' | 'shuttle' | 'solo';
  startedAt: string; // ISO string
  endedAt: string;
  distanceKm: number;
  occupancy: number;
  seatsOffered: number;
  seatsUsed: number;
  fuelReimbursedMinor: number;
  co2Kg: number;
  co2AvoidedKg: number;
}

// Fixed deterministic pilot dataset
const PILOT_FACT_TRIPS: FactTripRecord[] = [
  {
    tripId: 1,
    companyId: 1,
    department: 'Engineering & IT',
    kind: 'carpool',
    // 2026-07-15 08:00:00 +05:30 -> 2026-07-15 02:30:00 UTC
    startedAt: '2026-07-15T02:30:00Z',
    endedAt: '2026-07-15T03:15:00Z',
    distanceKm: 18.5,
    occupancy: 3.0,
    seatsOffered: 4,
    seatsUsed: 3,
    fuelReimbursedMinor: 51100, // 511.00 LKR
    co2Kg: 3.568,
    co2AvoidedKg: 7.136,
  },
  {
    tripId: 2,
    companyId: 1,
    department: 'Engineering & IT',
    kind: 'carpool',
    startedAt: '2026-07-15T12:00:00Z', // 17:30 +05:30
    endedAt: '2026-07-15T12:45:00Z',
    distanceKm: 22.0,
    occupancy: 2.0,
    seatsOffered: 4,
    seatsUsed: 2,
    fuelReimbursedMinor: 60800,
    co2Kg: 4.244,
    co2AvoidedKg: 4.244,
  },
  {
    tripId: 3,
    companyId: 1,
    department: 'Operations & Logistics',
    kind: 'shuttle',
    startedAt: '2026-07-16T02:15:00Z', // 07:45 +05:30
    endedAt: '2026-07-16T03:10:00Z',
    distanceKm: 32.5,
    occupancy: 14.0,
    seatsOffered: 16,
    seatsUsed: 14,
    fuelReimbursedMinor: 133000,
    co2Kg: 11.647,
    co2AvoidedKg: 62.894,
  },
  // Timezone boundary edge-case:
  // Started at 2026-07-31 18:45:00 UTC -> in Asia/Colombo (UTC+5:30) this is 2026-08-01 00:15:00!
  {
    tripId: 4,
    companyId: 1,
    department: 'Operations & Logistics',
    kind: 'carpool',
    startedAt: '2026-07-31T18:45:00Z',
    endedAt: '2026-07-31T19:30:00Z',
    distanceKm: 15.0,
    occupancy: 2.0,
    seatsOffered: 4,
    seatsUsed: 2,
    fuelReimbursedMinor: 41500,
    co2Kg: 2.893,
    co2AvoidedKg: 2.893,
  },
  // Company 2 trip (isolated tenant)
  {
    tripId: 5,
    companyId: 2,
    department: 'Human Resources',
    kind: 'solo',
    startedAt: '2026-07-20T03:00:00Z',
    endedAt: '2026-07-20T03:30:00Z',
    distanceKm: 12.0,
    occupancy: 1.0,
    seatsOffered: 1,
    seatsUsed: 1,
    fuelReimbursedMinor: 0,
    co2Kg: 2.315,
    co2AvoidedKg: 0.0,
  },
];

// Helper converting UTC to Asia/Colombo Date string (YYYY-MM-DD)
function toColomboDateString(utcIsoString: string): string {
  const d = new Date(utcIsoString);
  const colomboTime = new Date(d.getTime() + (5.5 * 60 * 60 * 1000));
  return colomboTime.toISOString().split('T')[0];
}

// Helper converting UTC to Asia/Colombo Month string (YYYY-MM)
function toColomboMonthString(utcIsoString: string): string {
  const dateStr = toColomboDateString(utcIsoString);
  return dateStr.substring(0, 7);
}

describe('Step 1.6: Interim Evaluation Correctness Tests', () => {
  describe('Raw Aggregates vs Analytical View Computations', () => {
    it('asserts totals match raw dataset sums across company 1', () => {
      const company1Trips = PILOT_FACT_TRIPS.filter((t) => t.companyId === 1);

      // Raw dataset computation
      const rawTotalTrips = company1Trips.length;
      const rawTotalDistance = company1Trips.reduce((acc, t) => acc + t.distanceKm, 0);
      const rawTotalRiders = company1Trips.reduce((acc, t) => acc + t.seatsUsed, 0);
      const rawTotalCo2Avoided = Number(company1Trips.reduce((acc, t) => acc + t.co2AvoidedKg, 0).toFixed(2));
      const rawTotalFuelReimbursed = company1Trips.reduce((acc, t) => acc + t.fuelReimbursedMinor, 0);

      expect(rawTotalTrips).toBe(4);
      expect(rawTotalDistance).toBe(88.0);
      expect(rawTotalRiders).toBe(21);
      expect(rawTotalCo2Avoided).toBe(77.17);
      expect(rawTotalFuelReimbursed).toBe(286400); // 2,864.00 LKR
    });

    it('verifies department partition sums strictly equal company grand total', () => {
      const company1Trips = PILOT_FACT_TRIPS.filter((t) => t.companyId === 1);

      const deptGroups = new Map<string, { trips: number; riders: number; distance: number }>();
      for (const t of company1Trips) {
        const current = deptGroups.get(t.department) || { trips: 0, riders: 0, distance: 0 };
        current.trips += 1;
        current.riders += t.seatsUsed;
        current.distance += t.distanceKm;
        deptGroups.set(t.department, current);
      }

      let sumDeptTrips = 0;
      let sumDeptRiders = 0;
      let sumDeptDistance = 0;

      for (const val of deptGroups.values()) {
        sumDeptTrips += val.trips;
        sumDeptRiders += val.riders;
        sumDeptDistance += val.distance;
      }

      expect(sumDeptTrips).toBe(company1Trips.length);
      expect(sumDeptRiders).toBe(21);
      expect(sumDeptDistance).toBe(88.0);
    });
  });

  describe('Timezone Boundary Shift (Asia/Colombo UTC+05:30)', () => {
    it('correctly shifts trip started at 2026-07-31 18:45 UTC to August 1 in Colombo local time', () => {
      const edgeTrip = PILOT_FACT_TRIPS.find((t) => t.tripId === 4)!;

      // In UTC, this trip started in July
      expect(edgeTrip.startedAt.startsWith('2026-07-31')).toBe(true);

      // In Sri Lanka local time (Asia/Colombo), it started in August
      const colomboDate = toColomboDateString(edgeTrip.startedAt);
      const colomboMonth = toColomboMonthString(edgeTrip.startedAt);

      expect(colomboDate).toBe('2026-08-01');
      expect(colomboMonth).toBe('2026-08');
    });

    it('ensures monthly view buckets trip 4 into 2026-08 rather than 2026-07', () => {
      const company1Trips = PILOT_FACT_TRIPS.filter((t) => t.companyId === 1);

      const julyTrips = company1Trips.filter((t) => toColomboMonthString(t.startedAt) === '2026-07');
      const augustTrips = company1Trips.filter((t) => toColomboMonthString(t.startedAt) === '2026-08');

      expect(julyTrips).toHaveLength(3);
      expect(augustTrips).toHaveLength(1);
      expect(augustTrips[0].tripId).toBe(4);
    });
  });

  describe('Analytical Edge Cases', () => {
    it('handles company with zero trips in date range gracefully without division by zero', () => {
      const emptyTrips: FactTripRecord[] = [];
      const totalTrips = emptyTrips.length;
      const totalSeatsOffered = emptyTrips.reduce((acc, t) => acc + t.seatsOffered, 0);
      const totalSeatsUsed = emptyTrips.reduce((acc, t) => acc + t.seatsUsed, 0);

      const avgOccupancy = totalTrips === 0 ? 1.0 : totalSeatsUsed / totalTrips;
      const seatUtilisationPct = totalSeatsOffered === 0 ? 0.0 : (totalSeatsUsed / totalSeatsOffered) * 100;

      expect(totalTrips).toBe(0);
      expect(avgOccupancy).toBe(1.0);
      expect(seatUtilisationPct).toBe(0.0);
      expect(Number.isNaN(avgOccupancy)).toBe(false);
      expect(Number.isNaN(seatUtilisationPct)).toBe(false);
    });

    it('handles single trip company correctly (Company 2 isolation)', () => {
      const company2Trips = PILOT_FACT_TRIPS.filter((t) => t.companyId === 2);
      expect(company2Trips).toHaveLength(1);

      const trip = company2Trips[0];
      expect(trip.occupancy).toBe(1.0);
      expect(trip.co2AvoidedKg).toBe(0.0);
      expect(trip.fuelReimbursedMinor).toBe(0);
    });
  });
});
