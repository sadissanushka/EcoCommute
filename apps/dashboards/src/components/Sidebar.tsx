import React from 'react';
import Link from 'next/link';

interface SidebarProps {
  currentPortal: 'admin' | 'gov';
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPortal }) => {
  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 min-h-screen">
      <div className="p-6 border-b border-slate-800">
        <Link href="/" className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center font-bold text-slate-950">
            EC
          </div>
          <span className="font-bold text-lg text-white tracking-tight">EcoCommute</span>
        </Link>
        <div className="mt-2 text-xs text-slate-400 font-medium">
          {currentPortal === 'admin' ? 'Corporate ESG Admin' : 'Government Urban Planning'}
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {currentPortal === 'admin' ? (
          <>
            <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              ESG & Commute
            </div>
            <Link
              href="/admin"
              className="flex items-center px-3 py-2 rounded-lg text-sm font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
            >
              Executive Summary
            </Link>
            <div className="flex items-center px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800/60 cursor-pointer">
              Department Split
            </div>
            <div className="flex items-center px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800/60 cursor-pointer">
              Carbon Accounting (GRI 3)
            </div>
            <div className="flex items-center px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800/60 cursor-pointer">
              Shuttle Fleet Utilization
            </div>
          </>
        ) : (
          <>
            <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Urban Mobility (DP)
            </div>
            <Link
              href="/gov"
              className="flex items-center px-3 py-2 rounded-lg text-sm font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20"
            >
              Commute Flow Heatmap
            </Link>
            <div className="flex items-center px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800/60 cursor-pointer">
              Privacy Budget Ledger
            </div>
            <div className="flex items-center px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800/60 cursor-pointer">
              Zone Congestion Trends
            </div>
          </>
        )}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <Link
          href={currentPortal === 'admin' ? '/gov' : '/admin'}
          className="flex items-center justify-center w-full px-3 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition"
        >
          Switch to {currentPortal === 'admin' ? 'Gov Portal (DP)' : 'Admin Portal'}
        </Link>
      </div>
    </aside>
  );
};
