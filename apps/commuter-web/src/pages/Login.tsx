import React, { useState } from 'react';
import { authApi } from '../api/client';
import { User } from '../types';

interface LoginProps {
  onSuccess: (user: User) => void;
  onGoToRegister: () => void;
}

export const Login: React.FC<LoginProps> = ({ onSuccess, onGoToRegister }) => {
  const [email, setEmail] = useState('sarah.taylor@syscolabs.com');
  const [password, setPassword] = useState('CorpPass2026!');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { user } = await authApi.login(email, password);
      onSuccess(user);
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative w-full bg-surface min-h-screen pb-safe flex flex-col justify-between items-center px-4 pt-safe font-sans">
      {/* Background ambient SVGs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-20">
        <svg
          className="absolute -top-24 -right-24 w-96 h-96 text-primary"
          viewBox="0 0 200 200"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M44.7,-76.4C58.8,-69.2,71.8,-59.1,79.6,-45.8C87.4,-32.5,90,-16.3,88.5,-0.9C87,14.6,81.4,29.2,73.1,42.4C64.8,55.6,53.8,67.4,40.4,75.1C27,82.8,11.2,86.4,-3.8,93C-18.8,99.6,-33,109.2,-46.5,107.5C-60,105.8,-72.8,92.8,-81.2,78.2C-89.6,63.6,-93.6,47.4,-94.1,31.6C-94.6,15.8,-91.6,0.4,-87.3,-14.2C-83,-28.8,-77.4,-42.6,-67.7,-53.8C-58,-65,-44.2,-73.6,-30.3,-80.8C-16.4,-88,-0.2,-93.8,14.6,-91.1C29.4,-88.4,44.7,-76.4,44.7,-76.4Z"
            fill="currentColor"
            transform="translate(100 100)"
          />
        </svg>
        <svg
          className="absolute bottom-20 -left-20 w-64 h-64 text-secondary/10"
          viewBox="0 0 200 200"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M38.1,-65.4C50.5,-58.4,62.4,-49.6,70.1,-38.1C77.8,-26.6,81.3,-12.3,80.1,1.5C78.9,15.3,73.1,28.6,64.8,40.2C56.5,51.8,45.7,61.7,33.3,68.1C20.9,74.5,6.9,77.4,-7.1,76.6C-21.1,75.8,-35.1,71.3,-47.5,63.4C-59.9,55.5,-70.7,44.2,-76.8,31C-82.9,17.8,-84.3,2.7,-81.8,-11.6C-79.3,-25.9,-72.9,-39.4,-62.7,-48.5C-52.5,-57.6,-38.5,-62.3,-25.5,-68.8C-12.5,-75.3,-0.5,-83.6,12,-85.7C24.5,-87.8,38.1,-65.4,38.1,-65.4Z"
            fill="currentColor"
            transform="translate(100 100)"
          />
        </svg>
      </div>

      {/* Main Centered Content Section */}
      <div className="w-full max-w-md my-auto relative z-10 py-6">
        {/* Floating Card with Integrated Header */}
        <div className="bg-surface-container-lowest rounded-2xl shadow-xl p-6 sm:p-8 w-full border border-outline-variant/30">
          {/* Card Header (Logo + Titles) */}
          <div className="flex flex-col items-center text-center pb-6 border-b border-surface-container-high/60">
            <div className="w-16 h-16 mb-3 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-sm">
              <span className="material-symbols-outlined text-[36px]">directions_bus</span>
            </div>
            <h1 className="text-2xl font-bold text-on-surface tracking-tight">Welcome back</h1>
            <p className="text-sm text-on-surface-variant mt-1">Empowering your sustainable journey.</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-3 rounded-xl bg-error-container text-on-error-container text-xs flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form className="space-y-4 pt-6" onSubmit={handleSubmit}>
            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-on-surface block" htmlFor="email">
                Corporate Email
              </label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors text-[20px]">
                  mail
                </span>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  required
                  className="w-full pl-11 pr-4 py-3 bg-surface rounded-lg text-sm text-on-surface outline-none border border-outline-variant/40 shadow-sm focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-outline"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-on-surface" htmlFor="password">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => alert('Please contact your enterprise IT administrator to reset your corporate pass credentials.')}
                  className="text-xs text-secondary font-semibold hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors text-[20px]">
                  lock
                </span>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-11 pr-11 py-3 bg-surface rounded-lg text-sm text-on-surface outline-none border border-outline-variant/40 shadow-sm focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-outline"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors flex items-center justify-center"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-primary text-on-primary rounded-lg text-sm font-bold shadow-md active:scale-[0.98] hover:bg-primary-container transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-75 cursor-pointer"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-on-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                </>
              )}
            </button>

            {/* Trust Badge */}
            <div className="flex items-center justify-center gap-1.5 pt-1 opacity-70">
              <span className="material-symbols-outlined text-[16px] text-primary">verified_user</span>
              <span className="text-xs text-on-surface-variant font-medium">Secure Corporate Access</span>
            </div>
          </form>
        </div>
      </div>

      {/* External Registration Footer */}
      <div className="w-full text-center py-6 relative z-10">
        <p className="text-sm text-on-surface-variant">
          New commuter?{' '}
          <button
            onClick={onGoToRegister}
            className="text-primary font-bold ml-1 hover:underline cursor-pointer"
          >
            Create account
          </button>
        </p>
      </div>
    </main>
  );
};
