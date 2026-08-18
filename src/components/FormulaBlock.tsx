import { cn } from '@/lib/utils'

export function FormulaBlock({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'whitespace-pre-line rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 py-2 font-mono text-sm leading-relaxed text-[hsl(var(--foreground))]',
        className,
      )}
    >
      {children}
    </div>
  )
}
