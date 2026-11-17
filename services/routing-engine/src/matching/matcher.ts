import { LatLng } from '../types/index.js';
import { RoadGraph } from '../graph/graph.js';
import { findShortestPathAStar } from '../routing/astar.js';
import { haversineDistanceMeters } from '../routing/haversine.js';
import { pool } from '../graph/db.js';

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
  id?: string;
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
  plannedPath?: LatLng[];
}

export class RouteOverlapMatcher {
  private detourLimitMeters: number;
  private graph?: RoadGraph;
  private offers: Map<string, RideOffer> = new Map();
  private requests: Map<string, RideRequest> = new Map();
  private confirmedMatches: Map<string, MatchCandidate> = new Map();

  constructor(detourLimitMeters: number = 2500, graph?: RoadGraph) {
    this.detourLimitMeters = detourLimitMeters;
    this.graph = graph;
    this.seedDefaultRides();
  }

  public setGraph(graph: RoadGraph): void {
    this.graph = graph;
  }

  public getDetourLimitMeters(): number {
    return this.detourLimitMeters;
  }

  public setDetourLimitMeters(limitM: number): void {
    this.detourLimitMeters = limitM;
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

  /**
   * Persist ride offer to PostGIS `ride_offers` table when database is available.
   */
  public async persistOfferToDb(offer: RideOffer): Promise<void> {
    this.addOffer(offer);
    const numericUserId = parseInt(String(offer.userId).replace(/\D/g, ''), 10) || 1;
    try {
      await pool.query(
        `INSERT INTO ride_offers (user_id, origin, destination, recurring, women_only)
         VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326), ST_SetSRID(ST_MakePoint($4, $5), 4326), $6, $7)`,
        [
          numericUserId,
          offer.origin.lng,
          offer.origin.lat,
          offer.destination.lng,
          offer.destination.lat,
          Boolean(offer.recurring),
          Boolean(offer.womenOnly),
        ]
      );
    } catch {
      // Standalone mode: in-memory map already updated
    }
  }

  /**
   * Persist ride request to PostGIS `ride_requests` table when database is available.
   */
  public async persistRequestToDb(req: RideRequest): Promise<void> {
    this.addRequest(req);
    const numericUserId = parseInt(String(req.userId).replace(/\D/g, ''), 10) || 1;
    try {
      await pool.query(
        `INSERT INTO ride_requests (user_id, origin, destination)
         VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326), ST_SetSRID(ST_MakePoint($4, $5), 4326))`,
        [
          numericUserId,
          req.origin.lng,
          req.origin.lat,
          req.destination.lng,
          req.destination.lat,
        ]
      );
    } catch {
      // Standalone mode: in-memory map already updated
    }
  }

  public getOffers(): RideOffer[] {
    return Array.from(this.offers.values());
  }

  public getRequests(): RideRequest[] {
    return Array.from(this.requests.values());
  }

  public getOfferById(id: string): RideOffer | undefined {
    return this.offers.get(id);
  }

  public getRequestById(id: string): RideRequest | undefined {
    return this.requests.get(id);
  }

  /**
   * Privacy Masking (Section 7 Security Checklist):
   * Snaps/rounds coordinates to the nearest road node (or ~150m grid) so a commuter's
   * exact home GPS coordinate is never exposed to other users in /rides or /matches.
   */
  public maskHomeCoordinate(point: LatLng): LatLng {
    const activeGraph = this.graph ?? RoadGraph.activeInstance;
    if (activeGraph && activeGraph.nodeCount > 0) {
      let closest: LatLng | null = null;
      let minDist = Infinity;
      for (const loc of activeGraph.nodes.values()) {
        const d = haversineDistanceMeters(point, loc);
        if (d < minDist) {
          minDist = d;
          closest = loc;
        }
      }
      if (closest && minDist <= 2500) {
        return { lat: closest.lat, lng: closest.lng };
      }
    }
    // ~150m grid rounding fallback (3 decimal places ~ 111m)
    return {
      lat: Number(point.lat.toFixed(3)),
      lng: Number(point.lng.toFixed(3)),
    };
  }

  public getPublicOffers(): RideOffer[] {
    return this.getOffers().map((o) => ({
      ...o,
      origin: this.maskHomeCoordinate(o.origin),
      destination: this.maskHomeCoordinate(o.destination),
    }));
  }

  public getPublicRequests(): RideRequest[] {
    return this.getRequests().map((r) => ({
      ...r,
      origin: this.maskHomeCoordinate(r.origin),
      destination: this.maskHomeCoordinate(r.destination),
    }));
  }

  /**
   * Cross-Module Contract C3: Reads `safety.safety_preferences.women_only`
   * from PostgreSQL when available, falling back to the request flag offline.
   */
  public async resolveWomenOnlyPreference(userId: string, fallbackFlag: boolean): Promise<boolean> {
    const numericId = parseInt(String(userId).replace(/\D/g, ''), 10);
    if (!numericId || Number.isNaN(numericId)) return fallbackFlag;
    try {
      const res = await pool.query(
        `SELECT sp.women_only, u.gender
         FROM core.users u
         LEFT JOIN safety.safety_preferences sp ON sp.user_id = u.id
         WHERE u.id = $1`,
        [numericId]
      );
      if (res.rows.length > 0) {
        return Boolean(res.rows[0].women_only) || fallbackFlag;
      }
    } catch {
      // Standalone mode fallback
    }
    return fallbackFlag;
  }

  /**
   * Computes road-network distance and polyline between two coordinates using A*,
   * falling back to Haversine straight-line distance when nodes are not snapped.
   */
  public computeLegRoute(from: LatLng, to: LatLng): { distanceM: number; path: LatLng[] } {
    const activeGraph = this.graph ?? RoadGraph.activeInstance;
    if (activeGraph && activeGraph.nodeCount > 0) {
      let startNode: string | null = null;
      let endNode: string | null = null;
      let minStart = Infinity;
      let minEnd = Infinity;

      for (const [nodeId, loc] of activeGraph.nodes.entries()) {
        const d1 = haversineDistanceMeters(from, loc);
        if (d1 < minStart) {
          minStart = d1;
          startNode = nodeId;
        }
        const d2 = haversineDistanceMeters(to, loc);
        if (d2 < minEnd) {
          minEnd = d2;
          endNode = nodeId;
        }
      }

      // Only use road-graph leg if endpoints are reasonably near the graph (within 3.5 km)
      if (startNode && endNode && minStart <= 3500 && minEnd <= 3500 && startNode !== endNode) {
        const route = findShortestPathAStar(activeGraph, startNode, endNode, { mode: 'distance' });
        if (route && route.distanceM > 0) {
          return {
            distanceM: route.distanceM + minStart * 0.2 + minEnd * 0.2,
            path: route.path,
          };
        }
      }
    }

    return {
      distanceM: haversineDistanceMeters(from, to),
      path: [from, to],
    };
  }

  /**
   * Filter candidates based on preferences (e.g., women-only filter & seat capacity).
   */
  public canMatch(offer: RideOffer, request: RideRequest): boolean {
    if (offer.womenOnly || request.womenOnly) {
      if (!offer.womenOnly || !request.womenOnly) {
        return false;
      }
    }
    const available = offer.seatsAvailable ?? 1;
    const needed = request.seatsNeeded ?? 1;
    if (needed > available) {
      return false;
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
    const directLeg = this.computeLegRoute(offer.origin, offer.destination);
    const directDistanceM = directLeg.distanceM;

    // Combined tour distance (driver origin -> rider origin -> rider dest -> driver dest)
    const leg1 = this.computeLegRoute(offer.origin, request.origin);
    const leg2 = this.computeLegRoute(request.origin, request.destination);
    const leg3 = this.computeLegRoute(request.destination, offer.destination);
    const combinedTourDistanceM = leg1.distanceM + leg2.distanceM + leg3.distanceM;

    const detourAddedM = Math.max(0, Math.round(combinedTourDistanceM - directDistanceM));

    // Reject if detour exceeds configured threshold
    if (detourAddedM > this.detourLimitMeters) {
      return null;
    }

    // Overlap percentage: ratio of rider's leg to combined tour minus detour penalty
    const overlapRatio = Math.min(1.0, leg2.distanceM / Math.max(1, directDistanceM));
    const overlapPct = Math.round(Math.max(10, Math.min(98, overlapRatio * 100)));

    // DEFRA 2024 Category 7 carbon avoided metric
    const co2SavedKg = Number(((leg2.distanceM / 1000) * 0.171 * 0.72).toFixed(2));

    const plannedPath: LatLng[] = [
      ...leg1.path,
      ...leg2.path.slice(1),
      ...leg3.path.slice(1),
    ];

    return {
      id: `match-${offer.id}-${request.id}`,
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
      plannedPath,
    };
  }

  /**
   * Finds and ranks candidate matches for a specific ride request.
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

  /**
   * Greedy multi-commuter assignment (Step 3.3):
   * Repeatedly selects the highest-ranked pairing across all active offers & requests,
   * decrements remaining driver seat capacity, and assigns each request at most once.
   */
  public greedySelectAllMatches(): MatchCandidate[] {
    const allCandidates: MatchCandidate[] = [];
    for (const offer of this.offers.values()) {
      for (const req of this.requests.values()) {
        const candidate = this.evaluateMatch(offer, req);
        if (candidate) {
          allCandidates.push(candidate);
        }
      }
    }

    // Sort globally by overlapPct DESC, detourAddedM ASC
    allCandidates.sort((a, b) => b.overlapPct - a.overlapPct || a.detourAddedM - b.detourAddedM);

    const remainingSeats = new Map<string, number>();
    for (const [id, offer] of this.offers.entries()) {
      remainingSeats.set(id, offer.seatsAvailable ?? 1);
    }

    const assignedRequests = new Set<string>();
    const selected: MatchCandidate[] = [];

    for (const candidate of allCandidates) {
      if (assignedRequests.has(candidate.requestId)) continue;
      const req = this.requests.get(candidate.requestId);
      const seatsNeeded = req?.seatsNeeded ?? 1;
      const seatsLeft = remainingSeats.get(candidate.offerId) ?? 0;

      if (seatsLeft >= seatsNeeded) {
        remainingSeats.set(candidate.offerId, seatsLeft - seatsNeeded);
        assignedRequests.add(candidate.requestId);
        selected.push(candidate);
      }
    }

    return selected;
  }

  /**
   * Confirms a match, decrements seat capacity, and publishes the planned polyline
   * to `safety.route_boundaries` for Module 4's deviation detector (Contract C2).
   */
  public async confirmMatch(
    offerId: string,
    requestId: string,
    tripId?: number
  ): Promise<{ match: MatchCandidate; routeBoundaryPublished: boolean } | null> {
    const offer = this.offers.get(offerId);
    const request = this.requests.get(requestId);
    if (!offer || !request) {
      return null;
    }

    const match = this.evaluateMatch(offer, request);
    if (!match) {
      return null;
    }

    match.status = 'confirmed';
    this.confirmedMatches.set(`${offerId}:${requestId}`, match);

    // Decrement offer available seats
    const needed = request.seatsNeeded ?? 1;
    if (typeof offer.seatsAvailable === 'number') {
      offer.seatsAvailable = Math.max(0, offer.seatsAvailable - needed);
    }

    let routeBoundaryPublished = false;
    const path = match.plannedPath && match.plannedPath.length >= 2
      ? match.plannedPath
      : [offer.origin, request.origin, request.destination, offer.destination];

    // Build WKT LineString in PostGIS (lng lat) order
    const wktCoords = path.map((pt) => `${pt.lng} ${pt.lat}`).join(', ');
    const lineStringWkt = `LINESTRING(${wktCoords})`;
    const targetTripId = tripId || 1;

    try {
      await pool.query(
        `INSERT INTO safety.route_boundaries (trip_id, geom, mild_threshold_m, severe_threshold_m)
         VALUES ($1, ST_GeomFromText($2, 4326), 250, 1000)
         ON CONFLICT (trip_id) DO UPDATE SET geom = EXCLUDED.geom`,
        [targetTripId, lineStringWkt]
      );
      routeBoundaryPublished = true;
    } catch {
      // Standalone mode: DB may not be active
    }

    return { match, routeBoundaryPublished };
  }
}
