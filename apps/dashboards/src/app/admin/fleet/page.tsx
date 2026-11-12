'use client';

import React, { useState } from 'react';
import {
  Bus,
  Zap,
  BatteryCharging,
  AlertTriangle,
  Download,
  PlusCircle,
  MapPin,
  CheckCircle2,
  Activity,
} from 'lucide-react';

export default function FleetManagementPage() {
  const [filterType, setFilterType] = useState('ALL');

  const fleet = [
    {
      plateNo: 'NC-8821',
      model: 'Toyota Coaster EV (Zero Emission)',
      type: 'Electric Shuttle',
      capacity: 30,
      assignedRoute: 'Kaduwela Express (Corridor A)',
      driverName: 'Saman Kumara',
      batterySoc: '92%',
      healthStatus: 'Optimal (100% SoC Health)',
      status: 'On Route',
    },
    {
      plateNo: 'WP-6490',
      model: 'Toyota HiAce VIP Hybrid',
      type: 'Hybrid Van',
      capacity: 14,
      assignedRoute: 'Malabe Tech Horizon (Corridor C)',
      driverName: 'Rohan Jayatilleke',
      batterySoc: '84%',
      healthStatus: 'Optimal',
      status: 'On Route',
    },
    {
      plateNo: 'CP-4521',
      model: 'Nissan Civilian Electric',
      type: 'Electric Shuttle',
      capacity: 22,
      assignedRoute: 'Moratuwa Coastal Line (Corridor B)',
      driverName: 'Chandana Silva',
      batterySoc: '78%',
      healthStatus: 'Optimal',
      status: 'On Route',
    },
    {
      plateNo: 'WP-9120',
      model: 'BYD K9 Pure Electric Coach',
      type: 'Electric Shuttle',
      capacity: 40,
      assignedRoute: 'Kaduwela Express (Corridor A)',
      driverName: 'Sunil Weeraratne',
      batterySoc: '96%',
      healthStatus: 'Optimal',
      status: 'Scheduled',
    },
    {
      plateNo: 'WP-3104',
      model: 'Toyota HiAce Standard',
      type: 'Diesel Low-Emission',
      capacity: 14,
      assignedRoute: 'Depot Standby (Backup)',
      driverName: 'Depot Fleet Reserve',
      batterySoc: 'N/A',
      healthStatus: 'Routine Inspection (200km to Service)',
      status: 'Depot Standby',
    },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-[#e0dedd] dark:border-[#272c29]">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-on-surface dark:text-white">
              Shuttle Fleet & Asset Telematics
            </h1>
            <span className="text-xs bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-full font-semibold">
              Telemetry Online
            </span>
          </div>
          <p className="text-sm text-on-surface-variant dark:text-[#a6b2a3] mt-1">
            Real-time vehicle battery state-of-charge, maintenance telemetry, and corridor route dispatch.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-surface-container-low dark:bg-[#1d211e] border border-[#e4e2e1] dark:border-[#2c332e] text-on-surface dark:text-white text-xs font-semibold rounded-xl hover:bg-surface-container-high dark:hover:bg-[#252b27] transition">
            <Download className="w-4 h-4" />
            <span>Download Fleet CSV</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-container text-on-primary text-xs font-semibold rounded-xl shadow-sm transition">
            <PlusCircle className="w-4 h-4" />
            <span>Add Vehicle</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-surface-container-lowest dark:bg-[#1d211e] border border-[#e4e2e1] dark:border-[#2c332e] p-6 rounded-2xl shadow-sm">
          <div className="flex justify-between items-start text-xs font-semibold uppercase text-on-surface-variant dark:text-[#a6b2a3]">
            <span>Active Shuttles</span>
            <Bus className="w-5 h-5 text-primary" />
          </div>
          <div className="mt-4 text-3xl font-bold text-on-surface dark:text-white">
            28 <span className="text-lg font-normal text-on-surface-variant dark:text-[#a6b2a3]">/ 32</span>
          </div>
          <div className="text-xs text-primary font-semibold mt-2">91% operational availability</div>
        </div>

        <div className="bg-surface-container-lowest dark:bg-[#1d211e] border border-[#e4e2e1] dark:border-[#2c332e] p-6 rounded-2xl shadow-sm">
          <div className="flex justify-between items-start text-xs font-semibold uppercase text-on-surface-variant dark:text-[#a6b2a3]">
            <span>Zero-Emission Ratio</span>
            <Zap className="w-5 h-5 text-secondary" />
          </div>
          <div className="mt-4 text-3xl font-bold text-secondary">68.8%</div>
          <div className="text-xs text-primary font-semibold mt-2">+4.2% MoM electric conversion</div>
        </div>

        <div className="bg-surface-container-lowest dark:bg-[#1d211e] border border-[#e4e2e1] dark:border-[#2c332e] p-6 rounded-2xl shadow-sm">
          <div className="flex justify-between items-start text-xs font-semibold uppercase text-on-surface-variant dark:text-[#a6b2a3]">
            <span>Avg Battery Health / SoC</span>
            <BatteryCharging className="w-5 h-5 text-primary" />
          </div>
          <div className="mt-4 text-3xl font-bold text-on-surface dark:text-white">84.5%</div>
          <div className="text-xs text-primary font-semibold mt-2">Optimal operating temperature</div>
        </div>

        <div className="bg-surface-container-lowest dark:bg-[#1d211e] border border-[#e4e2e1] dark:border-[#2c332e] p-6 rounded-2xl shadow-sm">
          <div className="flex justify-between items-start text-xs font-semibold uppercase text-on-surface-variant dark:text-[#a6b2a3]">
            <span>Maintenance Inspection</span>
            <AlertTriangle className="w-5 h-5 text-amber-500" />
          </div>
          <div className="mt-4 text-3xl font-bold text-on-surface dark:text-white">01 Flagged</div>
          <div className="text-xs text-on-surface-variant dark:text-[#a6b2a3] mt-2">Routine inspection due</div>
        </div>
      </div>

      {/* Fleet Inventory Table */}
      <div className="bg-surface-container-lowest dark:bg-[#1d211e] border border-[#e4e2e1] dark:border-[#2c332e] rounded-2xl p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#e0dedd] dark:border-[#272c29] text-xs uppercase font-semibold text-on-surface-variant dark:text-[#a6b2a3]">
                <th className="py-3 px-4">Vehicle Identifier</th>
                <th className="py-3 px-4">Model & Powertrain</th>
                <th className="py-3 px-4">Capacity</th>
                <th className="py-3 px-4">Assigned Route</th>
                <th className="py-3 px-4">Driver</th>
                <th className="py-3 px-4">Battery SoC</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e0dedd] dark:divide-[#272c29]">
              {fleet.map((v) => (
                <tr key={v.plateNo} className="hover:bg-surface-container-low dark:hover:bg-[#252b27] transition">
                  <td className="py-3.5 px-4 font-mono font-bold text-primary">{v.plateNo}</td>
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-on-surface dark:text-white">{v.model}</div>
                    <div className="text-xs text-on-surface-variant dark:text-[#a6b2a3]">{v.type}</div>
                  </td>
                  <td className="py-3.5 px-4 font-medium text-on-surface dark:text-white">{v.capacity} Seats</td>
                  <td className="py-3.5 px-4 text-xs text-on-surface dark:text-white font-medium">{v.assignedRoute}</td>
                  <td className="py-3.5 px-4 text-xs text-on-surface-variant dark:text-[#a6b2a3]">{v.driverName}</td>
                  <td className="py-3.5 px-4 font-bold text-primary">{v.batterySoc}</td>
                  <td className="py-3.5 px-4">
                    <span className="text-xs bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 rounded-md font-semibold">
                      {v.status}
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
