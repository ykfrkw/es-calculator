import type { Quantity, Values } from './types'

/** Domains differ enough that the validator branches on this, not on the id. */
export type Domain = 'rate' | 'ratio' | 'difference'

export interface QuantityMeta {
  id: Quantity
  /** Abbreviation used in chips, recipe lines and tables. */
  short: string
  /** Sentence-case name used in field labels. */
  long: string
  /** Mathematical symbol used inside formulas. */
  symbol: string
  domain: Domain
  placeholder: string
  hint: string
}

/** Canonical display order: rates, then ratios, then the standardised scale. */
export const QUANTITY_ORDER: Quantity[] = ['cer', 'eer', 'rr', 'or', 'smd']

export const QUANTITIES: Record<Quantity, QuantityMeta> = {
  cer: {
    id: 'cer',
    short: 'CER',
    long: 'Control event rate',
    symbol: 'CER',
    domain: 'rate',
    placeholder: 'e.g. 0.20',
    hint: 'Events in the control arm ÷ participants in the control arm. Strictly between 0 and 1.',
  },
  eer: {
    id: 'eer',
    short: 'EER',
    long: 'Experimental event rate',
    symbol: 'EER',
    domain: 'rate',
    placeholder: 'e.g. 0.35',
    hint: 'Events in the experimental arm ÷ participants in the experimental arm. Strictly between 0 and 1.',
  },
  rr: {
    id: 'rr',
    short: 'RR',
    long: 'Risk ratio',
    symbol: 'RR',
    domain: 'ratio',
    placeholder: 'e.g. 1.75',
    hint: 'EER ÷ CER. Greater than 0; 1 means no difference.',
  },
  or: {
    id: 'or',
    short: 'OR',
    long: 'Odds ratio',
    symbol: 'OR',
    domain: 'ratio',
    placeholder: 'e.g. 2.15',
    hint: 'Odds of an event in the experimental arm ÷ odds in the control arm. Greater than 0; 1 means no difference.',
  },
  smd: {
    id: 'smd',
    short: 'SMD',
    long: 'Standardised mean difference',
    symbol: 'd',
    domain: 'difference',
    placeholder: 'e.g. 0.46',
    hint: 'Cohen-style d on the latent continuous scale. Any finite value; the sign follows the event direction.',
  },
}

/** Beyond this a standardised mean difference is almost always a data error. */
const IMPLAUSIBLE_SMD = 3

/** Rates above this, entered as a proportion, are almost certainly percents. */
const PERCENT_LOOKING_MAX = 100

export interface Validation {
  ok: boolean
  error?: string
  warnings: string[]
}

/**
 * Validate one quantity in isolation.
 *
 * A rate of 35 is never accepted silently: coercing it to 0.35 would turn a
 * unit-toggle mistake into a plausible-looking answer, so it is surfaced as
 * an error the reader has to resolve.
 */
export function validateQuantity(id: Quantity, value: number): Validation {
  const meta = QUANTITIES[id]
  const warnings: string[] = []

  if (typeof value !== 'number' || Number.isNaN(value)) {
    return { ok: false, error: `${meta.short} is not a number.`, warnings }
  }
  if (!Number.isFinite(value)) {
    return { ok: false, error: `${meta.short} must be finite.`, warnings }
  }

  if (meta.domain === 'rate') {
    if (value > 1 && value <= PERCENT_LOOKING_MAX) {
      return {
        ok: false,
        error: `${meta.short} = ${value} looks like a percentage. Switch "Rates entered as" to %, or enter ${value / 100} as a proportion.`,
        warnings,
      }
    }
    if (value <= 0 || value >= 1) {
      return {
        ok: false,
        error: `${meta.short} must be strictly between 0 and 1. A rate of exactly 0 or 1 has no finite odds, so no ratio can be formed from it.`,
        warnings,
      }
    }
  }

  if (meta.domain === 'ratio' && value <= 0) {
    return {
      ok: false,
      error: `${meta.short} must be greater than 0.`,
      warnings,
    }
  }

  if (meta.domain === 'difference' && Math.abs(value) > IMPLAUSIBLE_SMD) {
    warnings.push(
      `|d| = ${Math.abs(value)} is larger than any effect normally seen in clinical trials — check the scale and the sign convention.`,
    )
  }

  return { ok: true, warnings }
}

/** Sort a quantity list into the canonical display order. */
export function orderQuantities(ids: Quantity[]): Quantity[] {
  return QUANTITY_ORDER.filter((id) => ids.includes(id))
}

/** The quantities present in a value bag, in canonical order. */
export function presentQuantities(values: Values): Quantity[] {
  return QUANTITY_ORDER.filter((id) => values[id] !== undefined)
}

/** "CER, EER or RR" — used in blocked-route prose. */
export function listQuantities(ids: Quantity[], conjunction = 'or'): string {
  const shorts = orderQuantities(ids).map((id) => QUANTITIES[id].short)
  if (shorts.length === 0) return ''
  if (shorts.length === 1) return shorts[0]
  return `${shorts.slice(0, -1).join(', ')} ${conjunction} ${shorts[shorts.length - 1]}`
}
