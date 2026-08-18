import { CitationText } from '@/components/CitationText'
import { FormulaBlock } from '@/components/FormulaBlock'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { QUANTITIES } from '@/lib/es/quantities'
import { fmtNumber, fmtPercent } from '@/lib/es/format'
import type { Route } from '@/lib/es/types'
import { cn } from '@/lib/utils'

function KindBadge({ kind }: { kind: Route['kind'] }) {
  return (
    <span
      className={cn(
        'rounded-md px-2 py-1 text-xs font-medium',
        kind === 'exact'
          ? 'bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]'
          : 'border border-amber-500/50 text-amber-700 dark:text-amber-300',
      )}
    >
      {kind === 'exact' ? 'Exact' : 'Approximate'}
    </span>
  )
}

export function RouteCard({ route }: { route: Route }) {
  const blocked = route.missing.length > 0
  const failed = !blocked && Number.isNaN(route.value)
  const meta = QUANTITIES[route.target]
  const finalStep = route.steps[route.steps.length - 1]

  return (
    <div
      className={cn(
        'space-y-3 rounded-lg border p-4',
        blocked && 'border-dashed opacity-70',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold">
          <CitationText text={route.label} />
        </div>
        <KindBadge kind={route.kind} />
      </div>

      {blocked ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          {route.blockedReason}
        </p>
      ) : failed ? (
        <Alert variant="destructive">
          <AlertDescription>
            {route.errors[0] ?? `${meta.short} could not be computed.`}
          </AlertDescription>
        </Alert>
      ) : (
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <div>
            <div className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
              {meta.short}
            </div>
            <div className="font-mono text-4xl font-semibold tabular-nums">
              {fmtNumber(route.value)}
            </div>
          </div>
          {meta.domain === 'rate' && (
            <div className="font-mono text-sm text-[hsl(var(--muted-foreground))] tabular-nums">
              = {fmtPercent(route.value)}
            </div>
          )}
        </div>
      )}

      {!blocked && finalStep && (
        <FormulaBlock>{finalStep.substituted}</FormulaBlock>
      )}

      {route.steps.length > 1 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-[hsl(var(--muted-foreground))]">
            Show working ({route.steps.length} steps)
          </summary>
          <ol className="mt-2 space-y-2">
            {route.steps.map((step, index) => (
              <li key={index} className="space-y-1">
                <div className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                  {index + 1}. {step.kind === 'exact' ? 'Exact' : 'Approximate'}{' '}
                  — {step.formula}
                </div>
                <FormulaBlock>{step.substituted}</FormulaBlock>
              </li>
            ))}
          </ol>
        </details>
      )}

      {route.assumption && (
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          <span className="font-medium">Assumes: </span>
          {route.assumption}
        </p>
      )}

      {route.warnings.length > 0 && !blocked && (
        <ul className="list-disc space-y-1 pl-4 text-xs text-[hsl(var(--muted-foreground))]">
          {route.warnings.map((warning, index) => (
            <li key={index}>{warning}</li>
          ))}
        </ul>
      )}

      {route.citations.length > 0 && (
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          {route.citations.map((key, index) => (
            <span key={key}>
              {index > 0 && '; '}
              <CitationText text={key} />
            </span>
          ))}
        </p>
      )}
    </div>
  )
}
