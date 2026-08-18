import { QUANTITY_ORDER } from './quantities'
import { requiredInputs, solve } from './solve'
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
  from: Quantity
  to: Quantity
  /** 'exact' when the conversion needs no latent-variable assumption. */
  kind: Kind
  /** Any one of these must also be supplied. Empty when `from` suffices. */
  requiredAnyOf: Quantity[]
  /** Not needed, but each unlocks a further route. */
  optional: Quantity[]
  /** Routes that resolve once the requirement is met, in display order. */
  routes: CatalogRoute[]
  /** Rule and method ids used, for cross-checking against the engine. */
  sources: string[]
}

function probe(ids: Quantity[]): Values {
  const values: Values = {}
  for (const id of ids) values[id] = SENTINELS[id]
  return values
}

/**
 * Built by driving the solver rather than written by hand: a table typed out
 * separately would be a second source of truth, and would go stale the first
 * time a rule changed.
 */
function buildCatalog(): CatalogEntry[] {
  const entries: CatalogEntry[] = []

  for (const from of QUANTITY_ORDER) {
    for (const to of QUANTITY_ORDER) {
      if (from === to) continue

      const requirement = requiredInputs(from, to)
      // Probe with the cheapest satisfying input so the routes the reader
      // will actually see are the ones recorded.
      const supplied: Quantity[] = [from]
      if (requirement.requiredAnyOf.length > 0) {
        supplied.push(requirement.requiredAnyOf[0])
      }

      const solution = solve(probe(supplied), to)
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
        requiredAnyOf: requirement.requiredAnyOf,
        optional: requirement.optional,
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
  from: Quantity,
  to: Quantity,
): CatalogEntry | undefined {
  return CONVERSION_CATALOG.find(
    (entry) => entry.from === from && entry.to === to,
  )
}
