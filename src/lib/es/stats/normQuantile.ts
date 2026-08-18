/**
 * Inverse standard normal CDF (quantile function).
 *
 * The rational core is the Beasley–Springer–Moro / Acklam approximation
 * (error < ~1e-9 on (0, 1)); see Moro (1995) / Beasley & Springer (1977).
 * One Halley step against the double-precision Φ of ./normal then pulls the
 * result to machine precision, because the probit conversion composes Φ⁻¹
 * with Φ and a 1e-9 quantile leaves a 1e-10 round-trip residue — visible in
 * the fourth significant digit of a converted OR.
 */
import { phi } from './normal'

/** Halley's correction is a no-op at ±Infinity and at the exact centre. */
function refine(p: number, x: number): number {
  if (!Number.isFinite(x)) return x
  const residual = phi(x) - p
  if (residual === 0) return x
  const scaled = residual * Math.sqrt(2 * Math.PI) * Math.exp((x * x) / 2)
  return x - scaled / (1 + (x * scaled) / 2)
}

export function normQuantile(p: number): number {
  if (p <= 0 || p >= 1 || Number.isNaN(p)) {
    if (p === 0) return -Infinity
    if (p === 1) return Infinity
    return NaN
  }

  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.38357751867269e2, -3.066479806614716e1, 2.506628277459239,
  ]
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1,
  ]
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783,
  ]
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
    3.754408661907416,
  ]

  const pLow = 0.02425
  const pHigh = 1 - pLow

  let q: number, r: number
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p))
    return refine(
      p,
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1),
    )
  }
  if (p <= pHigh) {
    q = p - 0.5
    r = q * q
    return refine(
      p,
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) *
        q) /
        (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1),
    )
  }
  q = Math.sqrt(-2 * Math.log(1 - p))
  return refine(
    p,
    -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1),
  )
}
