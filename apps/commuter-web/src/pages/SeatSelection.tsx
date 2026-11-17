
import React, { useEffect, useState } from 'react';
import { bookingApi } from '../api/client';
import { ShuttleTrip, Seat, BookingConfirmation } from '../types';

interface SeatSelectionProps {
  tripId: number;
  onBookingSuccess: () => void;
  onBack: () => void;
}

export const SeatSelection: React.FC<SeatSelectionProps> = ({
  tripId,
  onBookingSuccess,
  onBack,
}) => {
  const [trip, setTrip] = useState<ShuttleTrip | null>(null);
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [successBooking, setSuccessBooking] =
    useState<BookingConfirmation | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load the real trip and seat information from the backend.
  const loadTripDetails = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await bookingApi.getTripDetails(tripId);
      setTrip(result);
    } catch (err: any) {
      setTrip(null);
      setError(
        err.message || 'Unable to load shuttle and seat information.'
      );
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
      setSelectedSeat(null);
      setSuccessBooking(null);

      try {
        const result = await bookingApi.getTripDetails(tripId);

        if (active) {
          setTrip(result);
        }
      } catch (err: any) {
        if (active) {
          setError(
            err.message || 'Unable to load shuttle and seat information.'
          );
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
    };
  }, [tripId]);

  const handleSeatClick = (seat: Seat) => {
    if (!seat.isAvailable || submitting || successBooking) {
      return;
    }

    setSelectedSeat((current) =>
      current?.id === seat.id ? null : seat
    );

    setError(null);
  };

  const handleConfirmReservation = async () => {
    if (!selectedSeat || submitting || successBooking) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const booking = await bookingApi.createBooking(
        tripId,
        selectedSeat.id
      );

      // Show confirmation only after the backend creates the booking.
      setSuccessBooking(booking);
    } catch (err: any) {
      const status = err.status;

      if (status === 409) {
        // Another employee may have booked this seat first.
        setSelectedSeat(null);

        setError(
          'This seat is no longer available. The seat map is being refreshed. Please select another seat.'
        );

        try {
          const refreshedTrip = await bookingApi.getTripDetails(tripId);
          setTrip(refreshedTrip);
        } catch {
          setError(
            'The booking could not be completed, and the latest seat information could not be loaded. Please try refreshing.'
          );
        }
      } else {
        setError(
          err.message ||
            'Failed to complete the reservation. Please try again.'
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const seats = trip?.seats || [];

  const freeSeatsCount = seats.filter(
    (seat) => seat.isAvailable
  ).length;

  // Group actual backend seats by their row number.
  const seatRows = Array.from(
    new Set(seats.map((seat) => seat.row))
  ).sort((a, b) => a - b);

  // Find the seat actually assigned by the backend.
  const confirmedSeat = successBooking
    ? seats.find((seat) =>
        successBooking.assignedSeatIds.includes(seat.id)
      )
    : null;

  const renderSeatButton = (seat: Seat) => {
    const isSelected = selectedSeat?.id === seat.id;

    if (!seat.isAvailable) {
      return (
        <div
          key={seat.id}
          className="flex flex-col items-center gap-1 opacity-40 cursor-not-allowed"
          title={`${seat.label} is already booked`}
        >
          <div className="w-10 h-10 rounded-xl bg-surface-container-highest flex items-center justify-center border border-outline-variant/30">
            <span className="material-symbols-outlined text-[14px] text-outline">
              close
            </span>
          </div>
          <span className="text-[10px] text-outline font-medium">
            {seat.label}
          </span>
        </div>
      );
    }

    return (
      <button
        key={seat.id}
        type="button"
        onClick={() => handleSeatClick(seat)}
        disabled={submitting || !!successBooking}
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
            isSelected
              ? 'bg-primary text-on-primary ring-2 ring-primary ring-offset-2'
              : 'bg-surface-container-highest text-outline hover:bg-primary-container/20'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">
            chair
          </span>
        </div>

        <span
          className={`text-[10px] font-semibold ${
            isSelected ? 'text-primary font-bold' : 'text-outline'
          }`}
        >
          {seat.label}
        </span>
      </button>
    );
  };

  return (
    <main className="relative w-full pt-16 bg-surface min-h-screen pb-24 max-w-md mx-auto font-sans">

      {/* Progress / Shuttle Information */}
      <div className="px-4 pt-2 pb-3">
        <div className="bg-surface-container-low rounded-2xl p-3.5 flex items-center justify-between shadow-sm border border-outline-variant/30">

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onBack}
              className="w-9 h-9 rounded-full bg-surface-container-high flex items-center justify-center"
              aria-label="Back to trip search"
            >
              <span className="material-symbols-outlined text-[20px]">
                arrow_back
              </span>
            </button>

            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-on-primary">
              <span className="material-symbols-outlined text-[20px]">
                event_seat
              </span>
            </div>

            <div className="flex flex-col">
              <span className="text-[11px] font-semibold text-outline">
                {trip?.vehicle.type || 'Shuttle'}
              </span>

              <span className="text-sm font-bold text-on-surface">
                Select your seat
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end">
            <span className="text-xs font-bold text-primary">
              {freeSeatsCount} Free
            </span>

            <span className="text-[10px] text-outline uppercase font-semibold">
              Available
            </span>
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

      {/* Error State */}
      {!loading && error && !trip && (
        <div className="mx-4 my-4 p-4 rounded-2xl bg-error-container text-on-error-container">
          <p className="text-sm font-semibold">{error}</p>

          <button
            type="button"
            onClick={loadTripDetails}
            className="mt-3 px-4 py-2 rounded-xl bg-primary text-on-primary text-sm font-bold"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Seat Selection and Confirmation */}
      {!loading && trip && (
        <>
          {/* Trip Details */}
          <div className="mx-4 mb-3 p-3 rounded-xl bg-surface-container-low">
            <p className="text-sm font-bold text-on-surface">
              {trip.originName} → {trip.destinationName}
            </p>

            <p className="text-xs text-outline mt-1">
              Vehicle: {trip.vehicle.plateNo}
            </p>
          </div>

          {/* Legend */}
          <div className="px-4 flex justify-center gap-6 mb-3">
            <div className="flex items-center gap-1.5">
              <div className="w-3.5 h-3.5 rounded-sm bg-surface-container-highest border border-outline-variant/40" />
              <span className="text-xs text-on-surface-variant font-medium">
                Available
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <div className="w-3.5 h-3.5 rounded-sm bg-inverse-surface/15 flex items-center justify-center">
                <span className="material-symbols-outlined text-[10px] text-outline">
                  close
                </span>
              </div>
              <span className="text-xs text-on-surface-variant font-medium">
                Taken
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <div className="w-3.5 h-3.5 rounded-sm bg-primary shadow-sm" />
              <span className="text-xs text-on-surface-variant font-semibold">
                Selected
              </span>
            </div>
          </div>

          {/* Booking Error */}
          {error && (
            <div className="mx-4 mb-3 p-3 rounded-xl bg-error-container text-on-error-container text-xs flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">
                error
              </span>
              <span>{error}</span>
            </div>
          )}

          {/* Real Booking Confirmation */}
          {successBooking && (
            <div className="mx-4 mb-4 p-4 rounded-2xl bg-emerald-50 border border-primary text-primary flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[24px]">
                  verified
                </span>

                <span className="text-sm font-bold">
                  Reservation Confirmed!
                </span>
              </div>

              <p className="text-xs text-on-surface-variant">
                Your booking has been successfully created.
              </p>

              <div className="text-xs text-on-surface-variant space-y-1">
                <p>
                  Booking reference:{' '}
                  <span className="font-mono font-bold text-primary">
                    #EC-{successBooking.id}
                  </span>
                </p>

                <p>
                  Confirmed seat:{' '}
                  <span className="font-bold text-primary">
                    {confirmedSeat?.label || selectedSeat?.label || 'Assigned'}
                  </span>
                </p>

                <p>
                  Booking status:{' '}
                  <span className="font-bold">
                    {successBooking.status}
                  </span>
                </p>

                <p>
                  Booking date:{' '}
                  {new Date(successBooking.createdAt).toLocaleString()}
                </p>
              </div>

              <button
                type="button"
                onClick={onBookingSuccess}
                className="w-full mt-2 py-2.5 bg-primary text-on-primary rounded-xl text-xs font-bold shadow-md cursor-pointer hover:bg-primary-container"
              >
                Go to Commute Hub
              </button>
            </div>
          )}

          {/* Bus Layout */}
          <div className="px-4 flex-1">
            <div className="bg-white rounded-[36px] shadow-xl p-5 relative overflow-hidden border border-outline-variant/30">

              {/* Front of Shuttle */}
              <div className="h-14 bg-gradient-to-b from-surface-container-low to-transparent flex flex-col items-center pt-2 opacity-70 mb-4 rounded-t-3xl">
                <div className="w-24 h-1.5 rounded-full bg-outline-variant" />

                <span className="text-[10px] text-outline mt-1 uppercase tracking-widest font-semibold">
                  Front of Shuttle
                </span>
              </div>

              {/* Dynamic Seat Layout */}
              {seats.length === 0 ? (
                <p className="text-center text-sm text-outline py-8">
                  No seat information is available for this vehicle.
                </p>
              ) : (
                <div className="flex flex-col items-center gap-4 py-2">
                  {seatRows.map((rowNumber) => {
                    const rowSeats = seats
                      .filter((seat) => seat.row === rowNumber)
                      .sort((a, b) => a.col - b.col);

                    return (
                      <div
                        key={rowNumber}
                        className="flex items-center justify-center gap-2"
                      >
                        {rowSeats.map((seat, index) => (
                          <React.Fragment key={seat.id}>
                            {index === 2 && (
                              <div className="w-6 flex items-center justify-center text-[10px] text-outline opacity-40">
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

          {/* Bottom Sticky Action Bar */}
          {!successBooking && (<div className="fixed bottom-[72px] left-0 right-0 z-30 bg-surface/95 backdrop-blur-xl border-t border-outline-variant/30 p-4 pb-safe max-w-md mx-auto shadow-2xl">
            
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-[10px] font-semibold text-outline uppercase tracking-wider">
                    Selected Seat
                  </span>

                  <div className="text-base font-bold text-on-surface">
                    {selectedSeat
                      ? `Seat ${selectedSeat.label}`
                      : 'None'}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-semibold text-outline uppercase tracking-wider">
                    Available Seats
                  </span>

                  <div className="text-primary font-bold text-sm">
                    {freeSeatsCount}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleConfirmReservation}
                disabled={!selectedSeat || submitting}
                className={`w-full h-12 rounded-2xl flex items-center justify-center gap-2 font-bold text-sm transition-all shadow-md ${
                  selectedSeat && !submitting
                    ? 'bg-primary text-on-primary hover:bg-primary-container active:scale-95 cursor-pointer'
                    : 'bg-surface-container-high text-outline cursor-not-allowed opacity-60'
                }`}
              >
                {submitting ? (
                  <span>Confirming your booking...</span>
                ) : selectedSeat ? (
                  <>
                    <span className="material-symbols-outlined text-[18px]">
                      check_circle
                    </span>

                    <span>
                      Confirm Seat {selectedSeat.label} Reservation
                    </span>
                  </>
                ) : (
                  <span>Select an available seat above</span>
                )}
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
};
