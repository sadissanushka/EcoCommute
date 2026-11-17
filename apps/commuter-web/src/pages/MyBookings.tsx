
import React, { useEffect, useState } from 'react';
import { bookingApi } from '../api/client';
import { MyBooking } from '../types';

interface MyBookingsProps {
  onBack: () => void;
}

export const MyBookings: React.FC<MyBookingsProps> = ({ onBack }) => {
  const [bookings, setBookings] = useState<MyBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [removeTargetId, setRemoveTargetId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadBookings = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await bookingApi.getMyBookings();
      setBookings(result);
    } catch (err: any) {
      setError(
        err.message || 'Unable to load your bookings.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();
  }, []);

  const handleCancel = async (booking: MyBooking) => {
    const confirmed = window.confirm(
      `Are you sure you want to cancel booking #${booking.id}?`
    );

    if (!confirmed) return;

    setCancellingId(booking.id);
    setError(null);
    setNotice(null);

    try {
      await bookingApi.cancelBooking(booking.id);

      setNotice(
        `Booking #${booking.id} was successfully cancelled. Its assigned seat has been released.`
      );

      // Fetch the latest booking records from the backend.
      await loadBookings();
    } catch (err: any) {
      setError(
        err.message || 'Unable to cancel this booking.'
      );
    } finally {
      setCancellingId(null);
    }
  };

  const handleRemove = async () => {
    const bookingId = removeTargetId;
    if (bookingId === null || removingId !== null) return;

    setRemovingId(bookingId);
    setError(null);
    setNotice(null);

    try {
      await bookingApi.hideCancelledBooking(bookingId);
      setBookings((current) =>
        current.filter((booking) => booking.id !== bookingId)
      );
      setNotice(
        `Cancelled booking #${bookingId} was removed from your booking list.`
      );
      setRemoveTargetId(null);
    } catch (err: any) {
      setError(
        err.message || 'Unable to remove this cancelled booking from your list.'
      );
      setRemoveTargetId(null);
    } finally {
      setRemovingId(null);
    }
  };

  const formatDate = (value: string) => {
    if (!value) return 'Not available';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleString([], {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  const getStatusStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case 'confirmed':
        return 'bg-green-100 text-green-800';

      case 'cancelled':
        return 'bg-red-100 text-red-800';

      case 'waitlisted':
        return 'bg-amber-100 text-amber-800';

      case 'boarded':
        return 'bg-blue-100 text-blue-800';

      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <main className="min-h-screen bg-surface px-4 pt-5 pb-28 max-w-lg mx-auto">

      {/* Page heading */}
      <div className="flex items-center gap-3 mb-5">
        <button
          type="button"
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center"
          aria-label="Back to Hub"
        >
          <span className="material-symbols-outlined">
            arrow_back
          </span>
        </button>

        <div>
          <h1 className="text-xl font-bold text-on-surface">
            My Bookings
          </h1>

          <p className="text-xs text-outline">
            View and manage your shuttle reservations
          </p>
        </div>
      </div>

      {/* Success notice */}
      {notice && (
        <div className="mb-4 p-3 rounded-xl bg-green-100 text-green-800 text-sm">
          {notice}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mb-4 p-3 rounded-xl bg-error-container text-on-error-container text-sm">
          {error}

          <button
            type="button"
            onClick={loadBookings}
            className="block mt-2 font-bold underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="py-12 text-center">
          <span className="material-symbols-outlined text-3xl text-primary animate-spin">
            progress_activity
          </span>

          <p className="mt-2 text-sm text-outline">
            Loading your bookings...
          </p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && bookings.length === 0 && (
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-outline-variant/30">
          <span className="material-symbols-outlined text-5xl text-outline">
            event_seat
          </span>

          <h2 className="mt-3 font-bold text-on-surface">
            No bookings to display
          </h2>

          <p className="mt-1 text-sm text-outline">
            Your visible shuttle reservations will appear here after you book a trip.
          </p>

          <button
            type="button"
            onClick={onBack}
            className="mt-5 px-5 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-bold"
          >
            Find a Shuttle
          </button>
        </div>
      )}

      {/* Booking cards */}
      {!loading && bookings.length > 0 && (
        <div className="space-y-4">
          {bookings.map((booking) => {
            const canCancel =
              booking.status.toLowerCase() === 'confirmed';
            const canRemove =
              booking.status.toLowerCase() === 'cancelled';

            return (
              <article
                key={booking.id}
                className="bg-white rounded-2xl p-4 shadow-sm border border-outline-variant/30"
              >
                {/* Booking reference and status */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-outline">
                      Booking reference
                    </p>

                    <p className="font-mono font-bold text-on-surface">
                      #EC-{booking.id}
                    </p>
                  </div>

                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold capitalize ${getStatusStyle(
                      booking.status
                    )}`}
                  >
                    {booking.status}
                  </span>
                </div>

                {/* Route */}
                <div className="py-3 border-y border-outline-variant/30">
                  <p className="text-sm font-bold text-on-surface">
                    {booking.originName}
                  </p>

                  <div className="flex items-center gap-2 py-1 text-outline">
                    <span className="material-symbols-outlined text-base">
                      south
                    </span>

                    <span className="text-xs">
                      {booking.routeName}
                    </span>
                  </div>

                  <p className="text-sm font-bold text-on-surface">
                    {booking.destinationName}
                  </p>
                </div>

                {/* Trip information */}
                <div className="grid grid-cols-2 gap-3 py-3">
                  <div>
                    <p className="text-[10px] text-outline uppercase font-semibold">
                      Departure
                    </p>

                    <p className="text-xs font-semibold text-on-surface mt-1">
                      {formatDate(booking.departAt)}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] text-outline uppercase font-semibold">
                      Arrival
                    </p>

                    <p className="text-xs font-semibold text-on-surface mt-1">
                      {formatDate(booking.arriveAt)}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] text-outline uppercase font-semibold">
                      Vehicle
                    </p>

                    <p className="text-xs font-semibold text-on-surface mt-1">
                      {booking.vehicleType}
                    </p>

                    <p className="text-[10px] text-outline">
                      {booking.plateNo}
                    </p>
                  </div>

                  <div>
                    <p className="text-[10px] text-outline uppercase font-semibold">
                      Seats
                    </p>

                    <p className="text-xs font-semibold text-on-surface mt-1">
                      {booking.seats.length > 0
                        ? booking.seats.map((seat) => seat.label).join(', ')
                        : 'No active seat assignment'}
                    </p>
                  </div>
                </div>

                <div className="text-[10px] text-outline mb-3">
                  Booked on: {formatDate(booking.createdAt)}
                </div>

                {/* Cancellation */}
                {canCancel && (
                  <button
                    type="button"
                    onClick={() => handleCancel(booking)}
                    disabled={cancellingId === booking.id}
                    className="w-full py-2.5 rounded-xl border border-error/30 text-error text-sm font-bold hover:bg-error/10 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {cancellingId === booking.id
                      ? 'Cancelling...'
                      : 'Cancel Booking'}
                  </button>
                )}
                {canRemove && (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setRemoveTargetId(booking.id);
                    }}
                    className="w-full mt-2 py-2.5 rounded-xl border border-outline-variant text-on-surface-variant text-sm font-bold hover:bg-surface-container-low flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      delete
                    </span>
                    Remove
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}

      {removeTargetId !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => {
            if (removingId === null) setRemoveTargetId(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-booking-title"
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2
              id="remove-booking-title"
              className="text-base font-bold text-on-surface"
            >
              Remove cancelled booking?
            </h2>
            <p className="mt-2 text-sm text-on-surface-variant">
              Remove this cancelled booking from your booking history? This
              will only hide it from your My Bookings list. It will not change
              the cancellation or affect seat availability.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setRemoveTargetId(null)}
                disabled={removingId !== null}
                className="px-4 py-2 rounded-xl border border-outline-variant text-sm font-bold text-on-surface disabled:opacity-50"
              >
                Keep Booking
              </button>
              <button
                type="button"
                onClick={handleRemove}
                disabled={removingId !== null}
                className="px-4 py-2 rounded-xl bg-error text-on-error text-sm font-bold disabled:opacity-50"
              >
                {removingId === removeTargetId ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
};
