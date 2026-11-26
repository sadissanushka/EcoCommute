import React, { useState } from 'react';

interface PublishRideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPublished?: (data: any) => void;
}

export const PublishRideModal: React.FC<PublishRideModalProps> = ({
  isOpen,
  onClose,
  onPublished,
}) => {
  const [origin, setOrigin] = useState('Battaramulla Junction');
  const [destination, setDestination] = useState('Colombo Fort CBD');
  const [departureDate, setDepartureDate] = useState('Tomorrow');
  const [departureTime, setDepartureTime] = useState('08:15 AM');
  const [availableSeats, setAvailableSeats] = useState(3);
  const [pricePerSeatLkr, setPricePerSeatLkr] = useState(250);
  const [womenOnly, setWomenOnly] = useState(false);

  if (!isOpen) return null;

  const handleSwap = () => {
    const temp = origin;
    setOrigin(destination);
    setDestination(temp);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onPublished) {
      onPublished({
        origin,
        destination,
        departureDate,
        departureTime,
        availableSeats,
        pricePerSeatLkr,
        womenOnly,
      });
    }
    alert('Ride published successfully! Commuter matching engine active.');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-surface-container-lowest dark:bg-surface-container border border-outline-variant/40 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-outline-variant/20">
          <div className="flex items-center gap-2">
            <span className="text-xl">🚗</span>
            <h2 className="text-lg font-bold text-on-surface dark:text-white">Publish A Ride</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface-container-low dark:bg-surface-container-high flex items-center justify-center text-on-surface-variant dark:text-outline-variant hover:text-on-surface"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Origin & Destination with Swap */}
          <div className="space-y-3 p-4 bg-surface-container-low dark:bg-surface-container-high rounded-xl relative">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">Corridor Route</span>
              <button
                type="button"
                onClick={handleSwap}
                className="text-xs text-secondary font-semibold hover:underline"
              >
                ⇅ Swap Endpoints
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-on-surface-variant dark:text-outline-variant">
                  Pickup Origin
                </label>
                <input
                  type="text"
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  className="px-3 py-2 bg-surface-container-lowest dark:bg-surface-container border border-outline-variant/30 rounded-lg text-xs outline-none text-on-surface dark:text-white font-medium"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-on-surface-variant dark:text-outline-variant">
                  Workplace Destination
                </label>
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="px-3 py-2 bg-surface-container-lowest dark:bg-surface-container border border-outline-variant/30 rounded-lg text-xs outline-none text-on-surface dark:text-white font-medium"
                />
              </div>
            </div>
          </div>

          {/* Time & Seats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-on-surface dark:text-white">Departure Time</label>
              <input
                type="text"
                value={departureTime}
                onChange={(e) => setDepartureTime(e.target.value)}
                className="px-3 py-2 bg-surface-container-low dark:bg-surface-container-high border border-outline-variant/30 rounded-lg text-xs outline-none text-on-surface dark:text-white font-medium"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-on-surface dark:text-white">Available Seats</label>
              <select
                value={availableSeats}
                onChange={(e) => setAvailableSeats(Number(e.target.value))}
                className="px-3 py-2 bg-surface-container-low dark:bg-surface-container-high border border-outline-variant/30 rounded-lg text-xs outline-none text-on-surface dark:text-white font-semibold"
              >
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? 'Seat' : 'Seats'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Price & Women-Only Filter (Contract C3) */}
          <div className="p-4 bg-surface-container-low dark:bg-surface-container-high rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-on-surface dark:text-white">
                Fuel Contribution Share
              </span>
              <span className="text-xs font-bold text-primary">LKR {pricePerSeatLkr} / seat</span>
            </div>

            <label className="flex items-center gap-2 cursor-pointer pt-2 border-t border-outline-variant/20">
              <input
                type="checkbox"
                checked={womenOnly}
                onChange={(e) => setWomenOnly(e.target.checked)}
                className="w-4 h-4 accent-primary rounded cursor-pointer"
              />
              <span className="text-xs font-medium text-on-surface dark:text-white">
                Women-Only Commute Match (Contract C3 verified)
              </span>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-on-surface-variant dark:text-outline-variant hover:text-on-surface"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-primary hover:bg-primary-container text-on-primary text-xs font-bold rounded-xl shadow-sm transition"
            >
              Publish Offer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
