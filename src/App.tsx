import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { SegmentedControl } from '@/components/SegmentedControl'
import { ConversionCatalog } from '@/components/ConversionCatalog'
import { ConversionPicker } from '@/components/ConversionPicker'
import { DerivedStrip } from '@/components/DerivedStrip'
import { InputPanel } from '@/components/InputPanel'
import { ReferenceList } from '@/components/ReferenceList'
import { RouteList } from '@/components/RouteList'
import { parseNumeric } from '@/lib/parse'
import {
  DEFAULT_STATE,
  buildDeeplink,
  parseDeeplink,
  type DeeplinkState,
} from '@/lib/es/deeplink'
import { QUANTITIES, listQuantities } from '@/lib/es/quantities'
import { catalogEntry } from '@/lib/es/registry'
import {
  SELECTIONS,
  membersOf,
  selectSide,
  type Selection,
} from '@/lib/es/selections'
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
  return [...requirement.from, ...requirement.requiredAnyOf]
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
  target: Quantity,
  hasAnyInput: boolean,
): string {
  const targetLabel = QUANTITIES[target].short
  if (!hasAnyInput) {
    return `Enter ${listQuantities(requirement.from, 'and')} above to compute ${targetLabel}.`
  }
  if (requirement.requiredAnyOf.length === 0) {
    return `Check the values above — ${targetLabel} could not be computed from them.`
  }
  const fromLabel = listQuantities(requirement.from, 'and')
  return requirement.requiredAnyOf.length === 1
    ? `Needs ${QUANTITIES[requirement.requiredAnyOf[0]].short} as well — ${fromLabel} on its own does not fix ${targetLabel}.`
    : `Needs ${listQuantities(requirement.requiredAnyOf)} as well — any one of them is enough to fix ${targetLabel}.`
}

/** Which half of the pair the reader still has to choose. */
function missingSideNote(from: Selection | null): string {
  return from === null
    ? 'Pick the measure you are converting from.'
    : 'Pick the measure you are converting to.'
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

  const { from, to } = state

  const targets = useMemo(() => (to === null ? [] : membersOf(to)), [to])

  // Undefined while a side is empty: there is no conversion to describe, so
  // nothing downstream may run and produce a NaN to render.
  const requirement = useMemo(
    () =>
      from === null || to === null
        ? undefined
        : requiredInputs(membersOf(from), targets),
    [from, to, targets],
  )

  const known = useMemo(
    () =>
      requirement === undefined
        ? {}
        : numericValues(state, requirement, rateUnit),
    [state, requirement, rateUnit],
  )

  const solutions = useMemo(
    () =>
      requirement === undefined
        ? []
        : targets.map((target) => solve(known, target)),
    [known, requirement, targets],
  )

  const pickSide = (side: 'from' | 'to', picked: Selection): void =>
    setState((current) => ({ ...current, ...selectSide(current, side, picked) }))

  const setValue = (id: Quantity, value: string): void =>
    setState((current) => ({
      ...current,
      values: { ...current.values, [id]: value },
    }))

  // The badge describes the conversion itself, not whether the reader has
  // finished typing — an unfilled form does not make exact algebra unavailable.
  const conversionKind =
    from === null || to === null ? undefined : catalogEntry(from, to)?.kind
  const requirementSatisfied =
    requirement === undefined ||
    requirement.requiredAnyOf.length === 0 ||
    requirement.requiredAnyOf.some((id) => known[id] !== undefined)
  const hasAnyInput = Object.keys(known).length > 0
  // Input errors depend on the values alone, so every target reports the same
  // list; printing one per target would show the reader each error twice.
  const primary = solutions[0]
  const inputErrors = primary === undefined ? [] : primary.errors

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 text-[hsl(var(--foreground))]">
      <Card>
        <CardHeader>
          <CardTitle>Effect Size Converter</CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <ConversionPicker
              label="Convert from"
              value={from}
              takenByOtherSide={to}
              onChange={(picked) => pickSide('from', picked)}
              caption="One measure in. Anything else the conversion needs is asked for below."
            />
            <ConversionPicker
              label="Convert to"
              value={to}
              takenByOtherSide={from}
              onChange={(picked) => pickSide('to', picked)}
            />
          </div>

          {from === null || to === null ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              {missingSideNote(from)}
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-[hsl(var(--secondary))] px-3 py-1.5 font-mono text-sm text-[hsl(var(--secondary-foreground))]">
                {`${SELECTIONS[from].short} → ${SELECTIONS[to].short}`}
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
          )}

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

          {requirement !== undefined && (
            <>
              <InputPanel
                requirement={requirement}
                values={state.values}
                rateUnit={rateUnit}
                satisfied={requirementSatisfied}
                onChange={setValue}
              />

              {inputErrors.length > 0 && (
                <Alert variant="destructive">
                  <AlertDescription>
                    <ul className="list-disc space-y-1 pl-4">
                      {inputErrors.map((error, index) => (
                        <li key={index}>{error.message}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {solutions.map((solution) => (
                <RouteList
                  key={solution.target}
                  solution={solution}
                  pendingNote={pendingNote(
                    requirement,
                    solution.target,
                    hasAnyInput,
                  )}
                />
              ))}

              {primary !== undefined && (
                <DerivedStrip
                  derived={primary.derived}
                  targets={targets}
                  supplied={primary.from}
                />
              )}
            </>
          )}

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
