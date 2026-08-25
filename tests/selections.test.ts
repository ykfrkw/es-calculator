import { describe, it, expect } from 'vitest'
import {
  SELECTION_ORDER,
  membersOf,
  selectSide,
  selectionOf,
} from '@/lib/es/selections'

describe('selectSide', () => {
  it('sets the clicked side and leaves the other alone', () => {
    expect(selectSide({ from: 'or', to: 'smd' }, 'from', 'rr')).toEqual({
      from: 'rr',
      to: 'smd',
    })
    expect(selectSide({ from: 'or', to: 'smd' }, 'to', 'rates')).toEqual({
      from: 'or',
      to: 'rates',
    })
  })

  /**
   * Swapping the two ends is the commonest thing a reader wants. The measure
   * moves and the side it came from empties, rather than being shunted onto
   * something nobody asked for.
   */
  it('empties the other side when it held the clicked measure', () => {
    expect(selectSide({ from: 'or', to: 'smd' }, 'from', 'smd')).toEqual({
      from: 'smd',
      to: null,
    })
    expect(selectSide({ from: 'or', to: 'smd' }, 'to', 'or')).toEqual({
      from: null,
      to: 'or',
    })
  })

  it('fills an empty side without disturbing the other', () => {
    expect(selectSide({ from: 'smd', to: null }, 'to', 'rates')).toEqual({
      from: 'smd',
      to: 'rates',
    })
    expect(selectSide({ from: null, to: 'or' }, 'from', 'rr')).toEqual({
      from: 'rr',
      to: 'or',
    })
  })

  it('re-clicking the selected measure changes nothing', () => {
    expect(selectSide({ from: 'or', to: 'smd' }, 'from', 'or')).toEqual({
      from: 'or',
      to: 'smd',
    })
  })

  it('never leaves the same measure on both sides', () => {
    for (const picked of SELECTION_ORDER) {
      for (const side of ['from', 'to'] as const) {
        const pair = selectSide({ from: 'or', to: 'smd' }, side, picked)
        expect(pair.from === null || pair.from !== pair.to).toBe(true)
      }
    }
  })
})

describe('selection groups', () => {
  it('maps every member back to its own selection', () => {
    for (const id of SELECTION_ORDER) {
      for (const member of membersOf(id)) {
        expect(selectionOf(member)).toBe(id)
      }
    }
  })
})
