import { fmtNumber } from '@/lib/es/format'
import { QUANTITIES, QUANTITY_ORDER } from '@/lib/es/quantities'
import type { Quantity, Values } from '@/lib/es/types'

export interface DerivedStripProps {
  derived: Values
  /** Shown in the result cards instead, so they are skipped here. */
  targets: Quantity[]
  /** Typed by the reader, so not a derivation. */
  supplied: Quantity[]
}

/**
 * Everything else the inputs already determine. Picking one target should not
 * hide the other quantities the same two numbers pin down.
 */
export function DerivedStrip({ derived, targets, supplied }: DerivedStripProps) {
  const shown = QUANTITY_ORDER.filter(
    (id) =>
      !targets.includes(id) &&
      !supplied.includes(id) &&
      derived[id] !== undefined,
  )
  if (shown.length === 0) return null

  return (
    <div className="space-y-1.5">
      <div className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
        Also determined by these inputs
      </div>
      <div className="flex flex-wrap gap-2">
        {shown.map((id) => (
          <div
            key={id}
            className="rounded-md bg-[hsl(var(--secondary))] px-3 py-1.5 text-sm text-[hsl(var(--secondary-foreground))]"
            title={QUANTITIES[id].long}
          >
            <span className="font-medium">{QUANTITIES[id].short}</span>{' '}
            <span className="font-mono tabular-nums">
              {fmtNumber(derived[id])}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
