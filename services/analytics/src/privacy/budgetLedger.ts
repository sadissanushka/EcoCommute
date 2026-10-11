/**
 * Module 5: Privacy Budget Ledger & Query Cache
 * Tracks cumulative epsilon expenditure under sequential composition and provides
 * idempotent caching to mitigate differential privacy reconstruction / averaging attacks.
 */

import crypto from 'crypto';
import { Pool } from 'pg';
import { pool } from '../db/pool';

export class BudgetExhaustedError extends Error {
  constructor(public principalId: string, public remainingBudget: number, public requestedEpsilon: number) {
    super(`Privacy budget exhausted for principal '${principalId}'. Remaining: ${remainingBudget}, Requested: ${requestedEpsilon}`);
    this.name = 'BudgetExhaustedError';
  }
}

export interface BudgetStatus {
  principalId: string;
  dataset: string;
  totalBudget: number;
  totalSpent: number;
  remainingBudget: number;
  queryCount: number;
}

export class PrivacyBudgetService {
  constructor(
    private readonly dbPool: Pool = pool,
    private readonly defaultTotalBudget = 5.0 // total epsilon per principal
  ) {}

  /**
   * Generates a deterministic SHA-256 hash for query deduplication.
   */
  hashQuery(dataset: string, params: Record<string, any>, epsilon: number): string {
    const serialized = JSON.stringify({ dataset, params, epsilon }, Object.keys(params).sort());
    return crypto.createHash('sha256').update(serialized).digest('hex');
  }

  /**
   * Retrieves current cumulative budget expenditure for a principal.
   */
  async getBudgetStatus(principalId: string, dataset = 'colombo_commute_flows'): Promise<BudgetStatus> {
    const res = await this.dbPool.query(
      `SELECT 
         COALESCE(SUM(epsilon_spent), 0)::REAL AS total_spent,
         COUNT(id)::INT AS query_count
       FROM analytics.privacy_budget_ledger
       WHERE principal_id = $1 AND dataset = $2`,
      [principalId, dataset]
    );

    const totalSpent = Number(res.rows[0]?.total_spent || 0);
    const queryCount = Number(res.rows[0]?.query_count || 0);
    const remainingBudget = Math.max(0, Number((this.defaultTotalBudget - totalSpent).toFixed(4)));

    return {
      principalId,
      dataset,
      totalBudget: this.defaultTotalBudget,
      totalSpent,
      remainingBudget,
      queryCount,
    };
  }

  /**
   * Checks for a cached result for an identical past query.
   * Cached results cost 0 epsilon to prevent the averaging attack.
   */
  async getCachedResult(queryHash: string): Promise<any | null> {
    const res = await this.dbPool.query(
      `SELECT cached_result 
       FROM analytics.privacy_budget_ledger 
       WHERE query_hash = $1 
       LIMIT 1`,
      [queryHash]
    );

    if (res.rows.length > 0 && res.rows[0].cached_result) {
      return res.rows[0].cached_result;
    }
    return null;
  }

  /**
   * Evaluates query budget, checks cache, deducts epsilon, and stores noisy output.
   */
  async executePrivatizedQuery<T>(
    principalId: string,
    dataset: string,
    queryParams: Record<string, any>,
    epsilon: number,
    generatorFn: () => Promise<T>
  ): Promise<{ data: T; isCached: boolean; budget: BudgetStatus }> {
    const queryHash = this.hashQuery(dataset, queryParams, epsilon);

    // 1. Check cache (prevents averaging attacks; 0 budget spent)
    const cached = await this.getCachedResult(queryHash);
    if (cached) {
      const budget = await this.getBudgetStatus(principalId, dataset);
      return { data: cached, isCached: true, budget };
    }

    // 2. Budget verification
    const currentStatus = await this.getBudgetStatus(principalId, dataset);
    if (currentStatus.remainingBudget < epsilon) {
      throw new BudgetExhaustedError(principalId, currentStatus.remainingBudget, epsilon);
    }

    // 3. Execute generator to produce noisy dataset
    const result = await generatorFn();

    // 4. Record expenditure and cache result
    await this.dbPool.query(
      `INSERT INTO analytics.privacy_budget_ledger (
         principal_id, dataset, epsilon_spent, query_hash, cached_result
       ) VALUES ($1, $2, $3, $4, $5)`,
      [principalId, dataset, epsilon, queryHash, JSON.stringify(result)]
    );

    const updatedBudget = await this.getBudgetStatus(principalId, dataset);
    return { data: result, isCached: false, budget: updatedBudget };
  }
}
