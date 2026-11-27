import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  AppStateStatus,
  BackHandler,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiClient, parseApiError } from '../api/client';
import { Button, Card, ErrorBanner } from '../components';
import { Colors, Radius, Spacing, Typography } from '../theme';

// ============================================================================
// Types & Contracts
// ============================================================================

export interface ShuttleVehicleLayout {
  rows?: number;
  cols?: number;
  aisleAfterCol?: number;
  aisles?: number[];
}

export interface ShuttleVehicle {
  id: number | string;
  plateNo: string;
  type: string;
  capacity: number;
  layout?: ShuttleVehicleLayout;
}

export interface ShuttleStop {
  name: string;
  lat: number;
  lng: number;
}

export interface ShuttleTrip {
  id: number | string;
  routeId?: number | string;
  routeName: string;
  originName: string;
  destinationName: string;
  stops?: ShuttleStop[];
  departAt: string;
  arriveAt: string;
  bookingCutoffAt: string;
  availableSeats: number;
  status: string;
  vehicle: ShuttleVehicle;
  driver?: {
    id: number | string;
    name: string;
  };
  driverName?: string;
}

export interface ShuttleSeat {
  id: number;
  label: string;
  row: number;
  col: number;
  isWindow: boolean;
  isAisle: boolean;
  isAccessible: boolean;
  isAvailable: boolean;
  isHeld?: boolean;
}

export interface ShuttleTripDetail extends ShuttleTrip {
  seats: ShuttleSeat[];
}

export interface UserBooking {
  id: number;
  trip_id: number;
  user_id?: string | number;
  party_size: number;
  status: string;
  created_at?: string;
  depart_at: string;
  arrive_at: string;
  route_name: string;
  origin_name: string;
  destination_name: string;
  plate_no: string;
  vehicle_type: string;
  seats: Array<{ id: number; label: string }>;
  assignedSeatIds?: number[];
}

export interface SeatHoldInfo {
  id: number;
  tripId: number;
  userId?: string | number;
  partySize: number;
  status: string;
  expiresAt: string;
  expiresInSeconds: number;
  seatIds?: number[];
  seats?: ShuttleSeat[];
  allocationType?: string;
}

export interface WaitlistEntry {
  id: number;
  tripId?: number;
  partySize: number;
  status: string;
  position: number;
}

export interface UserWaitlistEntry {
  id: number;
  tripId: number;
  partySize: number;
  status: string;
  position: number;
  departAt: string;
  arriveAt: string;
  routeName: string;
  originName: string;
  destinationName: string;
  plateNo: string;
  vehicleType: string;
  createdAt?: string;
}

export type ShuttlesActiveScreen = 'search' | 'details' | 'confirmation' | 'bookings';

// UUID v4 generator for Idempotency-Key
function generateIdempotencyKey(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function formatDateTime(isoString?: string): string {
  if (!isoString) return '—';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return date.toLocaleString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

function formatTimeOnly(isoString?: string): string {
  if (!isoString) return '—';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

function resolveErrorMessage(err: unknown): string {
  const parsed = parseApiError(err);
  const code = parsed.code || '';
  const messageMap: Record<string, string> = {
    SEAT_UNAVAILABLE: 'One or more selected seats are no longer available. Refreshing the seat map.',
    DUPLICATE_BOOKING: 'You already hold an active booking or waitlist entry on this shuttle trip.',
    INSUFFICIENT_CAPACITY: 'There are not enough seats available on this shuttle for the requested party size.',
    CUTOFF_PASSED: 'The booking cutoff time has passed for this shuttle trip. Bookings are closed.',
    ACCESSIBLE_SEAT_REQUIRED: 'At least one selected seat must be accessible for an accessibility request.',
    ALREADY_BOOKED: 'You already hold a confirmed booking on this trip.',
    DUPLICATE_WAITLIST: 'You are already on the waitlist for this shuttle trip.',
    HOLD_EXPIRED: 'This seat hold has expired. Please refresh and select seats again.',
    ACTIVE_HOLD_EXISTS: 'You already have an active hold on this trip. Confirm or release it before creating another.',
    NETWORK_ERROR: 'Could not connect to the booking server. Please check your connection and retry.',
    '401': 'Your session has expired. Please sign in again.',
    '403': 'You are not authorized to perform this booking action.',
    '404': 'The requested trip or booking was not found.',
  };

  return messageMap[code] || messageMap[String(parsed.status)] || parsed.message || 'An unexpected error occurred.';
}

export const ShuttlesScreen: React.FC = () => {
  // Navigation State
  const [currentScreen, setCurrentScreen] = useState<ShuttlesActiveScreen>('search');

  // Search Screen State
  const [trips, setTrips] = useState<ShuttleTrip[]>([]);
  const [searchOrigin, setSearchOrigin] = useState('');
  const [searchDestination, setSearchDestination] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const [partySize, setPartySize] = useState<number>(1);
  const [isSearching, setIsSearching] = useState(false);

  // Trip Details & Seat Map State
  const [selectedTrip, setSelectedTrip] = useState<ShuttleTripDetail | null>(null);
  const [selectedSeatIds, setSelectedSeatIds] = useState<number[]>([]);
  const [autoAllocate, setAutoAllocate] = useState(false);
  const [requireAccessible, setRequireAccessible] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Temporary Hold State
  const [activeHold, setActiveHold] = useState<SeatHoldInfo | null>(null);
  const [holdRemainingSeconds, setHoldRemainingSeconds] = useState<number>(0);

  // Waitlist & Promotion State
  const [activeWaitlist, setActiveWaitlist] = useState<WaitlistEntry | null>(null);
  const [wasWaitlisted, setWasWaitlisted] = useState(false);
  const [promotedBooking, setPromotedBooking] = useState<UserBooking | null>(null);

  // Confirmation State
  const [confirmedBooking, setConfirmedBooking] = useState<{
    id: number;
    status: string;
    partySize: number;
    assignedSeatLabels: string[];
    trip: ShuttleTripDetail;
  } | null>(null);

  // My Bookings State
  const [userBookings, setUserBookings] = useState<UserBooking[]>([]);
  const [userWaitlists, setUserWaitlists] = useState<UserWaitlistEntry[]>([]);
  const [isLoadingBookings, setIsLoadingBookings] = useState(false);

  // Idempotency Retry Cache
  const [pendingBookingAttempt, setPendingBookingAttempt] = useState<{
    key: string;
    payloadHash: string;
  } | null>(null);

  // ============================================================================
  // Android Hardware Back Button Handling
  // ============================================================================
  useEffect(() => {
    const onBackPress = () => {
      if (currentScreen === 'details' || currentScreen === 'bookings' || currentScreen === 'confirmation') {
        setCurrentScreen('search');
        setErrorMessage(null);
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, [currentScreen]);

  // ============================================================================
  // API Operations
  // ============================================================================

  const fetchTrips = useCallback(async () => {
    setIsSearching(true);
    setErrorMessage(null);
    try {
      const params: Record<string, string | number> = {};
      if (searchOrigin.trim()) params.origin = searchOrigin.trim();
      if (searchDestination.trim()) params.destination = searchDestination.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(searchDate.trim())) params.date = searchDate.trim();

      const res = await apiClient.get('/trips', { params });
      const fetchedTrips = Array.isArray(res.data?.trips) ? res.data.trips : [];
      setTrips(fetchedTrips);
    } catch (err) {
      setTrips([]);
      setErrorMessage(resolveErrorMessage(err));
    } finally {
      setIsSearching(false);
    }
  }, [searchOrigin, searchDestination, searchDate]);

  const fetchUserBookings = useCallback(async () => {
    setIsLoadingBookings(true);
    try {
      const [bookingsRes, waitlistRes] = await Promise.allSettled([
        apiClient.get('/bookings/me'),
        apiClient.get('/trips/waitlist/me'),
      ]);

      if (bookingsRes.status === 'fulfilled') {
        const bookings = Array.isArray(bookingsRes.value.data?.bookings) ? bookingsRes.value.data.bookings : [];
        setUserBookings(bookings);
      }
      if (waitlistRes.status === 'fulfilled') {
        const waitlists = Array.isArray(waitlistRes.value.data?.waitlist) ? waitlistRes.value.data.waitlist : [];
        setUserWaitlists(waitlists);
      }
    } catch (err) {
      setErrorMessage(resolveErrorMessage(err));
    } finally {
      setIsLoadingBookings(false);
    }
  }, []);

  const refreshTripDetails = useCallback(async (tripId?: number | string) => {
    const id = tripId ?? selectedTrip?.id;
    if (!id) return;
    const res = await apiClient.get(`/trips/${id}`);
    const trip = res.data?.trip;
    if (!trip) throw new Error('Shuttle trip detail response was missing data');
    setSelectedTrip({
      ...trip,
      id: Number(trip.id),
      seats: (trip.seats || []).map((s: any) => ({
        ...s,
        id: Number(s.id),
        row: Number(s.row),
        col: Number(s.col),
        isAvailable: Boolean(s.isAvailable),
        isAccessible: Boolean(s.isAccessible),
        isWindow: Boolean(s.isWindow),
        isAisle: Boolean(s.isAisle),
      })),
    });
  }, [selectedTrip?.id]);

  // Initial load
  useEffect(() => {
    fetchTrips();
    fetchUserBookings();
  }, [fetchTrips, fetchUserBookings]);

  // AppState foreground refresh
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        fetchTrips();
        fetchUserBookings();
        if (currentScreen === 'details' && selectedTrip) {
          refreshTripDetails(selectedTrip.id).catch(() => undefined);
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [currentScreen, selectedTrip, fetchTrips, fetchUserBookings, refreshTripDetails]);

  // Hold expiration countdown timer
  useEffect(() => {
    if (!activeHold || activeHold.status !== 'held') {
      setHoldRemainingSeconds(0);
      return;
    }

    const calculateSeconds = () => {
      const diff = Math.max(0, Math.floor((new Date(activeHold.expiresAt).getTime() - Date.now()) / 1000));
      setHoldRemainingSeconds(diff);
      if (diff === 0 && activeHold.status === 'held') {
        setActiveHold((prev) => (prev ? { ...prev, status: 'expired' } : null));
      }
    };

    calculateSeconds();
    const interval = setInterval(calculateSeconds, 1000);
    return () => clearInterval(interval);
  }, [activeHold]);

  // Waitlist status polling and automatic promotion detector
  useEffect(() => {
    if (currentScreen !== 'details' || !selectedTrip) return;

    const interval = setInterval(async () => {
      try {
        const [waitlistRes, bookingsRes] = await Promise.allSettled([
          apiClient.get(`/trips/${selectedTrip.id}/waitlist/me`),
          apiClient.get('/bookings/me'),
        ]);

        const latestWaitlist =
          waitlistRes.status === 'fulfilled' ? waitlistRes.value.data?.waitlist || null : null;
        const latestBookings: UserBooking[] =
          bookingsRes.status === 'fulfilled' ? bookingsRes.value.data?.bookings || [] : userBookings;

        if (waitlistRes.status === 'fulfilled') {
          setActiveWaitlist(latestWaitlist);
        }
        if (bookingsRes.status === 'fulfilled') {
          setUserBookings(latestBookings);
        }

        // Detect automatic promotion
        if (wasWaitlisted && (!latestWaitlist || latestWaitlist.status !== 'waiting')) {
          const matchingBooking = latestBookings.find(
            (b) => Number(b.trip_id) === Number(selectedTrip.id) && b.status === 'confirmed'
          );
          if (matchingBooking) {
            setPromotedBooking(matchingBooking);
            setActiveWaitlist(null);
            refreshTripDetails(selectedTrip.id).catch(() => undefined);
          }
        }
      } catch {
        // Keep resilient on background poll failure
      }
    }, 12000);

    return () => clearInterval(interval);
  }, [currentScreen, selectedTrip, wasWaitlisted, userBookings, refreshTripDetails]);

  // ============================================================================
  // User Actions
  // ============================================================================

  const handleOpenTrip = async (trip: ShuttleTrip) => {
    setIsActionLoading(true);
    setErrorMessage(null);
    setSelectedTrip(null);
    setSelectedSeatIds([]);
    setActiveHold(null);
    setActiveWaitlist(null);
    setWasWaitlisted(false);
    setPromotedBooking(null);
    setPendingBookingAttempt(null);

    try {
      await refreshTripDetails(trip.id);
      setCurrentScreen('details');

      // Check if user is currently waitlisted
      try {
        const waitRes = await apiClient.get(`/trips/${trip.id}/waitlist/me`);
        if (waitRes.data?.waitlist) {
          setActiveWaitlist(waitRes.data.waitlist);
          setWasWaitlisted(true);
        }
      } catch {
        setActiveWaitlist(null);
      }
    } catch (err) {
      setErrorMessage(resolveErrorMessage(err));
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleToggleSeat = (seat: ShuttleSeat) => {
    if (!seat.isAvailable || isActionLoading || activeHold) return;

    setAutoAllocate(false);

    setSelectedSeatIds((prev) => {
      if (prev.includes(seat.id)) {
        return prev.filter((id) => id !== seat.id);
      }

      if (partySize === 1) {
        // Replace single seat selection directly
        return [seat.id];
      }

      if (prev.length < partySize) {
        return [...prev, seat.id];
      }

      // Already selected partySize seats; alert user or replace oldest
      Alert.alert(
        'Party Size Reached',
        `You have already selected ${partySize} seat${partySize === 1 ? '' : 's'} for your party. Deselect a seat first to choose a different one.`
      );
      return prev;
    });
  };

  const handleSetPartySize = (newSize: number) => {
    const clamped = Math.max(1, Math.min(6, newSize));
    setPartySize(clamped);
    setSelectedSeatIds([]);
    setPendingBookingAttempt(null);
  };

  // Group seats by physical row
  const seatsByRow = useMemo(() => {
    if (!selectedTrip?.seats) return [];
    const rowsMap = new Map<number, ShuttleSeat[]>();
    for (const seat of selectedTrip.seats) {
      if (!rowsMap.has(seat.row)) {
        rowsMap.set(seat.row, []);
      }
      rowsMap.get(seat.row)!.push(seat);
    }
    return Array.from(rowsMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([row, seats]) => [row, seats.sort((a, b) => a.col - b.col)] as const);
  }, [selectedTrip?.seats]);

  const getSeatLabels = useCallback(
    (seatIds: number[]): string[] => {
      if (!selectedTrip?.seats) return [];
      return seatIds
        .map((id) => selectedTrip.seats.find((s) => Number(s.id) === Number(id))?.label)
        .filter((label): label is string => Boolean(label));
    },
    [selectedTrip?.seats]
  );

  // Book Seats Operation
  const handleBookSeats = async () => {
    if (!selectedTrip) return;

    if (!autoAllocate && selectedSeatIds.length !== partySize) {
      setErrorMessage(
        `Please select exactly ${partySize} seat${partySize === 1 ? '' : 's'} on the seat map, or enable automatic allocation.`
      );
      return;
    }

    const payload = {
      partySize: Number(partySize),
      ...(!autoAllocate && selectedSeatIds.length > 0 ? { seatIds: selectedSeatIds.map(Number) } : {}),
      ...(requireAccessible ? { requireAccessible: true } : {}),
    };

    const payloadHash = JSON.stringify(payload);
    const idempotencyKey =
      pendingBookingAttempt && pendingBookingAttempt.payloadHash === payloadHash
        ? pendingBookingAttempt.key
        : generateIdempotencyKey();

    setPendingBookingAttempt({ key: idempotencyKey, payloadHash });
    setIsActionLoading(true);
    setErrorMessage(null);

    try {
      const res = await apiClient.post(`/trips/${selectedTrip.id}/bookings`, payload, {
        headers: { 'Idempotency-Key': idempotencyKey },
      });

      const booking = res.data?.booking;
      if (!booking?.id) {
        throw new Error('The booking service did not return a confirmed booking ID.');
      }

      const assignedIds: number[] = booking.assignedSeatIds || selectedSeatIds;
      const assignedLabels = getSeatLabels(assignedIds);

      setConfirmedBooking({
        id: booking.id,
        status: booking.status,
        partySize: booking.partySize,
        assignedSeatLabels: assignedLabels,
        trip: selectedTrip,
      });

      setActiveHold(null);
      setPendingBookingAttempt(null);
      setCurrentScreen('confirmation');

      await Promise.all([fetchTrips(), fetchUserBookings(), refreshTripDetails(selectedTrip.id)]);
    } catch (err) {
      setErrorMessage(resolveErrorMessage(err));
      await refreshTripDetails(selectedTrip.id).catch(() => undefined);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Hold Seats Operation
  const handleCreateHold = async () => {
    if (!selectedTrip) return;

    if (!autoAllocate && selectedSeatIds.length !== partySize) {
      setErrorMessage(`Please select ${partySize} seat${partySize === 1 ? '' : 's'} to hold.`);
      return;
    }

    setIsActionLoading(true);
    setErrorMessage(null);

    try {
      const payload = {
        partySize: Number(partySize),
        ...(!autoAllocate && selectedSeatIds.length > 0 ? { seatIds: selectedSeatIds.map(Number) } : {}),
        ...(requireAccessible ? { requireAccessible: true } : {}),
      };

      const res = await apiClient.post(`/trips/${selectedTrip.id}/holds`, payload);
      const hold = res.data?.hold;
      if (!hold?.id) throw new Error('Hold could not be established by the server.');

      setActiveHold(hold);
      setSelectedSeatIds([]);
      await refreshTripDetails(selectedTrip.id);
    } catch (err) {
      setErrorMessage(resolveErrorMessage(err));
      await refreshTripDetails(selectedTrip.id).catch(() => undefined);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Confirm Active Hold
  const handleConfirmHold = async () => {
    if (!selectedTrip || !activeHold) return;

    const idempotencyKey = pendingBookingAttempt?.key || generateIdempotencyKey();
    setPendingBookingAttempt({ key: idempotencyKey, payloadHash: String(activeHold.id) });
    setIsActionLoading(true);
    setErrorMessage(null);

    try {
      const res = await apiClient.post(
        `/trips/${selectedTrip.id}/holds/${activeHold.id}/confirm`,
        {},
        { headers: { 'Idempotency-Key': idempotencyKey } }
      );

      const booking = res.data?.booking;
      if (!booking?.id) throw new Error('The hold could not be confirmed into a booking.');

      const assignedIds: number[] = booking.assignedSeatIds || activeHold.seatIds || [];
      const assignedLabels = getSeatLabels(assignedIds);

      setConfirmedBooking({
        id: booking.id,
        status: booking.status,
        partySize: booking.partySize,
        assignedSeatLabels: assignedLabels,
        trip: selectedTrip,
      });

      setActiveHold(null);
      setPendingBookingAttempt(null);
      setCurrentScreen('confirmation');

      await Promise.all([fetchTrips(), fetchUserBookings(), refreshTripDetails(selectedTrip.id)]);
    } catch (err) {
      setErrorMessage(resolveErrorMessage(err));
      try {
        const checkRes = await apiClient.get(`/trips/${selectedTrip.id}/holds/${activeHold.id}`);
        setActiveHold(checkRes.data?.hold || activeHold);
      } catch {
        // retain existing hold
      }
    } finally {
      setIsActionLoading(false);
    }
  };

  // Release Active Hold
  const handleReleaseHold = async () => {
    if (!selectedTrip || !activeHold) return;
    setIsActionLoading(true);
    try {
      await apiClient.delete(`/trips/${selectedTrip.id}/holds/${activeHold.id}`);
      setActiveHold(null);
      setPendingBookingAttempt(null);
      await refreshTripDetails(selectedTrip.id);
    } catch (err) {
      setErrorMessage(resolveErrorMessage(err));
    } finally {
      setIsActionLoading(false);
    }
  };

  // Waitlist Operations
  const handleJoinWaitlist = async () => {
    if (!selectedTrip) return;
    setIsActionLoading(true);
    setErrorMessage(null);

    try {
      const res = await apiClient.post(`/trips/${selectedTrip.id}/waitlist`, { partySize: Number(partySize) });
      const waitlist = res.data?.waitlist;
      setActiveWaitlist(waitlist || null);
      setWasWaitlisted(true);
      await fetchUserBookings();
      Alert.alert(
        'Waitlist Joined',
        `You have joined the waitlist for ${selectedTrip.routeName} at position #${waitlist?.position || 1}. You will be automatically assigned seats if capacity becomes available.`
      );
    } catch (err) {
      setErrorMessage(resolveErrorMessage(err));
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleJoinWaitlistFromTripCard = async (trip: ShuttleTrip) => {
    setIsActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await apiClient.post(`/trips/${trip.id}/waitlist`, { partySize: Number(partySize) });
      const waitlist = res.data?.waitlist;
      await fetchUserBookings();
      Alert.alert(
        'Waitlist Joined',
        `You joined the waitlist for ${trip.routeName} (Party of ${partySize}) at position #${waitlist?.position || 1}.\n\nYou can track this entry anytime under 'My Bookings'.`,
        [
          { text: 'Keep Browsing', style: 'default' },
          {
            text: 'View in My Bookings',
            style: 'default',
            onPress: () => {
              setCurrentScreen('bookings');
            },
          },
        ]
      );
    } catch (err) {
      setErrorMessage(resolveErrorMessage(err));
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleLeaveWaitlistFromBookings = (entry: UserWaitlistEntry) => {
    Alert.alert(
      'Leave Shuttle Waitlist?',
      `Are you sure you want to leave the waitlist for ${entry.routeName} (Position #${entry.position})?`,
      [
        { text: 'Keep Spot', style: 'cancel' },
        {
          text: 'Leave Waitlist',
          style: 'destructive',
          onPress: async () => {
            setIsActionLoading(true);
            try {
              await apiClient.delete(`/trips/${entry.tripId}/waitlist/me`);
              setUserWaitlists((prev) => prev.filter((w) => w.id !== entry.id));
              Alert.alert('Waitlist Left', 'You have been removed from the shuttle waitlist.');
            } catch (err) {
              setErrorMessage(resolveErrorMessage(err));
            } finally {
              setIsActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleLeaveWaitlist = async () => {
    if (!selectedTrip) return;
    setIsActionLoading(true);
    try {
      await apiClient.delete(`/trips/${selectedTrip.id}/waitlist/me`);
      setActiveWaitlist(null);
      setWasWaitlisted(false);
      await fetchUserBookings();
    } catch (err) {
      setErrorMessage(resolveErrorMessage(err));
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleHideCancelledBooking = async (bookingId: number) => {
    setIsActionLoading(true);
    try {
      await apiClient.post(`/bookings/${bookingId}/hide`);
      setUserBookings((prev) => prev.filter((b) => b.id !== bookingId));
    } catch (err) {
      setErrorMessage(resolveErrorMessage(err));
    } finally {
      setIsActionLoading(false);
    }
  };

  // Cancel Booking
  const handleCancelBooking = (booking: UserBooking) => {
    Alert.alert(
      'Cancel Shuttle Booking?',
      `Are you sure you want to cancel booking #${booking.id} (${booking.route_name}) and release your seats?`,
      [
        { text: 'Keep Booking', style: 'cancel' },
        {
          text: 'Cancel Booking',
          style: 'destructive',
          onPress: async () => {
            setIsActionLoading(true);
            try {
              await apiClient.delete(`/bookings/${booking.id}`);
              await Promise.all([fetchUserBookings(), fetchTrips()]);
              if (selectedTrip && Number(selectedTrip.id) === Number(booking.trip_id)) {
                await refreshTripDetails(selectedTrip.id);
              }
              Alert.alert('Booking Cancelled', 'Your booking has been cancelled and seats released.');
            } catch (err) {
              setErrorMessage(resolveErrorMessage(err));
            } finally {
              setIsActionLoading(false);
            }
          },
        },
      ]
    );
  };

  // Navigation Header
  const renderHeader = (title: string, onBack: () => void) => (
    <View style={styles.headerRow}>
      <TouchableOpacity onPress={onBack} style={styles.backButton}>
        <Text style={styles.backButtonText}>‹ Back</Text>
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={{ width: 60 }} />
    </View>
  );

  // ============================================================================
  // Screen 1: Real Shuttle Search
  // ============================================================================
  const renderSearchScreen = () => (
    <ScrollView
      contentContainerStyle={styles.scrollContainer}
      refreshControl={
        <RefreshControl refreshing={isSearching} onRefresh={fetchTrips} tintColor={Colors.primary} />
      }
    >
      <View style={styles.titleRow}>
        <View>
          <Text style={Typography.titleLarge}>Corporate Shuttles</Text>
          <Text style={Typography.subtitle}>Search and book an employee shuttle</Text>
        </View>
        <TouchableOpacity
          style={styles.myBookingsBadge}
          onPress={() => {
            setErrorMessage(null);
            fetchUserBookings();
            setCurrentScreen('bookings');
          }}
        >
          <Text style={styles.myBookingsText}>
            My Bookings ({userBookings.length + userWaitlists.length})
          </Text>
        </TouchableOpacity>
      </View>

      <Card style={styles.searchCard}>
        <Text style={styles.inputLabel}>Origin</Text>
        <TextInput
          value={searchOrigin}
          onChangeText={setSearchOrigin}
          placeholder="e.g. Moratuwa, Kaduwela"
          placeholderTextColor={Colors.textMuted}
          style={styles.textInput}
        />

        <Text style={styles.inputLabel}>Destination</Text>
        <TextInput
          value={searchDestination}
          onChangeText={setSearchDestination}
          placeholder="e.g. Colombo Fort, CBD"
          placeholderTextColor={Colors.textMuted}
          style={styles.textInput}
        />

        <Text style={styles.inputLabel}>Date (YYYY-MM-DD)</Text>
        <TextInput
          value={searchDate}
          onChangeText={setSearchDate}
          placeholder="e.g. 2026-12-10"
          placeholderTextColor={Colors.textMuted}
          style={styles.textInput}
        />

        <Text style={styles.inputLabel}>Party Size</Text>
        <View style={styles.counterRow}>
          <View style={styles.counterGroup}>
            <TouchableOpacity
              onPress={() => handleSetPartySize(partySize - 1)}
              style={styles.counterBtn}
            >
              <Text style={styles.counterBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.counterValue}>{partySize}</Text>
            <TouchableOpacity
              onPress={() => handleSetPartySize(partySize + 1)}
              style={styles.counterBtn}
            >
              <Text style={styles.counterBtnText}>+</Text>
            </TouchableOpacity>
          </View>
          <Button
            title="Search Shuttles"
            onPress={fetchTrips}
            isLoading={isSearching}
            style={styles.searchSubmitBtn}
          />
        </View>
      </Card>

      <ErrorBanner message={errorMessage} />

      {isSearching && trips.length === 0 ? (
        <ActivityIndicator color={Colors.primary} size="large" style={styles.loader} />
      ) : trips.length === 0 ? (
        <Card>
          <Text style={styles.emptyTitle}>
            {errorMessage ? 'Unable to load shuttle trips' : 'No shuttle trips available'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {errorMessage
              ? 'Could not connect to the live booking service. Check your connection.'
              : 'Try modifying your search criteria or pull down to refresh.'}
          </Text>
        </Card>
      ) : (
        <View style={styles.tripsSection}>
          <Text style={styles.sectionHeader}>Available Shuttles ({trips.length})</Text>
          {trips.map((trip) => {
            const isFull = trip.availableSeats <= 0;
            const capacityExceeded = trip.availableSeats < partySize;

            return (
              <Card key={trip.id} style={styles.tripCard}>
                <View style={styles.tripCardHeader}>
                  <Text style={styles.tripRouteName}>{trip.routeName}</Text>
                  <View
                    style={[
                      styles.badge,
                      isFull
                        ? styles.badgeFull
                        : capacityExceeded
                        ? styles.badgeWarning
                        : styles.badgeAvailable,
                    ]}
                  >
                    <Text style={styles.badgeText}>
                      {isFull
                        ? 'FULL'
                        : capacityExceeded
                        ? `CAPACITY EXCEEDED (${trip.availableSeats} LEFT)`
                        : `${trip.availableSeats} seat${trip.availableSeats === 1 ? '' : 's'} free`}
                    </Text>
                  </View>
                </View>

                <Text style={styles.tripRoutePath}>
                  {trip.originName} → {trip.destinationName}
                </Text>

                <View style={styles.tripMetaGrid}>
                  <View style={styles.tripMetaCol}>
                    <Text style={styles.metaLabel}>DEPART</Text>
                    <Text style={styles.metaValue}>{formatDateTime(trip.departAt)}</Text>
                  </View>
                  <View style={styles.tripMetaCol}>
                    <Text style={styles.metaLabel}>ARRIVE</Text>
                    <Text style={styles.metaValue}>{formatDateTime(trip.arriveAt)}</Text>
                  </View>
                </View>

                <View style={styles.tripVehicleRow}>
                  <Text style={styles.vehicleInfo}>
                    🚌 {trip.vehicle?.type || 'Shuttle'} · Plate {trip.vehicle?.plateNo || '—'}
                  </Text>
                  <Text style={styles.cutoffInfo}>Cutoff {formatTimeOnly(trip.bookingCutoffAt)}</Text>
                </View>

                {capacityExceeded ? (
                  <View style={styles.actionBtnRow}>
                    <Button
                      title={`Join Waitlist (Party ${partySize})`}
                      onPress={() => handleJoinWaitlistFromTripCard(trip)}
                      isLoading={isActionLoading && selectedTrip?.id === trip.id}
                      style={styles.halfBtn}
                    />
                    <Button
                      title="View Details"
                      variant="outline"
                      onPress={() => handleOpenTrip(trip)}
                      style={styles.halfBtn}
                    />
                  </View>
                ) : (
                  <Button
                    title="Select Seats & Book"
                    onPress={() => handleOpenTrip(trip)}
                    isLoading={isActionLoading && selectedTrip?.id === trip.id}
                    style={styles.tripActionBtn}
                  />
                )}
              </Card>
            );
          })}
        </View>
      )}
    </ScrollView>
  );

  // ============================================================================
  // Screen 2: Real Trip Details & Dynamic Seat Map
  // ============================================================================
  const renderDetailsScreen = () => {
    if (!selectedTrip) return null;

    return (
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl
            refreshing={isActionLoading}
            onRefresh={() => refreshTripDetails(selectedTrip.id)}
            tintColor={Colors.primary}
          />
        }
      >
        {renderHeader('Trip & Seat Selection', () => {
          setCurrentScreen('search');
          setErrorMessage(null);
        })}

        <ErrorBanner message={errorMessage} />

        {/* Trip Overview Card */}
        <Card>
          <Text style={styles.tripRouteName}>{selectedTrip.routeName}</Text>
          <Text style={styles.tripRoutePath}>
            {selectedTrip.originName} → {selectedTrip.destinationName}
          </Text>
          <View style={styles.tripMetaGrid}>
            <View style={styles.tripMetaCol}>
              <Text style={styles.metaLabel}>DEPARTURE</Text>
              <Text style={styles.metaValue}>{formatDateTime(selectedTrip.departAt)}</Text>
            </View>
            <View style={styles.tripMetaCol}>
              <Text style={styles.metaLabel}>ARRIVAL</Text>
              <Text style={styles.metaValue}>{formatDateTime(selectedTrip.arriveAt)}</Text>
            </View>
          </View>
          <View style={styles.tripVehicleRow}>
            <Text style={styles.vehicleInfo}>
              Vehicle: {selectedTrip.vehicle?.type} ({selectedTrip.vehicle?.plateNo})
            </Text>
            <Text style={styles.cutoffInfo}>
              {selectedTrip.availableSeats} of {selectedTrip.vehicle?.capacity} available
            </Text>
          </View>
          {selectedTrip.stops && selectedTrip.stops.length > 0 && (
            <View style={styles.stopsContainer}>
              <Text style={styles.stopsTitle}>Route Stops:</Text>
              <Text style={styles.stopsList}>
                {selectedTrip.stops.map((s) => s.name).join(' → ')}
              </Text>
            </View>
          )}
        </Card>

        {/* Party Size & Booking Mode */}
        <Card>
          <View style={styles.partySizeHeaderRow}>
            <Text style={styles.sectionHeader}>Party Size</Text>
            <View style={styles.counterGroup}>
              <TouchableOpacity
                onPress={() => handleSetPartySize(partySize - 1)}
                style={styles.counterBtn}
              >
                <Text style={styles.counterBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.counterValue}>{partySize}</Text>
              <TouchableOpacity
                onPress={() => handleSetPartySize(partySize + 1)}
                style={styles.counterBtn}
              >
                <Text style={styles.counterBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => {
              setAutoAllocate(!autoAllocate);
              setSelectedSeatIds([]);
            }}
          >
            <Text style={styles.checkboxIcon}>{autoAllocate ? '☑' : '☐'}</Text>
            <Text style={styles.checkboxLabel}>Let the shuttle auto-allocate adjacent seats</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setRequireAccessible(!requireAccessible)}
          >
            <Text style={styles.checkboxIcon}>{requireAccessible ? '☑' : '☐'}</Text>
            <Text style={styles.checkboxLabel}>Require accessible / wheelchair seating (♿)</Text>
          </TouchableOpacity>

          <View style={styles.accessibleInfoBox}>
            <Text style={styles.accessibleInfoText}>
              ♿ Accessible Seating: Requests designated wheelchair or mobility-accessible seating near vehicle doors. When requested, at least one allocated seat will meet accessibility requirements.
            </Text>
          </View>
        </Card>

        {/* Dynamic Seat Map Card */}
        <Card>
          <Text style={styles.sectionHeader}>Cabin Seat Map</Text>
          <Text style={styles.seatMapSubtitle}>
            {autoAllocate
              ? 'Automatic allocation enabled. The backend will assign optimal seats.'
              : `Select ${partySize} available seat${partySize === 1 ? '' : 's'} (${selectedSeatIds.length}/${partySize} selected)`}
          </Text>

          {/* Front of vehicle indicator */}
          <View style={styles.cabinFrontIndicator}>
            <Text style={styles.cabinFrontText}>─── FRONT OF SHUTTLE / DRIVER ───</Text>
          </View>

          {seatsByRow.length === 0 ? (
            <Text style={styles.emptySubtitle}>Seat layout is not available for this vehicle.</Text>
          ) : (
            <View style={styles.seatGridContainer}>
              {seatsByRow.map(([row, seats]) => (
                <View key={row} style={styles.seatRow}>
                  <Text style={styles.rowNumberLabel}>{row}</Text>
                  {seats.map((seat, index) => {
                    const isSelected = selectedSeatIds.includes(seat.id);
                    const previousSeat = seats[index - 1];

                    // Determine aisle gap
                    const aisleAfter =
                      selectedTrip.vehicle?.layout?.aisleAfterCol === previousSeat?.col ||
                      selectedTrip.vehicle?.layout?.aisles?.includes(previousSeat?.col ?? -1);
                    const physicalGap = !!previousSeat && seat.col - previousSeat.col > 1;

                    return (
                      <TouchableOpacity
                        key={seat.id}
                        disabled={!seat.isAvailable || !!activeHold}
                        onPress={() => handleToggleSeat(seat)}
                        style={[
                          styles.seatBox,
                          (aisleAfter || physicalGap) && styles.aisleGap,
                          !seat.isAvailable && styles.seatUnavailable,
                          isSelected && styles.seatSelected,
                          seat.isAccessible && styles.seatAccessible,
                        ]}
                      >
                        <Text
                          style={[
                            styles.seatLabelText,
                            isSelected && styles.seatLabelSelected,
                            !seat.isAvailable && styles.seatLabelUnavailable,
                          ]}
                        >
                          {seat.label}
                        </Text>
                        <Text
                          style={[
                            styles.seatBadgeText,
                            isSelected && styles.seatLabelSelected,
                          ]}
                        >
                          {!seat.isAvailable
                            ? seat.isHeld
                              ? 'HELD'
                              : 'TAKEN'
                            : seat.isAccessible
                            ? '♿'
                            : seat.isWindow
                            ? 'W'
                            : seat.isAisle
                            ? 'A'
                            : ''}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          )}

          {/* Seat Map Legend */}
          <View style={styles.legendContainer}>
            <View style={styles.legendItem}>
              <View style={[styles.legendBox, styles.legendAvailable]} />
              <Text style={styles.legendText}>Available</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendBox, styles.legendSelected]} />
              <Text style={styles.legendText}>Selected</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendBox, styles.legendUnavailable]} />
              <Text style={styles.legendText}>Occupied</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendBox, styles.legendAccessible]} />
              <Text style={styles.legendText}>Accessible (♿)</Text>
            </View>
          </View>
        </Card>

        {/* Temporary Seat Hold Status */}
        {activeHold && (
          <Card style={styles.holdCard}>
            <View style={styles.holdHeader}>
              <Text style={styles.holdTitle}>Temporary Seat Hold Active</Text>
              <Text style={styles.holdTimer}>
                {activeHold.status === 'held' && holdRemainingSeconds > 0
                  ? `${Math.floor(holdRemainingSeconds / 60)}:${String(holdRemainingSeconds % 60).padStart(2, '0')}`
                  : 'EXPIRED'}
              </Text>
            </View>
            <Text style={styles.holdDescription}>
              Hold #{activeHold.id} · Expires at {formatTimeOnly(activeHold.expiresAt)}. Confirm to finalize your booking before the timer expires.
            </Text>
            {activeHold.status === 'held' && holdRemainingSeconds > 0 ? (
              <View style={styles.actionBtnRow}>
                <Button
                  title="Confirm Booking"
                  onPress={handleConfirmHold}
                  isLoading={isActionLoading}
                  style={styles.halfBtn}
                />
                <Button
                  title="Release Hold"
                  variant="outline"
                  onPress={handleReleaseHold}
                  isLoading={isActionLoading}
                  style={styles.halfBtn}
                />
              </View>
            ) : (
              <Text style={styles.holdExpiredText}>
                This hold has expired. Please refresh the seat map to pick new seats.
              </Text>
            )}
          </Card>
        )}

        {/* Automatic Promotion Banner */}
        {promotedBooking && (
          <Card style={styles.promotionCard}>
            <Text style={styles.promotionTitle}>🎉 Automatically Promoted!</Text>
            <Text style={styles.promotionDescription}>
              Your waitlist entry for {selectedTrip.routeName} has been promoted into Confirmed Booking #{promotedBooking.id}!
            </Text>
            <Button
              title="View in My Bookings"
              onPress={() => {
                fetchUserBookings();
                setCurrentScreen('bookings');
              }}
              style={styles.tripActionBtn}
            />
          </Card>
        )}

        {/* Waitlist Section */}
        {activeWaitlist && (
          <Card style={styles.waitlistCard}>
            <View style={styles.holdHeader}>
              <Text style={styles.waitlistTitle}>Waitlist Status: {activeWaitlist.status.toUpperCase()}</Text>
              <Text style={styles.waitlistPositionBadge}>Position #{activeWaitlist.position}</Text>
            </View>
            <Text style={styles.holdDescription}>
              Party size: {activeWaitlist.partySize}. If earlier bookings are cancelled, your party will be automatically promoted by the server.
            </Text>
            <Button
              title="Leave Waitlist"
              variant="outline"
              onPress={handleLeaveWaitlist}
              isLoading={isActionLoading}
              style={styles.tripActionBtn}
            />
          </Card>
        )}

        {/* When Trip Has No Capacity for Requested Party Size */}
        {!activeHold && !activeWaitlist && selectedTrip.availableSeats < partySize && (
          <Card style={styles.capacityNoticeCard}>
            <Text style={styles.capacityNoticeTitle}>Shuttle Capacity Exceeded</Text>
            <Text style={styles.capacityNoticeDescription}>
              Only {selectedTrip.availableSeats} seat{selectedTrip.availableSeats === 1 ? '' : 's'} remain available on this trip (requested: {partySize}). You can join the server-managed FIFO waitlist to be automatically promoted if seats become available.
            </Text>
            <Button
              title="Join Waitlist"
              onPress={handleJoinWaitlist}
              isLoading={isActionLoading}
              style={styles.tripActionBtn}
            />
          </Card>
        )}

        {/* Booking & Hold Actions */}
        {!activeHold && !activeWaitlist && selectedTrip.availableSeats >= partySize && (
          <View style={styles.actionBtnRow}>
            <Button
              title={`Book ${partySize} Seat${partySize === 1 ? '' : 's'}`}
              onPress={handleBookSeats}
              isLoading={isActionLoading}
              style={styles.halfBtn}
            />
            <Button
              title="Hold Seats (5m)"
              variant="outline"
              onPress={handleCreateHold}
              isLoading={isActionLoading}
              style={styles.halfBtn}
            />
          </View>
        )}
      </ScrollView>
    );
  };

  // ============================================================================
  // Screen 3: Real Booking Confirmation
  // ============================================================================
  const renderConfirmationScreen = () => {
    if (!confirmedBooking) return null;

    return (
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {renderHeader('Booking Confirmation', () => {
          setCurrentScreen('search');
          fetchTrips();
          fetchUserBookings();
        })}

        <Card style={styles.confirmationCard}>
          <Text style={styles.confirmationSuccessIcon}>✓</Text>
          <Text style={styles.confirmationTitle}>Shuttle Booking Confirmed!</Text>
          <Text style={styles.confirmationSubtitle}>
            Booking Reference #{confirmedBooking.id}
          </Text>

          <View style={styles.confirmDetailsBlock}>
            <View style={styles.confirmDetailRow}>
              <Text style={styles.confirmLabel}>Status</Text>
              <Text style={styles.confirmValueSuccess}>
                {confirmedBooking.status.toUpperCase()}
              </Text>
            </View>

            <View style={styles.confirmDetailRow}>
              <Text style={styles.confirmLabel}>Assigned Seats</Text>
              <Text style={styles.confirmValue}>
                {confirmedBooking.assignedSeatLabels.join(', ') || 'Allocated by Shuttle'}
              </Text>
            </View>

            <View style={styles.confirmDetailRow}>
              <Text style={styles.confirmLabel}>Party Size</Text>
              <Text style={styles.confirmValue}>{confirmedBooking.partySize}</Text>
            </View>

            <View style={styles.confirmDetailRow}>
              <Text style={styles.confirmLabel}>Route</Text>
              <Text style={styles.confirmValue}>{confirmedBooking.trip?.routeName}</Text>
            </View>

            <View style={styles.confirmDetailRow}>
              <Text style={styles.confirmLabel}>Journey</Text>
              <Text style={styles.confirmValue}>
                {confirmedBooking.trip?.originName} → {confirmedBooking.trip?.destinationName}
              </Text>
            </View>

            <View style={styles.confirmDetailRow}>
              <Text style={styles.confirmLabel}>Departure</Text>
              <Text style={styles.confirmValue}>
                {formatDateTime(confirmedBooking.trip?.departAt)}
              </Text>
            </View>

            <View style={styles.confirmDetailRow}>
              <Text style={styles.confirmLabel}>Vehicle</Text>
              <Text style={styles.confirmValue}>
                {confirmedBooking.trip?.vehicle?.type} ({confirmedBooking.trip?.vehicle?.plateNo})
              </Text>
            </View>
          </View>
        </Card>

        <Button
          title="View in My Bookings"
          onPress={() => {
            fetchUserBookings();
            setCurrentScreen('bookings');
          }}
          style={styles.tripActionBtn}
        />
        <Button
          title="Search More Shuttles"
          variant="outline"
          onPress={() => setCurrentScreen('search')}
          style={styles.tripActionBtn}
        />
      </ScrollView>
    );
  };

  // ============================================================================
  // Screen 4: My Bookings & Cancellation
  // ============================================================================
  const renderBookingsScreen = () => {
    const totalCount = userBookings.length + userWaitlists.length;

    return (
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl
            refreshing={isLoadingBookings}
            onRefresh={fetchUserBookings}
            tintColor={Colors.primary}
          />
        }
      >
        {renderHeader('My Shuttle Bookings', () => setCurrentScreen('search'))}

        <ErrorBanner message={errorMessage} />

        {isLoadingBookings && totalCount === 0 ? (
          <ActivityIndicator color={Colors.primary} size="large" style={styles.loader} />
        ) : totalCount === 0 ? (
          <Card>
            <Text style={styles.emptyTitle}>No active shuttle bookings or waitlists</Text>
            <Text style={styles.emptySubtitle}>
              You haven’t booked any corporate shuttles or joined any waitlists yet. Use the search tab to find and reserve seats.
            </Text>
            <Button
              title="Search Shuttles"
              onPress={() => setCurrentScreen('search')}
              style={styles.tripActionBtn}
            />
          </Card>
        ) : (
          <>
            {/* Active Waitlists Section */}
            {userWaitlists.length > 0 && (
              <View style={styles.waitlistSection}>
                <Text style={styles.sectionHeader}>Active Waitlists ({userWaitlists.length})</Text>
                {userWaitlists.map((entry) => (
                  <Card key={`waitlist-${entry.id}`} style={{ ...styles.bookingCard, ...styles.waitlistCard }}>
                    <View style={styles.tripCardHeader}>
                      <Text style={styles.tripRouteName}>{entry.routeName || 'Shuttle Trip'}</Text>
                      <View style={[styles.badge, styles.badgeInfo]}>
                        <Text style={styles.badgeText}>WAITLISTED</Text>
                      </View>
                    </View>

                    <Text style={styles.tripRoutePath}>
                      {entry.originName} → {entry.destinationName}
                    </Text>

                    <View style={styles.tripMetaGrid}>
                      <View style={styles.tripMetaCol}>
                        <Text style={styles.metaLabel}>DEPART</Text>
                        <Text style={styles.metaValue}>{formatDateTime(entry.departAt)}</Text>
                      </View>
                      <View style={styles.tripMetaCol}>
                        <Text style={styles.metaLabel}>ARRIVE</Text>
                        <Text style={styles.metaValue}>{formatDateTime(entry.arriveAt)}</Text>
                      </View>
                    </View>

                    <View style={styles.bookingDetailsRow}>
                      <Text style={styles.metaValueSmall}>
                        Waitlist #{entry.id} · Party of {entry.partySize}
                      </Text>
                      <Text style={styles.waitlistPositionBadge}>
                        Position #{entry.position}
                      </Text>
                    </View>

                    <Text style={styles.vehicleInfo}>
                      Vehicle: {entry.vehicleType} ({entry.plateNo})
                    </Text>

                    <Button
                      title="Leave Waitlist"
                      variant="outline"
                      onPress={() => handleLeaveWaitlistFromBookings(entry)}
                      isLoading={isActionLoading}
                      style={styles.cancelBookingBtn}
                    />
                  </Card>
                ))}
              </View>
            )}

            {/* Confirmed / Held / Cancelled Bookings */}
            {userBookings.length > 0 && (
              <View>
                {userWaitlists.length > 0 && (
                  <Text style={styles.sectionHeader}>Bookings ({userBookings.length})</Text>
                )}
                {userBookings.map((booking) => {
                  const isCancellable = ['confirmed', 'held'].includes(booking.status);
                  const isCancelled = booking.status === 'cancelled';
                  const seatLabels = (booking.seats || []).map((s) => s.label).filter(Boolean).join(', ');

                  return (
                    <Card key={booking.id} style={styles.bookingCard}>
                      <View style={styles.tripCardHeader}>
                        <Text style={styles.tripRouteName}>{booking.route_name || 'Shuttle Trip'}</Text>
                        <View
                          style={[
                            styles.badge,
                            booking.status === 'confirmed'
                              ? styles.badgeAvailable
                              : booking.status === 'cancelled'
                              ? styles.badgeCancelled
                              : styles.badgeFull,
                          ]}
                        >
                          <Text style={styles.badgeText}>{booking.status.toUpperCase()}</Text>
                        </View>
                      </View>

                      <Text style={styles.tripRoutePath}>
                        {booking.origin_name} → {booking.destination_name}
                      </Text>

                      <View style={styles.tripMetaGrid}>
                        <View style={styles.tripMetaCol}>
                          <Text style={styles.metaLabel}>DEPART</Text>
                          <Text style={styles.metaValue}>{formatDateTime(booking.depart_at)}</Text>
                        </View>
                        <View style={styles.tripMetaCol}>
                          <Text style={styles.metaLabel}>ARRIVE</Text>
                          <Text style={styles.metaValue}>{formatDateTime(booking.arrive_at)}</Text>
                        </View>
                      </View>

                      <View style={styles.bookingDetailsRow}>
                        <Text style={styles.metaValueSmall}>
                          Booking #{booking.id} · Party of {booking.party_size}
                        </Text>
                        <Text style={styles.metaValueSmall}>
                          Seats: {seatLabels || 'Assigned by Shuttle'}
                        </Text>
                      </View>

                      <Text style={styles.vehicleInfo}>
                        Vehicle: {booking.vehicle_type} ({booking.plate_no})
                      </Text>

                      {isCancellable && (
                        <Button
                          title="Cancel Booking"
                          variant="outline"
                          onPress={() => handleCancelBooking(booking)}
                          isLoading={isActionLoading}
                          style={styles.cancelBookingBtn}
                        />
                      )}

                      {isCancelled && (
                        <Button
                          title="Hide from List"
                          variant="outline"
                          onPress={() => handleHideCancelledBooking(booking.id)}
                          isLoading={isActionLoading}
                          style={styles.hideBookingBtn}
                        />
                      )}
                    </Card>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {currentScreen === 'search' && renderSearchScreen()}
      {currentScreen === 'details' && renderDetailsScreen()}
      {currentScreen === 'confirmation' && renderConfirmationScreen()}
      {currentScreen === 'bookings' && renderBookingsScreen()}
    </SafeAreaView>
  );
};

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.bgDark,
  },
  scrollContainer: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  myBookingsBadge: {
    backgroundColor: Colors.bgInput,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  myBookingsText: {
    color: Colors.primaryLight,
    fontWeight: '700',
    fontSize: 13,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  backButton: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  backButtonText: {
    color: Colors.primaryLight,
    fontSize: 16,
    fontWeight: '700',
  },
  headerTitle: {
    ...Typography.titleMedium,
    fontSize: 18,
    textAlign: 'center',
  },
  searchCard: {
    marginBottom: Spacing.md,
  },
  inputLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: Spacing.xs,
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: Colors.bgInput,
    color: Colors.textPrimary,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: Spacing.xs,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  counterGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  counterBtn: {
    width: 38,
    height: 38,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgInput,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterBtnText: {
    color: Colors.primaryLight,
    fontSize: 22,
    fontWeight: '700',
  },
  counterValue: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    minWidth: 24,
    textAlign: 'center',
  },
  searchSubmitBtn: {
    minWidth: 140,
  },
  loader: {
    marginTop: Spacing.xl,
  },
  emptyTitle: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptySubtitle: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  tripsSection: {
    marginTop: Spacing.xs,
  },
  sectionHeader: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  tripCard: {
    marginBottom: Spacing.sm,
  },
  tripCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  tripRouteName: {
    color: Colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
  },
  tripRoutePath: {
    color: Colors.textSecondary,
    fontSize: 14,
    marginBottom: Spacing.sm,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.sm,
  },
  badgeAvailable: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  badgeFull: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: Colors.danger,
  },
  badgeCancelled: {
    backgroundColor: 'rgba(100, 116, 139, 0.2)',
    borderWidth: 1,
    borderColor: Colors.textMuted,
  },
  badgeWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderWidth: 1,
    borderColor: Colors.warning,
  },
  badgeInfo: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderWidth: 1,
    borderColor: Colors.info,
  },
  hideBookingBtn: {
    marginTop: Spacing.sm,
    borderColor: Colors.border,
  },
  accessibleInfoBox: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    padding: Spacing.sm,
    marginTop: Spacing.xs,
  },
  accessibleInfoText: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  waitlistSection: {
    marginBottom: Spacing.md,
  },
  badgeText: {
    color: Colors.textPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  tripMetaGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: Colors.bgDark,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  tripMetaCol: {
    flex: 1,
  },
  metaLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  metaValue: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  metaValueSmall: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontWeight: '500',
  },
  tripVehicleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  vehicleInfo: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  cutoffInfo: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  tripActionBtn: {
    marginTop: Spacing.xs,
  },
  partySizeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  checkboxIcon: {
    fontSize: 18,
    color: Colors.primaryLight,
  },
  checkboxLabel: {
    color: Colors.textPrimary,
    fontSize: 13,
  },
  seatMapSubtitle: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginBottom: Spacing.sm,
  },
  cabinFrontIndicator: {
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.bgDark,
    borderRadius: Radius.sm,
    marginBottom: Spacing.sm,
  },
  cabinFrontText: {
    color: Colors.textMuted,
    fontSize: 10,
    letterSpacing: 1,
    fontWeight: '700',
  },
  seatGridContainer: {
    alignItems: 'center',
    gap: 8,
    marginVertical: Spacing.xs,
  },
  seatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowNumberLabel: {
    color: Colors.textMuted,
    width: 20,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
  },
  seatBox: {
    width: 52,
    height: 54,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgInput,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aisleGap: {
    marginLeft: 18,
  },
  seatUnavailable: {
    opacity: 0.35,
    backgroundColor: '#351B24',
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  seatSelected: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primaryLight,
    borderWidth: 2,
  },
  seatAccessible: {
    borderColor: Colors.info,
    borderWidth: 2,
  },
  seatLabelText: {
    color: Colors.textPrimary,
    fontWeight: '700',
    fontSize: 13,
  },
  seatLabelSelected: {
    color: '#FFFFFF',
  },
  seatLabelUnavailable: {
    color: Colors.danger,
  },
  seatBadgeText: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: '700',
    marginTop: 2,
  },
  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendBox: {
    width: 14,
    height: 14,
    borderRadius: 3,
  },
  legendAvailable: {
    backgroundColor: Colors.bgInput,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  legendSelected: {
    backgroundColor: Colors.primaryDark,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  legendUnavailable: {
    backgroundColor: '#351B24',
    borderWidth: 1,
    borderColor: Colors.danger,
  },
  legendAccessible: {
    backgroundColor: Colors.bgInput,
    borderWidth: 2,
    borderColor: Colors.info,
  },
  legendText: {
    color: Colors.textSecondary,
    fontSize: 11,
  },
  actionBtnRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  halfBtn: {
    flex: 1,
  },
  holdCard: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.warning,
  },
  holdHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  holdTitle: {
    color: Colors.warning,
    fontSize: 15,
    fontWeight: '700',
  },
  holdTimer: {
    color: Colors.warning,
    fontSize: 16,
    fontWeight: '800',
  },
  holdDescription: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginBottom: Spacing.sm,
  },
  holdExpiredText: {
    color: Colors.danger,
    fontSize: 12,
    fontWeight: '600',
    marginTop: Spacing.xs,
  },
  promotionCard: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.success,
  },
  promotionTitle: {
    color: Colors.success,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  promotionDescription: {
    color: Colors.textPrimary,
    fontSize: 13,
    marginBottom: Spacing.sm,
  },
  waitlistCard: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.info,
  },
  waitlistTitle: {
    color: Colors.info,
    fontSize: 14,
    fontWeight: '700',
  },
  waitlistPositionBadge: {
    color: Colors.info,
    fontSize: 14,
    fontWeight: '800',
  },
  capacityNoticeCard: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.warning,
  },
  capacityNoticeTitle: {
    color: Colors.warning,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  capacityNoticeDescription: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: Spacing.sm,
  },
  confirmationCard: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    marginBottom: Spacing.md,
  },
  confirmationSuccessIcon: {
    fontSize: 48,
    color: Colors.success,
    marginBottom: Spacing.xs,
  },
  confirmationTitle: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  confirmationSubtitle: {
    color: Colors.primaryLight,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: Spacing.lg,
  },
  confirmDetailsBlock: {
    width: '100%',
    backgroundColor: Colors.bgDark,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  confirmDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  confirmLabel: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
  confirmValue: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  confirmValueSuccess: {
    color: Colors.success,
    fontSize: 13,
    fontWeight: '800',
  },
  bookingCard: {
    marginBottom: Spacing.sm,
  },
  bookingDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: Colors.bgDark,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    marginVertical: Spacing.xs,
  },
  cancelBookingBtn: {
    marginTop: Spacing.sm,
    borderColor: 'rgba(239, 68, 68, 0.5)',
  },
  stopsContainer: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  stopsTitle: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
  },
  stopsList: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
});
