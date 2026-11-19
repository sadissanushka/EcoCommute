'use client';

import React, { useState } from 'react';
import {
  ReceiptText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Download,
  Calendar,
  Search,
  Filter,
  Shield,
  MapPin,
  Users,
} from 'lucide-react';

export default function TripsManifestsPage() {
  const [selectedCorridor, setSelectedCorridor] = useState('ALL');

  const manifests = [
    {
      tripId: 'TRIP-4081',
      corridor: 'Kaduwela Express (Corridor A)',
      origin: 'Kaduwela Interchange Hub',
      destination: 'Colombo Fort CBD',
      vehiclePlate: 'NC-8821 (EV Shuttle)',
      driverName: 'Saman Kumara',
      departureTime: '07:30 AM',
      passengerCount: 28,
      capacity: 30,
      manifestStatus: 'In-Transit (Telemetry Verified)',
      otpVerifiedCount: '28 / 28 Boarded',
      deviationAlert: 'None (Within 50m)',
    },
    {
      tripId: 'TRIP-4082',
      corridor: 'Moratuwa Coastal Line (Corridor B)',
      origin: 'Moratuwa Station / UoM',
      destination: 'Slave Island Tech Hub',
      vehiclePlate: 'CP-4521 (Electric)',
      driverName: 'Chandana Silva',
      departureTime: '08:00 AM',
      passengerCount: 22,
      capacity: 22,
      manifestStatus: 'In-Transit',
      otpVerifiedCount: '22 / 22 Boarded',
      deviationAlert: 'None',
    },
    {
      tripId: 'TRIP-4083',
      corridor: 'Malabe Tech Horizon (Corridor C)',
      origin: 'Malabe IT Park Campus',
      destination: 'Colombo WTC Campus',
      vehiclePlate: 'WP-6490 (Hybrid)',
      driverName: 'Rohan Jayatilleke',
      departureTime: '08:15 AM',
      passengerCount: 14,
      capacity: 14,
      manifestStatus: 'In-Transit',
      otpVerifiedCount: '14 / 14 Boarded',
      deviationAlert: 'None',
    },
    {
      tripId: 'TRIP-4084',
      corridor: 'Kaduwela Express (Corridor A)',
      origin: 'Kaduwela Interchange Hub',
      destination: 'Colombo Fort CBD',
      vehiclePlate: 'WP-9120 (BYD Electric)',
      driverName: 'Sunil Weeraratne',
      departureTime: '09:00 AM',
      passengerCount: 38,
      capacity: 40,
      manifestStatus: 'Boarding Active',
      otpVerifiedCount: '31 / 38 Boarded',
      deviationAlert: 'None',
    },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-[#e0dedd] dark:border-[#272c29]">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-on-surface dark:text-white">
              Trips & Manifests Control
            </h1>
            <span className="text-xs bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-full font-semibold">
              Live Transit Dispatch
            </span>
          </div>
          <p className="text-sm text-on-surface-variant dark:text-[#a6b2a3] mt-1">
            Real-time passenger manifests, cryptographic OTP boarding verification, and Route Deviation Shield telematics.
          </p>
        </div>

        <button className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-container text-on-primary text-xs font-semibold rounded-xl shadow-sm transition">
          <Download className="w-4 h-4" />
          <span>Export Master Manifest</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-surface-container-lowest dark:bg-[#1d211e] border border-[#e4e2e1] dark:border-[#2c332e] p-6 rounded-2xl shadow-sm">
          <div className="flex justify-between items-start text-xs font-semibold uppercase text-on-surface-variant dark:text-[#a6b2a3]">
            <span>Scheduled Today</span>
            <ReceiptText className="w-5 h-5 text-primary" />
          </div>
          <div className="mt-4 text-3xl font-bold text-on-surface dark:text-white">48 Trips</div>
          <div className="text-xs text-on-surface-variant dark:text-[#a6b2a3] mt-2">Fleet run-rate: 100%</div>
        </div>

        <div className="bg-surface-container-lowest dark:bg-[#1d211e] border border-[#e4e2e1] dark:border-[#2c332e] p-6 rounded-2xl shadow-sm">
          <div className="flex justify-between items-start text-xs font-semibold uppercase text-on-surface-variant dark:text-[#a6b2a3]">
            <span>Active In-Transit</span>
            <Clock className="w-5 h-5 text-secondary" />
          </div>
          <div className="mt-4 text-3xl font-bold text-secondary">12 Trips</div>
          <div className="text-xs text-on-surface-variant dark:text-[#a6b2a3] mt-2">334 commuters en route</div>
        </div>

        <div className="bg-surface-container-lowest dark:bg-[#1d211e] border border-[#e4e2e1] dark:border-[#2c332e] p-6 rounded-2xl shadow-sm">
          <div className="flex justify-between items-start text-xs font-semibold uppercase text-on-surface-variant dark:text-[#a6b2a3]">
            <span>Completed Today</span>
            <CheckCircle2 className="w-5 h-5 text-primary" />
          </div>
          <div className="mt-4 text-3xl font-bold text-primary">32 Trips</div>
          <div className="text-xs text-primary font-semibold mt-2">99.2% on-time execution</div>
        </div>

        <div className="bg-surface-container-lowest dark:bg-[#1d211e] border border-[#e4e2e1] dark:border-[#2c332e] p-6 rounded-2xl shadow-sm">
          <div className="flex justify-between items-start text-xs font-semibold uppercase text-on-surface-variant dark:text-[#a6b2a3]">
            <span>Route Deviation Shield</span>
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div className="mt-4 text-3xl font-bold text-on-surface dark:text-white">0 Flags</div>
          <div className="text-xs text-primary font-semibold mt-2">All trips within 500m bounds</div>
        </div>
      </div>

      {/* Manifest Table */}
      <div className="bg-surface-container-lowest dark:bg-[#1d211e] border border-[#e4e2e1] dark:border-[#2c332e] rounded-2xl p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#e0dedd] dark:border-[#272c29] text-xs uppercase font-semibold text-on-surface-variant dark:text-[#a6b2a3]">
                <th className="py-3 px-4">Trip ID</th>
                <th className="py-3 px-4">Corridor & Path</th>
                <th className="py-3 px-4">Assigned Vehicle</th>
                <th className="py-3 px-4">Driver</th>
                <th className="py-3 px-4">Departure</th>
                <th className="py-3 px-4">OTP Boarding</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e0dedd] dark:divide-[#272c29]">
              {manifests.map((m) => (
                <tr key={m.tripId} className="hover:bg-surface-container-low dark:hover:bg-[#252b27] transition">
                  <td className="py-3.5 px-4 font-mono font-bold text-primary">{m.tripId}</td>
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-on-surface dark:text-white">{m.corridor}</div>
                    <div className="text-xs text-on-surface-variant dark:text-[#a6b2a3]">
                      {m.origin} → {m.destination}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs text-on-surface dark:text-white">{m.vehiclePlate}</td>
                  <td className="py-3.5 px-4 text-xs font-medium text-on-surface dark:text-white">{m.driverName}</td>
                  <td className="py-3.5 px-4 font-semibold text-on-surface dark:text-white">{m.departureTime}</td>
                  <td className="py-3.5 px-4">
                    <span className="text-xs font-mono font-semibold text-primary">{m.otpVerifiedCount}</span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="text-xs bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 rounded-md font-semibold">
                      {m.manifestStatus}
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
