import { QUANTITIES, QUANTITY_ORDER } from '@/lib/es/quantities'
import type { Quantity } from '@/lib/es/types'
import { cn } from '@/lib/utils'

export interface QuantityPickerProps {
  from: Quantity[]
  to: Quantity
  onFromChange: (from: Quantity[]) => void
  onToChange: (to: Quantity) => void
}

export function QuantityPicker({
  from,
  to,
  onFromChange,
  onToChange,
}: QuantityPickerProps) {
  const toggleFrom = (id: Quantity): void => {
    const next = from.includes(id)
      ? from.filter((candidate) => candidate !== id)
      : [...from, id]
    // The last chip cannot be removed: an empty "from" has nothing to convert.
    if (next.length === 0) return
    onFromChange(QUANTITY_ORDER.filter((candidate) => next.includes(candidate)))
  }

  const selectableTargets = QUANTITY_ORDER.filter((id) => !from.includes(id))

  const moveTarget = (delta: number): void => {
    if (selectableTargets.length === 0) return
    const index = selectableTargets.indexOf(to)
    const next =
      (index + delta + selectableTargets.length) % selectableTargets.length
    onToChange(selectableTargets[next])
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <div className="text-sm font-medium leading-none">Convert from</div>
        <div
          role="group"
          aria-label="Quantities you have"
          className="flex flex-wrap gap-1.5"
        >
          {QUANTITY_ORDER.map((id) => {
            const selected = from.includes(id)
            return (
              <button
                key={id}
                type="button"
                aria-pressed={selected}
                onClick={() => toggleFrom(id)}
                title={QUANTITIES[id].long}
                className={cn(
                  'rounded-md border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]',
                  selected
                    ? 'border-transparent bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                    : 'bg-[hsl(var(--background))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]',
                )}
              >
                {QUANTITIES[id].short}
              </button>
            )
          })}
        </div>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          Pick everything the paper reports. Two of CER, EER, RR and OR pin down
          all four.
        </p>
      </div>

      <div className="space-y-1.5">
        <div className="text-sm font-medium leading-none">Convert to</div>
        <div
          role="radiogroup"
          aria-label="Quantity you want"
          className="flex flex-wrap gap-1.5"
        >
          {QUANTITY_ORDER.map((id) => {
            const disabled = from.includes(id)
            const selected = id === to
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={disabled}
                tabIndex={selected ? 0 : -1}
                onClick={() => onToChange(id)}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                    event.preventDefault()
                    moveTarget(1)
                  } else if (
                    event.key === 'ArrowLeft' ||
                    event.key === 'ArrowUp'
                  ) {
                    event.preventDefault()
                    moveTarget(-1)
                  }
                }}
                title={
                  disabled
                    ? `${QUANTITIES[id].short} is already an input`
                    : QUANTITIES[id].long
                }
                className={cn(
                  'rounded-md border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]',
                  disabled && 'cursor-not-allowed opacity-40',
                  selected
                    ? 'border-transparent bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                    : 'bg-[hsl(var(--background))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]',
                )}
              >
                {QUANTITIES[id].short}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
