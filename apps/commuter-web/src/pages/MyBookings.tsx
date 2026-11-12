import React, { useEffect, useState } from 'react';
import { bookingApi } from '../api/client';
import { MyBooking, WaitlistEntry } from '../types';

interface MyBookingsProps {
  onBack: () => void;
  onNavigateToFindShuttle?: () => void;
}

export const MyBookings: React.FC<MyBookingsProps> = ({ onBack, onNavigateToFindShuttle }) => {
  const [bookings, setBookings] = useState<MyBooking[]>([]);
  const [waitlists, setWaitlists] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [cancellingWaitlistTripId, setCancellingWaitlistTripId] = useState<number | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [removeTargetId, setRemoveTargetId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [bookingsRes, waitlistRes] = await Promise.all([
        bookingApi.getMyBookings(),
        bookingApi.getMyWaitlist(),
      ]);
      setBookings(bookingsRes);
      setWaitlists(waitlistRes);
    } catch (err: any) {
      setError(err.message || 'Unable to load your bookings and waitlist entries.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCancelBooking = async (booking: MyBooking) => {
    const confirmed = window.confirm(
      `Are you sure you want to cancel booking #${booking.id}? If waitlisted riders are waiting, they will be automatically promoted.`
    );

    if (!confirmed) return;

    setCancellingId(booking.id);
    setError(null);
    setNotice(null);

    try {
      await bookingApi.cancelBooking(booking.id);
      setNotice(
        `Booking #${booking.id} was successfully cancelled. Seats have been released and any eligible waitlisted riders have been promoted.`
      );
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Unable to cancel this booking.');
    } finally {
      setCancellingId(null);
    }
  };

  const handleLeaveWaitlist = async (tripId: number) => {
    const confirmed = window.confirm('Are you sure you want to withdraw from this waitlist?');
    if (!confirmed) return;

    setCancellingWaitlistTripId(tripId);
    setError(null);
    setNotice(null);

    try {
      await bookingApi.leaveWaitlist(tripId);
      setNotice('You have successfully left the waitlist.');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Unable to withdraw from waitlist.');
    } finally {
      setCancellingWaitlistTripId(null);
    }
  };

  const handleHideCancelledBooking = async () => {
    const bookingId = removeTargetId;
    if (bookingId === null || removingId !== null) return;

    setRemovingId(bookingId);
    setError(null);
    setNotice(null);

    try {
      await bookingApi.hideCancelledBooking(bookingId);
      setBookings((current) => current.filter((b) => b.id !== bookingId));
      setNotice(`Cancelled booking #${bookingId} was removed from your visible list.`);
      setRemoveTargetId(null);
    } catch (err: any) {
      setError(err.message || 'Unable to remove this cancelled booking from your list.');
      setRemoveTargetId(null);
    } finally {
      setRemovingId(null);
    }
  };

  const formatDate = (value: string) => {
    if (!value) return 'Not available';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'confirmed':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'waiting':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'promoted':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'boarded':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const hasItems = bookings.length > 0 || waitlists.length > 0;

  return (
    <main className="min-h-screen bg-surface px-4 pt-5 pb-28 max-w-lg mx-auto font-sans">
      {/* Page Header */}
      <div className="flex items-center gap-3 mb-5">
        <button
          type="button"
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center cursor-pointer hover:bg-surface-container-highest transition-all"
          aria-label="Back to Hub"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>

        <div>
          <h1 className="text-xl font-bold text-on-surface">My Bookings & Waitlists</h1>
          <p className="text-xs text-outline">Manage your shuttle reservations and queue positions</p>
        </div>
      </div>

      {/* Success Notice */}
      {notice && (
        <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          <span>{notice}</span>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 rounded-xl bg-error-container text-on-error-container text-xs flex items-center justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={loadData}
            className="font-bold underline cursor-pointer ml-2"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Spinner */}
      {loading && (
        <div className="py-12 text-center">
          <span className="material-symbols-outlined text-3xl text-primary animate-spin">
            progress_activity
          </span>
          <p className="mt-2 text-sm text-outline">Loading your bookings...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && !hasItems && (
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-outline-variant/30">
          <span className="material-symbols-outlined text-5xl text-outline">event_seat</span>
          <h2 className="mt-3 font-bold text-on-surface">No active bookings or waitlists</h2>
          <p className="mt-1 text-sm text-outline">
            Your shuttle reservations and waitlist status will appear here after booking a ride.
          </p>
          <button
            type="button"
            onClick={onNavigateToFindShuttle || onBack}
            className="mt-5 px-5 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-bold shadow-md hover:brightness-110 cursor-pointer"
          >
            Find a Shuttle
          </button>
        </div>
      )}

      {!loading && hasItems && (
        <div className="space-y-6">
          {/* Active Waitlist Section (M2-05) */}
          {waitlists.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600 text-[20px]">hourglass_top</span>
                <h2 className="text-sm font-bold text-on-surface uppercase tracking-wider">
                  Active Waitlist ({waitlists.length})
                </h2>
              </div>

              {waitlists.map((w) => (
                <div
                  key={w.id}
                  className="bg-white rounded-2xl p-4 shadow-sm border border-amber-200 flex flex-col gap-3 relative overflow-hidden"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-mono text-outline">WAITLIST #{w.id}</span>
                      <h3 className="font-bold text-sm text-on-surface mt-0.5">
                        {w.routeName || `Trip #${w.tripId}`}
                      </h3>
                      <p className="text-xs text-on-surface-variant mt-0.5">
                        {w.originName} → {w.destinationName}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-amber-100 text-amber-800 border border-amber-300 inline-block">
                        Queue #{w.position}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-outline bg-surface-container-lowest p-2.5 rounded-xl">
                    <span>👥 Party Size: <strong>{w.partySize} rider(s)</strong></span>
                    <span>🕒 Departure: <strong>{formatDate(w.departAt || '')}</strong></span>
                    <span>🚐 Vehicle: <strong>{w.vehicleType || 'Shuttle'}</strong></span>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <p className="text-[11px] text-amber-700 italic">
                      Automatic promotion will claim seats when cancellations occur.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleLeaveWaitlist(w.tripId)}
                      disabled={cancellingWaitlistTripId === w.tripId}
                      className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-bold hover:bg-red-50 cursor-pointer transition-all disabled:opacity-50"
                    >
                      {cancellingWaitlistTripId === w.tripId ? 'Leaving...' : 'Leave Waitlist'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Bookings Section */}
          {bookings.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">confirmation_number</span>
                <h2 className="text-sm font-bold text-on-surface uppercase tracking-wider">
                  Shuttle Bookings ({bookings.length})
                </h2>
              </div>

              {bookings.map((booking) => {
                const isConfirmed = booking.status.toLowerCase() === 'confirmed';
                const isCancelled = booking.status.toLowerCase() === 'cancelled';

                return (
                  <div
                    key={booking.id}
                    className="bg-white rounded-2xl p-4 shadow-sm border border-outline-variant/30 flex flex-col gap-3 relative"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-mono font-bold text-primary">
                          #EC-{booking.id}
                        </span>
                        <h3 className="font-bold text-sm text-on-surface mt-0.5">
                          {booking.routeName || `Trip #${booking.tripId}`}
                        </h3>
                        <p className="text-xs text-on-surface-variant mt-0.5">
                          {booking.originName} → {booking.destinationName}
                        </p>
                      </div>

                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusBadge(
                          booking.status
                        )}`}
                      >
                        {booking.status}
                      </span>
                    </div>

                    {/* Booking Details */}
                    <div className="grid grid-cols-2 gap-2 text-xs text-outline bg-surface-container-lowest p-2.5 rounded-xl">
                      <div>
                        <span className="block text-[10px] uppercase font-semibold text-outline">Seats Assigned</span>
                        <span className="font-bold text-on-surface text-sm">
                          {booking.seats && booking.seats.length > 0
                            ? booking.seats.map((s) => s.label).join(', ')
                            : 'First Available'}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase font-semibold text-outline">Party Size</span>
                        <span className="font-bold text-on-surface text-sm">{booking.partySize} person(s)</span>
                      </div>
                      <div className="col-span-2 pt-1 border-t border-outline-variant/20">
                        <span className="text-[11px]">Departure: {formatDate(booking.departAt)}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-2 pt-1">
                      {isConfirmed && (
                        <button
                          type="button"
                          onClick={() => handleCancelBooking(booking)}
                          disabled={cancellingId === booking.id}
                          className="px-3 py-1.5 rounded-xl border border-red-300 text-red-600 text-xs font-bold hover:bg-red-50 cursor-pointer transition-all disabled:opacity-50"
                        >
                          {cancellingId === booking.id ? 'Cancelling...' : 'Cancel Reservation'}
                        </button>
                      )}

                      {isCancelled && (
                        <button
                          type="button"
                          onClick={() => setRemoveTargetId(booking.id)}
                          disabled={removingId === booking.id}
                          className="px-3 py-1.5 rounded-xl bg-surface-container-high text-on-surface text-xs font-bold hover:bg-surface-container-highest cursor-pointer transition-all disabled:opacity-50"
                        >
                          Hide from List
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Confirmation Dialog for Hiding Cancelled Booking */}
      {removeTargetId !== null && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl flex flex-col gap-3">
            <h3 className="text-base font-bold text-on-surface">Hide Cancelled Booking</h3>
            <p className="text-xs text-on-surface-variant">
              This will remove booking #{removeTargetId} from your visible list. Its historical audit record remains securely stored in the system.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRemoveTargetId(null)}
                className="px-3 py-1.5 rounded-xl bg-surface-container-high text-xs font-bold text-on-surface hover:bg-surface-container-highest cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleHideCancelledBooking}
                disabled={removingId !== null}
                className="px-3 py-1.5 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 cursor-pointer disabled:opacity-50"
              >
                {removingId !== null ? 'Hiding...' : 'Confirm Hide'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
