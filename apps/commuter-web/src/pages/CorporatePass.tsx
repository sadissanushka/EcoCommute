import React from 'react';

interface CorporatePassProps {
  onBack?: () => void;
}

export const CorporatePass: React.FC<CorporatePassProps> = ({ onBack }) => {
  return (
    <div className="max-w-md mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        {onBack ? (
          <button
            onClick={onBack}
            className="px-3.5 py-1.5 rounded-xl bg-surface-container-low dark:bg-surface-container border border-outline-variant/30 text-xs font-semibold text-on-surface dark:text-white"
          >
            ← Back
          </button>
        ) : (
          <div />
        )}
        <div className="flex items-center gap-1.5 text-xs text-primary font-semibold">
          <span className="w-2 h-2 rounded-full bg-primary" />
          <span>Active Pass &bull; Unlimited</span>
        </div>
      </div>

      {/* Digital Pass Card */}
      <div className="bg-surface-container-lowest dark:bg-surface-container border border-outline-variant/30 rounded-2xl p-6 shadow-md space-y-6 relative overflow-hidden">
        {/* Pass Top Header */}
        <div className="flex items-center justify-between pb-4 border-b border-outline-variant/20">
          <div>
            <div className="text-base font-bold text-on-surface dark:text-white">Dialog Axiata PLC</div>
            <div className="text-xs text-on-surface-variant dark:text-outline-variant">Corporate Mobility Tier 1</div>
          </div>
          <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
            NFC / TOTP Ready
          </span>
        </div>

        {/* Commuter Identity */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-secondary text-white font-bold text-xl flex items-center justify-center">
            SJ
          </div>
          <div>
            <div className="text-lg font-bold text-on-surface dark:text-white">Sarah Jenkins</div>
            <div className="text-xs text-on-surface-variant dark:text-outline-variant">Senior Product Designer</div>
            <div className="text-xs font-mono font-semibold text-primary mt-0.5">
              EMP-8842 &bull; Corp ID #941
            </div>
          </div>
        </div>

        {/* Tier & Subsidy */}
        <div className="p-3.5 bg-surface-container-low dark:bg-surface-container-high rounded-xl flex items-center justify-between text-xs">
          <div>
            <div className="text-on-surface-variant dark:text-outline-variant">Pass Class</div>
            <div className="font-semibold text-on-surface dark:text-white">All-Zone Executive Commute</div>
          </div>
          <span className="font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-md">
            100% Subsidized
          </span>
        </div>

        {/* Simulated QR Code */}
        <div className="flex flex-col items-center justify-center py-4 bg-surface-container-low dark:bg-surface-container-high rounded-xl">
          <div className="w-44 h-44 bg-white p-3 rounded-xl border border-outline-variant/30 flex items-center justify-center shadow-inner">
            {/* SVG Flat Crisp QR Code representation */}
            <svg viewBox="0 0 100 100" className="w-full h-full text-slate-900" fill="currentColor">
              {/* Corner markers */}
              <rect x="5" y="5" width="25" height="25" rx="3" />
              <rect x="9" y="9" width="17" height="17" fill="white" />
              <rect x="13" y="13" width="9" height="9" />

              <rect x="70" y="5" width="25" height="25" rx="3" />
              <rect x="74" y="9" width="17" height="17" fill="white" />
              <rect x="78" y="13" width="9" height="9" />

              <rect x="5" y="70" width="25" height="25" rx="3" />
              <rect x="9" y="74" width="17" height="17" fill="white" />
              <rect x="13" y="78" width="9" height="9" />

              {/* Data payload cells */}
              <rect x="35" y="10" width="8" height="8" />
              <rect x="48" y="15" width="10" height="6" />
              <rect x="35" y="25" width="6" height="12" />
              <rect x="45" y="28" width="18" height="6" />
              <rect x="10" y="38" width="18" height="8" />
              <rect x="32" y="42" width="10" height="10" />
              <rect x="48" y="38" width="8" height="18" />
              <rect x="62" y="35" width="12" height="8" />
              <rect x="80" y="38" width="15" height="12" />
              <rect x="15" y="52" width="8" height="10" />
              <rect x="28" y="58" width="12" height="6" />
              <rect x="60" y="50" width="14" height="12" />
              <rect x="80" y="55" width="12" height="10" />
              <rect x="35" y="70" width="10" height="10" />
              <rect x="50" y="68" width="8" height="14" />
              <rect x="65" y="72" width="15" height="8" />
              <rect x="40" y="85" width="15" height="8" />
              <rect x="62" y="84" width="18" height="10" />
            </svg>
          </div>
          <span className="text-[11px] font-mono text-on-surface-variant dark:text-outline-variant mt-3">
            Dynamic Token: 8941-EC26-TOTP &bull; Valid
          </span>
        </div>

        {/* Assigned Corridor */}
        <div className="pt-2 text-center text-xs text-on-surface-variant dark:text-outline-variant">
          <span>Assigned Hub: </span>
          <strong className="text-on-surface dark:text-white">Barnes Place ⇄ Dialog HQ Tower 2</strong>
        </div>
      </div>
    </div>
  );
};
