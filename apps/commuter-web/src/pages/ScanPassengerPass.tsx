import React, { useState, useEffect, useRef } from 'react';
import { bookingApi } from '../api/client';
import { ManifestPassenger } from '../types';

interface ScanPassengerPassProps {
  onBack: () => void;
  onNavigateToNavigation?: () => void;
  tripId?: number;
}

export const ScanPassengerPass: React.FC<ScanPassengerPassProps> = ({
  onBack,
  onNavigateToNavigation,
  tripId = 1,
}) => {
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [boardedCount, setBoardedCount] = useState<number>(0);
  const [otpCode, setOtpCode] = useState<string>('');
  const [showOtpModal, setShowOtpModal] = useState<boolean>(false);
  const [passengers, setPassengers] = useState<ManifestPassenger[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [lastScanMessage, setLastScanMessage] = useState<{ text: string; success: boolean } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isScanningRef = useRef<boolean>(false);

  const loadManifest = async () => {
    try {
      setLoading(true);
      const list = await bookingApi.getTripManifest(tripId);
      setPassengers(list);
      setBoardedCount(list.filter((p) => p.status === 'Boarded').length);
    } catch (err) {
      console.warn('Failed to load trip manifest:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadManifest();
  }, [tripId]);

  // Start real device camera
  const startCamera = async () => {
    try {
      setCameraError(null);
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Camera API is not supported by your browser environment.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCameraActive(true);
    } catch (err: any) {
      console.warn('Camera stream error:', err);
      setCameraActive(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Camera permission was denied. Please allow camera access in browser permissions to scan QR passes.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('No camera found on this device. You can use the manual 6-digit code entry or upload a QR image.');
      } else {
        setCameraError(`Camera error: ${err.message || 'Unable to access video stream'}`);
      }
    }
  };

  // Stop camera stream
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setTorchOn(false);
  };

  // Toggle camera flashlight
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      const capabilities: any = track.getCapabilities?.() || {};
      if (capabilities.torch) {
        const nextState = !torchOn;
        await (track as any).applyConstraints({ advanced: [{ torch: nextState }] });
        setTorchOn(nextState);
      } else {
        alert('Hardware torch is not supported on this camera track.');
      }
    } catch (err) {
      console.warn('Failed to toggle torch:', err);
    }
  };

  // Handle scanned token from camera or image file
  const handleScannedValue = async (rawCode: string) => {
    if (!rawCode || isScanningRef.current) return;
    isScanningRef.current = true;

    try {
      let candidateCode = rawCode.trim();

      // Check if rawCode is JSON
      if (candidateCode.startsWith('{') && candidateCode.endsWith('}')) {
        try {
          const parsed = JSON.parse(candidateCode);
          candidateCode = parsed.passCode || parsed.otp || parsed.token || candidateCode;
        } catch {
          // keep as is
        }
      }

      const res = await bookingApi.boardPassenger(tripId, { passCode: candidateCode });
      if (res.success) {
        setPassengers((prev) =>
          prev.map((p) => (p.bookingId === res.bookingId ? { ...p, status: 'Boarded' as const } : p))
        );
        setBoardedCount((prev) => prev + 1);
        setLastScanMessage({
          text: `Verified & Boarded: ${res.passengerName} (${res.passengerEmail})`,
          success: true,
        });
      }
    } catch (err: any) {
      setLastScanMessage({
        text: err.message || 'Scanned QR code could not be verified for this trip.',
        success: false,
      });
    } finally {
      setTimeout(() => {
        isScanningRef.current = false;
      }, 2000);
    }
  };

  // BarcodeDetector scanning loop over active <video>
  useEffect(() => {
    if (!cameraActive) return;

    let active = true;
    let detector: any = null;

    if ('BarcodeDetector' in window) {
      try {
        detector = new (window as any).BarcodeDetector({ formats: ['qr_code', 'code_128', 'data_matrix'] });
      } catch (err) {
        console.warn('BarcodeDetector initialization error:', err);
      }
    }

    const interval = setInterval(async () => {
      if (!active || !videoRef.current || videoRef.current.readyState < 2 || isScanningRef.current) return;
      if (detector) {
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes && barcodes.length > 0 && active) {
            const code = barcodes[0].rawValue;
            if (code) {
              await handleScannedValue(code);
            }
          }
        } catch (err) {
          // ignore transient frame decode errors
        }
      }
    }, 600);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [cameraActive, tripId]);

  // Clean up camera on unmount
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  // Handle image file scan
  const handleFileScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!('BarcodeDetector' in window)) {
      alert('BarcodeDetector API is not available on this browser. Please enter the 6-digit passcode manually.');
      return;
    }

    try {
      const img = await createImageBitmap(file);
      const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
      const barcodes = await detector.detect(img);
      if (barcodes.length > 0) {
        await handleScannedValue(barcodes[0].rawValue);
      } else {
        setLastScanMessage({ text: 'No readable QR code found in uploaded image.', success: false });
      }
    } catch (err: any) {
      setLastScanMessage({ text: `Image decode failed: ${err.message}`, success: false });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const totalRiders = passengers.length;
  const progressPct = totalRiders > 0 ? Math.round((boardedCount / totalRiders) * 100) : 0;

  const handleVerifyOtp = async () => {
    if (!otpCode.trim()) return;
    try {
      const res = await bookingApi.boardPassenger(tripId, { passCode: otpCode.trim() });
      if (res.success) {
        setPassengers((prev) =>
          prev.map((p) => (p.bookingId === res.bookingId ? { ...p, status: 'Boarded' as const } : p))
        );
        setBoardedCount((prev) => prev + 1);
        setShowOtpModal(false);
        setOtpCode('');
        setLastScanMessage({
          text: `Verified & Boarded: ${res.passengerName}`,
          success: true,
        });
      }
    } catch (err: any) {
      alert(err.message || 'Invalid Passcode. Please check passenger digital pass OTP.');
    }
  };

  const handleBoardPassenger = async (p: ManifestPassenger) => {
    try {
      const res = await bookingApi.boardPassenger(tripId, { bookingId: p.bookingId });
      if (res.success) {
        setPassengers((prev) =>
          prev.map((item) => (item.bookingId === p.bookingId ? { ...item, status: 'Boarded' as const } : item))
        );
        setBoardedCount((prev) => prev + 1);
        setLastScanMessage({
          text: `Checked in passenger: ${p.name}`,
          success: true,
        });
      }
    } catch (err: any) {
      alert(err.message || 'Check-in failed');
    }
  };

  return (
    <div className="flex flex-col relative w-full min-h-[calc(100vh-64px)] bg-surface font-sans max-w-md mx-auto pb-24">
      {/* Scanner Toolbar */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-surface-container-high/60">
        <h1 className="text-sm font-bold text-on-surface">Optical Pass Scanner</h1>

        <div className="flex items-center gap-2">
          {cameraActive && (
            <button
              onClick={toggleTorch}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                torchOn ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface'
              }`}
              title="Toggle flashlight"
            >
              <span className="material-symbols-outlined text-[18px]">
                {torchOn ? 'flashlight_off' : 'flashlight_on'}
              </span>
            </button>
          )}

          <button
            onClick={cameraActive ? stopCamera : startCamera}
            className="w-9 h-9 rounded-full bg-surface-container text-on-surface flex items-center justify-center transition-colors cursor-pointer"
            title={cameraActive ? 'Stop Camera' : 'Start Camera'}
          >
            <span className="material-symbols-outlined text-[18px]">
              {cameraActive ? 'videocam_off' : 'videocam'}
            </span>
          </button>

          {onNavigateToNavigation && (
            <button
              onClick={() => {
                stopCamera();
                onNavigateToNavigation();
              }}
              className="px-2.5 py-1 rounded-xl bg-secondary text-on-secondary text-xs font-bold cursor-pointer"
            >
              Start Nav
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col w-full px-4 pt-3 gap-3">
        {/* Status bar */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-on-surface-variant font-medium">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span className="uppercase tracking-wider text-[10px] font-bold">Trip #{tripId} Manifest Check-In</span>
          </div>
          <div className="bg-surface-container-high px-2.5 py-0.5 rounded-full text-[11px] font-bold text-primary flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">eco</span>
            <span>Live Scanner</span>
          </div>
        </div>

        {/* Scan Result Feedback Toast */}
        {lastScanMessage && (
          <div
            className={`p-3 rounded-xl text-xs font-semibold flex items-center justify-between ${
              lastScanMessage.success
                ? 'bg-primary/10 text-primary border border-primary/20'
                : 'bg-error/10 text-error border border-error/20'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">
                {lastScanMessage.success ? 'check_circle' : 'error'}
              </span>
              <span>{lastScanMessage.text}</span>
            </div>
            <button
              onClick={() => setLastScanMessage(null)}
              className="text-on-surface-variant hover:text-on-surface ml-2"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        )}

        {/* QR Scanner Viewfinder with Live Camera Stream */}
        <div className="relative w-full h-72 rounded-2xl bg-black overflow-hidden shadow-lg flex flex-col justify-between p-3.5">
          {/* Real Live Video Feed */}
          {cameraActive ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-surface-container-lowest">
              <span className="material-symbols-outlined text-[40px] text-on-surface-variant mb-2">
                videocam_off
              </span>
              <p className="text-xs text-on-surface font-semibold mb-1">
                {cameraError || 'Camera stream is stopped'}
              </p>
              <p className="text-[11px] text-on-surface-variant mb-3">
                Allow camera access to scan corporate passes directly with your device.
              </p>
              <button
                onClick={startCamera}
                className="px-3 py-1.5 rounded-xl bg-primary text-on-primary text-xs font-bold cursor-pointer"
              >
                Enable Camera
              </button>
            </div>
          )}

          {/* Top Overlays */}
          <div className="relative z-10 flex items-center justify-between w-full">
            <div className="bg-black/60 backdrop-blur-md px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm text-xs text-white">
              <span className="material-symbols-outlined text-[16px] text-primary-fixed">center_focus_strong</span>
              <span>Point camera at passenger QR pass</span>
            </div>
            <span className="text-[10px] font-mono text-primary-fixed bg-black/60 backdrop-blur-md px-2 py-0.5 rounded">
              {cameraActive ? 'OPTICAL SCANNER' : 'IDLE'}
            </span>
          </div>

          {/* Center Target Box with Scanner Frame (STRICTLY NON-CLICKABLE VIEWFINDER) */}
          <div
            className="relative z-10 self-center w-48 h-48 flex items-center justify-center pointer-events-none"
            aria-label="QR Code Scanner Viewfinder"
          >
            <span className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-primary-fixed rounded-tl-lg" />
            <span className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-primary-fixed rounded-tr-lg" />
            <span className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-primary-fixed rounded-bl-lg" />
            <span className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-primary-fixed rounded-br-lg" />

            {cameraActive && (
              <div className="w-full h-0.5 bg-primary-fixed/80 shadow-[0_0_8px_rgba(21,128,61,0.8)] animate-pulse" />
            )}
          </div>

          {/* Bottom Feed Status */}
          <div className="relative z-10 flex items-center justify-center pb-1">
            <div className="bg-black/60 backdrop-blur-md px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm text-xs text-white">
              <span
                className={`w-2 h-2 rounded-full ${cameraActive ? 'bg-primary-fixed animate-ping' : 'bg-outline'}`}
              />
              <span>{cameraActive ? 'Detecting QR codes in live stream' : 'Camera off'}</span>
            </div>
          </div>
        </div>

        {/* Scan Options Row */}
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileScan}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px] text-primary">upload_file</span>
            <span>Scan QR Image</span>
          </button>
          <button
            onClick={() => setShowOtpModal(true)}
            className="flex-1 py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px] text-secondary">pin</span>
            <span>Enter 6-Digit Code</span>
          </button>
        </div>

        {/* Boarding Manifest Progress Card */}
        <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-outline-variant/30 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-on-surface uppercase tracking-wider">Manifest Verification</span>
            <span className="text-xs font-bold text-primary">{boardedCount} / {totalRiders} Boarded ({progressPct}%)</span>
          </div>

          <div className="w-full h-2 rounded-full bg-surface-container-highest overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs font-semibold text-on-surface">Booked Passengers</span>
            <button
              onClick={loadManifest}
              className="text-xs text-primary font-bold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[15px]">refresh</span>
              <span>Sync</span>
            </button>
          </div>

          {/* Passenger List */}
          <div className="flex flex-col gap-2">
            {passengers.length === 0 && !loading && (
              <p className="text-xs text-on-surface-variant text-center py-4">No passengers booked for this trip yet.</p>
            )}
            {passengers.map((p) => (
              <div
                key={p.bookingId}
                className="flex items-center justify-between p-2 rounded-xl bg-surface-container-low border border-outline-variant/20"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                    {p.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-on-surface truncate">{p.name}</span>
                    <span className="text-[10px] text-on-surface-variant truncate">{p.org} • {p.seat}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                      p.status === 'Boarded'
                        ? 'bg-primary/10 text-primary'
                        : 'bg-secondary-fixed text-on-secondary-fixed'
                    }`}
                  >
                    {p.status}
                  </span>
                  {p.status === 'Waiting' && (
                    <button
                      onClick={() => handleBoardPassenger(p)}
                      className="px-2 py-0.5 rounded-lg bg-primary text-on-primary text-[10px] font-bold cursor-pointer"
                    >
                      Check-In
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Manual 6-Digit Code Verification Modal */}
      {showOtpModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl max-w-xs w-full p-5 shadow-2xl border border-outline-variant/30 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-surface-container-high/60 pb-2">
              <h4 className="font-bold text-sm text-on-surface">Enter Passenger Passcode</h4>
              <button
                onClick={() => setShowOtpModal(false)}
                className="text-on-surface-variant hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <p className="text-xs text-on-surface-variant">
              Enter the 6-digit TOTP code displayed on the passenger's Corporate Commute Pass.
            </p>

            <input
              type="text"
              maxLength={6}
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              placeholder="e.g. 386889"
              className="w-full text-center text-xl font-mono font-bold tracking-widest p-3 rounded-xl border border-outline-variant/40 bg-surface-container-high focus:outline-primary"
            />

            <div className="flex gap-2">
              <button
                onClick={() => setShowOtpModal(false)}
                className="flex-1 py-2 rounded-xl bg-surface-container text-on-surface text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleVerifyOtp}
                className="flex-1 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold cursor-pointer"
              >
                Verify & Board
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
