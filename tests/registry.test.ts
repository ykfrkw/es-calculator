import { describe, it, expect } from 'vitest'
import { APPROX_METHODS } from '@/lib/es/approx'
import { CITATIONS, CITATION_ORDER, splitCitations } from '@/lib/es/citations'
import { EXACT_RULES, ruleById } from '@/lib/es/exact'
import { CONVERSION_CATALOG, catalogEntry } from '@/lib/es/registry'
import { QUANTITIES, QUANTITY_ORDER } from '@/lib/es/quantities'
import type { Quantity } from '@/lib/es/types'

describe('citations', () => {
  it('resolves every key referenced by a method', () => {
    for (const method of APPROX_METHODS) {
      for (const key of method.citations) {
        expect(CITATIONS[key], `${method.id} cites ${key}`).toBeDefined()
      }
    }
  })

  it('lists every citation exactly once, in order', () => {
    expect([...CITATION_ORDER].sort()).toEqual(Object.keys(CITATIONS).sort())
    expect(new Set(CITATION_ORDER).size).toBe(CITATION_ORDER.length)
  })

  it('keys match the objects they are stored under', () => {
    for (const [key, citation] of Object.entries(CITATIONS)) {
      expect(citation.key).toBe(key)
      expect(citation.url.length).toBeGreaterThan(0)
    }
  })

  it('does not claim Sánchez-Meca 2003 recommends an index', () => {
    const text = Object.values(CITATIONS)
      .map((citation) => `${citation.text} ${citation.note}`)
      .join(' ')
      .toLowerCase()
    expect(text).not.toMatch(/recommend/)
    expect(text).not.toMatch(/least biased/)
    expect(text).not.toMatch(/best index/)
  })

  it('splits prose on citation keys, including the accented one', () => {
    expect(splitCitations('see Chinn 2000 and Sánchez-Meca 2003.')).toEqual([
      { text: 'see ' },
      { cite: 'Chinn 2000' },
      { text: ' and ' },
      { cite: 'Sánchez-Meca 2003' },
      { text: '.' },
    ])
  })

  it('leaves prose without citations untouched', () => {
    expect(splitCitations('no references here')).toEqual([
      { text: 'no references here' },
    ])
  })
})

describe('rules and methods', () => {
  it('has unique rule ids that resolve', () => {
    const ids = EXACT_RULES.map((rule) => rule.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(ruleById(id)?.id).toBe(id)
  })

  it('has seven exact rules and three approximate methods', () => {
    expect(EXACT_RULES).toHaveLength(7)
    expect(APPROX_METHODS).toHaveLength(3)
  })

  it('never lets an exact rule produce SMD', () => {
    for (const rule of EXACT_RULES) expect(rule.produces).not.toBe('smd')
  })

  it('describes every quantity', () => {
    for (const id of QUANTITY_ORDER) {
      const meta = QUANTITIES[id]
      expect(meta.id).toBe(id)
      expect(meta.short.length).toBeGreaterThan(0)
      expect(meta.hint.length).toBeGreaterThan(0)
      expect(meta.placeholder.length).toBeGreaterThan(0)
    }
  })
})

describe('conversion catalogue', () => {
  it('marks approximate entries with an assumption and exact ones without', () => {
    for (const entry of CONVERSION_CATALOG) {
      for (const route of entry.routes) {
        const method = APPROX_METHODS.find((m) => m.id === route.id)
        if (route.kind === 'approximate') {
          expect(method?.assumption, `${route.id} assumption`).toBeDefined()
        } else {
          expect(method).toBeUndefined()
        }
      }
      expect(entry.kind).toBe(
        entry.routes.every((route) => route.kind === 'exact')
          ? 'exact'
          : 'approximate',
      )
    }
  })

  it('records metadata only — no numbers leak into the table', () => {
    const serialised = JSON.stringify(CONVERSION_CATALOG)
    expect(serialised).not.toMatch(/0\.2\b/)
    expect(serialised).not.toMatch(/2\.153846/)
  })

  it('never lists a source that is neither a rule nor a method', () => {
    const known = new Set([
      ...EXACT_RULES.map((rule) => rule.id),
      ...APPROX_METHODS.map((method) => method.id),
    ])
    for (const entry of CONVERSION_CATALOG) {
      for (const source of entry.sources) expect(known.has(source)).toBe(true)
    }
  })

  it('contains all five retired WordPress conversions', () => {
    const legacy: [Quantity[], Quantity][] = [
      [['cer', 'or'], 'eer'],
      [['cer', 'or'], 'rr'],
      [['cer', 'rr'], 'or'],
      [['or'], 'smd'],
      [['smd'], 'or'],
    ]
    for (const [from, to] of legacy) {
      expect(catalogEntry(from, to), `${from.join('+')} → ${to}`).toBeDefined()
    }
  })

  it('never lists a conversion whose target is one of its inputs', () => {
    for (const entry of CONVERSION_CATALOG) {
      expect(entry.from).not.toContain(entry.to)
    }
  })

  it('matches the recorded shape', () => {
    const summary = CONVERSION_CATALOG.map(
      (entry) =>
        `${entry.from.join('+')} → ${entry.to} [${entry.kind}] ${entry.routes
          .map((route) => route.id)
          .join('/')}`,
    )
    expect(summary).toMatchInlineSnapshot(`
      [
        "or → smd [approximate] cox/hh",
        "smd → or [approximate] cox/hh",
        "cer+eer → rr [exact] exact",
        "cer+eer → or [exact] exact",
        "cer+eer → smd [approximate] cox/hh/probit",
        "cer+rr → eer [exact] exact",
        "cer+rr → or [exact] exact",
        "cer+rr → smd [approximate] cox/hh/probit",
        "cer+or → eer [exact] exact",
        "cer+or → rr [exact] exact",
        "cer+or → smd [approximate] cox/hh/probit",
        "cer+smd → eer [approximate] cox/hh/probit",
        "cer+smd → rr [approximate] cox/hh/probit",
        "cer+smd → or [approximate] cox/hh/probit",
        "eer+rr → cer [exact] exact",
        "eer+rr → or [exact] exact",
        "eer+rr → smd [approximate] cox/hh/probit",
        "eer+or → cer [exact] exact",
        "eer+or → rr [exact] exact",
        "eer+or → smd [approximate] cox/hh/probit",
        "eer+smd → cer [approximate] cox/hh",
        "eer+smd → rr [approximate] cox/hh",
        "eer+smd → or [approximate] cox/hh",
        "rr+or → cer [exact] exact",
        "rr+or → eer [exact] exact",
        "rr+or → smd [approximate] cox/hh/probit",
        "rr+smd → cer [approximate] cox/hh",
        "rr+smd → eer [approximate] cox/hh",
        "rr+smd → or [approximate] cox/hh",
      ]
    `)
  })
})
