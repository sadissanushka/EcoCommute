/**
 * Module 5: Differential Privacy Engine
 * Implements the Laplace Mechanism with cryptographically secure random noise (CSPRNG),
 * global $L_1$ sensitivity bounding, and user contribution capping.
 * 
 * Mathematical Formulation:
 * For a numeric query f(D), the Laplace mechanism computes:
 *   M(D) = f(D) + Lap(Δ / ε)
 * where Δ is the L_1 sensitivity of f, and Lap(b) has density:
 *   p(x) = (1 / 2b) * exp(-|x| / b), with scale b = Δ / ε.
 * 
 * Properties:
 * - Variance: Var[Lap(b)] = 2 * b^2 = 2 * (Δ / ε)^2
 * - 95% Confidence Error Bound: b * ln(1 / 0.05) ≈ 2.9957 * (Δ / ε)
 */

import crypto from 'crypto';

export interface LaplaceNoiseProfile {
  epsilon: number;
  sensitivity: number;
  scale: number; // b = sensitivity / epsilon
  theoreticalVariance: number;
  standardDeviation: number;
  errorBound95Pct: number;
}

/**
 * Generates an open-interval uniform random float U in (0, 1) using OS CSPRNG entropy.
 */
export function generateSecureUniform(): number {
  // Read 6 bytes (48 bits) of cryptographic randomness
  const buf = crypto.randomBytes(6);
  const intVal = buf.readUIntBE(0, 6);
  const maxVal = 0xffffffffffff; // 2^48 - 1
  // Shift to ensure (0, 1) exclusive (avoid exact 0 or 1 for logarithm safety)
  return (intVal + 1) / (maxVal + 2);
}

/**
 * Samples a zero-mean Laplace random variate Lap(b) using the inverse cumulative distribution function.
 * X = -b * sgn(U - 0.5) * ln(1 - 2 * |U - 0.5|)
 */
export function sampleLaplaceNoise(scale: number): number {
  if (scale <= 0) {
    throw new RangeError(`Laplace scale parameter b must be strictly positive: ${scale}`);
  }

  const u = generateSecureUniform();
  const diff = u - 0.5;
  const sgn = diff < 0 ? -1 : 1;
  const magnitude = Math.abs(diff);

  // Guard against numerical underflow
  const inner = Math.max(1e-15, 1 - 2 * magnitude);
  const noise = -scale * sgn * Math.log(inner);

  return noise;
}

/**
 * Computes the theoretical noise and accuracy profile for a given query configuration.
 * Note: Does NOT reveal or touch true underlying data.
 */
export function computeNoiseProfile(epsilon: number, sensitivity = 1.0): LaplaceNoiseProfile {
  if (epsilon <= 0) {
    throw new RangeError(`Epsilon must be strictly positive: ${epsilon}`);
  }
  if (sensitivity <= 0) {
    throw new RangeError(`Sensitivity must be strictly positive: ${sensitivity}`);
  }

  const scale = sensitivity / epsilon;
  const theoreticalVariance = 2 * Math.pow(scale, 2);
  const standardDeviation = Math.sqrt(theoreticalVariance);
  const errorBound95Pct = scale * Math.log(1 / 0.05); // ~ 2.9957 * scale

  return {
    epsilon,
    sensitivity,
    scale: Number(scale.toFixed(4)),
    theoreticalVariance: Number(theoreticalVariance.toFixed(4)),
    standardDeviation: Number(standardDeviation.toFixed(4)),
    errorBound95Pct: Number(errorBound95Pct.toFixed(4)),
  };
}

/**
 * Applies the Laplace mechanism to a true count with post-processing (clamped >= 0 and integer rounded).
 * Sensitivity for counts with user contribution capping C: Δ = C (default C = 2 trips/day).
 */
export function privatizeCount(
  trueCount: number,
  epsilon: number,
  userCapC = 2
): { noisyCount: number; noiseAdded: number } {
  if (trueCount < 0) throw new RangeError('True count cannot be negative');

  const sensitivity = userCapC; // User-level DP: adding/removing one user changes count by at most C
  const scale = sensitivity / epsilon;
  const noise = sampleLaplaceNoise(scale);

  // Post-processing is free under DP
  const unrounded = trueCount + noise;
  const noisyCount = Math.max(0, Math.round(unrounded));

  return {
    noisyCount,
    noiseAdded: Number(noise.toFixed(4)),
  };
}

/**
 * Applies the Laplace mechanism to a continuous sum (e.g. total commute km, CO2 kg).
 * Value clamping to [0, maxClampB] ensures sensitivity is bounded: Δ = C * B.
 */
export function privatizeSum(
  trueSum: number,
  epsilon: number,
  maxClampB = 50.0, // e.g. max 50 km per commute leg
  userCapC = 2
): { noisySum: number; noiseAdded: number } {
  if (trueSum < 0) throw new RangeError('True sum cannot be negative');

  const sensitivity = userCapC * maxClampB;
  const scale = sensitivity / epsilon;
  const noise = sampleLaplaceNoise(scale);

  const noisySum = Math.max(0, Number((trueSum + noise).toFixed(2)));

  return {
    noisySum,
    noiseAdded: Number(noise.toFixed(4)),
  };
}
