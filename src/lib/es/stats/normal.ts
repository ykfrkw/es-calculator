/**
 * Log-odds machinery. The exact rules move between rates and odds ratios
 * through these two functions rather than through the algebraically
 * equivalent quotients, which cancel badly at the tails.
 */

/**
 * Log odds. Split as log(p) − log1p(−p) so that neither tail is computed as
 * the log of a cancelled difference.
 */
export function logit(p: number): number {
  if (Number.isNaN(p)) return NaN
  if (p === 0) return -Infinity
  if (p === 1) return Infinity
  if (p < 0 || p > 1) return NaN
  return Math.log(p) - Math.log1p(-p)
}

/**
 * Inverse logit. The branch matters: exp(x) overflows for large positive x
 * and 1/(1+exp(−x)) loses the whole mantissa for large negative x, so each
 * tail uses the form whose exponential stays below 1.
 */
export function expit(x: number): number {
  if (Number.isNaN(x)) return NaN
  if (x >= 0) return 1 / (1 + Math.exp(-x))
  const odds = Math.exp(x)
  return odds / (1 + odds)
}
