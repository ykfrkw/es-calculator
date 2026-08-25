import {
  SELECTIONS,
  SELECTION_ORDER,
  type Selection,
} from '@/lib/es/selections'
import { cn } from '@/lib/utils'

export interface ConversionPickerProps {
  label: string
  /** Null while this side is empty, waiting for the reader to choose. */
  value: Selection | null
  /** Held by the other row. Clicking it here moves it across. */
  takenByOtherSide: Selection | null
  onChange: (value: Selection) => void
  caption?: string
}

/**
 * One side of the conversion in, one out. Everything else the conversion
 * needs is prompted for as a field, so the picker never has to express a
 * combination.
 *
 * Every measure stays clickable, including the one the other side holds:
 * swapping the two ends is the commonest thing a reader wants to do, and a
 * disabled button makes it the one thing the picker refuses.
 */
export function ConversionPicker({
  label,
  value,
  takenByOtherSide,
  onChange,
  caption,
}: ConversionPickerProps) {
  // An empty side still needs one stop in the tab order, or the whole group
  // drops out of the keyboard path.
  const focusable = value ?? SELECTION_ORDER[0]

  const move = (delta: number): void => {
    const index = SELECTION_ORDER.indexOf(focusable)
    const count = SELECTION_ORDER.length
    onChange(SELECTION_ORDER[(index + delta + count) % count])
  }

  return (
    <div className="space-y-1.5">
      <div className="text-sm font-medium leading-none">{label}</div>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
        {SELECTION_ORDER.map((id) => {
          const taken = id === takenByOtherSide
          const selected = id === value
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={id === focusable ? 0 : -1}
              onClick={() => onChange(id)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                  event.preventDefault()
                  move(1)
                } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                  event.preventDefault()
                  move(-1)
                }
              }}
              title={
                taken
                  ? `${SELECTIONS[id].short} is on the other side — click to move it here`
                  : SELECTIONS[id].long
              }
              className={cn(
                'rounded-md border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]',
                taken && 'border-dashed opacity-60',
                selected
                  ? 'border-transparent bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                  : 'bg-[hsl(var(--background))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]',
              )}
            >
              {SELECTIONS[id].short}
            </button>
          )
        })}
      </div>
      {caption && (
        <p className="text-xs text-[hsl(var(--muted-foreground))]">{caption}</p>
      )}
    </div>
  )
}
