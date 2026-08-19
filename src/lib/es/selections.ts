/**
 * What the picker offers, as opposed to what the engine computes.
 *
 * CER and EER are two numbers but one editorial choice: a reader who has one
 * arm's rate is answering the same question as a reader who has the other,
 * and asking them to pick a side made half the picker's combinations
 * meaningless. They are grouped here rather than in ./quantities, which
 * defines single quantities and validates them one at a time.
 */
import { QUANTITIES } from './quantities'
import type { Quantity } from './types'

/** The four things the picker can convert from or to. */
export type Selection = 'rates' | 'rr' | 'or' | 'smd'

export interface SelectionMeta {
  id: Selection
  /** Abbreviation used in chips, the recipe line and the catalogue. */
  short: string
  /** Sentence-case name used in tooltips. */
  long: string
  /** The engine quantities this selection stands for, in canonical order. */
  members: Quantity[]
}

/** Canonical display order: rates, then ratios, then the standardised scale. */
export const SELECTION_ORDER: Selection[] = ['rates', 'rr', 'or', 'smd']

export const SELECTIONS: Record<Selection, SelectionMeta> = {
  rates: {
    id: 'rates',
    short: 'Event rates',
    long: 'Control and experimental event rates',
    members: ['cer', 'eer'],
  },
  rr: {
    id: 'rr',
    short: QUANTITIES.rr.short,
    long: QUANTITIES.rr.long,
    members: ['rr'],
  },
  or: {
    id: 'or',
    short: QUANTITIES.or.short,
    long: QUANTITIES.or.long,
    members: ['or'],
  },
  smd: {
    id: 'smd',
    short: QUANTITIES.smd.short,
    long: QUANTITIES.smd.long,
    members: ['smd'],
  },
}

/** The quantities a selection stands for. */
export function membersOf(id: Selection): Quantity[] {
  return SELECTIONS[id].members
}

/** The selection a quantity belongs to. */
export function selectionOf(id: Quantity): Selection {
  return SELECTION_ORDER.find((candidate) =>
    SELECTIONS[candidate].members.includes(id),
  )!
}
