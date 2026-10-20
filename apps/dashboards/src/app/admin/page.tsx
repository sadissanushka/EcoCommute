'use client';

import React, { useState } from 'react';
import { KpiCard } from '@/components/KpiCard';

export default function AdminDashboardPage() {
  const [dateRange, setDateRange] = useState('2026-07-01 to 2026-09-30');

  // Seeded aggregate metrics for Dialog Axiata PLC (Company 1)
  const kpis = {
    totalTrips: '1,842',
    totalRiders: '4,690',
    totalDistanceKm: '34,890 km',
    avgOccupancy: '2.85',
    seatUtilisation: '84.2%',
    co2AvoidedKg: '14,250 kg',
    treeEquivalent: '654.6 trees',
    fuelReimbursedLkr: 'Rs. 964,250',
  };

  const departments = [
    { name: 'Engineering & IT', trips: 684, riders: 1820, co2AvoidedKg: 5210, participation: '88%' },
    { name: 'Operations & Logistics', trips: 412, riders: 1140, co2AvoidedKg: 3450, participation: '82%' },
    { name: 'Customer Support', trips: 286, riders: 740, co2AvoidedKg: 2190, participation: '75%' },
    { name: 'Sales & Marketing', trips: 215, riders: 510, co2AvoidedKg: 1680, participation: '69%' },
    { name: 'Finance & Accounting', trips: 145, riders: 310, co2AvoidedKg: 1040, participation: '71%' },
    { name: 'Human Resources', trips: 100, riders: 170, co2AvoidedKg: 680, participation: '64%' },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Top Banner & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Corporate ESG & Commute Analytics</h1>
          <p className="text-sm text-slate-400 mt-1">
            Q3 2026 Scope 3 Commuting Emissions & Fleet Occupancy Report
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="text-xs bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-300">
            Period: <span className="font-semibold text-white">{dateRange}</span>
          </div>
          <button className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-4 py-2 rounded-lg transition shadow-sm">
            Export GRI Report (CSV)
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <KpiCard
          title="Total Shared Trips"
          value={kpis.totalTrips}
          subValue="Carpool & Corporate Shuttle legs"
          badge="+18.4%"
          badgeColor="green"
        />
        <KpiCard
          title="CO₂ Emissions Avoided"
          value={kpis.co2AvoidedKg}
          subValue="Calculated vs solo driver baseline"
          badge="Verified DEFRA"
          badgeColor="green"
        />
        <KpiCard
          title="Tree Equivalent Offset"
          value={kpis.treeEquivalent}
          subValue="Tropical mature tree absorption/year"
          badge="ESG Scope 3"
          badgeColor="purple"
        />
        <KpiCard
          title="Fuel Reimbursed"
          value={kpis.fuelReimbursedLkr}
          subValue="Paid via append-only ledger"
          badge="Balanced"
          badgeColor="blue"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <KpiCard
          title="Total Commuter Riders"
          value={kpis.totalRiders}
          subValue="Employees transported"
          badgeColor="blue"
        />
        <KpiCard
          title="Average Vehicle Occupancy"
          value={kpis.avgOccupancy}
          subValue="Passengers per shared vehicle"
          badge="Goal: 2.50"
          badgeColor="amber"
        />
        <KpiCard
          title="Shuttle Seat Utilisation"
          value={kpis.seatUtilisation}
          subValue="Capacity utilization rate"
          badge="Optimal"
          badgeColor="green"
        />
      </div>

      {/* Department Breakdown Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-base font-bold text-white tracking-tight">Departmental Commute Performance</h2>
          <span className="text-xs text-slate-400">Aggregated from analytics.mv_trips_by_department_day</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/60 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-6 py-3.5">Department</th>
                <th className="px-6 py-3.5">Trips Completed</th>
                <th className="px-6 py-3.5">Riders Transported</th>
                <th className="px-6 py-3.5">CO₂ Avoided</th>
                <th className="px-6 py-3.5">Participation Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {departments.map((dept) => (
                <tr key={dept.name} className="hover:bg-slate-800/30 transition">
                  <td className="px-6 py-4 font-medium text-white">{dept.name}</td>
                  <td className="px-6 py-4">{dept.trips.toLocaleString()}</td>
                  <td className="px-6 py-4">{dept.riders.toLocaleString()}</td>
                  <td className="px-6 py-4 font-semibold text-emerald-400">{dept.co2AvoidedKg.toLocaleString()} kg</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {dept.participation}
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
