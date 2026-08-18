import { cn } from '@/lib/utils'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
}

export interface SegmentedControlProps<T extends string> {
  label: string
  value: T
  options: SegmentedOption<T>[]
  onChange: (value: T) => void
  caption?: string
}

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  caption,
}: SegmentedControlProps<T>) {
  const move = (delta: number) => {
    const i = options.findIndex((o) => o.value === value)
    onChange(options[(i + delta + options.length) % options.length].value)
  }

  return (
    <div className="space-y-1.5">
      <div className="text-sm font-medium leading-none">{label}</div>
      <div
        role="radiogroup"
        aria-label={label}
        className="inline-flex rounded-md border bg-[hsl(var(--muted))] p-0.5"
      >
        {options.map((o) => {
          const selected = o.value === value
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(o.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                  e.preventDefault()
                  move(1)
                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                  e.preventDefault()
                  move(-1)
                }
              }}
              className={cn(
                'rounded-[0.3rem] px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]',
                selected
                  ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                  : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]',
              )}
            >
              {o.label}
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
