/**
 * One number formatter for the whole tool. Result cards, substituted
 * formulas and the derived strip all print through it, so a value never
 * appears with two different roundings on the same screen.
 */

/** Decimal places shown by default. */
const DEFAULT_DECIMALS = 2

/**
 * Significant digits used when the requested decimals would print nothing but
 * zeros. A converted rate of 0.0032 is a real answer, and "0.00" would read
 * as a failure rather than as a small number.
 */
const SMALL_SIGNIFICANT = 2

/** Outside this band fixed notation stops being readable. */
const EXPONENTIAL_ABOVE = 1000
const EXPONENTIAL_BELOW = 0.001

/** Printed instead of a number when there is nothing to print. */
export const EMPTY_MARK = '—'

export interface FormatOptions {
  decimals?: number
  /** String to print for undefined / NaN / non-finite input. */
  empty?: string
}

export function fmtNumber(
  value: number | undefined,
  options: FormatOptions = {},
): string {
  const { decimals = DEFAULT_DECIMALS, empty = EMPTY_MARK } = options
  if (value === undefined || !Number.isFinite(value)) return empty

  const magnitude = Math.abs(value)
  if (magnitude === 0) return '0'
  if (magnitude >= EXPONENTIAL_ABOVE || magnitude < EXPONENTIAL_BELOW) {
    return value.toExponential(3)
  }

  const fixed = value.toFixed(decimals)
  if (Number(fixed) === 0) {
    return trimTrailingZeros(value.toPrecision(SMALL_SIGNIFICANT))
  }
  return trimTrailingZeros(fixed)
}

/** Signed form, used where the sign carries meaning (SMD). */
export function fmtSigned(
  value: number | undefined,
  options: FormatOptions = {},
): string {
  const text = fmtNumber(value, options)
  if (text === (options.empty ?? EMPTY_MARK)) return text
  return value !== undefined && value > 0 ? `+${text}` : text
}

/** A rate as a percentage, for the "also equals" line under a rate. */
export function fmtPercent(
  value: number | undefined,
  options: FormatOptions = {},
): string {
  if (value === undefined || !Number.isFinite(value)) {
    return options.empty ?? EMPTY_MARK
  }
  return `${fmtNumber(value * 100, options)}%`
}

/**
 * Strip the padding zeros toFixed and toPrecision add, but only when there is
 * a decimal point — "17500" must not become "175".
 */
function trimTrailingZeros(text: string): string {
  if (!text.includes('.')) return text
  return text.replace(/0+$/, '').replace(/\.$/, '')
}
