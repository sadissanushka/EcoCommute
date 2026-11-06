'use client';

import React, { useState } from 'react';
import {
  Leaf,
  Trees,
  Zap,
  Award,
  Download,
  Calendar,
  FileCheck,
  TrendingDown,
  Building,
  CheckCircle2,
} from 'lucide-react';

export default function CarbonEsgPage() {
  const [selectedPeriod, setSelectedPeriod] = useState('2026-Q3');

  const esgBreakdown = [
    {
      scope: 'Category 7 (SOV Baseline)',
      description: 'Single Occupancy Vehicle Private Commute',
      emissionFactor: '0.1712 kg CO₂e / km',
      avoidedEmissions: '0 kg',
      netEmissions: '682,410 kg',
      status: 'Audited',
    },
    {
      scope: 'Category 7 (EV Shuttle)',
      description: 'Shared Electric Corporate Shuttles (42 routes)',
      emissionFactor: '0.0184 kg CO₂e / pass-km',
      avoidedEmissions: '298,400 kg',
      netEmissions: '24,190 kg',
      status: 'Verified DEFRA',
    },
    {
      scope: 'Category 7 (Carpool Sync)',
      description: 'Employee Multi-Hop Shared Carpool',
      emissionFactor: '0.0452 kg CO₂e / pass-km',
      avoidedEmissions: '130,200 kg',
      netEmissions: '31,520 kg',
      status: 'Verified DEFRA',
    },
  ];

  const handleExportCsv = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,Scope,Description,Emission Factor,Avoided Emissions,Net Emissions,Status\n' +
      esgBreakdown
        .map(
          (row) =>
            `"${row.scope}","${row.description}","${row.emissionFactor}","${row.avoidedEmissions}","${row.netEmissions}","${row.status}"`
        )
        .join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `GRI_305_Scope3_Report_${selectedPeriod}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-[#e0dedd] dark:border-[#272c29]">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-on-surface dark:text-white">
              Scope-3 Commute & ESG Performance
            </h1>
            <span className="text-xs bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-full font-semibold">
              ISO 14064-1 Compliant
            </span>
          </div>
          <p className="text-sm text-on-surface-variant dark:text-[#a6b2a3] mt-1">
            Certified Scope-3 Category 7 employee commuting GHG audit & GRI 305 emission abatement ledger.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-surface-container-low dark:bg-[#1d211e] border border-[#e4e2e1] dark:border-[#2c332e] rounded-xl px-3.5 py-2 text-xs text-on-surface-variant dark:text-[#a6b2a3]">
            <Calendar className="w-4 h-4 text-primary" />
            <span>Audit Period:</span>
            <strong className="text-on-surface dark:text-white">{selectedPeriod}</strong>
          </div>
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-container text-on-primary text-xs font-semibold rounded-xl shadow-sm transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Export GRI Report (CSV)</span>
          </button>
        </div>
      </div>

      {/* 4 Core ESG KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-surface-container-lowest dark:bg-[#1d211e] border border-[#e4e2e1] dark:border-[#2c332e] p-6 rounded-2xl shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant dark:text-[#a6b2a3]">
              Total Net CO₂ Abated
            </span>
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Leaf className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-bold text-primary tracking-tight">
              428.6 <span className="text-sm font-normal text-on-surface-variant dark:text-[#a6b2a3]">tCO₂e</span>
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-xs text-primary font-semibold">
              <TrendingDown className="w-4 h-4" />
              <span>-62.8% vs. solo driving</span>
            </div>
          </div>
        </div>

        <div className="bg-surface-container-lowest dark:bg-[#1d211e] border border-[#e4e2e1] dark:border-[#2c332e] p-6 rounded-2xl shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant dark:text-[#a6b2a3]">
              Equivalent Absorption
            </span>
            <div className="w-10 h-10 rounded-xl bg-[#e8f5e9] dark:bg-[#1a2e1d] text-primary flex items-center justify-center">
              <Trees className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-bold text-on-surface dark:text-white tracking-tight">
              19,480 <span className="text-sm font-normal text-on-surface-variant dark:text-[#a6b2a3]">trees</span>
            </div>
            <div className="text-xs text-on-surface-variant dark:text-[#a6b2a3] mt-2">
              Tropical mature forest equivalent/year
            </div>
          </div>
        </div>

        <div className="bg-surface-container-lowest dark:bg-[#1d211e] border border-[#e4e2e1] dark:border-[#2c332e] p-6 rounded-2xl shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant dark:text-[#a6b2a3]">
              Fleet Electrification
            </span>
            <div className="w-10 h-10 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center">
              <Zap className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-bold text-secondary tracking-tight">64.2%</div>
            <div className="text-xs text-on-surface-variant dark:text-[#a6b2a3] mt-2">
              +18.4% YoY electric transit transition
            </div>
          </div>
        </div>

        <div className="bg-primary text-on-primary p-6 rounded-2xl shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-white/80">
              Commute ESG Rating
            </span>
            <div className="w-10 h-10 rounded-xl bg-white/10 text-white flex items-center justify-center">
              <Award className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-bold text-white tracking-tight">AAA</div>
            <div className="flex justify-between items-center text-xs text-white/90 mt-2">
              <span>CSRD & EU Taxonomy Ready</span>
              <span className="font-bold">98.4 / 100</span>
            </div>
          </div>
        </div>
      </div>

      {/* Scope-3 Category 7 Deep Dive Table */}
      <div className="bg-surface-container-lowest dark:bg-[#1d211e] border border-[#e4e2e1] dark:border-[#2c332e] rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-[#e0dedd] dark:border-[#272c29] mb-4">
          <div>
            <h2 className="text-base font-bold text-on-surface dark:text-white">
              GRI 305-3 / DEFRA 2024 Scope-3 Ledger Verification
            </h2>
            <p className="text-xs text-on-surface-variant dark:text-[#a6b2a3] mt-0.5">
              Append-only audit trail verified against Dialog Axiata employee passenger records.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-primary font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            <span>Audit Trail Active</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#e0dedd] dark:border-[#272c29] text-xs uppercase font-semibold text-on-surface-variant dark:text-[#a6b2a3]">
                <th className="py-3 px-4">GHG Category</th>
                <th className="py-3 px-4">Commute Mode / Cohort</th>
                <th className="py-3 px-4">DEFRA Factor</th>
                <th className="py-3 px-4">Avoided CO₂</th>
                <th className="py-3 px-4">Net Footprint</th>
                <th className="py-3 px-4">Compliance Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e0dedd] dark:divide-[#272c29]">
              {esgBreakdown.map((row, idx) => (
                <tr key={idx} className="hover:bg-surface-container-low dark:hover:bg-[#252b27] transition">
                  <td className="py-3.5 px-4 font-semibold text-on-surface dark:text-white">{row.scope}</td>
                  <td className="py-3.5 px-4 text-on-surface-variant dark:text-[#a6b2a3]">{row.description}</td>
                  <td className="py-3.5 px-4 font-mono text-xs text-on-surface dark:text-white">{row.emissionFactor}</td>
                  <td className="py-3.5 px-4 font-semibold text-primary">{row.avoidedEmissions}</td>
                  <td className="py-3.5 px-4 font-mono text-on-surface dark:text-white">{row.netEmissions}</td>
                  <td className="py-3.5 px-4">
                    <span className="text-xs bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 rounded-md font-semibold">
                      {row.status}
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
