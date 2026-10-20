import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool';
import { requireAuth, requireRole } from '../middleware/auth';
import { privatizeCount, computeNoiseProfile } from '../privacy/laplace';
import { applyKAnonymity } from '../privacy/kAnonymity';
import { PrivacyBudgetService, BudgetExhaustedError } from '../privacy/budgetLedger';

export const govRouter = Router();
const budgetService = new PrivacyBudgetService(pool);

govRouter.use(requireAuth);

/**
 * GET /gov/budget
 * Returns the current privacy budget status for the authenticated policymaker.
 */
govRouter.get('/budget', requireRole(['policymaker', 'admin']), async (req: Request, res: Response) => {
  try {
    const principalId = `user_${req.user!.userId}`;
    const status = await budgetService.getBudgetStatus(principalId);
    res.json({ data: status });
  } catch (err: any) {
    res.status(500).json({
      error: { code: 'BUDGET_LOOKUP_ERROR', message: err.message, details: {} },
    });
  }
});

/**
 * GET /gov/noise-profile
 * Parameter visualizer for differential privacy: returns theoretical scale, variance,
 * and 95% error margin for a chosen epsilon. Never touches true underlying data.
 */
govRouter.get('/noise-profile', requireRole(['policymaker', 'admin']), (req: Request, res: Response) => {
  try {
    const epsilon = parseFloat((req.query.epsilon as string) || '1.0');
    const sensitivity = parseFloat((req.query.sensitivity as string) || '2.0'); // default C=2 trips

    const profile = computeNoiseProfile(epsilon, sensitivity);
    res.json({ data: profile });
  } catch (err: any) {
    res.status(400).json({
      error: { code: 'INVALID_PARAMETER', message: err.message, details: {} },
    });
  }
});

/**
 * GET /gov/flows
 * Returns differentially private (ε-Laplace) and k-anonymized commute flows between city zones.
 * Queries mv_zone_flow_hour filtered strictly by companies with active consent.
 */
govRouter.get('/flows', requireRole(['policymaker', 'admin']), async (req: Request, res: Response) => {
  try {
    const principalId = `user_${req.user!.userId}`;
    const epsilon = Math.max(0.1, Math.min(5.0, parseFloat((req.query.epsilon as string) || '1.0')));
    const kThreshold = Math.max(2, parseInt((req.query.k as string) || '5', 10));

    const queryParams = {
      from: req.query.from || '2026-07-01',
      to: req.query.to || '2026-09-30',
      kThreshold,
    };

    // Execute with sequential composition budget check & idempotent caching
    const execution = await budgetService.executePrivatizedQuery(
      principalId,
      'colombo_commute_flows',
      queryParams,
      epsilon,
      async () => {
        // Query raw zone flows aggregated from consenting companies
        const resDb = await pool.query(`
          SELECT 
            zf.origin_zone_id AS "originZoneId",
            oz.name AS "originZoneName",
            zf.dest_zone_id AS "destZoneId",
            dz.name AS "destZoneName",
            SUM(zf.raw_trip_count)::INT AS "rawCount"
          FROM analytics.mv_zone_flow_hour zf
          JOIN analytics.zones oz ON oz.id = zf.origin_zone_id
          JOIN analytics.zones dz ON dz.id = zf.dest_zone_id
          GROUP BY zf.origin_zone_id, oz.name, zf.dest_zone_id, dz.name
          ORDER BY "rawCount" DESC
        `);

        // 1. Apply k-Anonymity suppression
        const cells = resDb.rows.map((r: any) => ({
          ...r,
          timeBucket: 'peak_commute',
        }));
        const kReport = applyKAnonymity(cells, kThreshold);

        // 2. Apply Laplace Differential Privacy noise to released cells
        const privatizedCells = kReport.cells.map((cell) => {
          if (cell.isSuppressed) {
            return cell;
          }
          const { noisyCount } = privatizeCount(cell.rawCount, epsilon, 2);
          return {
            originZoneId: cell.originZoneId,
            originZoneName: cell.originZoneName,
            destZoneId: cell.destZoneId,
            destZoneName: cell.destZoneName,
            isSuppressed: false,
            displayCount: noisyCount,
            noisyCount,
          };
        });

        return {
          differentialPrivacy: {
            epsilon,
            mechanism: 'Laplace (CSPRNG)',
            contributionCapC: 2,
            noiseProfile: computeNoiseProfile(epsilon, 2),
          },
          kAnonymity: {
            kThreshold,
            totalPairs: kReport.totalCells,
            releasedPairs: kReport.releasedCells,
            suppressedPairs: kReport.suppressedCells,
            utilityLossPct: kReport.utilityLossPct,
          },
          flows: privatizedCells,
        };
      }
    );

    res.json({
      data: execution.data,
      meta: {
        isCached: execution.isCached,
        budget: execution.budget,
      },
    });
  } catch (err: any) {
    if (err instanceof BudgetExhaustedError) {
      res.status(429).json({
        error: {
          code: 'PRIVACY_BUDGET_EXHAUSTED',
          message: err.message,
          details: { remainingBudget: err.remainingBudget, requestedEpsilon: err.requestedEpsilon },
        },
      });
      return;
    }

    res.status(500).json({
      error: { code: 'GOV_FLOWS_ERROR', message: err.message, details: {} },
    });
  }
});
