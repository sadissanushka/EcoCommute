import React, { useState, useEffect, useRef } from 'react';
import { safetyApi } from '../api/client';

interface VerificationProps {
  email: string;
  onSuccess: () => void;
  onBack: () => void;
}

export const Verification: React.FC<VerificationProps> = ({ email, onSuccess, onBack }) => {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(30);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Automatically trigger OTP generation on load
    safetyApi.requestOtp(email).then((res) => {
      if (res.debugOtp) {
        setInfoMessage(`Test OTP generated: ${res.debugOtp}`);
      }
    }).catch(() => {
      // Offline fallback
      setInfoMessage('6-digit corporate verification code dispatched');
    });

    const timer = setInterval(() => {
      setResendCooldown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [email]);

  const handleDigitChange = (index: number, value: string) => {
    const val = value.slice(-1);
    const newDigits = [...digits];
    newDigits[index] = val;
    setDigits(newDigits);

    // Auto-advance
    if (val && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const newDigits = [...digits];
    for (let i = 0; i < pasted.length; i++) {
      newDigits[i] = pasted[i];
    }
    setDigits(newDigits);
    inputRefs.current[Math.min(5, pasted.length)]?.focus();
  };

  const handleVerify = async () => {
    const otp = digits.join('');
    if (otp.length < 6) {
      setError('Please enter all 6 digits of the verification code');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await safetyApi.confirmOtp(email, otp);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Invalid or expired OTP code. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setError(null);
    try {
      const res = await safetyApi.requestOtp(email);
      setResendCooldown(30);
      if (res.debugOtp) {
        setInfoMessage(`New verification code: ${res.debugOtp}`);
      } else {
        setInfoMessage('New verification code sent to your inbox');
      }
    } catch (err: any) {
      setError('Failed to resend code. Please try again shortly.');
    }
  };

  return (
    <main className="relative w-full pt-16 bg-surface min-h-screen max-w-md mx-auto font-sans">
      <header className="fixed top-0 left-0 right-0 z-50 bg-surface/85 backdrop-blur-xl pt-safe border-b border-surface-container-high/40">
        <div className="flex items-center gap-2 px-4 pt-3 pb-1 max-w-md mx-auto">
          <div className="flex-1 h-1 rounded-full bg-primary-container"></div>
          <div className="flex-1 h-1 rounded-full bg-primary-container"></div>
          <div className="flex-1 h-1 rounded-full bg-surface-container-highest"></div>
          <div className="flex-1 h-1 rounded-full bg-surface-container-highest"></div>
        </div>

        <div className="px-4 pt-1 pb-2 flex items-center justify-between mb-2 max-w-md mx-auto">
          <button
            onClick={onBack}
            aria-label="Go back"
            className="w-10 h-10 flex items-center justify-center rounded-full text-on-surface hover:bg-surface-container -ml-2 transition-colors"
          >
            <span className="material-symbols-outlined text-[24px]">arrow_back</span>
          </button>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0"></span>
            <span className="text-[11px] font-semibold tracking-wider uppercase">
              Step 2 of 4 · Verification
            </span>
          </div>
        </div>
      </header>

      <div className="flex flex-col w-full px-4 pt-4">
        {/* Hero Illustration Area */}
        <div className="relative flex flex-col items-center justify-center py-8 overflow-hidden rounded-3xl bg-gradient-to-br from-primary/10 via-surface-bright to-secondary/5 border border-primary/10">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-surface-container-lowest shadow-xl flex items-center justify-center z-10 relative">
              <span className="material-symbols-outlined text-primary text-[42px]">
                mark_email_unread
              </span>
            </div>
            <span className="material-symbols-outlined absolute -top-2 -right-3 text-primary opacity-60 animate-bounce">
              eco
            </span>
            <span className="material-symbols-outlined absolute bottom-0 -left-4 text-secondary opacity-50 animate-pulse">
              verified_user
            </span>
          </div>

          <div className="mt-4 text-center px-4">
            <h2 className="text-xl font-bold text-on-surface mb-1 tracking-tight">
              Check your inbox
            </h2>
            <p className="text-xs text-on-surface-variant max-w-[280px] mx-auto">
              We sent a 6-digit verification code to{' '}
              <span className="font-semibold text-on-surface block truncate">{email}</span>
            </p>
          </div>
        </div>

        {infoMessage && (
          <div className="mt-3 p-2.5 rounded-xl bg-primary/10 text-primary text-xs flex items-center gap-2 border border-primary/20">
            <span className="material-symbols-outlined text-[16px]">info</span>
            <span className="font-medium">{infoMessage}</span>
          </div>
        )}

        {error && (
          <div className="mt-3 p-2.5 rounded-xl bg-error-container text-on-error-container text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">error</span>
            <span>{error}</span>
          </div>
        )}

        {/* 6-Digit OTP Form */}
        <div className="mt-6 flex flex-col items-center">
          <div className="flex gap-2 justify-between w-full max-w-[340px]" onPaste={handlePaste}>
            {[0, 1, 2].map((idx) => (
              <input
                key={idx}
                ref={(el) => (inputRefs.current[idx] = el)}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digits[idx]}
                onChange={(e) => handleDigitChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                placeholder="•"
                className="w-11 h-13 text-center text-xl font-bold bg-surface-container-low border-b-2 border-transparent rounded-xl focus:bg-surface-container-high focus:border-primary focus:outline-none transition-all shadow-sm"
              />
            ))}
            <div className="w-2 flex items-center justify-center opacity-40 font-bold text-outline">—</div>
            {[3, 4, 5].map((idx) => (
              <input
                key={idx}
                ref={(el) => (inputRefs.current[idx] = el)}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digits[idx]}
                onChange={(e) => handleDigitChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                placeholder="•"
                className="w-11 h-13 text-center text-xl font-bold bg-surface-container-low border-b-2 border-transparent rounded-xl focus:bg-surface-container-high focus:border-primary focus:outline-none transition-all shadow-sm"
              />
            ))}
          </div>

          <p className="mt-3 text-xs text-on-surface-variant flex items-center gap-1">
            <span className="material-symbols-outlined text-[15px]">info</span>
            Check your corporate spam folder if not visible immediately.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col gap-3 mb-8">
          <button
            onClick={handleVerify}
            disabled={loading || digits.join('').length < 6}
            className="w-full h-13 bg-primary text-on-primary rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <span>Verifying...</span>
            ) : (
              <>
                <span>Verify Account</span>
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </>
            )}
          </button>

          <div className="flex items-center justify-center gap-1.5 text-xs text-on-surface-variant">
            <span>Didn't receive code?</span>
            <button
              onClick={handleResend}
              disabled={resendCooldown > 0}
              className={`font-semibold text-secondary hover:underline cursor-pointer ${
                resendCooldown > 0 ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : 'Resend code'}
            </button>
          </div>
        </div>

        {/* Decorative Trust Elements */}
        <div className="mt-auto py-6 flex flex-col items-center justify-center opacity-40">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-[1px] w-8 bg-outline-variant"></div>
            <span className="text-[10px] uppercase tracking-widest text-outline font-semibold">
              EcoCommute Security
            </span>
            <div className="h-[1px] w-8 bg-outline-variant"></div>
          </div>
          <div className="flex gap-4">
            <span className="material-symbols-outlined text-on-surface-variant">directions_bus</span>
            <span className="material-symbols-outlined text-on-surface-variant">shield</span>
            <span className="material-symbols-outlined text-on-surface-variant">eco</span>
          </div>
        </div>
      </div>
    </main>
  );
};
