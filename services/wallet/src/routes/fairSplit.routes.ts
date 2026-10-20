import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  calculateFairSplit,
  calculateShapleySplit,
  FairSplitInputSchema,
} from '../calculator/fairSplit';

export const fairSplitRouter = Router();

/**
 * POST /fair-split/calculate
 * Computes detour-weighted marginal cost shares with largest remainder rounding.
 */
fairSplitRouter.post('/calculate', (req: Request, res: Response) => {
  try {
    const input = FairSplitInputSchema.parse(req.body);
    const result = calculateFairSplit(input);
    res.json({ data: result });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid fair split input parameters',
          details: err.flatten(),
        },
      });
      return;
    }
    res.status(500).json({
      error: {
        code: 'SPLIT_CALCULATION_ERROR',
        message: err.message || 'Error occurred during fair split calculation',
        details: {},
      },
    });
  }
});

/**
 * POST /fair-split/shapley-compare
 * For evaluation and research comparisons: computes exact Shapley values for small groups (n <= 5).
 */
fairSplitRouter.post('/shapley-compare', (req: Request, res: Response) => {
  try {
    const schema = z.object({
      numPassengers: z.number().int().min(1).max(5),
      coalitionCosts: z.record(z.string(), z.number().nonnegative()),
    });

    const { numPassengers, coalitionCosts } = schema.parse(req.body);

    // Cost function evaluates coalition cost lookup
    const coalitionCostFn = (subset: number[]) => {
      const key = subset.slice().sort().join(',');
      return coalitionCosts[key] ?? 0;
    };

    const shapleyShares = calculateShapleySplit(coalitionCostFn, numPassengers);
    res.json({
      data: {
        numPassengers,
        shapleyShares,
      },
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid Shapley comparison input',
          details: err.flatten(),
        },
      });
      return;
    }
    res.status(500).json({
      error: {
        code: 'SHAPLEY_CALCULATION_ERROR',
        message: err.message || 'Error evaluating Shapley values',
        details: {},
      },
    });
  }
});
