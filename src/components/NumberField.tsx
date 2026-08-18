import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export interface NumberFieldProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  step?: string
  min?: string
  hint?: string
}

export function NumberField({
  id,
  label,
  value,
  onChange,
  placeholder,
  step = 'any',
  min,
  hint,
}: NumberFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && (
        <p className="text-xs text-[hsl(var(--muted-foreground))]">{hint}</p>
      )}
    </div>
  )
}
