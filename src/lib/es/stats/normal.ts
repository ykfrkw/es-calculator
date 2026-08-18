/**
 * Double-precision standard normal machinery.
 *
 * The probit conversion round-trips Φ and Φ⁻¹ against each other, so a
 * 1.5e-7 series (Abramowitz & Stegun 7.1.26) would cap the whole tool at
 * six digits. Hart's rational approximation, in the arrangement published by
 * West (2005) "Better approximations to cumulative normal functions",
 * holds ~1e-15 absolute across the range and costs the same two polynomials.
 */

/** Above this many SDs the upper tail underflows every double we care about. */
const TAIL_CUTOFF = 37

/** Hart's polynomial branch is valid to ~7.07; beyond it use the fraction. */
const HART_SPLIT = 7.07106781186547

/** √(2π), as used by Hart's continued-fraction tail. */
const SQRT_2PI = 2.506628274631

/**
 * Upper tail Φ(−z) for z ≥ 0, evaluated directly rather than as 1 − Φ(z):
 * the complement would lose every significant digit past z ≈ 8.
 */
function normalUpperTail(z: number): number {
  if (z > TAIL_CUTOFF) return 0
  const density = Math.exp(-0.5 * z * z)

  if (z < HART_SPLIT) {
    let numerator = 3.52624965998911e-2 * z + 0.700383064443688
    numerator = numerator * z + 6.37396220353165
    numerator = numerator * z + 33.912866078383
    numerator = numerator * z + 112.079291497871
    numerator = numerator * z + 221.213596169931
    numerator = numerator * z + 220.206867912376

    let denominator = 8.83883476483184e-2 * z + 1.75566716318264
    denominator = denominator * z + 16.064177579207
    denominator = denominator * z + 86.7807322029461
    denominator = denominator * z + 296.564248779674
    denominator = denominator * z + 637.333633378831
    denominator = denominator * z + 793.826512519948
    denominator = denominator * z + 440.413735824752

    return (density * numerator) / denominator
  }

  let fraction = z + 0.65
  fraction = z + 4 / fraction
  fraction = z + 3 / fraction
  fraction = z + 2 / fraction
  fraction = z + 1 / fraction
  return density / fraction / SQRT_2PI
}

/**
 * Complementary error function, erfc(x) = 1 − erf(x).
 *
 * Expressed through the normal tail because erfc(x) = 2·Φ(−x√2); the
 * reflection for negative x goes through 2 − erfc(|x|) so the small
 * branch is always the one actually computed.
 */
export function erfc(x: number): number {
  if (Number.isNaN(x)) return NaN
  const tail = 2 * normalUpperTail(Math.abs(x) * Math.SQRT2)
  return x >= 0 ? tail : 2 - tail
}

/** Error function, for callers that want the odd-symmetric form. */
export function erf(x: number): number {
  return 1 - erfc(x)
}

/** Standard normal cumulative distribution function, Φ(z). */
export function phi(z: number): number {
  if (Number.isNaN(z)) return NaN
  return 0.5 * erfc(-z / Math.SQRT2)
}

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
