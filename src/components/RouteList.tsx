import { RouteCard } from '@/components/RouteCard'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { fmtNumber } from '@/lib/es/format'
import { QUANTITIES } from '@/lib/es/quantities'
import type { Solution } from '@/lib/es/types'

export interface RouteListProps {
  solution: Solution
  /** Shown in place of a number while the requirement is still unmet. */
  pendingNote: string
}

export function RouteList({ solution, pendingNote }: RouteListProps) {
  const approximate = solution.routes.filter(
    (route) => route.kind === 'approximate' && Number.isFinite(route.value),
  )

  // Same presentation as a blocked route: the reader is looking at a card
  // that names what is missing, not at an error.
  if (solution.routes.length === 0) {
    return (
      <div className="space-y-3 rounded-lg border border-dashed p-4 opacity-70">
        <div className="text-sm font-semibold">
          {QUANTITIES[solution.target].short}
        </div>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          {pendingNote}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {solution.routes.map((route) => (
        <RouteCard key={route.id} route={route} />
      ))}

      {approximate.length >= 2 && solution.spread !== undefined && (
        <Alert variant="warning">
          <AlertDescription>
            The {approximate.length} methods that resolved span{' '}
            {fmtNumber(Math.min(...approximate.map((route) => route.value)))} to{' '}
            {fmtNumber(Math.max(...approximate.map((route) => route.value)))} — a
            spread of {fmtNumber(solution.spread)}. That gap is the size of the
            modelling assumption, not sampling error. Choose one method in
            advance and report which.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
