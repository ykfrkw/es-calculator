import { useEffect, useMemo, useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { SegmentedControl } from '@/components/SegmentedControl'
import { ConversionCatalog } from '@/components/ConversionCatalog'
import { DerivedStrip } from '@/components/DerivedStrip'
import { InputPanel } from '@/components/InputPanel'
import { QuantityPicker } from '@/components/QuantityPicker'
import { ReferenceList } from '@/components/ReferenceList'
import { RouteList } from '@/components/RouteList'
import { parseNumeric } from '@/lib/parse'
import {
  DEFAULT_STATE,
  buildDeeplink,
  parseDeeplink,
  type DeeplinkState,
} from '@/lib/es/deeplink'
import { QUANTITIES, QUANTITY_ORDER, listQuantities } from '@/lib/es/quantities'
import { catalogEntry } from '@/lib/es/registry'
import { requiredInputs, solve } from '@/lib/es/solve'
import { W } from '@/lib/es/warnings'
import type {
  InputRequirement,
  Quantity,
  RateUnit,
  Values,
} from '@/lib/es/types'

/** Long enough that typing a number does not write ten history entries. */
const URL_WRITE_DELAY_MS = 300

/** Rates are stored internally as proportions whatever the toggle says. */
function toProportion(value: number, id: Quantity, rateUnit: RateUnit): number {
  if (QUANTITIES[id].domain !== 'rate' || rateUnit === 'proportion') return value
  return value / 100
}

/** The fields the form is currently showing, in the order it shows them. */
function activeFields(requirement: InputRequirement): Quantity[] {
  return [
    requirement.from,
    ...requirement.requiredAnyOf,
    ...requirement.optional,
  ]
}

function numericValues(
  state: DeeplinkState,
  requirement: InputRequirement,
  rateUnit: RateUnit,
): Values {
  const values: Values = {}
  for (const id of activeFields(requirement)) {
    const parsed = parseNumeric(state.values[id] ?? '')
    if (parsed === undefined) continue
    values[id] = toProportion(parsed, id, rateUnit)
  }
  return values
}

/** What the result area says while the conversion cannot yet be attempted. */
function pendingNote(
  requirement: InputRequirement,
  hasAnyInput: boolean,
): string {
  const target = QUANTITIES[requirement.to].short
  if (!hasAnyInput) {
    return `Enter ${QUANTITIES[requirement.from].short} above to compute ${target}.`
  }
  if (requirement.requiredAnyOf.length === 0) {
    return `Check the values above — ${target} could not be computed from them.`
  }
  return requirement.requiredAnyOf.length === 1
    ? `Needs ${QUANTITIES[requirement.requiredAnyOf[0]].short} as well — ${QUANTITIES[requirement.from].short} on its own does not fix ${target}.`
    : `Needs ${listQuantities(requirement.requiredAnyOf)} as well — any one of them is enough to fix ${target}.`
}

function App() {
  // Parsed once: re-reading location on every render would fight the writer.
  const [state, setState] = useState<DeeplinkState>(() =>
    typeof window === 'undefined'
      ? DEFAULT_STATE
      : parseDeeplink(window.location.search),
  )
  const [rateUnit, setRateUnit] = useState<RateUnit>('proportion')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const timer = setTimeout(() => {
      // replaceState, never pushState: inside an iframe a pushed entry hijacks
      // the reader's Back button on the surrounding article.
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${buildDeeplink(state)}`,
      )
    }, URL_WRITE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [state])

  const requirement = useMemo(
    () => requiredInputs(state.from, state.to),
    [state.from, state.to],
  )

  const known = useMemo(
    () => numericValues(state, requirement, rateUnit),
    [state, requirement, rateUnit],
  )

  const solution = useMemo(() => solve(known, state.to), [known, state.to])

  // Picking a quantity that is already on the other side would leave the
  // pair invalid, so the other side steps aside to the next free option.
  const setFrom = (from: Quantity): void => {
    setState((current) => ({
      ...current,
      from,
      to:
        current.to === from
          ? QUANTITY_ORDER.find((candidate) => candidate !== from)!
          : current.to,
    }))
  }

  const setTo = (to: Quantity): void => {
    setState((current) => ({
      ...current,
      to,
      from:
        current.from === to
          ? QUANTITY_ORDER.find((candidate) => candidate !== to)!
          : current.from,
    }))
  }

  const setValue = (id: Quantity, value: string): void =>
    setState((current) => ({
      ...current,
      values: { ...current.values, [id]: value },
    }))

  const recipe = `${QUANTITIES[state.from].short} → ${QUANTITIES[state.to].short}`
  // The badge describes the conversion itself, not whether the reader has
  // finished typing — an unfilled form does not make exact algebra unavailable.
  const conversionKind = catalogEntry(state.from, state.to)?.kind
  const requirementSatisfied =
    requirement.requiredAnyOf.length === 0 ||
    requirement.requiredAnyOf.some((id) => known[id] !== undefined)
  const hasAnyInput = Object.keys(known).length > 0

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 text-[hsl(var(--foreground))]">
      <Card>
        <CardHeader>
          <CardTitle>Effect Size Converter</CardTitle>
          <CardDescription>
            Convert between control and experimental event rates, the risk
            ratio, the odds ratio and the standardised mean difference. Rate and
            ratio conversions are exact algebra; anything crossing to or from an
            SMD rests on a latent-variable assumption, stated on each card.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <QuantityPicker
              label="Convert from"
              value={state.from}
              disabled={state.to}
              onChange={setFrom}
              caption="One quantity in. Anything else the conversion needs is asked for below."
            />
            <QuantityPicker
              label="Convert to"
              value={state.to}
              disabled={state.from}
              onChange={setTo}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-[hsl(var(--secondary))] px-3 py-1.5 font-mono text-sm text-[hsl(var(--secondary-foreground))]">
              {recipe}
            </span>
            <span
              className={
                conversionKind === 'exact'
                  ? 'rounded-md bg-[hsl(var(--secondary))] px-2 py-1 text-xs font-medium text-[hsl(var(--secondary-foreground))]'
                  : 'rounded-md border border-amber-500/50 px-2 py-1 text-xs font-medium text-amber-700 dark:text-amber-300'
              }
            >
              {conversionKind === 'exact'
                ? 'Exact'
                : conversionKind === 'approximate'
                  ? 'Approximate'
                  : 'Not available'}
            </span>
          </div>

          <SegmentedControl
            label="Rates entered as"
            value={rateUnit}
            onChange={setRateUnit}
            options={[
              { value: 'proportion', label: 'proportion' },
              { value: 'percent', label: '%' },
            ]}
            caption={
              rateUnit === 'percent'
                ? 'CER and EER are read as percentages and divided by 100 before use.'
                : 'CER and EER are read as proportions between 0 and 1.'
            }
          />

          <InputPanel
            requirement={requirement}
            values={state.values}
            rateUnit={rateUnit}
            satisfied={requirementSatisfied}
            onChange={setValue}
          />

          {solution.errors.length > 0 && (
            <Alert variant="destructive">
              <AlertDescription>
                <ul className="list-disc space-y-1 pl-4">
                  {solution.errors.map((error, index) => (
                    <li key={index}>{error.message}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <RouteList
            solution={solution}
            pendingNote={pendingNote(requirement, hasAnyInput)}
          />

          <DerivedStrip
            derived={solution.derived}
            target={solution.target}
            supplied={solution.from}
          />

          <Separator />

          <div className="space-y-3 text-xs text-[hsl(var(--muted-foreground))]">
            <p>
              <span className="font-medium text-[hsl(var(--foreground))]">
                Sign convention.{' '}
              </span>
              {W.signConvention}
            </p>
            <p>
              <span className="font-medium text-[hsl(var(--foreground))]">
                Point estimates only.{' '}
              </span>
              {W.pointEstimatesOnly}
            </p>
          </div>

          <details className="text-sm">
            <summary className="cursor-pointer font-medium">
              Every conversion this tool can do
            </summary>
            <div className="mt-3">
              <ConversionCatalog />
            </div>
          </details>

          <Separator />

          <footer className="space-y-2 text-xs text-[hsl(var(--muted-foreground))]">
            <p className="font-medium text-[hsl(var(--foreground))]">
              References
            </p>
            <ReferenceList />
            <p className="pt-2">
              Conversions across the dichotomous/continuous boundary are
              approximations. Prefer the effect measure the trial actually
              reported where you have it.
            </p>
          </footer>
        </CardContent>
      </Card>
    </div>
  )
}

export default App
