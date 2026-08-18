import { NumberField } from '@/components/NumberField'
import { QUANTITIES } from '@/lib/es/quantities'
import type { ValueDraft } from '@/lib/es/deeplink'
import type { InputRequirement, Quantity, RateUnit } from '@/lib/es/types'

export interface InputPanelProps {
  requirement: InputRequirement
  values: ValueDraft
  rateUnit: RateUnit
  onChange: (id: Quantity, value: string) => void
}

/** Percentages need a different placeholder and hint from proportions. */
function fieldCopy(
  id: Quantity,
  rateUnit: RateUnit,
): { label: string; placeholder: string; hint: string } {
  const meta = QUANTITIES[id]
  const asPercent = meta.domain === 'rate' && rateUnit === 'percent'
  return {
    label: `${meta.long} (${meta.short})`,
    placeholder: asPercent
      ? `e.g. ${id === 'cer' ? '20' : '35'}`
      : meta.placeholder,
    hint: asPercent
      ? meta.hint.replace('Strictly between 0 and 1.', 'Strictly between 0 and 100.')
      : meta.hint,
  }
}

export function InputPanel({
  requirement,
  values,
  rateUnit,
  onChange,
}: InputPanelProps) {
  const { required, optional } = requirement

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {required.map((id) => {
          const copy = fieldCopy(id, rateUnit)
          return (
            <NumberField
              key={id}
              id={`field-${id}`}
              label={copy.label}
              value={values[id] ?? ''}
              onChange={(next) => onChange(id, next)}
              placeholder={copy.placeholder}
              hint={copy.hint}
            />
          )
        })}
      </div>

      {optional.length > 0 && (
        <div className="space-y-3 rounded-md border border-dashed p-3">
          <p className="text-xs font-medium">
            Optional — adds the probit method
          </p>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            The probit index needs the absolute event rates. Fill in any one of
            these and it will resolve alongside the logistic conversions.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {optional.map((id) => {
              const copy = fieldCopy(id, rateUnit)
              return (
                <NumberField
                  key={id}
                  id={`optional-${id}`}
                  label={copy.label}
                  value={values[id] ?? ''}
                  onChange={(next) => onChange(id, next)}
                  placeholder={copy.placeholder}
                  hint={copy.hint}
                />
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
