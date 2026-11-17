import { RouteOverlapMatcher, RideOffer, RideRequest } from '../src/matching/matcher.js';

describe('Route-Overlap Matching Engine (Step 3.3)', () => {
  let matcher: RouteOverlapMatcher;

  beforeEach(() => {
    matcher = new RouteOverlapMatcher(2500);
  });

  test('accepts commuter match along the same corridor when detour <= 2,500m', () => {
    const offer: RideOffer = {
      id: 'off-malabe',
      userId: 'driver-1',
      userName: 'Sunil Perera',
      origin: { lat: 6.9040, lng: 79.9540 }, // Malabe
      destination: { lat: 6.9344, lng: 79.8428 }, // Fort
      womenOnly: false,
      seatsAvailable: 3,
    };

    const request: RideRequest = {
      id: 'req-battr',
      userId: 'rider-1',
      userName: 'Kasun Bandara',
      origin: { lat: 6.8980, lng: 79.9210 }, // Battaramulla
      destination: { lat: 6.9344, lng: 79.8428 }, // Fort
      womenOnly: false,
      seatsNeeded: 1,
    };

    const match = matcher.evaluateMatch(offer, request);
    expect(match).not.toBeNull();
    expect(match!.detourAddedM).toBeLessThanOrEqual(2500);
    expect(match!.overlapPct).toBeGreaterThanOrEqual(60);
    expect(match!.co2SavedKg).toBeGreaterThan(0);
  });

  test('rejects candidate match when detour exceeds acceptable threshold (> 2,500m)', () => {
    const offer: RideOffer = {
      id: 'off-coastal',
      userId: 'driver-2',
      origin: { lat: 6.9344, lng: 79.8428 }, // Fort
      destination: { lat: 6.8740, lng: 79.8590 }, // Wellawatte
      womenOnly: false,
      seatsAvailable: 2,
    };

    // Rider is far inland in Kaduwela (> 12km detour off coastal road)
    const farRequest: RideRequest = {
      id: 'req-kaduwela',
      userId: 'rider-far',
      origin: { lat: 6.9357, lng: 79.9843 }, // Kaduwela
      destination: { lat: 6.8740, lng: 79.8590 },
      womenOnly: false,
      seatsNeeded: 1,
    };

    const match = matcher.evaluateMatch(offer, farRequest);
    expect(match).toBeNull();
  });

  test('enforces women-only preference filter before scoring', () => {
    const womenOnlyOffer: RideOffer = {
      id: 'off-women',
      userId: 'driver-female',
      origin: { lat: 6.9040, lng: 79.9540 },
      destination: { lat: 6.9344, lng: 79.8428 },
      womenOnly: true,
      seatsAvailable: 2,
    };

    const standardRequest: RideRequest = {
      id: 'req-std',
      userId: 'rider-male',
      origin: { lat: 6.8980, lng: 79.9210 },
      destination: { lat: 6.9344, lng: 79.8428 },
      womenOnly: false,
      seatsNeeded: 1,
    };

    const matchingWomenRequest: RideRequest = {
      id: 'req-female',
      userId: 'rider-female',
      origin: { lat: 6.8980, lng: 79.9210 },
      destination: { lat: 6.9344, lng: 79.8428 },
      womenOnly: true,
      seatsNeeded: 1,
    };

    expect(matcher.evaluateMatch(womenOnlyOffer, standardRequest)).toBeNull();
    expect(matcher.evaluateMatch(womenOnlyOffer, matchingWomenRequest)).not.toBeNull();
  });

  test('ranks multiple candidate offers by highest overlap % then lowest detour', () => {
    const m = new RouteOverlapMatcher(2500);
    const riderReq: RideRequest = {
      id: 'req-target',
      userId: 'rider-10',
      origin: { lat: 6.9094, lng: 79.8961 }, // Rajagiriya
      destination: { lat: 6.9344, lng: 79.8428 }, // Fort
      womenOnly: false,
      seatsNeeded: 1,
    };
    m.addRequest(riderReq);

    // Offer A starts very close to Rajagiriya (high overlap ratio with rider leg)
    m.addOffer({
      id: 'offer-tight',
      userId: 'driver-a',
      origin: { lat: 6.9080, lng: 79.9020 }, // Near Rajagiriya
      destination: { lat: 6.9344, lng: 79.8428 }, // Fort
      womenOnly: false,
      seatsAvailable: 2,
    });

    const ranked = m.findMatchesForRequest('req-target');
    expect(ranked.length).toBeGreaterThanOrEqual(2);
    expect(ranked[0].overlapPct).toBeGreaterThanOrEqual(ranked[1].overlapPct);
  });

  test('greedySelectAllMatches respects vehicle seat capacity across competing requests', () => {
    const m = new RouteOverlapMatcher(2500);
    // Offer on coastal corridor (Fort -> Moratuwa) with only 1 seat available
    m.addOffer({
      id: 'offer-single-seat',
      userId: 'driver-single',
      origin: { lat: 6.9344, lng: 79.8428 }, // Fort
      destination: { lat: 6.7969, lng: 79.9018 }, // Moratuwa
      womenOnly: false,
      seatsAvailable: 1,
    });

    m.addRequest({
      id: 'req-coastal-a',
      userId: 'rider-a',
      origin: { lat: 6.9065, lng: 79.8510 }, // Kollupitiya
      destination: { lat: 6.7969, lng: 79.9018 }, // Moratuwa
      womenOnly: false,
      seatsNeeded: 1,
    });

    m.addRequest({
      id: 'req-coastal-b',
      userId: 'rider-b',
      origin: { lat: 6.8740, lng: 79.8590 }, // Wellawatte
      destination: { lat: 6.7969, lng: 79.9018 }, // Moratuwa
      womenOnly: false,
      seatsNeeded: 1,
    });

    const selected = m.greedySelectAllMatches().filter((c) => c.offerId === 'offer-single-seat');
    // Only 1 request can be assigned to 'offer-single-seat' because seatsAvailable === 1
    expect(selected).toHaveLength(1);
    expect(selected[0].requestId).toBe('req-coastal-a'); // Higher overlap (Kollupitiya->Moratuwa > Wellawatte->Moratuwa)
  });
});

