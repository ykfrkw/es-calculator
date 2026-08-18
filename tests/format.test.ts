import { describe, it, expect } from 'vitest'
import { EMPTY_MARK, fmtNumber, fmtPercent, fmtSigned } from '@/lib/es/format'

describe('fmtNumber', () => {
  it.each([
    [0.35, '0.35'],
    [1.75, '1.75'],
    [2.153846153846154, '2.1538'],
    [0.4650031228567680, '0.465'],
    [1, '1'],
    [0, '0'],
    [-0.5, '-0.5'],
    [999.99, '999.99'],
  ])('formats %f as %s', (value, expected) => {
    expect(fmtNumber(value)).toBe(expected)
  })

  it('switches to exponential outside the readable band', () => {
    expect(fmtNumber(1000)).toBe('1.000e+3')
    expect(fmtNumber(0.0001)).toBe('1.000e-4')
    expect(fmtNumber(1.2345e9)).toBe('1.235e+9')
  })

  it('never truncates an integer by stripping zeros', () => {
    expect(fmtNumber(100)).toBe('100')
    expect(fmtNumber(120)).toBe('120')
  })

  it('honours a requested precision', () => {
    expect(fmtNumber(2.153846153846154, { significant: 3 })).toBe('2.15')
    expect(fmtNumber(2.153846153846154, { significant: 10 })).toBe('2.153846154')
  })

  it.each([undefined, NaN, Infinity, -Infinity])(
    'prints the empty mark for %s',
    (value) => {
      expect(fmtNumber(value)).toBe(EMPTY_MARK)
    },
  )

  it('accepts a custom empty mark', () => {
    expect(fmtNumber(NaN, { empty: 'n/a' })).toBe('n/a')
  })
})

describe('fmtSigned', () => {
  it('marks the direction of an effect', () => {
    expect(fmtSigned(0.4563)).toBe('+0.4563')
    expect(fmtSigned(-0.4563)).toBe('-0.4563')
    expect(fmtSigned(0)).toBe('0')
    expect(fmtSigned(NaN)).toBe(EMPTY_MARK)
  })
})

describe('fmtPercent', () => {
  it('renders a rate as a percentage', () => {
    expect(fmtPercent(0.2)).toBe('20%')
    expect(fmtPercent(0.3567)).toBe('35.67%')
    expect(fmtPercent(undefined)).toBe(EMPTY_MARK)
  })
})
