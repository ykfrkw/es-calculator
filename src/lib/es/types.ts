/** The five quantities this tool converts between. */
export type Quantity = 'cer' | 'eer' | 'rr' | 'or' | 'smd'

/** A partially filled set of quantities. Absent means "not supplied". */
export type Values = Partial<Record<Quantity, number>>

/** Exact algebra vs. a latent-variable approximation. */
export type Kind = 'exact' | 'approximate'

/** How rate inputs are typed in the UI. */
export type RateUnit = 'proportion' | 'percent'

/** A refusal to compute, tied to whatever caused it. */
export interface EsError {
  /** The quantity that could not be produced, when the failure has one. */
  quantity?: Quantity
  /** The rule or method that refused. */
  source?: string
  message: string
}

/** One derivation, ready to be printed as a line of working. */
export interface Step {
  /** Rule id (exact) or method id (approximate). */
  source: string
  kind: Kind
  produces: Quantity
  /** Generic form, e.g. "RR = EER / CER". */
  formula: string
  /** The same formula with the actual numbers in it. */
  substituted: string
  /** NaN when the step failed. */
  value: number
}

/** The outcome of a single rule or method application. */
export interface Derivation {
  value: number
  substituted: string
  error?: string
  warnings?: string[]
}

/** One way of getting from the supplied inputs to the target. */
export interface Route {
  /** 'exact' for the algebraic route, otherwise the method id. */
  id: string
  label: string
  kind: Kind
  target: Quantity
  /** NaN when the route is blocked or failed. */
  value: number
  steps: Step[]
  /** Latent-variable assumption. Present on approximate routes only. */
  assumption?: string
  /** Citation keys resolvable through lib/es/citations. */
  citations: string[]
  /** The smallest set of extra inputs that would unblock this route. */
  missing: Quantity[]
  /** Other single inputs that would unblock it just as well. */
  alternatives: Quantity[]
  /** Prose explaining what is missing and why the route needs it. */
  blockedReason?: string
  errors: string[]
  warnings: string[]
}

/** Everything the UI needs for one (inputs, target) pair. */
export interface Solution {
  target: Quantity
  /** Quantities actually supplied, in canonical order. */
  from: Quantity[]
  routes: Route[]
  /** Every quantity reachable by exact algebra from the inputs. */
  derived: Values
  /** True when at least one route produced a finite value. */
  resolved: boolean
  /** Spread between the extreme approximate estimates, when ≥ 2 resolved. */
  spread?: number
  errors: EsError[]
  warnings: string[]
  /** Why nothing could be computed, when nothing could be. */
  message?: string
}

/** What the input panel should render for a given picker state. */
export interface InputRequirement {
  required: Quantity[]
  /** Not required, but would unblock at least one otherwise-blocked route. */
  optional: Quantity[]
}
