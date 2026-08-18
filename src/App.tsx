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
import { QUANTITIES } from '@/lib/es/quantities'
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

function numericValues(
  state: DeeplinkState,
  requirement: InputRequirement,
  rateUnit: RateUnit,
): Values {
  const values: Values = {}
  for (const id of [...requirement.required, ...requirement.optional]) {
    const parsed = parseNumeric(state.values[id] ?? '')
    if (parsed === undefined) continue
    values[id] = toProportion(parsed, id, rateUnit)
  }
  return values
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

  const solution = useMemo(
    () => solve(numericValues(state, requirement, rateUnit), state.to),
    [state, requirement, rateUnit],
  )

  const setFrom = (from: Quantity[]): void => {
    setState((current) => {
      const to = from.includes(current.to)
        ? (['smd', 'or', 'rr', 'eer', 'cer'] as Quantity[]).find(
            (candidate) => !from.includes(candidate),
          )!
        : current.to
      return { ...current, from, to }
    })
  }

  const setTo = (to: Quantity): void =>
    setState((current) => ({ ...current, to }))

  const setValue = (id: Quantity, value: string): void =>
    setState((current) => ({
      ...current,
      values: { ...current.values, [id]: value },
    }))

  const recipe = `${state.from
    .map((id) => QUANTITIES[id].short)
    .join(' + ')} → ${QUANTITIES[state.to].short}`
  const isExact = solution.routes.every((route) => route.kind === 'exact')

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
          <QuantityPicker
            from={state.from}
            to={state.to}
            onFromChange={setFrom}
            onToChange={setTo}
          />

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-[hsl(var(--secondary))] px-3 py-1.5 font-mono text-sm text-[hsl(var(--secondary-foreground))]">
              {recipe}
            </span>
            <span
              className={
                isExact && solution.routes.length > 0
                  ? 'rounded-md bg-[hsl(var(--secondary))] px-2 py-1 text-xs font-medium text-[hsl(var(--secondary-foreground))]'
                  : 'rounded-md border border-amber-500/50 px-2 py-1 text-xs font-medium text-amber-700 dark:text-amber-300'
              }
            >
              {solution.routes.length === 0
                ? 'Not available'
                : isExact
                  ? 'Exact'
                  : 'Approximate'}
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

          <RouteList solution={solution} />

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
