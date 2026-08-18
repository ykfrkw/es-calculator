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

/** Quantities the reader can type. SMD is included; it is just never derived. */
const INPUT_QUANTITIES = QUANTITY_ORDER

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
  return INPUT_QUANTITIES.filter((candidate) => {
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

  const seeding = method.fromSmd(values.smd!, values)
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
  const candidates = INPUT_QUANTITIES.filter((candidate) => {
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
 * What the input panel should render: the quantities the reader picked, plus
 * the ones that would light up a route that is currently blocked.
 */
export function requiredInputs(
  from: Quantity[],
  target: Quantity,
): InputRequirement {
  const required = orderQuantities(from.filter((id) => id !== target))
  const closure = symbolicClosure(required)

  const wanted = new Set<Quantity>()
  for (const method of APPROX_METHODS) {
    const needs =
      target === 'smd'
        ? method.needs
        : required.includes('smd')
          ? inverseNeeds(method)
          : []
    if (needs.length === 0) continue
    if (needs.every((id) => closure.has(id))) continue
    for (const candidate of unblockers(required, needs)) {
      if (candidate !== target) wanted.add(candidate)
    }
  }

  return { required, optional: orderQuantities([...wanted]) }
}
