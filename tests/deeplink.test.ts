import { describe, it, expect } from 'vitest'
import {
  DEFAULT_STATE,
  buildDeeplink,
  parseDeeplink,
} from '@/lib/es/deeplink'

/** The URLs the retired WordPress forms are replaced by. */
const LEGACY_LINKS: [string, string[], string][] = [
  ['?from=cer,or&to=eer', ['cer', 'or'], 'eer'],
  ['?from=cer,or&to=rr', ['cer', 'or'], 'rr'],
  ['?from=cer,rr&to=or', ['cer', 'rr'], 'or'],
  ['?from=or&to=smd', ['or'], 'smd'],
  ['?from=smd&to=or', ['smd'], 'or'],
]

describe('legacy deep links', () => {
  it.each(LEGACY_LINKS)('%s parses', (search, from, to) => {
    const state = parseDeeplink(search)
    expect(state.from).toEqual(from)
    expect(state.to).toBe(to)
    expect(state.values).toEqual({})
  })
})

describe('prefills', () => {
  it('reads numeric values for the quantities it knows', () => {
    const state = parseDeeplink('?from=cer,or&to=eer&cer=0.2&or=2.15')
    expect(state.values).toEqual({ cer: '0.2', or: '2.15' })
  })

  it('drops values that are not numbers', () => {
    const state = parseDeeplink('?from=cer,or&to=eer&cer=abc&or=&rr=1.5')
    expect(state.values).toEqual({ rr: '1.5' })
  })

  it('keeps negative and exponential notation', () => {
    const state = parseDeeplink('?from=smd&to=or&smd=-1.2e-1')
    expect(state.values.smd).toBe('-1.2e-1')
  })
})

describe('normalisation', () => {
  it('orders and deduplicates the from set', () => {
    expect(parseDeeplink('?from=or,cer,or&to=eer').from).toEqual(['cer', 'or'])
  })

  it('ignores unknown ids inside a usable from set', () => {
    expect(parseDeeplink('?from=cer,zzz,or&to=eer').from).toEqual(['cer', 'or'])
  })

  it('is case insensitive', () => {
    const state = parseDeeplink('?from=CER,OR&to=EER')
    expect(state.from).toEqual(['cer', 'or'])
    expect(state.to).toBe('eer')
  })
})

describe('junk never throws and never errors out', () => {
  const junk = [
    '?from=xyz&to=abc',
    '?to=eer',
    '?from=cer,cer,cer',
    '?from=cer&to=cer',
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
    expect(state.from.length).toBeGreaterThan(0)
    expect(state.from).not.toContain(state.to)
  })

  it.each([
    '?from=xyz&to=abc',
    '?to=eer',
    '?from=cer,cer,cer',
    '?from=cer&to=cer',
    '?',
    '',
  ])('%s falls back to the default state', (search) => {
    expect(parseDeeplink(search)).toEqual(DEFAULT_STATE)
  })
})

describe('round trip', () => {
  it.each(LEGACY_LINKS)('%s survives build → parse', (search) => {
    const once = parseDeeplink(search)
    expect(parseDeeplink(buildDeeplink(once))).toEqual(once)
  })

  it('is idempotent with prefills', () => {
    const once = parseDeeplink('?from=cer,or&to=eer&cer=0.2&or=2.15')
    const twice = parseDeeplink(buildDeeplink(once))
    expect(twice).toEqual(once)
    expect(buildDeeplink(twice)).toBe(buildDeeplink(once))
  })

  it('writes the from set in canonical order regardless of input order', () => {
    expect(buildDeeplink({ from: ['or', 'cer'], to: 'eer', values: {} })).toBe(
      '?from=cer%2Cor&to=eer',
    )
  })

  it('omits blank and unparseable prefills', () => {
    const link = buildDeeplink({
      from: ['cer', 'or'],
      to: 'eer',
      values: { cer: '  ', or: 'abc', rr: '1.5' },
    })
    expect(link).toBe('?from=cer%2Cor&to=eer&rr=1.5')
  })
})
