import React, { useEffect, useState, useRef } from 'react';
import { bookingApi } from '../api/client';
import { ShuttleTrip, Seat, BookingConfirmation, SeatHold, WaitlistEntry } from '../types';

interface SeatSelectionProps {
  tripId: number;
  partySize?: number;
  onBookingSuccess: () => void;
  onBack: () => void;
  onNavigateToBookings?: () => void;
}

export const SeatSelection: React.FC<SeatSelectionProps> = ({
  tripId,
  partySize = 1,
  onBookingSuccess,
  onBack,
  onNavigateToBookings,
}) => {
  const [trip, setTrip] = useState<ShuttleTrip | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<Seat[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [successBooking, setSuccessBooking] = useState<BookingConfirmation | null>(null);
  const [error, setError] = useState<string | null>(null);

  // M2-07: Seat Hold state
  const [activeHold, setActiveHold] = useState<SeatHold | null>(null);
  const [holdSecondsLeft, setHoldSecondsLeft] = useState<number>(0);
  const timerRef = useRef<any>(null);

  // M2-05: Waitlist state
  const [waitlistEntry, setWaitlistEntry] = useState<WaitlistEntry | null>(null);
  const [joiningWaitlist, setJoiningWaitlist] = useState(false);

  // Selection mode: 'manual' vs 'auto'
  const [allocationMode, setAllocationMode] = useState<'manual' | 'auto'>('auto');
  const [requireAccessible, setRequireAccessible] = useState<boolean>(false);

  // Load the real trip and seat information from the backend.
  const loadTripDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await bookingApi.getTripDetails(tripId);
      setTrip(result);
    } catch (err: any) {
      setTrip(null);
      setError(err.message || 'Unable to load shuttle and seat information.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;

    const fetchTrip = async () => {
      setLoading(true);
      setError(null);
      setTrip(null);
      setSelectedSeats([]);
      setSuccessBooking(null);
      setActiveHold(null);

      try {
        const result = await bookingApi.getTripDetails(tripId);
        if (active) {
          setTrip(result);
        }
      } catch (err: any) {
        if (active) {
          setError(err.message || 'Unable to load shuttle and seat information.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchTrip();

    return () => {
      active = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [tripId]);

  // Server-authoritative hold countdown effect
  useEffect(() => {
    if (!activeHold) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const targetTime = new Date(activeHold.expiresAt).getTime();

    const updateTimer = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((targetTime - now) / 1000));
      setHoldSecondsLeft(diff);

      if (diff <= 0) {
        clearInterval(timerRef.current);
        setActiveHold(null);
        setError('Your seat hold has expired. The seat map has been refreshed.');
        loadTripDetails();
      }
    };

    updateTimer();
    timerRef.current = setInterval(updateTimer, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeHold]);

  const handleSeatClick = (seat: Seat) => {
    if (!seat.isAvailable || submitting || successBooking || activeHold) {
      return;
    }

    setAllocationMode('manual');
    setError(null);

    setSelectedSeats((current) => {
      const exists = current.some((s) => s.id === seat.id);
      if (exists) {
        return current.filter((s) => s.id !== seat.id);
      }
      if (current.length >= partySize) {
        // Replace first selected if partySize reached
        if (partySize === 1) {
          return [seat];
        }
        setError(`You have already selected ${partySize} seat(s). Deselect one to choose another.`);
        return current;
      }
      return [...current, seat];
    });
  };

  // M2-07: Create temporary hold (5 minutes)
  const handleCreateHold = async () => {
    if (submitting || successBooking) return;

    if (allocationMode === 'manual' && selectedSeats.length !== partySize) {
      setError(`Please select exactly ${partySize} seat(s) or switch to Auto-Allocate.`);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const seatIds = allocationMode === 'manual' ? selectedSeats.map((s) => s.id) : undefined;
      const hold = await bookingApi.createHold(tripId, partySize, seatIds, requireAccessible);
      setActiveHold(hold);

      // If auto-allocated, highlight the held seats
      if (hold.seats && hold.seats.length > 0) {
        const heldSeatModels = (trip?.seats || []).filter((s) => hold.seatIds.includes(s.id));
        setSelectedSeats(heldSeatModels);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to hold seats.');
      if (err.status === 409) {
        await loadTripDetails();
      }
    } finally {
      setSubmitting(false);
    }
  };

  // M2-07: Confirm Hold
  const handleConfirmHold = async () => {
    if (!activeHold || submitting || successBooking) return;

    setSubmitting(true);
    setError(null);

    try {
      const booking = await bookingApi.confirmHold(tripId, activeHold.id);
      setSuccessBooking(booking);
      setActiveHold(null);
    } catch (err: any) {
      setError(err.message || 'Failed to confirm reservation.');
      if (err.status === 409) {
        setActiveHold(null);
        await loadTripDetails();
      }
    } finally {
      setSubmitting(false);
    }
  };

  // M2-07: Release Hold early
  const handleReleaseHold = async () => {
    if (!activeHold || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      await bookingApi.releaseHold(tripId, activeHold.id);
      setActiveHold(null);
      setSelectedSeats([]);
      await loadTripDetails();
    } catch (err: any) {
      setError(err.message || 'Failed to release hold.');
    } finally {
      setSubmitting(false);
    }
  };

  // Direct Booking (without prior hold)
  const handleDirectBooking = async () => {
    if (submitting || successBooking) return;

    if (allocationMode === 'manual' && selectedSeats.length !== partySize) {
      setError(`Please select exactly ${partySize} seat(s) or choose Auto-Allocate.`);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const seatIds = allocationMode === 'manual' ? selectedSeats.map((s) => s.id) : undefined;
      const booking = await bookingApi.createBooking(tripId, partySize, seatIds, requireAccessible);
      setSuccessBooking(booking);
    } catch (err: any) {
      setError(err.message || 'Failed to complete booking.');
      if (err.status === 409) {
        await loadTripDetails();
      }
    } finally {
      setSubmitting(false);
    }
  };

  // M2-05: Join Waitlist
  const handleJoinWaitlist = async () => {
    setJoiningWaitlist(true);
    setError(null);

    try {
      const entry = await bookingApi.joinWaitlist(tripId, partySize);
      setWaitlistEntry(entry);
    } catch (err: any) {
      setError(err.message || 'Failed to join waitlist.');
    } finally {
      setJoiningWaitlist(false);
    }
  };

  const seats = trip?.seats || [];
  const freeSeatsCount = seats.filter((seat) => seat.isAvailable).length;

  // Group actual backend seats by row
  const seatRows = Array.from(new Set(seats.map((seat) => seat.row))).sort((a, b) => a - b);

  // Format seconds into MM:SS
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const renderSeatButton = (seat: Seat) => {
    const isSelected = selectedSeats.some((s) => s.id === seat.id);
    const isHeldByMe = activeHold && activeHold.seatIds.includes(seat.id);

    if (!seat.isAvailable && !isHeldByMe) {
      return (
        <div
          key={seat.id}
          className="flex flex-col items-center gap-1 opacity-40 cursor-not-allowed"
          title={`${seat.label} is already booked or held`}
        >
          <div className="w-10 h-10 rounded-xl bg-surface-container-highest flex items-center justify-center border border-outline-variant/30">
            <span className="material-symbols-outlined text-[14px] text-outline">close</span>
          </div>
          <span className="text-[10px] text-outline font-medium">{seat.label}</span>
        </div>
      );
    }

    return (
      <button
        key={seat.id}
        type="button"
        onClick={() => handleSeatClick(seat)}
        disabled={submitting || !!successBooking || !!activeHold}
        title={[
          seat.label,
          seat.isWindow ? 'Window seat' : '',
          seat.isAccessible ? 'Accessible seat' : '',
        ]
          .filter(Boolean)
          .join(' - ')}
        className="flex flex-col items-center gap-1 transition-transform active:scale-90 cursor-pointer disabled:cursor-not-allowed"
      >
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-sm ${
            isHeldByMe
              ? 'bg-amber-500 text-white ring-2 ring-amber-400 ring-offset-2'
              : isSelected
              ? 'bg-primary text-on-primary ring-2 ring-primary ring-offset-2'
              : 'bg-surface-container-highest text-outline hover:bg-primary-container/20'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">chair</span>
        </div>
        <span
          className={`text-[10px] font-semibold ${
            isHeldByMe ? 'text-amber-600 font-bold' : isSelected ? 'text-primary font-bold' : 'text-outline'
          }`}
        >
          {seat.label}
        </span>
      </button>
    );
  };

  return (
    <main className="relative w-full pt-16 bg-surface min-h-screen pb-36 max-w-md mx-auto font-sans">
      {/* Shuttle Header Info */}
      <div className="px-4 pt-2 pb-3">
        <div className="bg-surface-container-low rounded-2xl p-3.5 flex items-center justify-between shadow-sm border border-outline-variant/30">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onBack}
              className="w-9 h-9 rounded-full bg-surface-container-high flex items-center justify-center cursor-pointer hover:bg-surface-container-highest"
              aria-label="Back to trip search"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </button>

            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-on-primary">
              <span className="material-symbols-outlined text-[20px]">event_seat</span>
            </div>

            <div className="flex flex-col">
              <span className="text-[11px] font-semibold text-outline">
                {trip?.vehicle.type || 'Shuttle'}
              </span>
              <span className="text-sm font-bold text-on-surface">
                Party of {partySize}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end">
            <span className="text-xs font-bold text-primary">{freeSeatsCount} Free</span>
            <span className="text-[10px] text-outline uppercase font-semibold">Available</span>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="mx-4 my-8 p-6 rounded-2xl bg-surface-container-low text-center">
          <span className="material-symbols-outlined text-3xl text-primary animate-spin">
            progress_activity
          </span>
          <p className="mt-2 text-sm font-semibold text-on-surface">
            Loading real shuttle seat information...
          </p>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="mx-4 mb-3 p-3 rounded-xl bg-error-container text-on-error-container text-xs flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error</span>
          <span className="flex-1">{error}</span>
        </div>
      )}

      {/* Active Hold Countdown Banner (M2-07) */}
      {activeHold && (
        <div className="mx-4 mb-3 p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 flex items-center justify-between shadow-sm animate-pulse">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-600 text-[22px]">timer</span>
            <div>
              <p className="text-xs font-bold">Seats Held Temporarily</p>
              <p className="text-[11px] text-amber-700">Complete confirmation before timer expires</p>
            </div>
          </div>
          <div className="text-right">
            <span className="font-mono text-base font-extrabold text-amber-800">
              {formatTimer(holdSecondsLeft)}
            </span>
          </div>
        </div>
      )}

      {/* Waitlist Confirmed Banner (M2-05) */}
      {waitlistEntry && (
        <div className="mx-4 mb-3 p-3.5 rounded-xl bg-blue-50 border border-blue-300 text-blue-900 flex flex-col gap-2">
          <div className="flex items-center gap-2 font-bold text-sm">
            <span className="material-symbols-outlined text-blue-600 text-[20px]">hourglass_top</span>
            <span>Enrolled in Waitlist</span>
          </div>
          <p className="text-xs">
            You are <strong>#{waitlistEntry.position}</strong> in the waitlist queue for this trip. When a booking is cancelled, seats will be automatically allocated to you.
          </p>
          {onNavigateToBookings && (
            <button
              type="button"
              onClick={onNavigateToBookings}
              className="mt-1 py-1.5 px-3 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 cursor-pointer text-center"
            >
              View in My Bookings
            </button>
          )}
        </div>
      )}

      {/* Real Booking Confirmation Banner */}
      {successBooking && (
        <div className="mx-4 mb-4 p-4 rounded-2xl bg-emerald-50 border border-primary text-primary flex flex-col gap-2 shadow-md">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[24px]">verified</span>
            <span className="text-sm font-bold">Reservation Confirmed!</span>
          </div>
          <p className="text-xs text-on-surface-variant">Your shuttle booking has been confirmed.</p>
          <div className="text-xs text-on-surface-variant space-y-1">
            <p>
              Booking Reference:{' '}
              <span className="font-mono font-bold text-primary">#EC-{successBooking.id}</span>
            </p>
            <p>
              Party Size: <span className="font-bold">{successBooking.partySize} rider(s)</span>
            </p>
            <p>
              Allocation Method:{' '}
              <span className="font-bold uppercase text-primary">
                {successBooking.allocationType || 'Adjacent Block'}
              </span>
            </p>
            <p>
              Status: <span className="font-bold text-emerald-700">{successBooking.status}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onBookingSuccess}
            className="w-full mt-2 py-2.5 bg-primary text-on-primary rounded-xl text-xs font-bold shadow-md cursor-pointer hover:brightness-110"
          >
            Go to Commuter Hub
          </button>
        </div>
      )}

      {!loading && trip && !successBooking && (
        <>
          {/* Allocation Controls */}
          {!activeHold && (
            <div className="mx-4 mb-3 p-3 bg-surface-container-low rounded-xl border border-outline-variant/30 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-on-surface">Seat Allocation:</span>
                <div className="flex rounded-lg bg-surface-container-high p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setAllocationMode('auto');
                      setSelectedSeats([]);
                    }}
                    className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
                      allocationMode === 'auto'
                        ? 'bg-primary text-on-primary shadow-sm'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    Auto (Adjacent)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllocationMode('manual')}
                    className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
                      allocationMode === 'manual'
                        ? 'bg-primary text-on-primary shadow-sm'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    Pick Seats
                  </button>
                </div>
              </div>

              {partySize > 1 && allocationMode === 'auto' && (
                <p className="text-[11px] text-outline">
                  ✨ The intelligent allocator will automatically reserve a contiguous adjacent block for your group of {partySize}.
                </p>
              )}

              {allocationMode === 'manual' && (
                <p className="text-[11px] text-outline">
                  Please tap on {partySize} available seat(s) on the bus layout below ({selectedSeats.length}/{partySize} selected).
                </p>
              )}

              <label className="flex items-center gap-2 pt-1 text-xs text-on-surface-variant cursor-pointer">
                <input
                  type="checkbox"
                  checked={requireAccessible}
                  onChange={(e) => setRequireAccessible(e.target.checked)}
                  className="rounded text-primary focus:ring-primary"
                />
                <span>Require wheelchair accessible seating</span>
              </label>
            </div>
          )}

          {/* Legend */}
          <div className="px-4 flex justify-center gap-5 mb-3 text-[11px]">
            <div className="flex items-center gap-1.5">
              <div className="w-3.5 h-3.5 rounded-sm bg-surface-container-highest border border-outline-variant/40" />
              <span className="text-on-surface-variant">Available</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3.5 h-3.5 rounded-sm bg-inverse-surface/15 flex items-center justify-center">
                <span className="material-symbols-outlined text-[10px] text-outline">close</span>
              </div>
              <span className="text-on-surface-variant">Taken / Held</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3.5 h-3.5 rounded-sm bg-primary shadow-sm" />
              <span className="text-on-surface-variant font-semibold">Selected</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3.5 h-3.5 rounded-sm bg-amber-500 shadow-sm" />
              <span className="text-on-surface-variant font-semibold">Held (5m)</span>
            </div>
          </div>

          {/* Bus Layout */}
          <div className="px-4 flex-1">
            <div className="bg-white rounded-[32px] shadow-lg p-5 relative overflow-hidden border border-outline-variant/30">
              {/* Front of Shuttle */}
              <div className="h-12 bg-gradient-to-b from-surface-container-low to-transparent flex flex-col items-center pt-1.5 opacity-70 mb-4 rounded-t-2xl">
                <div className="w-20 h-1 rounded-full bg-outline-variant" />
                <span className="text-[10px] text-outline mt-1 uppercase tracking-widest font-semibold">
                  Driver & Front
                </span>
              </div>

              {/* Seats Matrix */}
              {seats.length === 0 ? (
                <p className="text-center text-sm text-outline py-8">
                  No seat information is available for this vehicle.
                </p>
              ) : (
                <div className="flex flex-col items-center gap-3.5 py-2">
                  {seatRows.map((rowNumber) => {
                    const rowSeats = seats
                      .filter((seat) => seat.row === rowNumber)
                      .sort((a, b) => a.col - b.col);

                    const aisleCol = trip?.vehicle.layout?.aisleAfterCol || 2;

                    return (
                      <div key={rowNumber} className="flex items-center justify-center gap-2">
                        {rowSeats.map((seat) => (
                          <React.Fragment key={seat.id}>
                            {seat.col === aisleCol + 1 && (
                              <div className="w-5 flex items-center justify-center text-[10px] text-outline opacity-40">
                                |
                              </div>
                            )}
                            {renderSeatButton(seat)}
                          </React.Fragment>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Fixed Action Panel */}
          <div className="fixed bottom-[68px] left-0 right-0 z-30 bg-surface/95 backdrop-blur-xl border-t border-outline-variant/30 p-3.5 max-w-md mx-auto shadow-2xl flex flex-col gap-2">
            {/* If seats available */}
            {freeSeatsCount >= partySize ? (
              activeHold ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleReleaseHold}
                    disabled={submitting}
                    className="flex-1 h-11 rounded-xl bg-surface-container-high text-on-surface text-xs font-bold hover:bg-surface-container-highest cursor-pointer transition-all"
                  >
                    Release Hold
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmHold}
                    disabled={submitting}
                    className="flex-[2] h-11 rounded-xl bg-primary text-on-primary text-xs font-bold shadow-md hover:brightness-110 active:scale-98 cursor-pointer transition-all flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                    <span>Confirm Booking Now</span>
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCreateHold}
                    disabled={submitting || (allocationMode === 'manual' && selectedSeats.length !== partySize)}
                    className="flex-1 h-11 rounded-xl bg-amber-500 text-white text-xs font-bold shadow-md hover:bg-amber-600 active:scale-98 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[16px]">timer</span>
                    <span>Hold 5 Min</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDirectBooking}
                    disabled={submitting || (allocationMode === 'manual' && selectedSeats.length !== partySize)}
                    className="flex-[2] h-11 rounded-xl bg-primary text-on-primary text-xs font-bold shadow-md hover:brightness-110 active:scale-98 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">bolt</span>
                    <span>
                      {allocationMode === 'auto'
                        ? `Auto-Book (${partySize} Seats)`
                        : `Book ${selectedSeats.length}/${partySize} Selected`}
                    </span>
                  </button>
                </div>
              )
            ) : (
              <button
                type="button"
                onClick={handleJoinWaitlist}
                disabled={joiningWaitlist || !!waitlistEntry}
                className="w-full h-11 rounded-xl bg-amber-600 text-white text-xs font-bold shadow-md hover:bg-amber-700 active:scale-98 cursor-pointer transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">hourglass_top</span>
                <span>
                  {waitlistEntry
                    ? `Already on Waitlist (Position #${waitlistEntry.position})`
                    : joiningWaitlist
                    ? 'Joining Waitlist...'
                    : `Join FIFO Waitlist (Party of ${partySize})`}
                </span>
              </button>
            )}
          </div>
        </>
      )}
    </main>
  );
};
