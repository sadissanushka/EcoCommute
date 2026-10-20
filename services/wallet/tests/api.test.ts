import request from 'supertest';
import { app } from '../src/index';

describe('Wallet & Carbon Service HTTP Endpoints', () => {
  describe('GET /health', () => {
    it('returns healthy status and service info', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.module).toBe(3);
    });
  });

  describe('GET /carbon/factors', () => {
    it('returns active DEFRA 2024 emission factors', async () => {
      const res = await request(app).get('/carbon/factors');
      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThanOrEqual(4);

      const petrolFactor = res.body.data.find((f: any) => f.fuelCode === 'PETROL_92');
      expect(petrolFactor).toBeDefined();
      expect(petrolFactor.kg_co2e_per_litre).toBe(2.31495);
    });
  });

  describe('GET /carbon/prices', () => {
    it('returns Ceylon Petroleum Corporation benchmark prices', async () => {
      const res = await request(app).get('/carbon/prices');
      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);

      const petrolPrice = res.body.data.find((p: any) => p.fuelCode === 'PETROL_92');
      expect(petrolPrice).toBeDefined();
      expect(petrolPrice.priceMinorPerLitre).toBe(33200);
    });
  });

  describe('POST /carbon/calculate', () => {
    it('calculates trip fuel consumption, cost in cents, and CO2 kg', async () => {
      const res = await request(app)
        .post('/carbon/calculate')
        .send({
          distanceKm: 25.0,
          kmPerLitre: 12.5,
          fuelTypeCode: 'PETROL_92',
          priceMinorPerLitre: 33200,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.litresConsumed).toBe(2.0);
      expect(res.body.data.fuelCostMinor).toBe(66400); // 664.00 LKR
      expect(res.body.data.fuelCostLkr).toBe(664.0);
      expect(res.body.data.co2EmittedKg).toBe(4.6299); // 2 * 2.31495 = 4.6299
    });

    it('rejects invalid inputs with 400 validation error', async () => {
      const res = await request(app)
        .post('/carbon/calculate')
        .send({
          distanceKm: -10,
          kmPerLitre: 0,
          fuelTypeCode: 'UNKNOWN_FUEL',
          priceMinorPerLitre: -5,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /fair-split/calculate', () => {
    it('calculates detour-weighted cost shares with exact integer balance', async () => {
      const res = await request(app)
        .post('/fair-split/calculate')
        .send({
          totalTripCostMinor: 120000,
          driverSoloCostMinor: 80000,
          passengers: [
            { userId: 101, marginalDetourKm: 1.5 },
            { userId: 102, marginalDetourKm: 2.5 },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.sharedExtraCostMinor).toBe(40000);
      expect(res.body.data.isExactBalance).toBe(true);
      expect(res.body.data.passengers).toHaveLength(2);

      const sumShares = res.body.data.passengers.reduce(
        (sum: number, p: any) => sum + p.finalShareMinor,
        0
      );
      expect(sumShares).toBe(40000);
    });
  });
});
