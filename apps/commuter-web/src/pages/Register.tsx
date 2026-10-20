import React, { useState } from 'react';
import { authApi } from '../api/client';
import { User } from '../types';

interface RegisterProps {
  onSuccess: (user: User, email: string) => void;
  onGoToLogin: () => void;
}

export const Register: React.FC<RegisterProps> = ({ onSuccess, onGoToLogin }) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [companyId, setCompanyId] = useState('1');
  const [workCode, setWorkCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Compute password strength (1 to 3)
  const getPasswordStrength = (pwd: string) => {
    let score = 0;
    if (pwd.length >= 6) score++;
    if (pwd.length >= 8 && /[A-Z]/.test(pwd) && /[0-9]/.test(pwd)) score++;
    if (pwd.length >= 10 && /[^A-Za-z0-9]/.test(pwd)) score++;
    return score;
  };

  const strength = getPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!termsAccepted) {
      setError('Please accept terms of service');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const { user } = await authApi.register({
        fullName,
        email,
        password,
        companyId: parseInt(companyId, 10),
      });
      onSuccess(user, email);
    } catch (err: any) {
      setError(err.message || 'Registration failed. Corporate domain must be authorized.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex flex-col relative w-full px-4 pb-safe bg-surface min-h-screen pt-4 max-w-md mx-auto font-sans">
      <div className="flex flex-col w-full pb-8">
        {/* Step Progress Header */}
        <div className="w-full flex flex-col pb-4">
          <div className="flex items-center gap-2 mb-4 w-full">
            <div className="flex-1 h-1 rounded-full bg-primary-container"></div>
            <div className="flex-1 h-1 rounded-full bg-surface-container-highest"></div>
            <div className="flex-1 h-1 rounded-full bg-surface-container-highest"></div>
            <div className="flex-1 h-1 rounded-full bg-surface-container-highest"></div>
          </div>

          <div className="flex items-center justify-between mb-4 w-full">
            <button
              onClick={onGoToLogin}
              aria-label="Go back"
              className="w-10 h-10 flex items-center justify-center rounded-full text-on-surface hover:bg-surface-container -ml-2 transition-colors"
            >
              <span className="material-symbols-outlined text-[24px]">arrow_back</span>
            </button>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0"></span>
              <span className="text-[11px] font-semibold tracking-wider uppercase">
                Step 1 of 4 · Create Account
              </span>
            </div>
          </div>

          <div className="flex flex-col">
            <h1 className="text-2xl font-bold text-on-surface tracking-tight">Create Account</h1>
            <p className="text-sm text-on-surface-variant mt-1 leading-relaxed">
              Sustainable transit crafted for modern corporate teams.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-error-container text-on-error-container text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{error}</span>
          </div>
        )}

        {/* Card Form */}
        <div className="bg-surface-container-lowest rounded-3xl p-5 shadow-[0_4px_24px_rgba(0,93,183,0.06)] flex flex-col gap-4 border border-outline-variant/30">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Full Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-on-surface" htmlFor="reg-name">
                Full Name
              </label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3.5 text-outline text-[20px] pointer-events-none">
                  person
                </span>
                <input
                  id="reg-name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Sarah Taylor"
                  className="w-full bg-surface-container-low text-on-surface pl-11 pr-4 py-3 rounded-xl text-sm outline-none focus:bg-surface-container focus:ring-2 focus:ring-primary transition-all placeholder:text-outline"
                />
              </div>
            </div>

            {/* Corporate Email */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-on-surface" htmlFor="reg-email">
                  Corporate Email
                </label>
                <span className="text-[11px] text-secondary font-medium">Domain verification required</span>
              </div>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3.5 text-outline text-[20px] pointer-events-none">
                  mail
                </span>
                <input
                  id="reg-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@syscolabs.com"
                  className="w-full bg-surface-container-low text-on-surface pl-11 pr-4 py-3 rounded-xl text-sm outline-none focus:bg-surface-container focus:ring-2 focus:ring-primary transition-all placeholder:text-outline"
                />
              </div>
            </div>

            {/* Workplace Hub */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-on-surface" htmlFor="reg-company">
                Workplace / Enterprise
              </label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3.5 text-outline text-[20px] pointer-events-none">
                  apartment
                </span>
                <select
                  id="reg-company"
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  className="w-full bg-surface-container-low text-on-surface pl-11 pr-10 py-3 rounded-xl text-sm outline-none focus:bg-surface-container focus:ring-2 focus:ring-primary transition-all appearance-none cursor-pointer"
                >
                  <option value="1">Sysco LABS (Colombo HQ Metro Campus)</option>
                  <option value="2">Virtusa Corporation (Orion City)</option>
                  <option value="3">WSO2 (Palm Grove Corridor)</option>
                  <option value="4">Dialog Axiata (Innovation Pavillion)</option>
                </select>
                <span className="material-symbols-outlined absolute right-3.5 text-outline text-[20px] pointer-events-none">
                  expand_more
                </span>
              </div>
            </div>

            {/* Employee ID / Work Code */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-on-surface" htmlFor="reg-code">
                  Employee ID / Work Code
                </label>
                <span className="text-[11px] text-outline bg-surface-container px-2 py-0.5 rounded-md">
                  Optional
                </span>
              </div>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3.5 text-outline text-[20px] pointer-events-none">
                  badge
                </span>
                <input
                  id="reg-code"
                  type="text"
                  value={workCode}
                  onChange={(e) => setWorkCode(e.target.value)}
                  placeholder="e.g. SL-24018"
                  className="w-full bg-surface-container-low text-on-surface pl-11 pr-4 py-3 rounded-xl text-sm outline-none focus:bg-surface-container focus:ring-2 focus:ring-primary transition-all placeholder:text-outline"
                />
              </div>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-on-surface" htmlFor="reg-password">
                Password
              </label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3.5 text-outline text-[20px] pointer-events-none">
                  lock
                </span>
                <input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-surface-container-low text-on-surface pl-11 pr-11 py-3 rounded-xl text-sm outline-none focus:bg-surface-container focus:ring-2 focus:ring-primary transition-all placeholder:text-outline"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 text-outline hover:text-on-surface p-1"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>

              {/* Strength Bars */}
              <div className="flex items-center gap-1.5 pt-1 px-1">
                <div className="flex-1 h-1.5 rounded-full bg-surface-container overflow-hidden">
                  <div
                    className={`h-full w-full transition-colors duration-300 ${
                      strength >= 1 ? 'bg-error' : 'bg-transparent'
                    }`}
                  ></div>
                </div>
                <div className="flex-1 h-1.5 rounded-full bg-surface-container overflow-hidden">
                  <div
                    className={`h-full w-full transition-colors duration-300 ${
                      strength >= 2 ? 'bg-amber-500' : 'bg-transparent'
                    }`}
                  ></div>
                </div>
                <div className="flex-1 h-1.5 rounded-full bg-surface-container overflow-hidden">
                  <div
                    className={`h-full w-full transition-colors duration-300 ${
                      strength >= 3 ? 'bg-primary' : 'bg-transparent'
                    }`}
                  ></div>
                </div>
                <span className="text-[11px] text-outline ml-1 min-w-[50px] text-right font-medium">
                  {strength === 0 ? 'Empty' : strength === 1 ? 'Weak' : strength === 2 ? 'Good' : 'Strong'}
                </span>
              </div>
            </div>

            {/* Terms checkbox */}
            <label className="flex items-start gap-2.5 mt-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-1 h-4 w-4 rounded accent-primary bg-surface-container-low cursor-pointer"
              />
              <span className="text-xs text-on-surface-variant leading-relaxed">
                I agree to the <span className="text-secondary font-semibold hover:underline">Terms of Service</span> & <span className="text-secondary font-semibold hover:underline">Privacy Policy</span>.
              </span>
            </label>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3.5 px-6 rounded-2xl bg-primary text-on-primary text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:brightness-110 active:scale-[0.99] transition-all disabled:opacity-75 cursor-pointer"
            >
              {loading ? (
                <span>Creating Account...</span>
              ) : (
                <>
                  <span>Create Commuter Account</span>
                  <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                </>
              )}
            </button>
          </form>
        </div>

        <div className="flex items-center justify-center gap-1.5 mt-6 mb-2">
          <span className="text-sm text-on-surface-variant">Already have an account?</span>
          <button
            onClick={onGoToLogin}
            className="text-sm font-bold text-secondary hover:underline cursor-pointer"
          >
            Sign in
          </button>
        </div>
      </div>
    </main>
  );
};
