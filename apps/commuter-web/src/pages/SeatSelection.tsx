import React, { useState, useEffect } from 'react';
import { bookingApi } from '../api/client';
import { ShuttleTrip, Seat } from '../types';

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
  const [successBookingId, setSuccessBookingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    bookingApi.getTripDetails(tripId).then((res) => {
      setTrip(res);
    });
  }, [tripId]);

  const handleSeatClick = (seat: Seat) => {
    if (!seat.isAvailable) return;
    if (selectedSeat?.id === seat.id) {
      setSelectedSeat(null);
    } else {
      setSelectedSeat(seat);
    }
  };

  const handleConfirmReservation = async () => {
    if (!selectedSeat) return;
    setSubmitting(true);
    setError(null);

    try {
      const booking = await bookingApi.createBooking(tripId, selectedSeat.id);
      setSuccessBookingId(booking.id);
    } catch (err: any) {
      setError(err.message || 'Failed to complete reservation. Please try another seat.');
    } finally {
      setSubmitting(false);
    }
  };

  const seats = trip?.seats || [];
  const freeSeatsCount = seats.filter((s) => s.isAvailable).length;

  return (
    <main className="relative w-full pt-16 bg-surface min-h-screen pb-24 max-w-md mx-auto font-sans">
      {/* Interactive Progress Step */}
      <div className="px-4 pt-2 pb-3">
        <div className="bg-surface-container-low rounded-2xl p-3.5 flex items-center justify-between shadow-sm border border-outline-variant/30">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-on-primary">
              <span className="material-symbols-outlined text-[20px]">event_seat</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-semibold text-outline">
                {trip?.vehicle.type || 'Electric Shuttle #882'}
              </span>
              <span className="text-sm font-bold text-on-surface">Select your seat</span>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-xs font-bold text-primary">{freeSeatsCount} Free</span>
            <span className="text-[10px] text-outline uppercase font-semibold">Eco-Tier</span>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="px-4 flex justify-center gap-6 mb-3">
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 rounded-sm bg-surface-container-highest border border-outline-variant/40"></div>
          <span className="text-xs text-on-surface-variant font-medium">Available</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 rounded-sm bg-inverse-surface/15 flex items-center justify-center">
            <span className="material-symbols-outlined text-[10px] text-outline">close</span>
          </div>
          <span className="text-xs text-on-surface-variant font-medium">Taken</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 rounded-sm bg-primary shadow-sm"></div>
          <span className="text-xs text-on-surface-variant font-semibold">Selected</span>
        </div>
      </div>

      {/* Success Modal / Banner */}
      {successBookingId && (
        <div className="mx-4 mb-4 p-4 rounded-2xl bg-emerald-50 border border-primary text-primary flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[24px]">verified</span>
            <span className="text-sm font-bold">Reservation Confirmed!</span>
          </div>
          <p className="text-xs text-on-surface-variant">
            Booking ref <span className="font-mono font-bold text-primary">#EC-{successBookingId}</span> for seat{' '}
            <span className="font-bold">{selectedSeat?.label}</span>. Boarding pass is ready.
          </p>
          <button
            onClick={onBookingSuccess}
            className="w-full mt-2 py-2.5 bg-primary text-on-primary rounded-xl text-xs font-bold shadow-md cursor-pointer hover:bg-primary-container"
          >
            Go to Commute Hub
          </button>
        </div>
      )}

      {error && (
        <div className="mx-4 mb-3 p-3 rounded-xl bg-error-container text-on-error-container text-xs flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* Bus Layout Cabin Container */}
      <div className="px-4 flex-1">
        <div className="bg-white rounded-[36px] shadow-xl p-5 relative overflow-hidden border border-outline-variant/30">
          {/* Front of Shuttle Indicator */}
          <div className="h-14 bg-gradient-to-b from-surface-container-low to-transparent flex flex-col items-center pt-2 opacity-70 mb-4 rounded-t-3xl">
            <div className="w-24 h-1.5 rounded-full bg-outline-variant"></div>
            <span className="text-[10px] text-outline mt-1 uppercase tracking-widest font-semibold">
              Front of Shuttle
            </span>
          </div>

          {/* Seating Grid */}
          <div className="grid grid-cols-5 gap-y-4 gap-x-2 max-w-[280px] mx-auto py-2">
            {/* Row 1 */}
            {renderSeatButton(seats[0], '1A')}
            {renderSeatButton(seats[1], '1B')}
            <div className="w-6 flex items-center justify-center text-[10px] text-outline opacity-40">
              |
            </div>
            {renderSeatButton(seats[2], '1C')}
            {renderSeatButton(seats[3], '1D')}

            {/* Row 2 */}
            {renderSeatButton(seats[4], '2A')}
            {renderSeatButton(seats[5], '2B')}
            <div className="w-6 flex items-center justify-center text-[10px] text-outline opacity-40">
              |
            </div>
            {renderSeatButton(seats[6], '2C')}
            <div className="w-10"></div>

            {/* Row 3 */}
            {renderSeatButton(seats[7], '3A')}
            {renderSeatButton(seats[8], '3B')}
            <div className="w-6 flex items-center justify-center text-[10px] text-outline opacity-40">
              |
            </div>
            {renderSeatButton(seats[9], '3C')}
            {renderSeatButton(seats[10], '3D')}

            {/* Row 4 */}
            {renderSeatButton(seats[11], '4A')}
            {renderSeatButton(seats[12], '4B')}
            <div className="w-6 flex items-center justify-center text-[10px] text-outline opacity-40">
              |
            </div>
            {renderSeatButton(seats[13], '4C')}
            <div className="w-10"></div>
          </div>
        </div>
      </div>

      {/* Bottom Sticky Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-surface/95 backdrop-blur-xl border-t border-outline-variant/30 p-4 pb-safe max-w-md mx-auto shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-[10px] font-semibold text-outline uppercase tracking-wider">
              Selected Seat
            </span>
            <div className="text-base font-bold text-on-surface">
              {selectedSeat ? `Seat ${selectedSeat.label}` : 'None'}
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] font-semibold text-outline uppercase tracking-wider">
              Estimated CO2 Saved
            </span>
            <div className="flex items-center justify-end gap-1 text-primary font-bold text-sm">
              <span className="material-symbols-outlined text-[16px]">eco</span>
              <span>2.4 kg</span>
            </div>
          </div>
        </div>

        <button
          onClick={handleConfirmReservation}
          disabled={!selectedSeat || submitting}
          className={`w-full h-12 rounded-2xl flex items-center justify-center gap-2 font-bold text-sm transition-all shadow-md cursor-pointer ${
            selectedSeat
              ? 'bg-primary text-on-primary hover:bg-primary-container active:scale-95'
              : 'bg-surface-container-high text-outline cursor-not-allowed opacity-60'
          }`}
        >
          {submitting ? (
            <span>Securing Seat in Outbox...</span>
          ) : selectedSeat ? (
            <>
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              <span>Confirm Seat {selectedSeat.label} Reservation</span>
            </>
          ) : (
            <span>Select an available seat above</span>
          )}
        </button>
      </div>
    </main>
  );

  function renderSeatButton(seat?: Seat, fallbackLabel: string = '1A') {
    if (!seat) {
      return (
        <div className="flex flex-col items-center gap-1 opacity-20">
          <div className="w-10 h-10 rounded-xl bg-surface-container-highest"></div>
          <span className="text-[10px] text-outline">{fallbackLabel}</span>
        </div>
      );
    }

    const isSelected = selectedSeat?.id === seat.id;

    if (!seat.isAvailable) {
      return (
        <div className="flex flex-col items-center gap-1 opacity-40 cursor-not-allowed">
          <div className="w-10 h-10 rounded-xl bg-surface-container-highest flex items-center justify-center border border-outline-variant/30">
            <span className="material-symbols-outlined text-[14px] text-outline">close</span>
          </div>
          <span className="text-[10px] text-outline font-medium">{seat.label}</span>
        </div>
      );
    }

    return (
      <button
        onClick={() => handleSeatClick(seat)}
        className="flex flex-col items-center gap-1 transition-transform active:scale-90 cursor-pointer"
      >
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-sm ${
            isSelected
              ? 'bg-primary text-on-primary ring-2 ring-primary ring-offset-2'
              : 'bg-surface-container-highest text-outline hover:bg-primary-container/20'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">chair</span>
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
  }
};
