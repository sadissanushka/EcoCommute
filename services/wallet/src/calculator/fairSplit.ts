/**
 * Module 3: Fair-Split Cost Sharing Engine
 * Implements detour-weighted marginal cost splitting and Shapley-value cooperative game comparisons.
 * 
 * Strict Unit Conventions:
 * - Costs: integer minor units (LKR cents)
 * - Distances: kilometers (float >= 0)
 * - Rounding: Largest-Remainder Method (Hamilton-Hare) guarantees exact integer balance with zero drift.
 */

import { z } from 'zod';

export interface PassengerDetourInput {
  userId: number | string;
  marginalDetourKm: number;    // cost(route with all) - cost(route without passenger i)
  directDistanceKm?: number;    // passenger's own direct trip distance
  maxWillingnessMinor?: number; // optional price cap in minor units
}

export const FairSplitInputSchema = z.object({
  totalTripCostMinor: z.number().int().nonnegative('Total trip cost must be non-negative integer'),
  driverSoloCostMinor: z.number().int().nonnegative('Driver solo cost must be non-negative integer'),
  passengers: z.array(
    z.object({
      userId: z.union([z.number(), z.string()]),
      marginalDetourKm: z.number().min(0, 'Marginal detour must be non-negative'),
      directDistanceKm: z.number().min(0).optional(),
      maxWillingnessMinor: z.number().int().positive().optional(),
    })
  ).min(0),
  epsilonFloorKm: z.number().positive().default(0.2), // 200m floor for zero-detour pickups
  companySubsidyPct: z.number().min(0).max(100).default(0), // 0 to 100%
  minimumFareMinor: z.number().int().nonnegative().default(0),
});

export type FairSplitInput = z.input<typeof FairSplitInputSchema>;

export interface PassengerSplitResult {
  userId: number | string;
  weight: number;
  rawShareMinor: number;
  finalShareMinor: number; // rounded integer minor units (LKR cents)
  subsidizedMinor: number; // paid by company if subsidy enabled
  netPassengerPayMinor: number;
  marginalDetourKm: number;
}

export interface FairSplitResult {
  totalTripCostMinor: number;
  driverSoloCostMinor: number;
  sharedExtraCostMinor: number; // amount distributed among passengers
  driverReimbursementMinor: number; // amount credited to driver wallet
  totalPassengerPaidMinor: number;
  companySubsidyPaidMinor: number;
  isExactBalance: boolean; // checks sum(finalShareMinor) === sharedExtraCostMinor
  passengers: PassengerSplitResult[];
}

/**
 * Largest-Remainder Method (Hamilton-Hare) for allocating integer minor units (cents)
 * while ensuring the sum of shares matches the exact total with 0 rounding drift.
 */
export function allocateLargestRemainder(
  targetTotalMinor: number,
  weights: number[]
): number[] {
  if (weights.length === 0) return [];
  if (targetTotalMinor <= 0) return weights.map(() => 0);

  const sumWeights = weights.reduce((acc, w) => acc + w, 0);
  if (sumWeights <= 0) {
    // If all weights are 0, distribute equally
    const equalShare = Math.floor(targetTotalMinor / weights.length);
    const remainder = targetTotalMinor - equalShare * weights.length;
    return weights.map((_, i) => equalShare + (i < remainder ? 1 : 0));
  }

  // 1. Compute exact floating-point quotas and integer floors
  const quotas = weights.map((w) => (w / sumWeights) * targetTotalMinor);
  const integerParts = quotas.map((q) => Math.floor(q));
  const remainders = quotas.map((q, idx) => ({
    index: idx,
    fraction: q - integerParts[idx],
  }));

  // 2. Count remaining minor units to distribute
  const currentSum = integerParts.reduce((acc, val) => acc + val, 0);
  let remainingToDistribute = targetTotalMinor - currentSum;

  // 3. Sort by largest fractional remainder descending
  remainders.sort((a, b) => b.fraction - a.fraction);

  // 4. Distribute 1 minor unit to the largest fractional remainders
  const result = [...integerParts];
  for (let i = 0; i < remainingToDistribute; i++) {
    result[remainders[i].index] += 1;
  }

  return result;
}

/**
 * Detour-Weighted Fair-Split Engine
 * Calculates fair cost share per passenger according to their marginal detour contribution.
 */
export function calculateFairSplit(input: FairSplitInput): FairSplitResult {
  const validated = FairSplitInputSchema.parse(input);
  const {
    totalTripCostMinor,
    driverSoloCostMinor,
    passengers,
    epsilonFloorKm,
    companySubsidyPct,
    minimumFareMinor,
  } = validated;

  // Driver absorbs their direct route; passengers only share the marginal extra cost
  const sharedExtraCostMinor = Math.max(0, totalTripCostMinor - driverSoloCostMinor);

  if (passengers.length === 0 || sharedExtraCostMinor === 0) {
    return {
      totalTripCostMinor,
      driverSoloCostMinor,
      sharedExtraCostMinor: 0,
      driverReimbursementMinor: 0,
      totalPassengerPaidMinor: 0,
      companySubsidyPaidMinor: 0,
      isExactBalance: true,
      passengers: [],
    };
  }

  // Edge case: exactly 1 passenger
  if (passengers.length === 1) {
    const p = passengers[0];
    const subsidyMinor = Math.round((sharedExtraCostMinor * companySubsidyPct) / 100);
    const netPay = Math.max(minimumFareMinor, sharedExtraCostMinor - subsidyMinor);

    return {
      totalTripCostMinor,
      driverSoloCostMinor,
      sharedExtraCostMinor,
      driverReimbursementMinor: sharedExtraCostMinor,
      totalPassengerPaidMinor: netPay,
      companySubsidyPaidMinor: subsidyMinor,
      isExactBalance: true,
      passengers: [
        {
          userId: p.userId,
          weight: Math.max(p.marginalDetourKm, epsilonFloorKm),
          rawShareMinor: sharedExtraCostMinor,
          finalShareMinor: sharedExtraCostMinor,
          subsidizedMinor: subsidyMinor,
          netPassengerPayMinor: netPay,
          marginalDetourKm: p.marginalDetourKm,
        },
      ],
    };
  }

  // Multi-passenger detour weighting: w_i = max(marginalDetourKm, epsilonFloorKm)
  const weights = passengers.map((p) => Math.max(p.marginalDetourKm, epsilonFloorKm));
  const sumWeights = weights.reduce((acc, w) => acc + w, 0);

  // Allocate exact minor units via Largest Remainder
  const allocatedShares = allocateLargestRemainder(sharedExtraCostMinor, weights);

  let totalPassengerPaidMinor = 0;
  let companySubsidyPaidMinor = 0;

  const passengerResults: PassengerSplitResult[] = passengers.map((p, index) => {
    const rawShare = (weights[index] / sumWeights) * sharedExtraCostMinor;
    let finalShare = allocatedShares[index];

    // Check minimum fare
    if (finalShare < minimumFareMinor && sharedExtraCostMinor >= minimumFareMinor * passengers.length) {
      finalShare = minimumFareMinor;
    }

    // Apply company subsidy
    const subsidizedMinor = Math.round((finalShare * companySubsidyPct) / 100);
    const netPassengerPay = finalShare - subsidizedMinor;

    totalPassengerPaidMinor += netPassengerPay;
    companySubsidyPaidMinor += subsidizedMinor;

    return {
      userId: p.userId,
      weight: weights[index],
      rawShareMinor: Number(rawShare.toFixed(2)),
      finalShareMinor: finalShare,
      subsidizedMinor,
      netPassengerPayMinor: netPassengerPay,
      marginalDetourKm: p.marginalDetourKm,
    };
  });

  const sumFinalShares = passengerResults.reduce((acc, p) => acc + p.finalShareMinor, 0);
  const isExactBalance = sumFinalShares === sharedExtraCostMinor;

  return {
    totalTripCostMinor,
    driverSoloCostMinor,
    sharedExtraCostMinor,
    driverReimbursementMinor: sharedExtraCostMinor,
    totalPassengerPaidMinor,
    companySubsidyPaidMinor,
    isExactBalance,
    passengers: passengerResults,
  };
}

/**
 * Shapley-Value Cost Allocation for Small Groups (n <= 5)
 * Formula: phi_i = sum_{S subseteq N \ {i}} [ |S|!(|N| - |S| - 1)! / |N|! ] * [ v(S union {i}) - v(S) ]
 * where v(S) is the characteristic routing cost function for coalition S.
 */
export function calculateShapleySplit(
  coalitionCostFn: (coalitionIndices: number[]) => number,
  numPlayers: number
): number[] {
  if (numPlayers <= 0) return [];
  if (numPlayers === 1) return [coalitionCostFn([0])];

  const factorial = (n: number): number => (n <= 1 ? 1 : n * factorial(n - 1));
  const n = numPlayers;
  const nFact = factorial(n);

  const players = Array.from({ length: n }, (_, i) => i);
  const shapleyValues = new Array(n).fill(0);

  // Generate all subsets of players
  const totalSubsets = 1 << n;

  for (let i = 0; i < n; i++) {
    let phi_i = 0;

    for (let mask = 0; mask < totalSubsets; mask++) {
      // Check if player i is NOT in subset S
      if ((mask & (1 << i)) === 0) {
        const S: number[] = [];
        for (let j = 0; j < n; j++) {
          if ((mask & (1 << j)) !== 0) {
            S.push(j);
          }
        }

        const sizeS = S.length;
        const weight = (factorial(sizeS) * factorial(n - sizeS - 1)) / nFact;

        const costS = S.length === 0 ? 0 : coalitionCostFn(S);
        const costSWithI = coalitionCostFn([...S, i]);

        const marginalContribution = costSWithI - costS;
        phi_i += weight * marginalContribution;
      }
    }

    shapleyValues[i] = Number(phi_i.toFixed(4));
  }

  return shapleyValues;
}
