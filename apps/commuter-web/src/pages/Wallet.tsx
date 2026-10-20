import React, { useState, useEffect } from 'react';
import { walletApi } from '../api/client';
import { WalletBalance, Transaction } from '../types';

export const Wallet: React.FC = () => {
  const [balance, setBalance] = useState<WalletBalance>({
    balanceLkr: 428.50,
    balanceMinor: 42850,
    currency: 'LKR',
    co2SavedKg: 12.4,
    corporateCardLast4: '8882',
  });

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showAddFundsModal, setShowAddFundsModal] = useState(false);
  const [addAmount, setAddAmount] = useState(1000);
  const [addingFunds, setAddingFunds] = useState(false);

  // Carbon & Fair Split Calculator State (Module 3 real calculation)
  const [calcDistance, setCalcDistance] = useState(18);
  const [calcFuelType, setCalcFuelType] = useState('ELECTRIC');
  const [calcPassengers, setCalcPassengers] = useState(3);
  const [carbonResult, setCarbonResult] = useState<{
    co2AvoidedKg: number;
    fuelCostLkr: number;
  }>({
    co2AvoidedKg: 2.85,
    fuelCostLkr: 513.0,
  });

  useEffect(() => {
    walletApi.getBalance().then(setBalance);
    walletApi.getTransactions().then(setTransactions);
  }, []);

  useEffect(() => {
    walletApi
      .calculateCarbon({
        distanceKm: calcDistance,
        fuelType: calcFuelType,
        passengers: calcPassengers,
      })
      .then((res) => {
        setCarbonResult({
          co2AvoidedKg: res.data?.co2AvoidedKg || 2.85,
          fuelCostLkr: res.data?.fuelCostLkr || 513.0,
        });
      });
  }, [calcDistance, calcFuelType, calcPassengers]);

  const handleAddFunds = () => {
    setAddingFunds(true);
    setTimeout(() => {
      setBalance((prev) => ({
        ...prev,
        balanceLkr: prev.balanceLkr + addAmount,
      }));
      setTransactions((prev) => [
        {
          id: Date.now(),
          type: 'credit',
          amount: addAmount,
          description: 'Top-up via Corporate Card ••8882',
          timestamp: 'Just now',
        },
        ...prev,
      ]);
      setAddingFunds(false);
      setShowAddFundsModal(false);
    }, 800);
  };

  return (
    <div className="flex flex-col w-full max-w-md mx-auto px-4 pb-24 font-sans">
      {/* 1. Available Balance Card */}
      <section className="py-2">
        <div className="relative overflow-hidden bg-primary p-6 rounded-3xl shadow-xl flex flex-col gap-3 text-on-primary border border-primary-container">
          <div className="absolute top-0 right-0 opacity-10 translate-x-1/4 -translate-y-1/4 pointer-events-none">
            <span className="material-symbols-outlined text-[140px]">eco</span>
          </div>

          <div className="flex justify-between items-start relative z-10">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-primary-fixed/80 uppercase tracking-widest">
                Available Commute Balance
              </span>
              <h1 className="text-3xl font-extrabold text-on-primary mt-1 tracking-tight">
                LKR {balance.balanceLkr.toFixed(2)}
              </h1>
            </div>
            <div className="bg-primary-container p-2.5 rounded-full shadow-inner">
              <span className="material-symbols-outlined text-on-primary-container text-[26px]">
                account_balance_wallet
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 relative z-10 mt-1 pt-2 border-t border-primary-container/40">
            <div className="w-6 h-6 rounded-full bg-secondary text-white text-[9px] font-bold flex items-center justify-center">
              VISA
            </div>
            <span className="text-xs text-primary-fixed/90 font-medium">
              Linked to Corporate Pass Card ending in ••{balance.corporateCardLast4}
            </span>
          </div>
        </div>
      </section>

      {/* 2. Primary Actions: Add Funds & Redeem */}
      <section className="grid grid-cols-2 gap-3 my-2">
        <button
          onClick={() => setShowAddFundsModal(true)}
          className="flex flex-col items-center justify-center gap-2 bg-secondary-container p-4 rounded-2xl transition-transform active:scale-95 shadow-sm group cursor-pointer"
        >
          <div className="w-11 h-11 rounded-full bg-on-secondary-container text-secondary-container flex items-center justify-center group-hover:rotate-12 transition-transform">
            <span className="material-symbols-outlined text-[24px]">add_circle</span>
          </div>
          <span className="text-xs font-bold text-on-secondary-container">Add Funds</span>
        </button>

        <button
          onClick={() => alert('Eco Rewards Tier: Silver\nEarn 25 points per EV shuttle commute.')}
          className="flex flex-col items-center justify-center gap-2 bg-primary-fixed p-4 rounded-2xl transition-transform active:scale-95 shadow-sm group cursor-pointer"
        >
          <div className="w-11 h-11 rounded-full bg-primary text-primary-fixed flex items-center justify-center group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined text-[24px]">redeem</span>
          </div>
          <span className="text-xs font-bold text-on-primary-fixed">Redeem Rewards</span>
        </button>
      </section>

      {/* 3. DEFRA 2024 Carbon & Fair Split Calculator */}
      <section className="my-2 bg-surface-container-low p-4 rounded-2xl shadow-sm border border-outline-variant/30 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">calculate</span>
            <h2 className="text-xs font-bold text-on-surface uppercase tracking-wider">
              DEFRA Carbon & Fair-Split Engine
            </h2>
          </div>
          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
            DEFRA 2024
          </span>
        </div>

        {/* Sliders and inputs */}
        <div className="space-y-3 pt-1">
          <div>
            <div className="flex justify-between text-xs font-semibold text-on-surface mb-1">
              <span>Commute Distance</span>
              <span className="text-primary font-bold">{calcDistance} km</span>
            </div>
            <input
              type="range"
              min="2"
              max="60"
              value={calcDistance}
              onChange={(e) => setCalcDistance(parseInt(e.target.value, 10))}
              className="w-full accent-primary cursor-pointer"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-outline block mb-1">Powertrain</label>
              <select
                value={calcFuelType}
                onChange={(e) => setCalcFuelType(e.target.value)}
                className="w-full bg-surface-container text-xs p-2 rounded-xl outline-none border border-outline-variant/40"
              >
                <option value="ELECTRIC">Electric EV (Zero)</option>
                <option value="HYBRID">Hybrid Petrol</option>
                <option value="AUTO_DIESEL">Diesel Shuttle</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-semibold text-outline block mb-1">Riders</label>
              <select
                value={calcPassengers}
                onChange={(e) => setCalcPassengers(parseInt(e.target.value, 10))}
                className="w-full bg-surface-container text-xs p-2 rounded-xl outline-none border border-outline-variant/40"
              >
                <option value="1">1 Passenger (Solo)</option>
                <option value="2">2 Passengers</option>
                <option value="3">3 Passengers (Optimal)</option>
                <option value="4">4 Passengers (Full)</option>
              </select>
            </div>
          </div>

          {/* Metric Outputs */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="bg-surface-container-lowest p-2.5 rounded-xl border border-primary/20 text-center">
              <span className="text-[10px] text-outline uppercase font-semibold">CO2 Avoided</span>
              <div className="text-base font-bold text-primary flex items-center justify-center gap-1">
                <span className="material-symbols-outlined text-[16px]">eco</span>
                <span>{carbonResult.co2AvoidedKg} kg</span>
              </div>
            </div>

            <div className="bg-surface-container-lowest p-2.5 rounded-xl border border-secondary/20 text-center">
              <span className="text-[10px] text-outline uppercase font-semibold">Rider Fair Share</span>
              <div className="text-base font-bold text-secondary">
                LKR {(carbonResult.fuelCostLkr / calcPassengers).toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Pending Claims & Activity History */}
      <section className="my-2 flex flex-col gap-2">
        <div className="flex justify-between items-center px-1">
          <h2 className="text-xs font-bold text-on-surface uppercase tracking-wider">
            Activity & Subsidies
          </h2>
          <span className="text-xs font-semibold text-primary cursor-pointer">DEFRA Verified</span>
        </div>

        <div className="flex flex-col gap-2">
          {transactions.map((tx) => (
            <div
              key={tx.id}
              className="w-full bg-surface-container-lowest rounded-2xl p-3 flex items-center justify-between border border-outline-variant/20 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    tx.type === 'credit'
                      ? 'bg-primary/10 text-primary'
                      : 'bg-secondary/10 text-secondary'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {tx.type === 'credit' ? 'arrow_downward' : 'local_gas_station'}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-on-surface">{tx.description}</span>
                  <span className="text-[10px] text-on-surface-variant">{tx.timestamp}</span>
                </div>
              </div>

              <div className="text-right">
                <span
                  className={`text-xs font-bold ${
                    tx.type === 'credit' ? 'text-primary' : 'text-on-surface'
                  }`}
                >
                  {tx.type === 'credit' ? '+' : '-'}LKR {tx.amount.toFixed(2)}
                </span>
                {tx.co2OffsetKg && (
                  <div className="text-[10px] text-primary font-semibold flex items-center justify-end gap-0.5">
                    <span className="material-symbols-outlined text-[12px]">eco</span>
                    <span>{tx.co2OffsetKg}kg saved</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Add Funds Modal */}
      {showAddFundsModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-sm bg-surface rounded-3xl p-5 shadow-2xl border border-outline-variant/30 flex flex-col gap-4 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-surface-container-high">
              <h3 className="text-base font-bold text-on-surface">Top-up Commute Balance</h3>
              <button
                onClick={() => setShowAddFundsModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-surface-container text-outline"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="flex gap-2">
              {[500, 1000, 2500].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setAddAmount(amt)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    addAmount === amt
                      ? 'bg-primary text-on-primary border-primary shadow-sm'
                      : 'bg-surface-container-low text-on-surface border-outline-variant/40'
                  }`}
                >
                  LKR {amt}
                </button>
              ))}
            </div>

            <div className="bg-surface-container-low p-3 rounded-2xl flex items-center gap-3">
              <span className="material-symbols-outlined text-primary">credit_card</span>
              <div className="flex-1">
                <div className="text-xs font-bold text-on-surface">Corporate Visa ••8882</div>
                <div className="text-[10px] text-outline">Employer Billing Account</div>
              </div>
              <span className="material-symbols-outlined text-primary text-[18px]">check_circle</span>
            </div>

            <button
              onClick={handleAddFunds}
              disabled={addingFunds}
              className="w-full py-3 bg-primary text-on-primary rounded-xl font-bold text-sm shadow-md hover:bg-primary-container active:scale-95 transition-all cursor-pointer"
            >
              {addingFunds ? 'Processing...' : `Confirm LKR ${addAmount}.00 Top-up`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
