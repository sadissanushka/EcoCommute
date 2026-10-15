import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool';
import { requireAuth, requireRole } from '../middleware/auth';

export const analyticsRouter = Router();

// Apply auth to all company analytics endpoints
analyticsRouter.use(requireAuth);
analyticsRouter.use(requireRole(['admin']));

/**
 * GET /analytics/summary
 * Returns high-level ESG and operational KPI cards for the caller's company.
 * Query reads exclusively from fast materialized views.
 */
analyticsRouter.get('/summary', async (req: Request, res: Response) => {
  try {
    const companyId = req.user!.companyId || 1;
    const fromDate = (req.query.from as string) || '2026-07-01';
    const toDate = (req.query.to as string) || '2026-09-30';

    // 1. Query Trips and Distance from mv_trips_by_department_day
    const tripsRes = await pool.query(
      `SELECT 
         COALESCE(SUM(total_trips), 0)::INT AS "totalTrips",
         COALESCE(SUM(total_riders), 0)::INT AS "totalRiders",
         COALESCE(SUM(total_distance_km), 0)::REAL AS "totalDistanceKm",
         COALESCE(SUM(total_co2_avoided_kg), 0)::REAL AS "totalCo2AvoidedKg"
       FROM analytics.mv_trips_by_department_day
       WHERE company_id = $1 AND day >= $2::DATE AND day <= $3::DATE`,
      [companyId, fromDate, toDate]
    );

    // 2. Query Occupancy from mv_occupancy_by_route_day
    const occRes = await pool.query(
      `SELECT 
         COALESCE(ROUND(AVG(avg_occupancy)::numeric, 2), 1.0)::REAL AS "avgOccupancy",
         COALESCE(ROUND(AVG(seat_utilisation_pct)::numeric, 1), 0.0)::REAL AS "seatUtilisationPct"
       FROM analytics.mv_occupancy_by_route_day
       WHERE company_id = $1 AND day >= $2::DATE AND day <= $3::DATE`,
      [companyId, fromDate, toDate]
    );

    // 3. Query Fuel Reimbursement from mv_fuel_reimbursed_month
    const fuelRes = await pool.query(
      `SELECT 
         COALESCE(SUM(total_fuel_reimbursed_minor), 0)::BIGINT AS "fuelReimbursedMinor",
         COALESCE(SUM(total_fuel_reimbursed_lkr), 0)::REAL AS "fuelReimbursedLkr"
       FROM analytics.mv_fuel_reimbursed_month
       WHERE company_id = $1`,
      [companyId]
    );

    const tripData = tripsRes.rows[0];
    const occData = occRes.rows[0];
    const fuelData = fuelRes.rows[0];

    // Tree-equivalent offset (1 mature tropical tree absorbs ~21.77 kg CO2 / year)
    const treeEquivalent = Number((tripData.totalCo2AvoidedKg / 21.77).toFixed(1));

    res.json({
      data: {
        companyId,
        period: { from: fromDate, to: toDate },
        kpis: {
          totalTrips: tripData.totalTrips,
          totalRiders: tripData.totalRiders,
          totalDistanceKm: tripData.totalDistanceKm,
          avgOccupancy: occData.avgOccupancy,
          seatUtilisationPct: occData.seatUtilisationPct,
          fuelReimbursedMinor: parseInt(fuelData.fuelReimbursedMinor, 10),
          fuelReimbursedLkr: fuelData.fuelReimbursedLkr,
          totalCo2AvoidedKg: tripData.totalCo2AvoidedKg,
          treeEquivalentSaved: treeEquivalent,
        },
      },
    });
  } catch (err: any) {
    res.status(500).json({
      error: { code: 'DATABASE_ERROR', message: err.message, details: {} },
    });
  }
});

/**
 * GET /analytics/by-department
 * Returns trips, riders, and carbon savings broken down by corporate department.
 */
analyticsRouter.get('/by-department', async (req: Request, res: Response) => {
  try {
    const companyId = req.user!.companyId || 1;
    const fromDate = (req.query.from as string) || '2026-07-01';
    const toDate = (req.query.to as string) || '2026-09-30';

    const resDb = await pool.query(
      `SELECT 
         department,
         SUM(total_trips)::INT AS "totalTrips",
         SUM(total_riders)::INT AS "totalRiders",
         ROUND(SUM(total_distance_km)::numeric, 2)::REAL AS "totalDistanceKm",
         ROUND(SUM(total_co2_avoided_kg)::numeric, 2)::REAL AS "totalCo2AvoidedKg"
       FROM analytics.mv_trips_by_department_day
       WHERE company_id = $1 AND day >= $2::DATE AND day <= $3::DATE
       GROUP BY department
       ORDER BY "totalTrips" DESC`,
      [companyId, fromDate, toDate]
    );

    res.json({
      data: {
        companyId,
        departments: resDb.rows,
      },
    });
  } catch (err: any) {
    res.status(500).json({
      error: { code: 'DATABASE_ERROR', message: err.message, details: {} },
    });
  }
});

/**
 * GET /analytics/timeseries
 * Returns daily or monthly trend metrics for charting.
 */
analyticsRouter.get('/timeseries', async (req: Request, res: Response) => {
  try {
    const companyId = req.user!.companyId || 1;
    const granularity = (req.query.granularity as string) || 'day';

    if (granularity === 'month') {
      const resDb = await pool.query(
        `SELECT 
           month_bucket AS "month",
           total_co2_kg AS "co2Kg",
           total_co2_avoided_kg AS "co2AvoidedKg",
           completed_trips AS "completedTrips"
         FROM analytics.mv_co2_by_company_month
         WHERE company_id = $1
         ORDER BY month_bucket ASC`,
        [companyId]
      );
      res.json({ data: { companyId, granularity, series: resDb.rows } });
      return;
    }

    // Daily timeseries
    const resDb = await pool.query(
      `SELECT 
         day,
         SUM(total_trips)::INT AS "trips",
         SUM(total_riders)::INT AS "riders",
         ROUND(SUM(total_distance_km)::numeric, 2)::REAL AS "distanceKm",
         ROUND(SUM(total_co2_avoided_kg)::numeric, 2)::REAL AS "co2AvoidedKg"
       FROM analytics.mv_trips_by_department_day
       WHERE company_id = $1
       GROUP BY day
       ORDER BY day ASC
       LIMIT 90`,
      [companyId]
    );

    res.json({ data: { companyId, granularity: 'day', series: resDb.rows } });
  } catch (err: any) {
    res.status(500).json({
      error: { code: 'DATABASE_ERROR', message: err.message, details: {} },
    });
  }
});

/**
 * GET /analytics/export
 * Exports analytical facts as CSV or JSON format.
 */
analyticsRouter.get('/export', async (req: Request, res: Response) => {
  try {
    const companyId = req.user!.companyId || 1;
    const format = (req.query.format as string) || 'json';

    const resDb = await pool.query(
      `SELECT 
         trip_id AS "tripId", department, kind, started_at AS "startedAt",
         distance_km AS "distanceKm", occupancy, seats_used AS "seatsUsed",
         (fuel_reimbursed_minor / 100.0)::REAL AS "fuelReimbursedLkr",
         co2_kg AS "co2Kg", co2_avoided_kg AS "co2AvoidedKg"
       FROM analytics.fact_trips
       WHERE company_id = $1
       ORDER BY started_at DESC
       LIMIT 1000`,
      [companyId]
    );

    if (format === 'csv') {
      const headers = ['tripId', 'department', 'kind', 'startedAt', 'distanceKm', 'occupancy', 'seatsUsed', 'fuelReimbursedLkr', 'co2Kg', 'co2AvoidedKg'];
      const rows = resDb.rows.map((r: any) => headers.map((h) => JSON.stringify(r[h] ?? '')).join(','));
      const csv = [headers.join(','), ...rows].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="company_${companyId}_esg_export.csv"`);
      res.send(csv);
      return;
    }

    res.json({ data: resDb.rows });
  } catch (err: any) {
    res.status(500).json({
      error: { code: 'EXPORT_ERROR', message: err.message, details: {} },
    });
  }
});
