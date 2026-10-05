import { LatLng } from '../types/index.js';

export interface RideOffer {
  id: string;
  userId: string;
  origin: LatLng;
  destination: LatLng;
  timeWindowStart?: Date;
  timeWindowEnd?: Date;
  recurring?: boolean;
  womenOnly?: boolean;
}

export interface RideRequest {
  id: string;
  userId: string;
  origin: LatLng;
  destination: LatLng;
  timeWindowStart?: Date;
  timeWindowEnd?: Date;
  womenOnly?: boolean;
}

export interface MatchCandidate {
  offerId: string;
  requestId: string;
  overlapPct: number;
  detourAddedM: number;
  status: 'proposed' | 'confirmed' | 'rejected';
}

export class RouteOverlapMatcher {
  private detourLimitMeters: number;

  constructor(detourLimitMeters: number = 2000) {
    this.detourLimitMeters = detourLimitMeters;
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
    directDistanceM: number,
    combinedTourDistanceM: number
  ): { detourAddedM: number; isValid: boolean } {
    const detourAddedM = combinedTourDistanceM - directDistanceM;
    return {
      detourAddedM,
      isValid: detourAddedM <= this.detourLimitMeters,
    };
  }
}
