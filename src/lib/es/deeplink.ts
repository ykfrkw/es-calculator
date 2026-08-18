import { QUANTITY_ORDER, orderQuantities } from './quantities'
import type { Quantity } from './types'

/** Raw field text, keyed by quantity — the UI holds strings, not numbers. */
export type ValueDraft = Partial<Record<Quantity, string>>

export interface DeeplinkState {
  from: Quantity[]
  to: Quantity
  values: ValueDraft
}

/** What an absent, empty or unparseable query string resolves to. */
export const DEFAULT_STATE: DeeplinkState = {
  from: ['cer', 'eer'],
  to: 'smd',
  values: {},
}

function isQuantity(candidate: string): candidate is Quantity {
  return (QUANTITY_ORDER as string[]).includes(candidate)
}

function readParams(search: string): URLSearchParams | undefined {
  try {
    return new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  } catch {
    // URLSearchParams is extremely permissive, but a caller could still hand
    // us something exotic; a bad link must never surface as an error.
    return undefined
  }
}

/**
 * Parse `?from=cer,or&to=eer` plus optional numeric prefills.
 *
 * Anything unrecognised is dropped and anything self-contradictory falls back
 * to the default state. A reader who follows a stale link should land on a
 * working page, never on an error.
 */
export function parseDeeplink(search: string): DeeplinkState {
  const params = readParams(search ?? '')
  if (!params) return DEFAULT_STATE

  const from = orderQuantities([
    ...new Set(
      (params.get('from') ?? '')
        .split(',')
        .map((token) => token.trim().toLowerCase())
        .filter(isQuantity),
    ),
  ])
  const rawTo = (params.get('to') ?? '').trim().toLowerCase()

  if (from.length === 0) return DEFAULT_STATE
  if (!isQuantity(rawTo)) return DEFAULT_STATE
  if (from.includes(rawTo)) return DEFAULT_STATE

  const values: ValueDraft = {}
  for (const id of QUANTITY_ORDER) {
    const raw = params.get(id)
    if (raw === null) continue
    const text = raw.trim()
    if (text === '' || !Number.isFinite(Number(text))) continue
    values[id] = text
  }

  return { from, to: rawTo, values }
}

/** The query string for a state, in a stable order so writes are idempotent. */
export function buildDeeplink(state: DeeplinkState): string {
  const params = new URLSearchParams()
  params.set('from', orderQuantities(state.from).join(','))
  params.set('to', state.to)
  for (const id of QUANTITY_ORDER) {
    const text = state.values[id]?.trim()
    if (!text || !Number.isFinite(Number(text))) continue
    params.set(id, text)
  }
  return `?${params.toString()}`
}
