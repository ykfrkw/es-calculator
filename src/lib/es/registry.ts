import { QUANTITY_ORDER } from './quantities'
import { solve } from './solve'
import type { Kind, Quantity, Values } from './types'

/**
 * Consistent probe values: CER 0.20 / EER 0.35 and the RR and OR they imply.
 * They exist only so `solve` has something to run on — nothing numeric
 * escapes into the catalogue.
 */
const SENTINELS: Record<Quantity, number> = {
  cer: 0.2,
  eer: 0.35,
  rr: 1.75,
  or: 2.153846153846154,
  smd: 0.4563007671653466,
}

export interface CatalogRoute {
  id: string
  label: string
  kind: Kind
}

export interface CatalogEntry {
  from: Quantity[]
  to: Quantity
  /** 'exact' when the conversion needs no latent-variable assumption. */
  kind: Kind
  /** Routes that actually resolve, in the order the tool shows them. */
  routes: CatalogRoute[]
  /** Rule and method ids used, for cross-checking against the engine. */
  sources: string[]
}

/** Every 1- and 2-element subset of the quantities, in canonical order. */
function inputSubsets(): Quantity[][] {
  const subsets: Quantity[][] = QUANTITY_ORDER.map((id) => [id])
  for (let i = 0; i < QUANTITY_ORDER.length; i += 1) {
    for (let j = i + 1; j < QUANTITY_ORDER.length; j += 1) {
      subsets.push([QUANTITY_ORDER[i], QUANTITY_ORDER[j]])
    }
  }
  return subsets
}

function probe(from: Quantity[]): Values {
  const values: Values = {}
  for (const id of from) values[id] = SENTINELS[id]
  return values
}

/**
 * Built by driving the solver rather than written by hand: a table typed out
 * separately would be a second source of truth, and would go stale the first
 * time a rule changed.
 */
function buildCatalog(): CatalogEntry[] {
  const entries: CatalogEntry[] = []

  for (const from of inputSubsets()) {
    for (const to of QUANTITY_ORDER) {
      if (from.includes(to)) continue

      const solution = solve(probe(from), to)
      const live = solution.routes.filter((route) =>
        Number.isFinite(route.value),
      )
      if (live.length === 0) continue

      entries.push({
        from,
        to,
        kind: live.every((route) => route.kind === 'exact')
          ? 'exact'
          : 'approximate',
        routes: live.map((route) => ({
          id: route.id,
          label: route.label,
          kind: route.kind,
        })),
        sources: [
          ...new Set(live.flatMap((route) => route.steps.map((s) => s.source))),
        ],
      })
    }
  }

  return entries
}

export const CONVERSION_CATALOG: CatalogEntry[] = buildCatalog()

/** Catalogue lookup for a given picker state. */
export function catalogEntry(
  from: Quantity[],
  to: Quantity,
): CatalogEntry | undefined {
  const key = [...from].sort().join(',')
  return CONVERSION_CATALOG.find(
    (entry) => entry.to === to && [...entry.from].sort().join(',') === key,
  )
}
