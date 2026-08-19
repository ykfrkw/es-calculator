import { describe, it, expect } from 'vitest'
import { APPROX_METHODS } from '@/lib/es/approx'
import { CITATIONS, CITATION_ORDER, splitCitations } from '@/lib/es/citations'
import { EXACT_RULES, ruleById } from '@/lib/es/exact'
import { CONVERSION_CATALOG, catalogEntry } from '@/lib/es/registry'
import { QUANTITIES, QUANTITY_ORDER } from '@/lib/es/quantities'
import { SELECTION_ORDER, type Selection } from '@/lib/es/selections'

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

  it('has seven exact rules and two approximate methods', () => {
    expect(EXACT_RULES).toHaveLength(7)
    expect(APPROX_METHODS).toHaveLength(2)
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

  it('contains the five presets the WordPress post links to', () => {
    const presets: [Selection, Selection][] = [
      ['or', 'rates'],
      ['or', 'rr'],
      ['rr', 'or'],
      ['or', 'smd'],
      ['smd', 'or'],
    ]
    for (const [from, to] of presets) {
      expect(catalogEntry(from, to), `${from} → ${to}`).toBeDefined()
    }
  })

  it('covers every ordered pair of distinct selections', () => {
    expect(CONVERSION_CATALOG).toHaveLength(
      SELECTION_ORDER.length * (SELECTION_ORDER.length - 1),
    )
  })

  it('never lists a conversion whose target is its own input', () => {
    for (const entry of CONVERSION_CATALOG) {
      expect(entry.from).not.toBe(entry.to)
    }
  })

  it('never demands EER', () => {
    for (const entry of CONVERSION_CATALOG) {
      expect(entry.requiredAnyOf).not.toContain('eer')
    }
  })

  it('matches the recorded shape', () => {
    const summary = CONVERSION_CATALOG.map(
      (entry) =>
        `${entry.from} → ${entry.to} [${entry.kind}] ${entry.routes
          .map((route) => route.id)
          .join('/')} +${entry.requiredAnyOf.join('|') || '—'}`,
    )
    expect(summary).toMatchInlineSnapshot(`
      [
        "rates → rr [exact] exact +—",
        "rates → or [exact] exact +—",
        "rates → smd [approximate] cox/hh +—",
        "rr → rates [exact] exact +or",
        "rr → or [exact] exact +cer",
        "rr → smd [approximate] cox/hh +cer|or",
        "or → rates [exact] exact +rr",
        "or → rr [exact] exact +cer",
        "or → smd [approximate] cox/hh +—",
        "smd → rates [approximate] cox/hh +rr",
        "smd → rr [approximate] cox/hh +cer",
        "smd → or [approximate] cox/hh +—",
      ]
    `)
  })
})
