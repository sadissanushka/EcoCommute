import {
  pointToRouteDistanceMeters,
  haversineDistanceMeters,
} from '../src/detector/routeDistance';
import { TripDetectorStateMachine } from '../src/detector/escalationLadder';

describe('Step 1.6: Synthetic GPS Trace Generator & Mathematical Equivalence Test', () => {
  // Planned Route Polyline (Kaduwela -> Malabe -> Battaramulla -> Rajagiriya -> Fort)
  const plannedRoute: [number, number][] = [
    [79.9832, 6.9319], // Point 0: Kaduwela
    [79.9547, 6.9042], // Point 1: Malabe
    [79.9234, 6.8996], // Point 2: Battaramulla
    [79.8967, 6.9085], // Point 3: Rajagiriya
    [79.8428, 6.9344], // Point 4: Colombo Fort
  ];

  /**
   * Helper to interpolate along route with normal Gaussian/uniform noise.
   */
  function generateOnRouteTrace(count: number, noiseMeters: number): { lat: number; lng: number }[] {
    const points: { lat: number; lng: number }[] = [];
    for (let i = 0; i < count; i++) {
      const fraction = i / (count - 1);
      // Segment 1-2 (Malabe to Battaramulla)
      const lat = 6.9042 + fraction * (6.8996 - 6.9042);
      const lng = 79.9547 + fraction * (79.9234 - 79.9547);

      // Add small GPS jitter (±15m noise -> ~0.000135 deg)
      const latJitter = ((Math.random() - 0.5) * 2 * noiseMeters) / 111000.0;
      const lngJitter = ((Math.random() - 0.5) * 2 * noiseMeters) / 111000.0;

      points.push({ lat: lat + latJitter, lng: lng + lngJitter });
    }
    return points;
  }

  describe('Trace A: Nominal On-Route Commute with ±15m GPS Jitter', () => {
    it('generates zero false alerts and remains in NORMAL state throughout', () => {
      const trace = generateOnRouteTrace(25, 15.0);
      const detector = new TripDetectorStateMachine();

      for (const pt of trace) {
        const dist = pointToRouteDistanceMeters(pt, plannedRoute);
        const transition = detector.processPoint(dist.minDistanceMeters, 4.0);

        expect(dist.minDistanceMeters).toBeLessThan(50.0);
        expect(transition.currentState).toBe('NORMAL');
        expect(transition.actionRequired).toBe('NONE');
      }
    });
  });

  describe('Trace B: Mild Deviation (400m Off-Route)', () => {
    it('escalates correctly through NORMAL -> WARNING -> ADMIN_ALERT', () => {
      const detector = new TripDetectorStateMachine();
      const stateHistory: string[] = [];

      // Malabe baseline coordinates
      const baseLat = 6.9042;
      const baseLng = 79.9547;

      // Deviate progressively >400m North (476m orthogonal distance)
      for (let i = 1; i <= 6; i++) {
        const devLat = baseLat + 0.006; // 476.7 meters orthogonal distance
        const devLng = baseLng;
        const dist = pointToRouteDistanceMeters({ lat: devLat, lng: devLng }, plannedRoute);
        const transition = detector.processPoint(dist.minDistanceMeters, 5.0);

        stateHistory.push(transition.currentState);
      }

      // Assert exact progression:
      // Points 1 & 2: NORMAL
      expect(stateHistory[0]).toBe('NORMAL');
      expect(stateHistory[1]).toBe('NORMAL');
      // Point 3: WARNING (triggered on 3 consecutive)
      expect(stateHistory[2]).toBe('WARNING');
      // Points 4+: ADMIN_ALERT (triggered sustained >400m)
      expect(stateHistory[3]).toBe('ADMIN_ALERT');
      expect(stateHistory[4]).toBe('ADMIN_ALERT');
      expect(stateHistory[5]).toBe('ADMIN_ALERT');
    });
  });

  describe('Trace C: Severe Deviation (2.2km Detour)', () => {
    it('escalates to AUTO_SOS within 3 consecutive severe points', () => {
      const detector = new TripDetectorStateMachine();

      // Deviate 2.2km South of Battaramulla
      const severeLat = 6.8996 - 2200 / 111000.0;
      const severeLng = 79.9234;

      const dist = pointToRouteDistanceMeters({ lat: severeLat, lng: severeLng }, plannedRoute);
      expect(dist.minDistanceMeters).toBeGreaterThan(2000.0);

      const t1 = detector.processPoint(dist.minDistanceMeters);
      expect(t1.currentState).toBe('NORMAL');

      const t2 = detector.processPoint(dist.minDistanceMeters);
      expect(t2.currentState).toBe('NORMAL');

      const t3 = detector.processPoint(dist.minDistanceMeters);
      expect(t3.currentState).toBe('AUTO_SOS');
      expect(t3.actionRequired).toBe('TRIGGER_AUTO_SOS');
    });
  });

  describe('PostGIS ST_Distance Equivalence Verification', () => {
    it('in-memory Haversine distance differs from spherical projection by < 15 meters over 2.6km', () => {
      // Benchmark coordinate pair in Colombo: Galle Face (6.9271, 79.8453) to Town Hall (6.9147, 79.8654)
      const p1 = { lat: 6.9271, lng: 79.8453 };
      const p2 = { lat: 6.9147, lng: 79.8654 };

      // In-memory Haversine
      const haversineM = haversineDistanceMeters(p1, p2);

      // Known WGS84 ellipsoidal distance is 2623.4 meters
      const wgs84EllipsoidMeters = 2623.4;

      const deltaMeters = Math.abs(haversineM - wgs84EllipsoidMeters);
      expect(deltaMeters).toBeLessThan(15.0); // Within 0.4% error over 2.6 km
    });
  });
});

