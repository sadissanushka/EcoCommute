'use client';

import React, { useState } from 'react';
import {
  Users,
  Bus,
  Clock,
  Leaf,
  Download,
  Calendar,
  CheckCircle2,
  TrendingUp,
  MapPin,
  ArrowRight,
} from 'lucide-react';

export default function OperationsOverviewPage() {
  const [filterPeriod, setFilterPeriod] = useState<'today' | '7d' | '30d'>('today');

  const corridors = [
    {
      name: 'Kaduwela Express (Corridor A)',
      origin: 'Kaduwela Interchange Hub',
      destination: 'Colombo Fort CBD',
      activeShuttles: 4,
      onTimeRate: '98.8%',
      commuterLoad: '142 / 160 seats',
      status: 'Normal Operations',
    },
    {
      name: 'Moratuwa Coastal Line (Corridor B)',
      origin: 'Moratuwa Station / UoM Hub',
      destination: 'Slave Island Tech Hub',
      activeShuttles: 3,
      onTimeRate: '96.5%',
      commuterLoad: '88 / 90 seats',
      status: 'Optimal Flow',
    },
    {
      name: 'Malabe Tech Horizon (Corridor C)',
      origin: 'Malabe IT Park Campus',
      destination: 'Colombo World Trade Center',
      activeShuttles: 5,
      onTimeRate: '97.2%',
      commuterLoad: '150 / 150 seats',
      status: 'Full Capacity',
    },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-[#e0dedd] dark:border-[#272c29]">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-on-surface dark:text-white">
              Operations Overview
            </h1>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-high dark:bg-[#252b27] text-on-surface dark:text-white text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-primary" />
              <span>Network Active</span>
              <span className="text-on-surface-variant dark:text-[#a6b2a3]">·</span>
              <span>All 3 Corridors Synchronized</span>
            </div>
          </div>
          <p className="text-sm text-on-surface-variant dark:text-[#a6b2a3] mt-1">
            Real-time commute telemetry and corridor synchronization across metro terminals.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center p-1 bg-surface-container-low dark:bg-[#1d211e] rounded-xl border border-[#e4e2e1] dark:border-[#2c332e]">
            {(['today', '7d', '30d'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setFilterPeriod(p)}
                className={`px-3.5 py-1.5 text-xs rounded-lg font-semibold transition ${
                  filterPeriod === p
                    ? 'bg-primary text-on-primary'
                    : 'text-on-surface-variant dark:text-[#a6b2a3] hover:text-on-surface dark:hover:text-white'
                }`}
              >
                {p === 'today' ? 'Today' : p.toUpperCase()}
              </button>
            ))}
          </div>

          <button className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-container text-on-primary text-xs font-semibold rounded-xl shadow-sm transition">
            <Download className="w-4 h-4" />
            <span>Export Summary</span>
          </button>
        </div>
      </div>

      {/* 4 Core Metric KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-surface-container-lowest dark:bg-[#1d211e] border border-[#e4e2e1] dark:border-[#2c332e] p-6 rounded-2xl shadow-sm">
          <div className="flex items-start justify-between text-xs font-semibold uppercase text-on-surface-variant dark:text-[#a6b2a3]">
            <span>Active Commuters</span>
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-bold text-on-surface dark:text-white tracking-tight">2,840</div>
            <div className="flex items-center gap-1.5 mt-2 text-xs text-primary font-semibold">
              <TrendingUp className="w-4 h-4" />
              <span>+12% vs last week</span>
            </div>
          </div>
        </div>

        <div className="bg-surface-container-lowest dark:bg-[#1d211e] border border-[#e4e2e1] dark:border-[#2c332e] p-6 rounded-2xl shadow-sm">
          <div className="flex items-start justify-between text-xs font-semibold uppercase text-on-surface-variant dark:text-[#a6b2a3]">
            <span>Shuttles on Route</span>
            <div className="w-9 h-9 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center">
              <Bus className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-bold text-on-surface dark:text-white tracking-tight">
              28 <span className="text-lg font-normal text-on-surface-variant dark:text-[#a6b2a3]">/ 32</span>
            </div>
            <div className="text-xs text-on-surface-variant dark:text-[#a6b2a3] mt-2">
              91% active fleet availability
            </div>
          </div>
        </div>

        <div className="bg-surface-container-lowest dark:bg-[#1d211e] border border-[#e4e2e1] dark:border-[#2c332e] p-6 rounded-2xl shadow-sm">
          <div className="flex items-start justify-between text-xs font-semibold uppercase text-on-surface-variant dark:text-[#a6b2a3]">
            <span>On-Time Arrival</span>
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-bold text-primary tracking-tight">98.4%</div>
            <div className="text-xs text-on-surface-variant dark:text-[#a6b2a3] mt-2">
              Exceeding corporate target (95.0%)
            </div>
          </div>
        </div>

        <div className="bg-surface-container-lowest dark:bg-[#1d211e] border border-[#e4e2e1] dark:border-[#2c332e] p-6 rounded-2xl shadow-sm">
          <div className="flex items-start justify-between text-xs font-semibold uppercase text-on-surface-variant dark:text-[#a6b2a3]">
            <span>Daily Carbon Offset</span>
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Leaf className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-bold text-primary tracking-tight">
              1.84 <span className="text-lg font-normal text-on-surface dark:text-white">tCO₂e</span>
            </div>
            <div className="text-xs text-on-surface-variant dark:text-[#a6b2a3] mt-2">
              Avoided vs solo private vehicle commutes
            </div>
          </div>
        </div>
      </div>

      {/* Synchronized Corridors Table */}
      <div className="bg-surface-container-lowest dark:bg-[#1d211e] border border-[#e4e2e1] dark:border-[#2c332e] rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-[#e0dedd] dark:border-[#272c29] mb-4">
          <div>
            <h2 className="text-base font-bold text-on-surface dark:text-white">
              Active Metro Transit Corridors
            </h2>
            <p className="text-xs text-on-surface-variant dark:text-[#a6b2a3] mt-0.5">
              Automated timetable synchronization and load monitoring across Colombo terminals.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#e0dedd] dark:border-[#272c29] text-xs uppercase font-semibold text-on-surface-variant dark:text-[#a6b2a3]">
                <th className="py-3 px-4">Corridor Name</th>
                <th className="py-3 px-4">Route Path</th>
                <th className="py-3 px-4">Active Shuttles</th>
                <th className="py-3 px-4">Seat Utilization</th>
                <th className="py-3 px-4">Punctuality</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e0dedd] dark:divide-[#272c29]">
              {corridors.map((c, idx) => (
                <tr key={idx} className="hover:bg-surface-container-low dark:hover:bg-[#252b27] transition">
                  <td className="py-3.5 px-4 font-semibold text-on-surface dark:text-white">{c.name}</td>
                  <td className="py-3.5 px-4 text-xs text-on-surface-variant dark:text-[#a6b2a3]">
                    <span>{c.origin}</span>
                    <span className="mx-2 font-bold text-primary">→</span>
                    <span>{c.destination}</span>
                  </td>
                  <td className="py-3.5 px-4 font-mono font-semibold text-on-surface dark:text-white">
                    {c.activeShuttles} Vehicles
                  </td>
                  <td className="py-3.5 px-4 font-medium text-on-surface dark:text-white">{c.commuterLoad}</td>
                  <td className="py-3.5 px-4 font-bold text-primary">{c.onTimeRate}</td>
                  <td className="py-3.5 px-4">
                    <span className="text-xs bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 rounded-md font-semibold">
                      {c.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
