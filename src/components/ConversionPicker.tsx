import {
  SELECTIONS,
  SELECTION_ORDER,
  type Selection,
} from '@/lib/es/selections'
import { cn } from '@/lib/utils'

export interface ConversionPickerProps {
  label: string
  value: Selection
  /** Already taken by the other row, so not selectable here. */
  disabled: Selection
  onChange: (value: Selection) => void
  caption?: string
}

/**
 * One side of the conversion in, one out. Everything else the conversion
 * needs is prompted for as a field, so the picker never has to express a
 * combination.
 */
export function ConversionPicker({
  label,
  value,
  disabled,
  onChange,
  caption,
}: ConversionPickerProps) {
  const selectable = SELECTION_ORDER.filter((id) => id !== disabled)

  const move = (delta: number): void => {
    if (selectable.length === 0) return
    const index = selectable.indexOf(value)
    onChange(selectable[(index + delta + selectable.length) % selectable.length])
  }

  return (
    <div className="space-y-1.5">
      <div className="text-sm font-medium leading-none">{label}</div>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
        {SELECTION_ORDER.map((id) => {
          const isDisabled = id === disabled
          const selected = id === value
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={isDisabled}
              tabIndex={selected ? 0 : -1}
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
                isDisabled
                  ? `${SELECTIONS[id].short} is already on the other side`
                  : SELECTIONS[id].long
              }
              className={cn(
                'rounded-md border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]',
                isDisabled && 'cursor-not-allowed opacity-40',
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
