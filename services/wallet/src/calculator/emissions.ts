/**
 * Module 3: Emission & Carbon Accounting Engine
 * Pure calculation functions for fuel consumption, fuel cost, and CO₂ emissions.
 * 
 * Strict Unit Conventions:
 * - Distance: kilometers [km] (float >= 0)
 * - Fuel Efficiency: kilometers per litre [km/l] (float > 0)
 * - Fuel Volume: litres [L] (float >= 0)
 * - Fuel Price: integer minor units [LKR cents] (1 LKR = 100 cents, e.g., 332 LKR = 33,200 cents)
 * - Total Fuel Cost: integer minor units [LKR cents] (Math.round to integer)
 * - Emission Factor: kilograms CO₂ equivalent per litre [kg CO₂e / L] or per km [kg CO₂e / km]
 * - Carbon Emissions: kilograms CO₂ equivalent [kg CO₂e]
 */

import { z } from 'zod';

export const DEFRA_2024_FACTORS = {
  PETROL_92: {
    kg_co2e_per_litre: 2.31495,
    source: 'UK DEFRA GHG Conversion Factors 2024 (Petrol - 100% mineral)',
    year: 2024,
  },
  AUTO_DIESEL: {
    kg_co2e_per_litre: 2.68779,
    source: 'UK DEFRA GHG Conversion Factors 2024 (Diesel - 100% mineral)',
    year: 2024,
  },
  HYBRID: {
    kg_co2e_per_litre: 1.62410,
    source: 'UK DEFRA GHG Conversion Factors 2024 (Hybrid car average)',
    year: 2024,
  },
  ELECTRIC: {
    kg_co2e_per_km: 0.08450, // based on Sri Lanka CEB Grid Emission Factor ~0.56 kg CO₂/kWh & 0.15 kWh/km
    source: 'Sri Lanka Sustainable Energy Authority (CEB Grid Mix 2024)',
    year: 2024,
  },
} as const;

export type FuelTypeCode = keyof typeof DEFRA_2024_FACTORS;

export const TripEmissionInputSchema = z.object({
  distanceKm: z.number().min(0, 'Distance must be non-negative'),
  kmPerLitre: z.number().positive('Fuel efficiency (km/l) must be greater than zero'),
  fuelTypeCode: z.enum(['PETROL_92', 'AUTO_DIESEL', 'HYBRID', 'ELECTRIC']),
  priceMinorPerLitre: z.number().int().nonnegative('Fuel price in cents must be a non-negative integer'),
  customEmissionFactor: z.number().positive().optional(),
});

export type TripEmissionInput = z.infer<typeof TripEmissionInputSchema>;

export interface TripEmissionResult {
  distanceKm: number;
  kmPerLitre: number;
  fuelTypeCode: FuelTypeCode;
  litresConsumed: number;
  fuelCostMinor: number; // in LKR cents
  fuelCostLkr: number;   // formatted in major currency
  co2EmittedKg: number;
  emissionFactorUsed: number;
  emissionFactorUnit: 'kg_co2e_per_litre' | 'kg_co2e_per_km';
  factorSource: string;
}

/**
 * Calculates fuel consumed in litres.
 * litres = distance_km / km_per_litre
 */
export function calculateFuelConsumption(distanceKm: number, kmPerLitre: number): number {
  if (distanceKm < 0) throw new RangeError('Distance cannot be negative');
  if (kmPerLitre <= 0) throw new RangeError('kmPerLitre must be strictly positive');
  return Number((distanceKm / kmPerLitre).toFixed(6));
}

/**
 * Calculates total fuel cost in integer minor units (LKR cents).
 * fuelCost = round(litres * price_minor_per_litre)
 */
export function calculateFuelCostMinor(litres: number, priceMinorPerLitre: number): number {
  if (litres < 0) throw new RangeError('Litres consumed cannot be negative');
  if (priceMinorPerLitre < 0) throw new RangeError('Price per litre cannot be negative');
  return Math.round(litres * priceMinorPerLitre);
}

/**
 * Calculates total CO₂ emissions in kilograms.
 * co2_kg = litres * kg_co2e_per_litre
 */
export function calculateEmissionsFromLitres(litres: number, kgCo2ePerLitre: number): number {
  if (litres < 0) throw new RangeError('Litres consumed cannot be negative');
  if (kgCo2ePerLitre < 0) throw new RangeError('Emission factor cannot be negative');
  return Number((litres * kgCo2ePerLitre).toFixed(4));
}

/**
 * Calculates total CO₂ emissions for electric / per-km vehicle modes.
 * co2_kg = distance_km * kg_co2e_per_km
 */
export function calculateEmissionsFromDistance(distanceKm: number, kgCo2ePerKm: number): number {
  if (distanceKm < 0) throw new RangeError('Distance cannot be negative');
  if (kgCo2ePerKm < 0) throw new RangeError('Emission factor cannot be negative');
  return Number((distanceKm * kgCo2ePerKm).toFixed(4));
}

/**
 * Full end-to-end trip fuel-cost and CO₂ calculation pipeline with strict validation.
 */
export function calculateTripEmissions(input: TripEmissionInput): TripEmissionResult {
  const validated = TripEmissionInputSchema.parse(input);

  const { distanceKm, kmPerLitre, fuelTypeCode, priceMinorPerLitre, customEmissionFactor } = validated;

  if (fuelTypeCode === 'ELECTRIC') {
    const factor = customEmissionFactor ?? DEFRA_2024_FACTORS.ELECTRIC.kg_co2e_per_km;
    const co2EmittedKg = calculateEmissionsFromDistance(distanceKm, factor);
    // Electric cars: litres is 0, cost is calculated equivalent or zero for pure fuel
    const fuelCostMinor = Math.round(distanceKm * (priceMinorPerLitre / 100)); // normalized energy cost
    return {
      distanceKm,
      kmPerLitre,
      fuelTypeCode,
      litresConsumed: 0,
      fuelCostMinor,
      fuelCostLkr: Number((fuelCostMinor / 100).toFixed(2)),
      co2EmittedKg,
      emissionFactorUsed: factor,
      emissionFactorUnit: 'kg_co2e_per_km',
      factorSource: DEFRA_2024_FACTORS.ELECTRIC.source,
    };
  }

  const factorConfig = DEFRA_2024_FACTORS[fuelTypeCode];
  const factor = customEmissionFactor ?? factorConfig.kg_co2e_per_litre;
  const litresConsumed = calculateFuelConsumption(distanceKm, kmPerLitre);
  const fuelCostMinor = calculateFuelCostMinor(litresConsumed, priceMinorPerLitre);
  const co2EmittedKg = calculateEmissionsFromLitres(litresConsumed, factor);

  return {
    distanceKm,
    kmPerLitre,
    fuelTypeCode,
    litresConsumed,
    fuelCostMinor,
    fuelCostLkr: Number((fuelCostMinor / 100).toFixed(2)),
    co2EmittedKg,
    emissionFactorUsed: factor,
    emissionFactorUnit: 'kg_co2e_per_litre',
    factorSource: factorConfig.source,
  };
}

export interface AvoidedEmissionsInput {
  actualTrip: {
    distanceKm: number;
    kmPerLitre: number;
    fuelTypeCode: FuelTypeCode;
    passengerCount: number;
  };
  passengers: Array<{
    userId: number | string;
    soloDistanceKm: number;
    soloFuelTypeCode?: FuelTypeCode;
    soloKmPerLitre?: number;
  }>;
  driverSoloDistanceKm: number;
}

export interface AvoidedEmissionsResult {
  actualEmissionsKg: number;
  soloBaselineEmissionsKg: number;
  co2AvoidedKg: number;
  avoidedPercentage: number;
  passengerSavings: Array<{
    userId: number | string;
    soloDistanceKm: number;
    soloEmissionsKg: number;
  }>;
}

/**
 * Calculates CO₂ avoided by carpooling/shuttle vs solo baseline driving.
 * CO2_solo_baseline = driver_solo_CO2 + sum(passenger_solo_CO2)
 * CO2_actual = actual_trip_CO2
 * CO2_avoided = max(0, CO2_solo_baseline - CO2_actual)
 */
export function calculateAvoidedEmissions(input: AvoidedEmissionsInput): AvoidedEmissionsResult {
  const DEFAULT_SOLO_KM_PER_LITRE = 12.0; // average commuter car
  const DEFAULT_SOLO_FUEL: FuelTypeCode = 'PETROL_92';

  // 1. Calculate actual emissions
  const actualResult = calculateTripEmissions({
    distanceKm: input.actualTrip.distanceKm,
    kmPerLitre: input.actualTrip.kmPerLitre,
    fuelTypeCode: input.actualTrip.fuelTypeCode,
    priceMinorPerLitre: 0,
  });
  const actualEmissionsKg = actualResult.co2EmittedKg;

  // 2. Calculate driver solo baseline emissions
  const driverSolo = calculateTripEmissions({
    distanceKm: input.driverSoloDistanceKm,
    kmPerLitre: input.actualTrip.kmPerLitre,
    fuelTypeCode: input.actualTrip.fuelTypeCode,
    priceMinorPerLitre: 0,
  });

  // 3. Calculate each passenger's solo baseline emissions
  let totalSoloPassengerKg = 0;
  const passengerSavings = input.passengers.map((p) => {
    const fuelType = p.soloFuelTypeCode ?? DEFAULT_SOLO_FUEL;
    const kmPerLitre = p.soloKmPerLitre ?? DEFAULT_SOLO_KM_PER_LITRE;
    const soloRes = calculateTripEmissions({
      distanceKm: p.soloDistanceKm,
      kmPerLitre,
      fuelTypeCode: fuelType,
      priceMinorPerLitre: 0,
    });
    totalSoloPassengerKg += soloRes.co2EmittedKg;
    return {
      userId: p.userId,
      soloDistanceKm: p.soloDistanceKm,
      soloEmissionsKg: soloRes.co2EmittedKg,
    };
  });

  const soloBaselineEmissionsKg = Number((driverSolo.co2EmittedKg + totalSoloPassengerKg).toFixed(4));
  const rawAvoided = soloBaselineEmissionsKg - actualEmissionsKg;
  const co2AvoidedKg = Number(Math.max(0, rawAvoided).toFixed(4));
  const avoidedPercentage = soloBaselineEmissionsKg > 0
    ? Number(((co2AvoidedKg / soloBaselineEmissionsKg) * 100).toFixed(2))
    : 0;

  return {
    actualEmissionsKg,
    soloBaselineEmissionsKg,
    co2AvoidedKg,
    avoidedPercentage,
    passengerSavings,
  };
}
