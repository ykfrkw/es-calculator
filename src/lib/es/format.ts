/**
 * One number formatter for the whole tool. Result cards, substituted
 * formulas and the derived strip all print through it, so a value never
 * appears with two different roundings on the same screen.
 */

/** Significant digits shown by default. */
const DEFAULT_SIGNIFICANT = 5

/** Outside this band fixed notation stops being readable. */
const EXPONENTIAL_ABOVE = 1000
const EXPONENTIAL_BELOW = 0.001

/** Printed instead of a number when there is nothing to print. */
export const EMPTY_MARK = '—'

export interface FormatOptions {
  significant?: number
  /** String to print for undefined / NaN / non-finite input. */
  empty?: string
}

export function fmtNumber(
  value: number | undefined,
  options: FormatOptions = {},
): string {
  const { significant = DEFAULT_SIGNIFICANT, empty = EMPTY_MARK } = options
  if (value === undefined || !Number.isFinite(value)) return empty

  const magnitude = Math.abs(value)
  if (magnitude === 0) return '0'
  if (magnitude >= EXPONENTIAL_ABOVE || magnitude < EXPONENTIAL_BELOW) {
    return value.toExponential(3)
  }
  return trimTrailingZeros(value.toPrecision(significant))
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
  return `${fmtNumber(value * 100, { significant: 4, ...options })}%`
}

/**
 * Strip the padding zeros toPrecision adds, but only when there is a decimal
 * point — "17500" must not become "175".
 */
function trimTrailingZeros(text: string): string {
  if (!text.includes('.')) return text
  return text.replace(/0+$/, '').replace(/\.$/, '')
}
