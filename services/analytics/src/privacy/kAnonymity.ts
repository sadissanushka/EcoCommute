/**
 * Module 5: k-Anonymity & Suppression Engine
 * Ensures that released aggregation cells contain at least k distinct records.
 * Cells with counts < k are suppressed (replaced with "<k" marker) to prevent re-identification.
 */

export interface AggregationCell {
  originZoneId: number | string;
  destZoneId: number | string;
  timeBucket: string;
  rawCount: number;
  [key: string]: any;
}

export interface KAnonymizedCell {
  originZoneId: number | string;
  destZoneId: number | string;
  timeBucket: string;
  isSuppressed: boolean;
  displayCount: string | number;
  noisyCount?: number;
  [key: string]: any;
}

export interface KAnonymityReport {
  kThreshold: number;
  totalCells: number;
  releasedCells: number;
  suppressedCells: number;
  utilityLossPct: number;
  cells: KAnonymizedCell[];
}

/**
 * Applies k-anonymity suppression to an array of aggregate cells.
 */
export function applyKAnonymity(
  cells: AggregationCell[],
  kThreshold = 5
): KAnonymityReport {
  if (kThreshold < 1) {
    throw new RangeError(`kThreshold must be at least 1: ${kThreshold}`);
  }

  let suppressedCount = 0;

  const processedCells: KAnonymizedCell[] = cells.map((cell) => {
    if (cell.rawCount < kThreshold) {
      suppressedCount++;
      return {
        ...cell,
        isSuppressed: true,
        displayCount: `<${kThreshold}`,
      };
    }

    return {
      ...cell,
      isSuppressed: false,
      displayCount: cell.rawCount,
    };
  });

  const totalCells = cells.length;
  const releasedCells = totalCells - suppressedCount;
  const utilityLossPct = totalCells > 0 ? Number(((suppressedCount / totalCells) * 100).toFixed(2)) : 0;

  return {
    kThreshold,
    totalCells,
    releasedCells,
    suppressedCells: suppressedCount,
    utilityLossPct,
    cells: processedCells,
  };
}
