import { SELECTION_ORDER, membersOf, type Selection } from './selections'
import { requiredInputs, solve } from './solve'
import type { Kind, Quantity, Route, Values } from './types'

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
  from: Selection
  to: Selection
  /** 'exact' when the conversion needs no latent-variable assumption. */
  kind: Kind
  /** Any one of these must also be supplied. Empty when `from` suffices. */
  requiredAnyOf: Quantity[]
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
 * The routes that resolve for a selection, across all of its targets.
 *
 * Converting to event rates runs the solver twice, once per rate, and both
 * runs offer the same methods — so the routes are keyed by id rather than
 * listed once per target.
 */
function resolvedRoutes(known: Values, targets: Quantity[]): Route[] {
  const byId = new Map<string, Route>()
  for (const target of targets) {
    for (const route of solve(known, target).routes) {
      if (!Number.isFinite(route.value)) continue
      if (!byId.has(route.id)) byId.set(route.id, route)
    }
  }
  return [...byId.values()]
}

/**
 * Built by driving the solver rather than written by hand: a table typed out
 * separately would be a second source of truth, and would go stale the first
 * time a rule changed.
 */
function buildCatalog(): CatalogEntry[] {
  const entries: CatalogEntry[] = []

  for (const from of SELECTION_ORDER) {
    for (const to of SELECTION_ORDER) {
      if (from === to) continue

      const targets = membersOf(to)
      const requirement = requiredInputs(membersOf(from), targets)
      // Probe with the cheapest satisfying input so the routes the reader
      // will actually see are the ones recorded.
      const supplied: Quantity[] = [...membersOf(from)]
      if (requirement.requiredAnyOf.length > 0) {
        supplied.push(requirement.requiredAnyOf[0])
      }

      const live = resolvedRoutes(probe(supplied), targets)
      if (live.length === 0) continue

      entries.push({
        from,
        to,
        kind: live.every((route) => route.kind === 'exact')
          ? 'exact'
          : 'approximate',
        requiredAnyOf: requirement.requiredAnyOf,
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
  from: Selection,
  to: Selection,
): CatalogEntry | undefined {
  return CONVERSION_CATALOG.find(
    (entry) => entry.from === from && entry.to === to,
  )
}
