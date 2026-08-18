import { RouteCard } from '@/components/RouteCard'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { fmtNumber } from '@/lib/es/format'
import { QUANTITIES } from '@/lib/es/quantities'
import type { Solution } from '@/lib/es/types'

export function RouteList({ solution }: { solution: Solution }) {
  const approximate = solution.routes.filter(
    (route) => route.kind === 'approximate' && Number.isFinite(route.value),
  )

  if (solution.routes.length === 0) {
    return (
      <Alert>
        <AlertDescription>
          {solution.message ??
            `Enter the inputs above to compute ${QUANTITIES[solution.target].short}.`}
        </AlertDescription>
      </Alert>
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
