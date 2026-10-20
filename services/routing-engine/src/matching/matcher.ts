import { LatLng } from '../types/index.js';
import { haversineDistanceMeters } from '../routing/haversine.js';

export interface RideOffer {
  id: string;
  userId: string;
  userName?: string;
  origin: LatLng;
  destination: LatLng;
  timeWindowStart?: string;
  timeWindowEnd?: string;
  recurring?: boolean;
  womenOnly?: boolean;
  seatsAvailable?: number;
  vehicle?: string;
  createdAt?: string;
}

export interface RideRequest {
  id: string;
  userId: string;
  userName?: string;
  origin: LatLng;
  destination: LatLng;
  timeWindowStart?: string;
  timeWindowEnd?: string;
  womenOnly?: boolean;
  seatsNeeded?: number;
  createdAt?: string;
}

export interface MatchCandidate {
  offerId: string;
  requestId: string;
  driverName?: string;
  riderName?: string;
  directDistanceM: number;
  detourAddedM: number;
  overlapPct: number;
  co2SavedKg: number;
  status: 'proposed' | 'confirmed' | 'rejected';
  driverVehicle?: string;
}

export class RouteOverlapMatcher {
  private detourLimitMeters: number;
  private offers: Map<string, RideOffer> = new Map();
  private requests: Map<string, RideRequest> = new Map();

  constructor(detourLimitMeters: number = 2500) {
    this.detourLimitMeters = detourLimitMeters;
    this.seedDefaultRides();
  }

  private seedDefaultRides(): void {
    // Seed verified corporate ride offers along Colombo corridors
    this.addOffer({
      id: 'offer-1',
      userId: 'user-sunil',
      userName: 'Sunil Perera (Lead Eng)',
      origin: { lat: 6.9040, lng: 79.9540 }, // Malabe
      destination: { lat: 6.9344, lng: 79.8428 }, // Fort CBD
      womenOnly: false,
      seatsAvailable: 3,
      vehicle: 'Toyota Prius (Hybrid) • WP-CAR-3912',
      timeWindowStart: '07:45 AM',
    });

    this.addOffer({
      id: 'offer-2',
      userId: 'user-anusha',
      userName: 'Anusha Senanayake (QA Manager)',
      origin: { lat: 6.8410, lng: 79.9650 }, // Kottawa
      destination: { lat: 6.9050, lng: 79.8700 }, // Colombo 07
      womenOnly: true,
      seatsAvailable: 2,
      vehicle: 'Nissan Leaf (EV) • WP-EV-8842',
      timeWindowStart: '08:15 AM',
    });

    this.addRequest({
      id: 'req-1',
      userId: 'user-kasun',
      userName: 'Kasun Bandara (Dev)',
      origin: { lat: 6.8980, lng: 79.9210 }, // Battaramulla (along Malabe-Fort corridor)
      destination: { lat: 6.9344, lng: 79.8428 }, // Fort CBD
      womenOnly: false,
      seatsNeeded: 1,
      timeWindowStart: '08:00 AM',
    });
  }

  public addOffer(offer: RideOffer): void {
    this.offers.set(offer.id, {
      ...offer,
      createdAt: offer.createdAt || new Date().toISOString(),
    });
  }

  public addRequest(req: RideRequest): void {
    this.requests.set(req.id, {
      ...req,
      createdAt: req.createdAt || new Date().toISOString(),
    });
  }

  public getOffers(): RideOffer[] {
    return Array.from(this.offers.values());
  }

  public getRequests(): RideRequest[] {
    return Array.from(this.requests.values());
  }

  /**
   * Filter candidates based on preferences (e.g., women-only filter).
   */
  public canMatch(offer: RideOffer, request: RideRequest): boolean {
    if (offer.womenOnly || request.womenOnly) {
      if (!offer.womenOnly || !request.womenOnly) {
        return false;
      }
    }
    return true;
  }

  /**
   * Computes detour and overlap metrics between a driver trip and rider request.
   */
  public evaluateMatch(
    offer: RideOffer,
    request: RideRequest
  ): MatchCandidate | null {
    if (!this.canMatch(offer, request)) {
      return null;
    }

    // Direct driver distance (origin -> dest)
    const directDistanceM = haversineDistanceMeters(offer.origin, offer.destination);

    // Combined tour distance (driver origin -> rider origin -> rider dest -> driver dest)
    const leg1 = haversineDistanceMeters(offer.origin, request.origin);
    const leg2 = haversineDistanceMeters(request.origin, request.destination);
    const leg3 = haversineDistanceMeters(request.destination, offer.destination);
    const combinedTourDistanceM = leg1 + leg2 + leg3;

    const detourAddedM = Math.round(combinedTourDistanceM - directDistanceM);

    // Reject if detour exceeds configured threshold
    if (detourAddedM > this.detourLimitMeters) {
      return null;
    }

    // Overlap percentage: ratio of rider's leg to direct driver corridor
    const overlapRatio = Math.min(1.0, leg2 / Math.max(1, directDistanceM));
    const overlapPct = Math.round(Math.max(10, Math.min(98, overlapRatio * 100)));

    // DEFRA 2024 Category 7 carbon avoided metric
    const co2SavedKg = Number(((leg2 / 1000) * 0.171 * 0.72).toFixed(2));

    return {
      offerId: offer.id,
      requestId: request.id,
      driverName: offer.userName || 'Verified Colleague Driver',
      riderName: request.userName || 'Commuter',
      directDistanceM: Math.round(directDistanceM),
      detourAddedM,
      overlapPct,
      co2SavedKg,
      status: 'proposed',
      driverVehicle: offer.vehicle || 'Corporate Shuttle / Carpool',
    };
  }

  /**
   * Finds and ranks candidate matches for a specific ride offer or request.
   */
  public findMatchesForRequest(requestId: string): MatchCandidate[] {
    const request = this.requests.get(requestId);
    if (!request) return [];

    const candidates: MatchCandidate[] = [];
    for (const offer of this.offers.values()) {
      const match = this.evaluateMatch(offer, request);
      if (match) {
        candidates.push(match);
      }
    }

    // Rank greedily: Highest overlap % first, then lowest detour added
    return candidates.sort((a, b) => b.overlapPct - a.overlapPct || a.detourAddedM - b.detourAddedM);
  }

  /**
   * Finds matches for a driver's offer against all requests.
   */
  public findMatchesForOffer(offerId: string): MatchCandidate[] {
    const offer = this.offers.get(offerId);
    if (!offer) return [];

    const candidates: MatchCandidate[] = [];
    for (const request of this.requests.values()) {
      const match = this.evaluateMatch(offer, request);
      if (match) {
        candidates.push(match);
      }
    }

    return candidates.sort((a, b) => b.overlapPct - a.overlapPct || a.detourAddedM - b.detourAddedM);
  }
}
