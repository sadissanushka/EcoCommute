import {
  calculateFuelConsumption,
  calculateFuelCostMinor,
  calculateEmissionsFromLitres,
  calculateEmissionsFromDistance,
  calculateTripEmissions,
  calculateAvoidedEmissions,
  DEFRA_2024_FACTORS,
} from '../src/calculator/emissions';

describe('Step 1.3: Emission & Fuel-Cost Engine (DEFRA 2024 Verification)', () => {
  describe('calculateFuelConsumption', () => {
    it('computes litres consumed accurately', () => {
      // 120 km at 15 km/l = 8.0 L
      expect(calculateFuelConsumption(120, 15)).toBe(8.0);
      // 55.5 km at 12.2 km/l
      expect(calculateFuelConsumption(55.5, 12.2)).toBeCloseTo(4.54918, 4);
    });

    it('rejects negative distance and zero or negative kmPerLitre', () => {
      expect(() => calculateFuelConsumption(-10, 15)).toThrow(RangeError);
      expect(() => calculateFuelConsumption(100, 0)).toThrow(RangeError);
      expect(() => calculateFuelConsumption(100, -5)).toThrow(RangeError);
    });
  });

  describe('calculateFuelCostMinor', () => {
    it('calculates integer minor units (LKR cents) with exact rounding', () => {
      // 10 L at 332.00 LKR (33,200 cents/L) = 332,000 cents
      expect(calculateFuelCostMinor(10, 33200)).toBe(332000);
      // 4.54918 L at 30,700 cents/L = 139,659.8 -> 139660 cents
      expect(calculateFuelCostMinor(4.54918, 30700)).toBe(139660);
    });

    it('returns zero for 0 litres', () => {
      expect(calculateFuelCostMinor(0, 33200)).toBe(0);
    });
  });

  describe('calculateEmissionsFromLitres vs DEFRA Reference Data', () => {
    it('matches DEFRA 2024 reference factor for Petrol 92 (2.31495 kg CO₂e / L)', () => {
      // 10 L Petrol 92 = 23.1495 kg CO₂e
      const emitted = calculateEmissionsFromLitres(10, DEFRA_2024_FACTORS.PETROL_92.kg_co2e_per_litre);
      expect(emitted).toBe(23.1495);
    });

    it('matches DEFRA 2024 reference factor for Auto Diesel (2.68779 kg CO₂e / L)', () => {
      // 15 L Auto Diesel = 40.31685 -> 40.3169 kg CO₂e
      const emitted = calculateEmissionsFromLitres(15, DEFRA_2024_FACTORS.AUTO_DIESEL.kg_co2e_per_litre);
      expect(emitted).toBe(40.3169);
    });

    it('matches DEFRA 2024 reference factor for Hybrid (1.62410 kg CO₂e / L)', () => {
      // 20 L Hybrid = 32.4820 kg CO₂e
      const emitted = calculateEmissionsFromLitres(20, DEFRA_2024_FACTORS.HYBRID.kg_co2e_per_litre);
      expect(emitted).toBe(32.482);
    });
  });

  describe('calculateTripEmissions full pipeline', () => {
    it('performs end-to-end trip calculation for Petrol vehicle', () => {
      const result = calculateTripEmissions({
        distanceKm: 30,
        kmPerLitre: 12, // 2.5 litres
        fuelTypeCode: 'PETROL_92',
        priceMinorPerLitre: 33200, // 332 LKR/L
      });

      expect(result.litresConsumed).toBe(2.5);
      expect(result.fuelCostMinor).toBe(83000); // 830.00 LKR
      expect(result.fuelCostLkr).toBe(830.0);
      expect(result.co2EmittedKg).toBe(5.7874); // 2.5 * 2.31495 = 5.787375 -> 5.7874
      expect(result.emissionFactorUsed).toBe(2.31495);
    });

    it('performs calculation for Electric vehicle using per-km factor', () => {
      const result = calculateTripEmissions({
        distanceKm: 50,
        kmPerLitre: 6.5,
        fuelTypeCode: 'ELECTRIC',
        priceMinorPerLitre: 8000,
      });

      expect(result.litresConsumed).toBe(0);
      expect(result.emissionFactorUnit).toBe('kg_co2e_per_km');
      // 50 km * 0.0845 = 4.2250 kg CO₂e
      expect(result.co2EmittedKg).toBe(4.225);
    });

    it('throws validation error for invalid inputs', () => {
      expect(() =>
        calculateTripEmissions({
          distanceKm: -5,
          kmPerLitre: 10,
          fuelTypeCode: 'PETROL_92',
          priceMinorPerLitre: 33200,
        })
      ).toThrow();
    });
  });

  describe('calculateAvoidedEmissions', () => {
    it('computes positive avoided carbon when 3 passengers share one vehicle', () => {
      const result = calculateAvoidedEmissions({
        actualTrip: {
          distanceKm: 35,
          kmPerLitre: 10,
          fuelTypeCode: 'PETROL_92',
          passengerCount: 3,
        },
        driverSoloDistanceKm: 28,
        passengers: [
          { userId: 101, soloDistanceKm: 25 },
          { userId: 102, soloDistanceKm: 20 },
          { userId: 103, soloDistanceKm: 30 },
        ],
      });

      expect(result.actualEmissionsKg).toBeGreaterThan(0);
      expect(result.soloBaselineEmissionsKg).toBeGreaterThan(result.actualEmissionsKg);
      expect(result.co2AvoidedKg).toBeGreaterThan(0);
      expect(result.avoidedPercentage).toBeGreaterThan(0);
      expect(result.passengerSavings).toHaveLength(3);
    });

    it('ensures avoided CO₂ is never negative even if detour exceeds savings', () => {
      const result = calculateAvoidedEmissions({
        actualTrip: {
          distanceKm: 200,
          kmPerLitre: 5,
          fuelTypeCode: 'AUTO_DIESEL',
          passengerCount: 1,
        },
        driverSoloDistanceKm: 10,
        passengers: [{ userId: 201, soloDistanceKm: 5 }],
      });

      expect(result.co2AvoidedKg).toBe(0);
      expect(result.avoidedPercentage).toBe(0);
    });
  });
});
