import React from 'react';
import { User } from '../types';

interface HeaderProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  user?: User | null;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  showBack = false,
  onBack,
  user,
  onLogout,
}) => {
  return (
    <header className="fixed top-0 w-full z-40 bg-surface/85 backdrop-blur-xl pt-safe shadow-[0_1px_8px_rgba(0,0,0,0.04)] border-b border-surface-container-high/50">
      <div className="h-16 px-4 flex items-center justify-between max-w-lg mx-auto">
        <div className="flex items-center gap-2">
          {showBack ? (
            <button
              onClick={onBack}
              aria-label="Go back"
              className="w-10 h-10 -ml-2 flex items-center justify-center rounded-full hover:bg-surface-container active:bg-surface-container-high transition-colors"
            >
              <span className="material-symbols-outlined text-on-surface text-[24px]">arrow_back</span>
            </button>
          ) : null}

          {title ? (
            <h1 className="font-semibold text-lg text-on-surface truncate">{title}</h1>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-[22px]">eco</span>
              </div>
              <span className="font-bold text-xl text-primary tracking-tight">EcoCommute</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {user ? (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-xs uppercase">
                {user.fullName ? user.fullName.charAt(0) : 'U'}
              </div>
              {onLogout && (
                <button
                  onClick={onLogout}
                  title="Sign out"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-outline hover:text-error transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">logout</span>
                </button>
              )}
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
              Corporate
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
