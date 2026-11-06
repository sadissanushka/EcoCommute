'use client';

import React, { useState } from 'react';
import {
  Landmark,
  ShieldCheck,
  TrendingUp,
  MapPin,
  Building2,
  Activity,
  Sliders,
  BarChart3,
  Layers,
} from 'lucide-react';

export default function GovernmentAnalyticsPage() {
  const [selectedZone, setSelectedZone] = useState('ALL');

  const zoneData = [
    { id: 'CMB-01', name: 'Colombo Fort CBD', volume: 14250, sovReduction: '24.2%', avgTransitMins: 28, airQualityIdx: 'Good (42 AQI)' },
    { id: 'CMB-02', name: 'Slave Island Tech Hub', volume: 9840, sovReduction: '31.5%', avgTransitMins: 22, airQualityIdx: 'Moderate (55 AQI)' },
    { id: 'CMB-07', name: 'Cinnamon Gardens', volume: 6420, sovReduction: '18.9%', avgTransitMins: 34, airQualityIdx: 'Good (38 AQI)' },
    { id: 'DEH-01', name: 'Dehiwala / Mt. Lavinia', volume: 8190, sovReduction: '22.0%', avgTransitMins: 41, airQualityIdx: 'Moderate (62 AQI)' },
    { id: 'KJW-01', name: 'Rajagiriya Parliament Hub', volume: 11300, sovReduction: '27.4%', avgTransitMins: 31, airQualityIdx: 'Good (45 AQI)' },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-[#e0dedd] dark:border-[#272c29]">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-on-surface dark:text-white">
              Government & Urban Mobility Analytics
            </h1>
            <span className="text-xs bg-secondary/10 text-secondary border border-secondary/20 px-3 py-1 rounded-full font-semibold">
              Colombo Metro Authority
            </span>
          </div>
          <p className="text-sm text-on-surface-variant dark:text-[#a6b2a3] mt-1">
            Macro-level corridor traffic mitigation, public road network load abatement, and air quality indexes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-on-surface-variant dark:text-[#a6b2a3]">Privacy Tier:</span>
          <span className="text-xs bg-primary/10 text-primary border border-primary/20 px-3 py-1.5 rounded-xl font-bold">
            DP Verified (ε = 1.0, k ≥ 5)
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-surface-container-lowest dark:bg-[#1d211e] border border-[#e4e2e1] dark:border-[#2c332e] p-6 rounded-2xl shadow-sm">
          <div className="flex justify-between items-start text-xs font-semibold uppercase text-on-surface-variant dark:text-[#a6b2a3]">
            <span>Peak Hour Trips Displaced</span>
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <div className="mt-4 text-3xl font-bold text-primary tracking-tight">50,000+</div>
          <div className="text-xs text-on-surface-variant dark:text-[#a6b2a3] mt-2">
            Weekly SOV trips diverted into shared shuttles
          </div>
        </div>

        <div className="bg-surface-container-lowest dark:bg-[#1d211e] border border-[#e4e2e1] dark:border-[#2c332e] p-6 rounded-2xl shadow-sm">
          <div className="flex justify-between items-start text-xs font-semibold uppercase text-on-surface-variant dark:text-[#a6b2a3]">
            <span>Corridor Congestion Delta</span>
            <TrendingUp className="w-5 h-5 text-secondary" />
          </div>
          <div className="mt-4 text-3xl font-bold text-secondary tracking-tight">-28.4%</div>
          <div className="text-xs text-on-surface-variant dark:text-[#a6b2a3] mt-2">
            Delay reduction on Galle Road & Parliament Corridor
          </div>
        </div>

        <div className="bg-surface-container-lowest dark:bg-[#1d211e] border border-[#e4e2e1] dark:border-[#2c332e] p-6 rounded-2xl shadow-sm">
          <div className="flex justify-between items-start text-xs font-semibold uppercase text-on-surface-variant dark:text-[#a6b2a3]">
            <span>Participating Employers</span>
            <Building2 className="w-5 h-5 text-primary" />
          </div>
          <div className="mt-4 text-3xl font-bold text-on-surface dark:text-white tracking-tight">48 Entities</div>
          <div className="text-xs text-on-surface-variant dark:text-[#a6b2a3] mt-2">
            Multi-tenant data aggregation under strict k-anonymity
          </div>
        </div>

        <div className="bg-surface-container-lowest dark:bg-[#1d211e] border border-[#e4e2e1] dark:border-[#2c332e] p-6 rounded-2xl shadow-sm">
          <div className="flex justify-between items-start text-xs font-semibold uppercase text-on-surface-variant dark:text-[#a6b2a3]">
            <span>Avg Transit Velocity</span>
            <BarChart3 className="w-5 h-5 text-primary" />
          </div>
          <div className="mt-4 text-3xl font-bold text-on-surface dark:text-white tracking-tight">31.2 km/h</div>
          <div className="text-xs text-primary font-semibold mt-2">
            +6.4 km/h improvement over solo driving
          </div>
        </div>
      </div>

      {/* Urban Zone Breakdown Table */}
      <div className="bg-surface-container-lowest dark:bg-[#1d211e] border border-[#e4e2e1] dark:border-[#2c332e] rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-[#e0dedd] dark:border-[#272c29] mb-4">
          <div>
            <h2 className="text-base font-bold text-on-surface dark:text-white">
              Colombo Metropolitan Spatial Zones & Congestion Relief
            </h2>
            <p className="text-xs text-on-surface-variant dark:text-[#a6b2a3] mt-0.5">
              Differential privacy protected aggregated mobility matrix across urban terminal nodes.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#e0dedd] dark:border-[#272c29] text-xs uppercase font-semibold text-on-surface-variant dark:text-[#a6b2a3]">
                <th className="py-3 px-4">Zone Code</th>
                <th className="py-3 px-4">Urban Planning Sector</th>
                <th className="py-3 px-4">Weekly Commute Volume</th>
                <th className="py-3 px-4">Private SOV Relief</th>
                <th className="py-3 px-4">Avg Travel Time</th>
                <th className="py-3 px-4">Air Quality Index</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e0dedd] dark:divide-[#272c29]">
              {zoneData.map((z) => (
                <tr key={z.id} className="hover:bg-surface-container-low dark:hover:bg-[#252b27] transition">
                  <td className="py-3.5 px-4 font-mono font-bold text-primary">{z.id}</td>
                  <td className="py-3.5 px-4 font-semibold text-on-surface dark:text-white">{z.name}</td>
                  <td className="py-3.5 px-4 font-mono text-on-surface dark:text-white">{z.volume.toLocaleString()} trips</td>
                  <td className="py-3.5 px-4 font-bold text-primary">{z.sovReduction}</td>
                  <td className="py-3.5 px-4 text-on-surface-variant dark:text-[#a6b2a3]">{z.avgTransitMins} mins</td>
                  <td className="py-3.5 px-4">
                    <span className="text-xs bg-surface-container dark:bg-[#2b322e] text-on-surface dark:text-white px-2.5 py-1 rounded-md font-medium">
                      {z.airQualityIdx}
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
