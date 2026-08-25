import { QUANTITY_ORDER } from './quantities'
import { SELECTION_ORDER, selectionOf, type Selection } from './selections'
import type { Quantity } from './types'

/** Raw field text, keyed by quantity — the UI holds strings, not numbers. */
export type ValueDraft = Partial<Record<Quantity, string>>

export interface DeeplinkState {
  /** Null while the reader has moved this measure to the other side. */
  from: Selection | null
  to: Selection | null
  values: ValueDraft
}

/** What an absent, empty or unparseable query string resolves to. */
export const DEFAULT_STATE: DeeplinkState = {
  from: 'or',
  to: 'smd',
  values: {},
}

/**
 * Where a link that named a single rate lands once both rates are one
 * selection. Both sides of `?from=cer&to=eer` collapse onto the same
 * selection, and OR is the measure a reader arriving from that link most
 * often has in hand.
 */
const COLLAPSED_STATE: Omit<DeeplinkState, 'values'> = {
  from: 'or',
  to: 'rates',
}

function isQuantity(candidate: string): candidate is Quantity {
  return (QUANTITY_ORDER as string[]).includes(candidate)
}

/** Tokens a link may name: the four selections plus the five old quantities. */
function isToken(candidate: string): boolean {
  return isQuantity(candidate) || (SELECTION_ORDER as string[]).includes(candidate)
}

function toSelection(token: string): Selection {
  return isQuantity(token) ? selectionOf(token) : (token as Selection)
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

function readValues(params: URLSearchParams): ValueDraft {
  const values: ValueDraft = {}
  for (const id of QUANTITY_ORDER) {
    const raw = params.get(id)
    if (raw === null) continue
    const text = raw.trim()
    if (text === '' || !Number.isFinite(Number(text))) continue
    values[id] = text
  }
  return values
}

/**
 * Parse `?from=or&to=rr` plus optional numeric prefills.
 *
 * Three earlier link shapes are still in the wild and all of them have to
 * land on a working page rather than on an error: `from` as a comma list
 * (first valid id wins), a bare `cer` or `eer` where a selection is now
 * expected, and a self-contradictory pair, which falls back to the default.
 *
 * Never returns a half-chosen state. A side with no measure is transient UI
 * the reader is in the middle of, not something a reload should reinstate.
 */
export function parseDeeplink(search: string): DeeplinkState {
  const params = readParams(search ?? '')
  if (!params) return DEFAULT_STATE

  const rawFrom = (params.get('from') ?? '')
    .split(',')
    .map((token) => token.trim().toLowerCase())
    .find(isToken)
  const rawTo = (params.get('to') ?? '').trim().toLowerCase()

  if (rawFrom === undefined) return DEFAULT_STATE
  if (!isToken(rawTo)) return DEFAULT_STATE
  // Judged on the raw tokens: `?from=cer&to=cer` was junk when it was minted
  // and stays junk, whereas `?from=cer&to=eer` named a real conversion.
  if (rawFrom === rawTo) return DEFAULT_STATE

  const from = toSelection(rawFrom)
  const to = toSelection(rawTo)
  const values = readValues(params)

  if (from === to) return { ...COLLAPSED_STATE, values }
  return { from, to, values }
}

/** The query string for a state, in a stable order so writes are idempotent. */
export function buildDeeplink(state: DeeplinkState): string {
  const params = new URLSearchParams()
  // An empty side is simply absent: writing `from=` would mint a link that
  // parses back to the default rather than to what the reader is looking at.
  if (state.from !== null) params.set('from', state.from)
  if (state.to !== null) params.set('to', state.to)
  for (const id of QUANTITY_ORDER) {
    const text = state.values[id]?.trim()
    if (!text || !Number.isFinite(Number(text))) continue
    params.set(id, text)
  }
  return `?${params.toString()}`
}
