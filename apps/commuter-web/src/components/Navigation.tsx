import React from 'react';

export type TabType = 'home' | 'book' | 'tracking' | 'wallet' | 'sos';

interface NavigationProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ currentTab, onSelectTab }) => {
  const tabs = [
    { id: 'home' as TabType, label: 'Home', icon: 'grid_view' },
    { id: 'book' as TabType, label: 'Book', icon: 'directions_bus' },
    { id: 'tracking' as TabType, label: 'Tracking', icon: 'radar' },
    { id: 'wallet' as TabType, label: 'Wallet', icon: 'account_balance_wallet' },
    { id: 'sos' as TabType, label: 'SOS', icon: 'emergency', isSpecial: true },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-surface/90 backdrop-blur-xl border-t border-outline-variant/30 pb-safe shadow-[0_-2px_12px_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id;

          if (tab.isSpecial) {
            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`flex flex-col items-center justify-center -mt-4 p-2 rounded-full transition-transform active:scale-95 ${
                  isActive ? 'scale-105' : ''
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-error text-on-error flex items-center justify-center shadow-lg shadow-error/30">
                  <span className="material-symbols-outlined text-[24px]">emergency</span>
                </div>
                <span className="text-[11px] font-bold text-error mt-0.5 uppercase tracking-wider">
                  SOS
                </span>
              </button>
            );
          }

          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`flex-1 flex flex-col items-center justify-center py-1 transition-all ${
                isActive ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <div
                className={`p-1 rounded-xl transition-colors ${
                  isActive ? 'bg-primary/10' : 'bg-transparent'
                }`}
              >
                <span className="material-symbols-outlined text-[22px]">{tab.icon}</span>
              </div>
              <span
                className={`text-[11px] mt-0.5 tracking-tight ${
                  isActive ? 'font-bold' : 'font-medium'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
