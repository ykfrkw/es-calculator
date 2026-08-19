import { APPROX_METHODS, type ApproxMethod } from './approx'
import { completeExact, symbolicClosure, traceSteps } from './exact'
import type { ExactResult } from './exact'
import {
  QUANTITIES,
  QUANTITY_ORDER,
  listQuantities,
  orderQuantities,
} from './quantities'
import type {
  EsError,
  InputRequirement,
  Quantity,
  Route,
  Solution,
  Step,
  Values,
} from './types'
import { W } from './warnings'

/**
 * Quantities the tool will ever ask a reader to add. EER is never one of
 * them: either arm's rate answers the same question, and CER is the one a
 * paper always reports, so demanding EER only makes the form look arbitrary.
 */
const AUXILIARY_QUANTITIES = QUANTITY_ORDER.filter((id) => id !== 'eer')

/** The inputs a method needs when running the SMD backwards. */
function inverseNeeds(method: ApproxMethod): Quantity[] {
  return method.needs.filter((id) => id !== method.seeds)
}

function suppliedQuantities(known: Values): Quantity[] {
  return QUANTITY_ORDER.filter((id) => known[id] !== undefined)
}

function missingFrom(values: Values, needs: Quantity[]): Quantity[] {
  return needs.filter((id) => values[id] === undefined)
}

/**
 * Single quantities that, if added, would satisfy `needs`.
 *
 * Reachability is decided on ids alone. Probing with a sentinel number would
 * report "nothing helps" whenever the sentinel happened to contradict a value
 * the reader had already entered.
 */
function unblockers(supplied: Quantity[], needs: Quantity[]): Quantity[] {
  return AUXILIARY_QUANTITIES.filter((candidate) => {
    if (candidate === 'smd') return false
    if (supplied.includes(candidate)) return false
    const closure = symbolicClosure([...supplied, candidate])
    return needs.every((id) => closure.has(id))
  })
}

function blockedRoute(
  method: ApproxMethod,
  target: Quantity,
  supplied: Quantity[],
  needs: Quantity[],
  values: Values,
): Route {
  const unmet = missingFrom(values, needs)
  const candidates = unblockers(supplied, needs)
  const reason =
    candidates.length > 0
      ? `Needs ${listQuantities(candidates)} as well — ${method.blockedNote}`
      : `Needs ${listQuantities(unmet, 'and')}, which cannot be derived from what you entered — ${method.blockedNote}`

  return {
    id: method.id,
    label: method.label,
    kind: 'approximate',
    target,
    value: NaN,
    steps: [],
    assumption: method.assumption,
    citations: [...method.citations],
    // One input is enough whenever any single one is; the rest are offered
    // as alternatives so the reader can use whichever the paper reported.
    missing: candidates.length > 0 ? [candidates[0]] : unmet,
    alternatives: candidates.slice(1),
    blockedReason: reason,
    errors: [],
    warnings: [],
  }
}

/** Exact steps that fed the given needs, deduplicated, in derivation order. */
function supportingSteps(exact: ExactResult, needs: Quantity[]): Step[] {
  const wanted = new Set<Step>()
  for (const need of needs) {
    for (const step of traceSteps(exact.steps, need)) wanted.add(step)
  }
  return exact.steps.filter((step) => wanted.has(step))
}

function toSmdRoute(
  method: ApproxMethod,
  supplied: Quantity[],
  exact: ExactResult,
): Route {
  const values = exact.values
  if (missingFrom(values, method.needs).length > 0) {
    return blockedRoute(method, 'smd', supplied, method.needs, values)
  }

  const outcome = method.toSmd(values)
  const approximateStep: Step = {
    source: method.id,
    kind: 'approximate',
    produces: 'smd',
    formula: method.toSmdFormula,
    substituted: outcome.substituted,
    value: outcome.value,
  }

  return {
    id: method.id,
    label: method.label,
    kind: 'approximate',
    target: 'smd',
    value: outcome.value,
    steps: [...supportingSteps(exact, method.needs), approximateStep],
    assumption: method.assumption,
    citations: [...method.citations],
    missing: [],
    alternatives: [],
    errors: outcome.error ? [outcome.error] : [],
    warnings: outcome.warnings ?? [],
  }
}

function fromSmdRoute(
  method: ApproxMethod,
  target: Quantity,
  known: Values,
  supplied: Quantity[],
  exact: ExactResult,
): Route {
  const values = exact.values
  const needs = inverseNeeds(method)
  if (missingFrom(values, needs).length > 0) {
    return blockedRoute(method, target, supplied, needs, values)
  }

  const base: Route = {
    id: method.id,
    label: method.label,
    kind: 'approximate',
    target,
    value: NaN,
    steps: [],
    assumption: method.assumption,
    citations: [...method.citations],
    missing: [],
    alternatives: [],
    errors: [],
    warnings: [],
  }

  // Seeding a quantity the reader already gave would either contradict it or
  // add nothing; either way the SMD is not what is missing.
  if (values[method.seeds] !== undefined) {
    const seedShort = QUANTITIES[method.seeds].short
    return {
      ...base,
      errors: [
        `${seedShort} is already known, so this route adds nothing: ${QUANTITIES[target].short} still needs ${listQuantities(unblockers(supplied, [target]))}.`,
      ],
    }
  }

  const seeding = method.fromSmd(values.smd!)
  if (seeding.error !== undefined) {
    return { ...base, errors: [seeding.error] }
  }

  const approximateStep: Step = {
    source: method.id,
    kind: 'approximate',
    produces: method.seeds,
    formula: method.fromSmdFormula,
    substituted: seeding.substituted,
    value: seeding.seed[method.seeds]!,
  }

  // The reader's own numbers win over the seed, so a seeded value can never
  // silently replace something that was actually measured.
  const seededKnown: Values = { ...seeding.seed }
  for (const id of supplied) {
    if (id !== 'smd') seededKnown[id] = known[id]
  }

  const seeded = completeExact(seededKnown)
  const value = seeded.values[target]
  if (value === undefined) {
    return {
      ...base,
      steps: [approximateStep],
      errors: [
        seeded.errors[0]?.message ??
          `${QUANTITIES[target].short} could not be reached from the seeded ${QUANTITIES[method.seeds].short}.`,
      ],
    }
  }

  return {
    ...base,
    value,
    steps: [approximateStep, ...traceSteps(seeded.steps, target)],
    warnings: [...(seeding.warnings ?? []), W.smdFromRoundedRates],
  }
}

function exactRoute(target: Quantity, exact: ExactResult): Route {
  const steps = traceSteps(exact.steps, target)
  return {
    id: 'exact',
    label: steps.length > 0 ? 'Exact algebra' : 'Supplied directly',
    kind: 'exact',
    target,
    value: exact.values[target]!,
    steps,
    citations: [],
    missing: [],
    alternatives: [],
    errors: [],
    warnings: [],
  }
}

function unreachableMessage(
  supplied: Quantity[],
  target: Quantity,
): string {
  const candidates = AUXILIARY_QUANTITIES.filter((candidate) => {
    if (candidate === target || supplied.includes(candidate)) return false
    if (candidate === 'smd') {
      // An SMD only helps if a method can seed its way to the target.
      return APPROX_METHODS.some((method) => {
        const closure = symbolicClosure([...supplied, method.seeds])
        return (
          closure.has(target) &&
          inverseNeeds(method).every((id) => symbolicClosure(supplied).has(id))
        )
      })
    }
    return symbolicClosure([...supplied, candidate]).has(target)
  })

  const head = `${listQuantities(supplied, 'and') || 'No input'} alone does not determine ${QUANTITIES[target].short}`
  return candidates.length > 0
    ? `${head}. Add ${listQuantities(candidates)}.`
    : `${head}, and nothing else on this page would recover it.`
}

export function solve(known: Values, target: Quantity): Solution {
  const exact = completeExact(known)
  const supplied = suppliedQuantities(known)
  const validSupplied = supplied.filter((id) => exact.values[id] !== undefined)
  const errors: EsError[] = [...exact.errors]
  const warnings = [...exact.warnings]

  const derived: Values = {}
  for (const id of QUANTITY_ORDER) {
    if (exact.values[id] !== undefined) derived[id] = exact.values[id]
  }

  let routes: Route[]
  let message: string | undefined

  // A quantity that is already in hand — supplied or exactly derived — never
  // needs an approximation, whatever the target is.
  if (exact.values[target] !== undefined) {
    routes = [exactRoute(target, exact)]
  } else if (target === 'smd') {
    routes = APPROX_METHODS.map((method) =>
      toSmdRoute(method, validSupplied, exact),
    )
  } else if (exact.values.smd !== undefined) {
    routes = APPROX_METHODS.map((method) =>
      fromSmdRoute(method, target, known, validSupplied, exact),
    )
  } else {
    routes = []
    message = unreachableMessage(validSupplied, target)
  }

  const resolvedValues = routes
    .filter((route) => Number.isFinite(route.value))
    .map((route) => route.value)

  let spread: number | undefined
  if (resolvedValues.length >= 2) {
    const low = Math.min(...resolvedValues)
    const high = Math.max(...resolvedValues)
    spread = high - low
    warnings.push(W.spreadBetweenMethods(low, high))
  }

  return {
    target,
    from: orderQuantities(supplied),
    routes,
    derived,
    resolved: resolvedValues.length > 0,
    spread,
    errors,
    warnings: [...new Set(warnings)],
    message,
  }
}

/**
 * Which routes exist for a set of inputs, decided on ids alone.
 *
 * The picker has to answer "what else do you need?" before any number is
 * typed, so reachability is worked out from the rule graph rather than by
 * probing with sentinel values that might contradict what was entered.
 */
function symbolicRoutes(
  supplied: Quantity[],
  target: Quantity,
): { exact: boolean; approximate: string[] } {
  const closure = symbolicClosure(supplied)
  if (closure.has(target)) return { exact: true, approximate: [] }

  if (target === 'smd') {
    return {
      exact: false,
      approximate: APPROX_METHODS.filter((method) =>
        method.needs.every((id) => closure.has(id)),
      ).map((method) => method.id),
    }
  }

  if (!supplied.includes('smd')) return { exact: false, approximate: [] }

  const base = supplied.filter((id) => id !== 'smd')
  const baseClosure = symbolicClosure(base)
  return {
    exact: false,
    approximate: APPROX_METHODS.filter(
      (method) =>
        inverseNeeds(method).every((id) => baseClosure.has(id)) &&
        // Seeding something already in hand adds nothing, exactly as
        // fromSmdRoute refuses to do at run time.
        !baseClosure.has(method.seeds) &&
        symbolicClosure([...base, method.seeds]).has(target),
    ).map((method) => method.id),
  }
}

/** Every target has at least one route, exact or approximate. */
function reachesAll(supplied: Quantity[], targets: Quantity[]): boolean {
  return targets.every((target) => {
    const routes = symbolicRoutes(supplied, target)
    return routes.exact || routes.approximate.length > 0
  })
}

/** Every target is reachable by algebra alone. */
function reachesAllExactly(supplied: Quantity[], targets: Quantity[]): boolean {
  return targets.every((target) => symbolicRoutes(supplied, target).exact)
}

/**
 * What the input panel should render for one (from → to) pair.
 *
 * Both sides are sets because the picker converts to and from event rates as
 * a pair, and a group is only satisfied when every member of it is reachable.
 *
 * Exact additions win over approximate ones: offering a latent-variable
 * conversion as an equal alternative to algebra would quietly invite the
 * reader to take an assumption they did not need.
 */
export function requiredInputs(
  from: Quantity[],
  to: Quantity[],
): InputRequirement {
  if (reachesAll(from, to)) {
    return { from, to, requiredAnyOf: [], unreachable: false }
  }

  const candidates = AUXILIARY_QUANTITIES.filter(
    (id) => !from.includes(id) && !to.includes(id),
  )
  const exactAdds = candidates.filter((candidate) =>
    reachesAllExactly([...from, candidate], to),
  )
  const requiredAnyOf =
    exactAdds.length > 0
      ? exactAdds
      : candidates.filter((candidate) => reachesAll([...from, candidate], to))

  return {
    from,
    to,
    requiredAnyOf: orderQuantities(requiredAnyOf),
    unreachable: requiredAnyOf.length === 0,
  }
}
