import {
  haversineDistanceMeters,
  pointToRouteDistanceMeters,
} from '../src/detector/routeDistance';
import {
  TripDetectorStateMachine,
  DEFAULT_DETECTOR_CONFIG,
} from '../src/detector/escalationLadder';

describe('Step 1.4: Anomaly Detector Stages 1 & 2', () => {
  // Polyline: Kaduwela -> Malabe -> Battaramulla
  const routePolyline: [number, number][] = [
    [79.9832, 6.9319], // Point 0: Kaduwela
    [79.9547, 6.9042], // Point 1: Malabe
    [79.9234, 6.8996], // Point 2: Battaramulla
  ];

  describe('Stage 1 — Orthogonal Distance to Planned Route', () => {
    it('computes near-zero distance for points lying directly on a route segment', () => {
      // Point directly on segment 0-1
      const onRoutePoint = { lat: 6.9042, lng: 79.9547 };
      const res = pointToRouteDistanceMeters(onRoutePoint, routePolyline);
      expect(res.minDistanceMeters).toBeLessThanOrEqual(5.0);
      expect(res.nearestSegmentIndex).toBe(0);
    });

    it('accurately computes orthogonal distance for off-route coordinates', () => {
      // A point 300 meters north of Battaramulla
      const offRoutePoint = { lat: 6.9023, lng: 79.9234 };
      const res = pointToRouteDistanceMeters(offRoutePoint, routePolyline);
      expect(res.minDistanceMeters).toBeGreaterThan(250.0);
      expect(res.minDistanceMeters).toBeLessThan(350.0);
    });

    it('matches spherical Haversine formula on single segment endpoints', () => {
      const p1 = { lat: 6.9042, lng: 79.9547 };
      const p2 = { lat: 6.8996, lng: 79.9234 };
      const d = haversineDistanceMeters(p1, p2);
      expect(d).toBeGreaterThan(3000);
      expect(d).toBeLessThan(4000);
    });
  });

  describe('Stage 2 — Escalation Ladder State Machine', () => {
    let sm: TripDetectorStateMachine;

    beforeEach(() => {
      sm = new TripDetectorStateMachine(DEFAULT_DETECTOR_CONFIG);
    });

    it('remains in NORMAL state when distance is within mild threshold (≤250m)', () => {
      for (let i = 0; i < 5; i++) {
        const transition = sm.processPoint(50.0);
        expect(transition.currentState).toBe('NORMAL');
        expect(transition.actionRequired).toBe('NONE');
      }
    });

    it('escalates to WARNING after 3 consecutive mild deviation points (250m-1000m)', () => {
      // Point 1
      let t = sm.processPoint(300.0);
      expect(t.currentState).toBe('NORMAL');

      // Point 2
      t = sm.processPoint(310.0);
      expect(t.currentState).toBe('NORMAL');

      // Point 3 -> Triggers WARNING
      t = sm.processPoint(320.0);
      expect(t.currentState).toBe('WARNING');
      expect(t.actionRequired).toBe('BROADCAST_WARNING');
      expect(t.escalated).toBe(true);
    });

    it('escalates to ADMIN_ALERT after 6 consecutive mild deviations or sustained >400m', () => {
      // 4 points > 400m triggers ADMIN_ALERT
      sm.processPoint(420.0);
      sm.processPoint(430.0);
      sm.processPoint(440.0); // WARNING at 3
      const t4 = sm.processPoint(450.0); // ADMIN_ALERT at 4
      expect(t4.currentState).toBe('ADMIN_ALERT');
      expect(t4.actionRequired).toBe('ADMIN_ALERT');
    });

    it('escalates to AUTO_SOS after 3 consecutive severe deviation points (≥1000m)', () => {
      sm.processPoint(1500.0);
      sm.processPoint(1800.0);
      const t3 = sm.processPoint(2200.0);

      expect(t3.currentState).toBe('AUTO_SOS');
      expect(t3.actionRequired).toBe('TRIGGER_AUTO_SOS');
      expect(t3.consecutiveSevere).toBe(3);
    });

    it('de-escalates with hysteresis requiring consecutive normal points', () => {
      // Escalate to WARNING
      sm.processPoint(300.0);
      sm.processPoint(300.0);
      sm.processPoint(300.0);
      expect(sm.currentState).toBe('WARNING');

      // Single on-route point does NOT immediately de-escalate (prevents flapping)
      let t = sm.processPoint(20.0);
      expect(t.currentState).toBe('WARNING');

      // Second consecutive on-route point resets to NORMAL
      t = sm.processPoint(20.0);
      expect(t.currentState).toBe('NORMAL');
      expect(t.deescalated).toBe(true);
    });

    it('ignores points with degraded GPS accuracy (>100m)', () => {
      const t = sm.processPoint(1500.0, 150.0); // 150m accuracy
      expect(t.actionRequired).toBe('NONE');
      expect(sm.consecutiveSevereCount).toBe(0);
    });
  });
});
