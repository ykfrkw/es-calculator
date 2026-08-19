import { describe, it, expect } from 'vitest'
import {
  DEFAULT_STATE,
  buildDeeplink,
  parseDeeplink,
} from '@/lib/es/deeplink'

/** The presets the WordPress post links to, as they were minted. */
const PRESET_LINKS: [string, string, string][] = [
  ['?from=cer&to=eer', 'or', 'rates'],
  ['?from=or&to=rr', 'or', 'rr'],
  ['?from=rr&to=or', 'rr', 'or'],
  ['?from=or&to=smd', 'or', 'smd'],
  ['?from=smd&to=or', 'smd', 'or'],
]

describe('preset deep links', () => {
  it.each(PRESET_LINKS)('%s parses', (search, from, to) => {
    const state = parseDeeplink(search)
    expect(state.from).toBe(from)
    expect(state.to).toBe(to)
    expect(state.values).toEqual({})
  })
})

/**
 * CER and EER are one selection now, so a link naming a single rate maps onto
 * it. `?from=cer&to=eer` named a real conversion when it was minted, and both
 * sides now collapse onto the same selection — it lands on OR → Event rates
 * rather than on the default or on an error.
 */
describe('links minted when each rate was its own side', () => {
  it.each([
    ['?from=cer&to=rr', 'rates', 'rr'],
    ['?from=eer&to=rr', 'rates', 'rr'],
    ['?from=rr&to=cer', 'rr', 'rates'],
    ['?from=smd&to=eer', 'smd', 'rates'],
  ])('%s maps the rate onto its selection', (search, from, to) => {
    const state = parseDeeplink(search)
    expect(state.from).toBe(from)
    expect(state.to).toBe(to)
  })

  it('lands a rate-to-rate link on OR → Event rates', () => {
    expect(parseDeeplink('?from=cer&to=eer')).toEqual({
      from: 'or',
      to: 'rates',
      values: {},
    })
  })

  it('keeps the prefills when a rate-to-rate link is redirected', () => {
    expect(parseDeeplink('?from=cer&to=eer&cer=0.2')).toEqual({
      from: 'or',
      to: 'rates',
      values: { cer: '0.2' },
    })
  })

  it('accepts the new selection token as well', () => {
    const state = parseDeeplink('?from=rates&to=rr')
    expect(state.from).toBe('rates')
    expect(state.to).toBe('rr')
  })
})

/**
 * `from` used to be a comma-separated list. Links minted then are still in
 * the wild, so they degrade to their first id rather than erroring.
 */
describe('legacy comma form', () => {
  it.each([
    ['?from=cer,or&to=eer', 'or', 'rates'],
    ['?from=cer,or&to=rr', 'rates', 'rr'],
    ['?from=cer,rr&to=or', 'rates', 'or'],
    ['?from=or,cer&to=smd', 'or', 'smd'],
  ])('%s keeps the first id', (search, from, to) => {
    const state = parseDeeplink(search)
    expect(state.from).toBe(from)
    expect(state.to).toBe(to)
  })

  it('skips leading junk to reach the first valid id', () => {
    expect(parseDeeplink('?from=zzz,or&to=rr').from).toBe('or')
  })

  it('falls back when the surviving id collides with the target', () => {
    expect(parseDeeplink('?from=eer,cer&to=eer')).toEqual(DEFAULT_STATE)
  })

  it('carries prefills across the legacy form', () => {
    const state = parseDeeplink('?from=cer,or&to=rr&cer=0.2&or=2.15')
    expect(state.from).toBe('rates')
    expect(state.values).toEqual({ cer: '0.2', or: '2.15' })
  })
})

describe('prefills', () => {
  it('reads numeric values for the quantities it knows', () => {
    const state = parseDeeplink('?from=cer&to=rr&cer=0.2&or=2.15')
    expect(state.values).toEqual({ cer: '0.2', or: '2.15' })
  })

  it('drops values that are not numbers', () => {
    const state = parseDeeplink('?from=cer&to=rr&cer=abc&or=&rr=1.5')
    expect(state.values).toEqual({ rr: '1.5' })
  })

  it('keeps negative and exponential notation', () => {
    const state = parseDeeplink('?from=smd&to=or&smd=-1.2e-1')
    expect(state.values.smd).toBe('-1.2e-1')
  })
})

describe('normalisation', () => {
  it('ignores repeats of the same id', () => {
    expect(parseDeeplink('?from=or,or,or&to=rr').from).toBe('or')
  })

  it('ignores unknown ids', () => {
    expect(parseDeeplink('?from=zzz,cer&to=rr').from).toBe('rates')
  })

  it('is case insensitive', () => {
    const state = parseDeeplink('?from=OR&to=EER')
    expect(state.from).toBe('or')
    expect(state.to).toBe('rates')
  })

  it('trims whitespace', () => {
    expect(parseDeeplink('?from= or &to= rr ').from).toBe('or')
  })
})

describe('junk never throws and never errors out', () => {
  const junk = [
    '?from=xyz&to=abc',
    '?to=eer',
    '?from=cer,cer,cer',
    '?from=cer&to=cer',
    '?from=rates&to=rates',
    '?from=&to=',
    '?',
    '',
    '?from=cer,eer&to=smd&smd=NaN',
    'from=cer&to=or&cer=0.2',
    '?%%%',
  ]

  it.each(junk)('%s', (search) => {
    expect(() => parseDeeplink(search)).not.toThrow()
    const state = parseDeeplink(search)
    expect(state.from).not.toBe(state.to)
  })

  it.each([
    '?from=xyz&to=abc',
    '?to=eer',
    '?from=cer,cer,cer',
    '?from=cer&to=cer',
    '?from=rates&to=rates',
    '?',
    '',
  ])('%s falls back to the default state', (search) => {
    expect(parseDeeplink(search)).toEqual(DEFAULT_STATE)
  })
})

describe('round trip', () => {
  it.each(PRESET_LINKS)('%s survives build → parse', (search) => {
    const once = parseDeeplink(search)
    expect(parseDeeplink(buildDeeplink(once))).toEqual(once)
  })

  it('is idempotent with prefills', () => {
    const once = parseDeeplink('?from=cer&to=rr&cer=0.2&or=2.15')
    const twice = parseDeeplink(buildDeeplink(once))
    expect(twice).toEqual(once)
    expect(buildDeeplink(twice)).toBe(buildDeeplink(once))
  })

  it('writes the selection ids', () => {
    expect(buildDeeplink({ from: 'or', to: 'rates', values: {} })).toBe(
      '?from=or&to=rates',
    )
  })

  it('normalises a legacy link to the selection form on the way back out', () => {
    expect(buildDeeplink(parseDeeplink('?from=cer,or&to=rr'))).toBe(
      '?from=rates&to=rr',
    )
  })

  it('omits blank and unparseable prefills', () => {
    const link = buildDeeplink({
      from: 'rates',
      to: 'rr',
      values: { cer: '  ', or: 'abc', rr: '1.5' },
    })
    expect(link).toBe('?from=rates&to=rr&rr=1.5')
  })
})
