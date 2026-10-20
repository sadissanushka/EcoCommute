import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  calculateTripEmissions,
  calculateAvoidedEmissions,
  DEFRA_2024_FACTORS,
  TripEmissionInputSchema,
} from '../calculator/emissions';
import { pool } from '../db/pool';

export const carbonRouter = Router();

/**
 * GET /carbon/factors
 * Returns lookup table of active emission factors (DEFRA 2024 + Local).
 */
carbonRouter.get('/factors', async (_req: Request, res: Response) => {
  try {
    const dbFactors = await pool.query(`
      SELECT ef.id, ft.code AS "fuelCode", ft.name AS "fuelName",
             ef.kg_co2e_per_litre AS "kgCo2ePerLitre", ef.kg_co2e_per_km AS "kgCo2ePerKm",
             ef.source, ef.source_year AS "sourceYear", ef.region
      FROM wallet.emission_factors ef
      JOIN wallet.fuel_types ft ON ft.id = ef.fuel_type_id
      ORDER BY ef.region DESC, ft.code ASC
    `);

    if (dbFactors.rows.length > 0) {
      res.json({ data: dbFactors.rows });
      return;
    }

    // Fallback to in-memory DEFRA factors if DB table has not run migrations
    res.json({
      data: Object.entries(DEFRA_2024_FACTORS).map(([code, config]) => ({
        fuelCode: code,
        ...config,
      })),
    });
  } catch (err: any) {
    // If DB query fails, still return authoritative DEFRA factors
    res.json({
      data: Object.entries(DEFRA_2024_FACTORS).map(([code, config]) => ({
        fuelCode: code,
        ...config,
      })),
    });
  }
});

/**
 * GET /carbon/prices
 * Returns current fuel prices lookup (in LKR minor units / cents).
 */
carbonRouter.get('/prices', async (_req: Request, res: Response) => {
  try {
    const dbPrices = await pool.query(`
      SELECT DISTINCT ON (ft.code)
             ft.code AS "fuelCode", ft.name AS "fuelName",
             fp.price_minor_per_litre AS "priceMinorPerLitre",
             (fp.price_minor_per_litre / 100.0)::NUMERIC(10,2) AS "priceLkrPerLitre",
             fp.effective_from AS "effectiveFrom", fp.source
      FROM wallet.fuel_prices fp
      JOIN wallet.fuel_types ft ON ft.id = fp.fuel_type_id
      ORDER BY ft.code, fp.effective_from DESC
    `);

    if (dbPrices.rows.length > 0) {
      res.json({ data: dbPrices.rows });
      return;
    }

    // Default Ceylon Petroleum Corporation (CPC) benchmark prices
    res.json({
      data: [
        { fuelCode: 'PETROL_92', priceMinorPerLitre: 33200, priceLkrPerLitre: 332.0, source: 'CPC 2026' },
        { fuelCode: 'AUTO_DIESEL', priceMinorPerLitre: 30700, priceLkrPerLitre: 307.0, source: 'CPC 2026' },
        { fuelCode: 'HYBRID', priceMinorPerLitre: 33200, priceLkrPerLitre: 332.0, source: 'CPC 2026' },
        { fuelCode: 'ELECTRIC', priceMinorPerLitre: 8000, priceLkrPerLitre: 80.0, source: 'CEB Commercial Tier' },
      ],
    });
  } catch (err: any) {
    res.json({
      data: [
        { fuelCode: 'PETROL_92', priceMinorPerLitre: 33200, priceLkrPerLitre: 332.0, source: 'CPC 2026' },
        { fuelCode: 'AUTO_DIESEL', priceMinorPerLitre: 30700, priceLkrPerLitre: 307.0, source: 'CPC 2026' },
      ],
    });
  }
});

/**
 * POST /carbon/calculate
 * Computes fuel consumption, cost in LKR cents, and CO₂ kg for a trip.
 */
carbonRouter.post('/calculate', (req: Request, res: Response) => {
  try {
    const input = TripEmissionInputSchema.parse(req.body);
    const result = calculateTripEmissions(input);
    res.json({ data: result });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid emission calculation input parameters',
          details: err.flatten(),
        },
      });
      return;
    }
    res.status(500).json({
      error: {
        code: 'CALCULATION_ERROR',
        message: err.message || 'Error occurred during carbon calculation',
        details: {},
      },
    });
  }
});

/**
 * POST /carbon/avoided
 * Computes avoided CO₂ emissions by comparing shared trip to individual solo baseline.
 */
carbonRouter.post('/avoided', (req: Request, res: Response) => {
  try {
    const schema = z.object({
      actualTrip: z.object({
        distanceKm: z.number().min(0),
        kmPerLitre: z.number().positive(),
        fuelTypeCode: z.enum(['PETROL_92', 'AUTO_DIESEL', 'HYBRID', 'ELECTRIC']),
        passengerCount: z.number().int().min(0),
      }),
      driverSoloDistanceKm: z.number().min(0),
      passengers: z.array(
        z.object({
          userId: z.union([z.number(), z.string()]),
          soloDistanceKm: z.number().min(0),
          soloFuelTypeCode: z.enum(['PETROL_92', 'AUTO_DIESEL', 'HYBRID', 'ELECTRIC']).optional(),
          soloKmPerLitre: z.number().positive().optional(),
        })
      ),
    });

    const validated = schema.parse(req.body);
    const result = calculateAvoidedEmissions(validated);
    res.json({ data: result });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid avoided emissions parameters',
          details: err.flatten(),
        },
      });
      return;
    }
    res.status(500).json({
      error: {
        code: 'CALCULATION_ERROR',
        message: err.message || 'Error occurred calculating avoided emissions',
        details: {},
      },
    });
  }
});
