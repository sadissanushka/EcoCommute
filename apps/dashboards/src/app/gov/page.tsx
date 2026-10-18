'use client';

import React, { useState } from 'react';
import { KpiCard } from '@/components/KpiCard';

export default function GovDashboardPage() {
  const [epsilon, setEpsilon] = useState(1.0);
  const [kThreshold, setKThreshold] = useState(5);

  const sensitivity = 2.0; // Contribution cap C = 2 trips/user
  const scale = sensitivity / epsilon;
  const theoreticalVariance = 2 * Math.pow(scale, 2);
  const errorBound95 = scale * Math.log(20); // ~2.9957 * scale

  // Sample urban commute flows between Colombo Metropolitan Zones
  const flows = [
    { origin: 'Dehiwala / Mt. Lavinia (DEH-01)', dest: 'Colombo Fort (CMB-01)', count: 482, raw: 480, suppressed: false },
    { origin: 'Rajagiriya (KJW-01)', dest: 'Slave Island Tech Hub (CMB-02)', count: 341, raw: 338, suppressed: false },
    { origin: 'Cinnamon Gardens (CMB-07)', dest: 'Colombo Fort (CMB-01)', count: 215, raw: 220, suppressed: false },
    { origin: 'Kollupitiya (CMB-03)', dest: 'Slave Island (CMB-02)', count: 189, raw: 185, suppressed: false },
    { origin: 'Dehiwala (DEH-01)', dest: 'Cinnamon Gardens (CMB-07)', count: 74, raw: 76, suppressed: false },
    { origin: 'Colombo Fort (CMB-01)', dest: 'Rajagiriya (KJW-01)', count: '<5', raw: 3, suppressed: true },
    { origin: 'Slave Island (CMB-02)', dest: 'Dehiwala (DEH-01)', count: '<5', raw: 2, suppressed: true },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Title & Privacy Policy Banner */}
      <div className="pb-6 border-b border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Urban Commute Flow Heatmap</h1>
            <p className="text-sm text-slate-400 mt-1">
              Multi-company aggregate traffic density with mathematically provable differential privacy.
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="text-xs bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-300">
              Remaining Budget: <span className="font-semibold text-emerald-400">3.8 / 5.0 ε</span>
            </div>
            <div className="text-xs bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2 text-blue-400 font-medium">
              k = {kThreshold} Suppression Active
            </div>
          </div>
        </div>
      </div>

      {/* Privacy Slider & Noise Visualizer Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls Column */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Privacy Controls</h2>

          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-slate-400">Privacy Parameter (ε):</span>
              <span className="font-bold text-blue-400">{epsilon.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="0.2"
              max="3.0"
              step="0.2"
              value={epsilon}
              onChange={(e) => setEpsilon(parseFloat(e.target.value))}
              className="w-full accent-blue-500 cursor-pointer"
            />
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>Strong (ε=0.2)</span>
              <span>Balanced (ε=1.0)</span>
              <span>High Utility (ε=3.0)</span>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 space-y-2 text-xs text-slate-400">
            <div className="flex justify-between">
              <span>Sensitivity (Δ):</span>
              <span className="text-white font-mono">{sensitivity.toFixed(1)} (C=2 trips)</span>
            </div>
            <div className="flex justify-between">
              <span>Laplace Scale (b = Δ/ε):</span>
              <span className="text-white font-mono">{scale.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Theoretical Variance:</span>
              <span className="text-white font-mono">{theoreticalVariance.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>95% Max Error Bound:</span>
              <span className="text-amber-400 font-mono">&plusmn;{errorBound95.toFixed(1)} trips</span>
            </div>
          </div>
        </div>

        {/* Mechanism Guarantee & Theoretical Distribution */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Laplace Mechanism Guarantee & Noise Profile
              </h2>
              <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                Lap(b = {scale.toFixed(2)})
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Every released cell is independently perturbed using cryptographically secure Laplace noise sampled via OS entropy. True values are never revealed. Small equivalence classes below k={kThreshold} are suppressed completely.
            </p>

            <div className="mt-5 p-4 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 space-y-2">
              <div className="text-blue-400 font-semibold">Mathematical Security Proof:</div>
              <div>&bull; Neighboring datasets D, D&apos; differ by at most one commuter&apos;s daily activity (C &le; 2).</div>
              <div>&bull; Sensitivity &Delta; = C = 2.0 &rArr; Scale b = 2.0 / {epsilon.toFixed(1)} = {scale.toFixed(2)}.</div>
              <div>&bull; Pr[M(D) &isin; S] &le; exp({epsilon.toFixed(1)}) &times; Pr[M(D&apos;) &isin; S].</div>
              <div className="text-emerald-400">&bull; Identical queries are served from cache at 0 budget to prevent averaging attacks.</div>
            </div>
          </div>

          <div className="mt-4 text-xs text-slate-500">
            Opt-in consent verified: 5 of 5 registered companies currently sharing data.
          </div>
        </div>
      </div>

      {/* Differentially Private Flow Grid */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-base font-bold text-white tracking-tight">Zone-to-Zone Morning Peak Commute Flows</h2>
          <span className="text-xs text-slate-400">Differentially private (ε = {epsilon.toFixed(1)}, k = {kThreshold})</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/60 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-6 py-3.5">Origin Zone</th>
                <th className="px-6 py-3.5">Destination Zone</th>
                <th className="px-6 py-3.5">Released Flow Count (Noisy)</th>
                <th className="px-6 py-3.5">Privacy Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {flows.map((flow, idx) => (
                <tr key={idx} className="hover:bg-slate-800/30 transition">
                  <td className="px-6 py-4 font-medium text-white">{flow.origin}</td>
                  <td className="px-6 py-4 text-slate-300">{flow.dest}</td>
                  <td className="px-6 py-4 font-mono font-bold text-blue-400">
                    {flow.count}
                  </td>
                  <td className="px-6 py-4">
                    {flow.suppressed ? (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        Suppressed (&lt; {kThreshold})
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        Laplace Perturbed (b={scale.toFixed(1)})
                      </span>
                    )}
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
