import React, { useState, useEffect } from 'react';
import { User, getAvatarInitials } from '../types';

interface CorporatePassProps {
  user?: User | null;
  onBack?: () => void;
}

export const CorporatePass: React.FC<CorporatePassProps> = ({ user, onBack }) => {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(24);
  const [totpToken, setTotpToken] = useState<string>('849204');

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          // Regenerate dynamic 6-digit TOTP token
          const newToken = Math.floor(100000 + Math.random() * 900000).toString();
          setTotpToken(newToken);
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const companyName = user?.companyName || 'Dialog Axiata PLC';
  const employeeName = user?.fullName || 'Sarah Jenkins';
  const employeeId = user?.id ? `EMP-${user.id}` : 'EMP-8842';
  const corpId = user?.companyId ? `Corp ID #${user.companyId}` : 'Corp ID #941';

  return (
    <main className="flex flex-col relative w-full min-h-[calc(100vh-64px)] bg-surface font-sans max-w-md mx-auto pb-24">
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-surface-container-high/60">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              onClick={onBack}
              className="w-9 h-9 rounded-full bg-surface-container-high text-on-surface flex items-center justify-center hover:bg-surface-container-highest transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </button>
          )}
          <h1 className="text-base font-bold text-on-surface">Corporate Pass</h1>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-primary font-semibold">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span>Active Pass • Unlimited</span>
        </div>
      </div>

      <div className="flex flex-col w-full px-4 pt-3 gap-3">
        {/* Micro Status / Notice */}
        <div className="flex items-center justify-between py-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-[11px] text-primary font-bold uppercase tracking-wider">
              Transit Card Active
            </span>
          </div>
          <span className="text-[11px] text-on-surface-variant flex items-center gap-1 font-semibold">
            <span className="material-symbols-outlined text-[15px] text-primary">verified_user</span>
            HR & Fleet Verified
          </span>
        </div>

        {/* Physical Digital Pass Card */}
        <div className="relative w-full rounded-2xl bg-surface-container-lowest shadow-lg border border-outline-variant/30 overflow-hidden p-5 flex flex-col gap-4">
          {/* Subtle Ambient Backing Mesh */}
          <div className="absolute -top-16 -right-16 w-48 h-48 bg-primary/5 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-secondary/5 rounded-full blur-2xl pointer-events-none" />

          {/* Pass Header: Corporate Branding & Chip */}
          <div className="relative flex items-center justify-between pb-3 border-b border-surface-container-high/60">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-surface-container flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[22px]">corporate_fare</span>
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <h2 className="text-xs font-bold text-on-surface tracking-tight">{companyName}</h2>
                  <span className="material-symbols-outlined text-[14px] text-primary">check_circle</span>
                </div>
                <p className="text-[10px] text-on-surface-variant font-medium">Corporate Mobility Tier 1</p>
              </div>
            </div>

            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container text-on-surface-variant text-[11px] font-bold">
              <span className="material-symbols-outlined text-[15px] text-primary">contactless</span>
              <span>NFC</span>
            </div>
          </div>

          {/* Commuter Identity Row */}
          <div className="relative flex items-center gap-3 py-1">
            <div className="w-13 h-13 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-lg select-none shrink-0">
              {getAvatarInitials(employeeName)}
            </div>
            <div className="flex flex-col min-w-0">
              <h3 className="text-base font-bold text-on-surface truncate">{employeeName}</h3>
              <p className="text-xs text-on-surface-variant truncate">
                {user?.role === 'admin' ? 'Fleet Administrator' : 'Corporate Commuter'}
              </p>
              <div className="flex items-center gap-1 mt-0.5 text-[11px]">
                <span className="text-primary font-bold">{employeeId}</span>
                <span className="text-outline-variant">•</span>
                <span className="text-on-surface-variant">{corpId}</span>
              </div>
            </div>
          </div>

          {/* Tier & Subsidy Banner */}
          <div className="relative px-3.5 py-2.5 rounded-xl bg-surface-container-low flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">
                Pass Class
              </span>
              <span className="text-xs text-on-surface font-semibold">
                All-Zone Executive Express
              </span>
            </div>
            <span className="text-[11px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-lg">
              100% Sponsored
            </span>
          </div>

          {/* Dynamic Vector QR Code with Center Leaf Motif */}
          <div className="relative flex flex-col items-center justify-center py-2">
            <div className="p-4 rounded-2xl bg-white shadow-inner border border-outline-variant/30 flex flex-col items-center justify-center">
              <svg className="w-40 h-40 text-on-surface" fill="currentColor" viewBox="0 0 140 140">
                {/* Position Detection Squares (Top-Left, Top-Right, Bottom-Left) */}
                <rect height="35" rx="4" width="35" x="10" y="10" />
                <rect fill="#ffffff" height="25" width="25" x="15" y="15" />
                <rect height="15" width="15" x="20" y="20" />
                <rect height="35" rx="4" width="35" x="95" y="10" />
                <rect fill="#ffffff" height="25" width="25" x="100" y="15" />
                <rect height="15" width="15" x="105" y="20" />
                <rect height="35" rx="4" width="35" x="10" y="95" />
                <rect fill="#ffffff" height="25" width="25" x="15" y="100" />
                <rect height="15" width="15" x="20" y="105" />

                {/* Dynamic Payload Patterns */}
                <rect height="7" width="7" x="52" y="14" />
                <rect height="14" width="7" x="65" y="14" />
                <rect height="7" width="9" x="78" y="14" />
                <rect height="7" width="14" x="52" y="28" />
                <rect height="7" width="15" x="72" y="28" />
                <rect height="14" width="7" x="14" y="52" />
                <rect height="7" width="14" x="28" y="52" />
                <rect height="7" width="14" x="14" y="72" />
                <rect height="14" width="7" x="35" y="65" />

                {/* Center Identity Mark (Emerald Leaf Motif) */}
                <rect fill="#ffffff" height="42" rx="4" width="42" x="49" y="49" />
                <rect fill="#0d631b" height="32" rx="4" width="32" x="54" y="54" />
                <path d="M63 76 C 63 65, 75 62, 79 60 C 79 67, 75 76, 63 76 Z" fill="#ffffff" />
                <path d="M63 76 L 73 66" stroke="#0d631b" strokeLinecap="round" strokeWidth="2" />

                {/* Lower Data Elements */}
                <rect height="7" width="14" x="52" y="98" />
                <rect height="14" width="7" x="72" y="98" />
                <rect height="14" width="7" x="52" y="112" />
                <rect height="7" width="14" x="65" y="119" />
                <rect height="14" width="7" x="85" y="112" />
                <rect height="14" width="7" x="98" y="52" />
                <rect height="7" width="14" x="112" y="52" />
                <rect height="7" width="14" x="98" y="72" />
                <rect height="14" width="7" x="119" y="65" />
                <rect height="14" width="14" x="98" y="98" />
                <rect height="7" width="7" x="119" y="98" />
                <rect height="7" width="14" x="112" y="119" />
                <rect height="7" width="7" x="98" y="119" />
              </svg>
            </div>

            {/* Live Dynamic Token Refresher */}
            <div className="flex items-center gap-1.5 mt-2.5 text-xs text-on-surface-variant font-medium">
              <span className="material-symbols-outlined text-[15px] text-primary">sync</span>
              <span>Auto-refreshes in {secondsRemaining}s</span>
              <span className="text-outline-variant">•</span>
              <span className="font-mono font-bold text-on-surface">{totpToken}</span>
            </div>
          </div>

          {/* Contactless Wave Shuttle Banner */}
          <div className="w-full py-2.5 px-3 rounded-xl bg-surface-container flex items-center justify-center gap-2 text-xs font-semibold text-on-surface">
            <span className="material-symbols-outlined text-[18px] text-primary">sensors</span>
            <span>Hold near shuttle terminal reader to validate</span>
          </div>
        </div>

        {/* Commuter Access & Coverage Details */}
        <div className="rounded-2xl bg-surface-container-low p-4 flex flex-col gap-3 border border-outline-variant/30">
          <div className="flex items-center justify-between pb-1 border-b border-surface-container-high/60">
            <h4 className="text-xs font-bold text-on-surface uppercase tracking-wider">
              Transit Coverage & Privileges
            </h4>
            <span className="text-[10px] font-semibold text-primary">All Zones Included</span>
          </div>

          {/* Dedicated Route Corridor */}
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-primary shrink-0 mt-0.5">
              <span className="material-symbols-outlined text-[18px]">alt_route</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] text-on-surface-variant font-medium uppercase">
                Primary Transit Corridor
              </span>
              <span className="text-xs font-bold text-on-surface truncate">
                Kaduwela / Moratuwa ↔ Colombo CBD Hub
              </span>
              <span className="text-[11px] text-on-surface-variant mt-0.5">
                Direct express lane & shuttle priority boarding enabled
              </span>
            </div>
          </div>

          {/* Approved Mobility Modes */}
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-primary shrink-0 mt-0.5">
              <span className="material-symbols-outlined text-[18px]">electric_bolt</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] text-on-surface-variant font-medium uppercase">
                Approved Modes
              </span>
              <span className="text-xs font-bold text-on-surface">
                EV Corporate Shuttles, Rapid Transit & Verified Green Carpools
              </span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};
