'use client';

import React, { useState } from 'react';
import {
  Building,
  Save,
  CheckCircle2,
  Shield,
  Bell,
  Coins,
  MapPin,
  Lock,
} from 'lucide-react';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'general' | 'privacy' | 'fleet' | 'esg'>('general');
  const [isSaved, setIsSaved] = useState(false);

  // Form states
  const [orgName, setOrgName] = useState('Dialog Axiata PLC / RideSync Enterprise');
  const [hubName, setHubName] = useState('Colombo WTC Campus Hub');
  const [currency, setCurrency] = useState('LKR (Rs.)');
  const [epsilonBudget, setEpsilonBudget] = useState('5.0');
  const [kSuppressionThreshold, setKSuppressionThreshold] = useState('5');
  const [womenOnlyEnabled, setWomenOnlyEnabled] = useState(true);
  const [otpMandatory, setOtpMandatory] = useState(true);

  const handleSave = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-[#e0dedd] dark:border-[#272c29]">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-on-surface dark:text-white">
            Enterprise Settings
          </h1>
          <p className="text-sm text-on-surface-variant dark:text-[#a6b2a3] mt-1">
            Configure organization policies, differential privacy budgets, automated dispatch, and ESG accounting parameters.
          </p>
        </div>

        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-container text-on-primary font-semibold text-xs rounded-xl shadow-sm transition-all"
        >
          {isSaved ? <CheckCircle2 className="w-4 h-4 text-white" /> : <Save className="w-4 h-4" />}
          <span>{isSaved ? 'Changes Saved!' : 'Save Changes'}</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#e0dedd] dark:border-[#272c29] pb-3">
        <button
          onClick={() => setActiveTab('general')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
            activeTab === 'general'
              ? 'bg-primary text-on-primary'
              : 'text-on-surface-variant dark:text-[#a6b2a3] hover:bg-surface-container-low dark:hover:bg-[#1d211e]'
          }`}
        >
          General & Organization
        </button>
        <button
          onClick={() => setActiveTab('privacy')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
            activeTab === 'privacy'
              ? 'bg-primary text-on-primary'
              : 'text-on-surface-variant dark:text-[#a6b2a3] hover:bg-surface-container-low dark:hover:bg-[#1d211e]'
          }`}
        >
          Differential Privacy & Security
        </button>
        <button
          onClick={() => setActiveTab('fleet')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
            activeTab === 'fleet'
              ? 'bg-primary text-on-primary'
              : 'text-on-surface-variant dark:text-[#a6b2a3] hover:bg-surface-container-low dark:hover:bg-[#1d211e]'
          }`}
        >
          Fleet & Dispatch Policies
        </button>
      </div>

      {/* Settings Body */}
      {activeTab === 'general' && (
        <div className="bg-surface-container-lowest dark:bg-[#1d211e] border border-[#e4e2e1] dark:border-[#2c332e] rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-3">
            <Building className="w-6 h-6 text-primary" />
            <div>
              <h2 className="text-base font-bold text-on-surface dark:text-white">Organization Identity</h2>
              <p className="text-xs text-on-surface-variant dark:text-[#a6b2a3]">Legal entity profile and geographic anchor hub</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-xs font-semibold text-on-surface dark:text-white">Registered Corporate Entity</label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="px-3.5 py-2.5 bg-surface-container-low dark:bg-[#252b27] border border-[#e4e2e1] dark:border-[#2c332e] rounded-xl text-sm outline-none text-on-surface dark:text-white"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-on-surface dark:text-white">Headquarters Transit Hub</label>
              <input
                type="text"
                value={hubName}
                onChange={(e) => setHubName(e.target.value)}
                className="px-3.5 py-2.5 bg-surface-container-low dark:bg-[#252b27] border border-[#e4e2e1] dark:border-[#2c332e] rounded-xl text-sm outline-none text-on-surface dark:text-white"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-on-surface dark:text-white">Default Operating Currency</label>
              <input
                type="text"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="px-3.5 py-2.5 bg-surface-container-low dark:bg-[#252b27] border border-[#e4e2e1] dark:border-[#2c332e] rounded-xl text-sm outline-none text-on-surface dark:text-white"
              />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'privacy' && (
        <div className="bg-surface-container-lowest dark:bg-[#1d211e] border border-[#e4e2e1] dark:border-[#2c332e] rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-3">
            <Lock className="w-6 h-6 text-primary" />
            <div>
              <h2 className="text-base font-bold text-on-surface dark:text-white">Differential Privacy Engine Parameters</h2>
              <p className="text-xs text-on-surface-variant dark:text-[#a6b2a3]">Laplace mechanism sensitivity and suppression bounds</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-on-surface dark:text-white">Global Privacy Budget (ε)</label>
              <input
                type="number"
                step="0.5"
                value={epsilonBudget}
                onChange={(e) => setEpsilonBudget(e.target.value)}
                className="px-3.5 py-2.5 bg-surface-container-low dark:bg-[#252b27] border border-[#e4e2e1] dark:border-[#2c332e] rounded-xl text-sm outline-none text-on-surface dark:text-white"
              />
              <span className="text-[11px] text-on-surface-variant dark:text-[#a6b2a3]">Recommended: 5.0 ε per reporting cycle</span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-on-surface dark:text-white">k-Anonymity Suppression Threshold</label>
              <input
                type="number"
                value={kSuppressionThreshold}
                onChange={(e) => setKSuppressionThreshold(e.target.value)}
                className="px-3.5 py-2.5 bg-surface-container-low dark:bg-[#252b27] border border-[#e4e2e1] dark:border-[#2c332e] rounded-xl text-sm outline-none text-on-surface dark:text-white"
              />
              <span className="text-[11px] text-on-surface-variant dark:text-[#a6b2a3]">Routes with &lt; k commuters are suppressed</span>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'fleet' && (
        <div className="bg-surface-container-lowest dark:bg-[#1d211e] border border-[#e4e2e1] dark:border-[#2c332e] rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-primary" />
            <div>
              <h2 className="text-base font-bold text-on-surface dark:text-white">Safety & Dispatch Constraints</h2>
              <p className="text-xs text-on-surface-variant dark:text-[#a6b2a3]">Real-time boarding OTP and matching filters</p>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={womenOnlyEnabled}
                onChange={(e) => setWomenOnlyEnabled(e.target.checked)}
                className="w-4 h-4 accent-primary rounded cursor-pointer"
              />
              <span className="text-sm font-medium text-on-surface dark:text-white">
                Enable Women-Only Commute Match Filter (Contract C3)
              </span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={otpMandatory}
                onChange={(e) => setOtpMandatory(e.target.checked)}
                className="w-4 h-4 accent-primary rounded cursor-pointer"
              />
              <span className="text-sm font-medium text-on-surface dark:text-white">
                Require Cryptographic TOTP Verification Prior to Boarding
              </span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
