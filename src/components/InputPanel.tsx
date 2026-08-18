import { NumberField } from '@/components/NumberField'
import { QUANTITIES, listQuantities } from '@/lib/es/quantities'
import type { ValueDraft } from '@/lib/es/deeplink'
import type { InputRequirement, Quantity, RateUnit } from '@/lib/es/types'
import { cn } from '@/lib/utils'

export interface InputPanelProps {
  requirement: InputRequirement
  values: ValueDraft
  rateUnit: RateUnit
  /** True once at least one member of the required group holds a number. */
  satisfied: boolean
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
      ? meta.hint.replace(
          'Strictly between 0 and 1.',
          'Strictly between 0 and 100.',
        )
      : meta.hint,
  }
}

function FieldGrid({
  ids,
  prefix,
  values,
  rateUnit,
  onChange,
}: {
  ids: Quantity[]
  prefix: string
  values: ValueDraft
  rateUnit: RateUnit
  onChange: (id: Quantity, value: string) => void
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {ids.map((id) => {
        const copy = fieldCopy(id, rateUnit)
        return (
          <NumberField
            key={id}
            id={`${prefix}-${id}`}
            label={copy.label}
            value={values[id] ?? ''}
            onChange={(next) => onChange(id, next)}
            placeholder={copy.placeholder}
            hint={copy.hint}
          />
        )
      })}
    </div>
  )
}

export function InputPanel({
  requirement,
  values,
  rateUnit,
  satisfied,
  onChange,
}: InputPanelProps) {
  const { from, requiredAnyOf, optional } = requirement
  const anyOne = requiredAnyOf.length > 1

  return (
    <div className="space-y-4">
      <FieldGrid
        ids={[from]}
        prefix="from"
        values={values}
        rateUnit={rateUnit}
        onChange={onChange}
      />

      {requiredAnyOf.length > 0 && (
        <div
          className={cn(
            'space-y-3 rounded-md border p-3',
            // Solid and emphasised while unmet; once one field holds a number
            // the block recedes rather than shouting at a satisfied reader.
            satisfied ? 'opacity-80' : 'border-[hsl(var(--foreground))]/40',
          )}
        >
          <p className="text-xs font-medium">
            {anyOne
              ? 'Also needed — fill in any one of these'
              : `Also needed — ${QUANTITIES[requiredAnyOf[0]].short}`}
          </p>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            {anyOne
              ? `${QUANTITIES[from].short} on its own does not fix ${QUANTITIES[requirement.to].short}. Any one of ${listQuantities(requiredAnyOf)} completes it — the others are then worked out for you.`
              : `${QUANTITIES[from].short} on its own does not fix ${QUANTITIES[requirement.to].short}. ${QUANTITIES[requiredAnyOf[0]].short} is the missing piece.`}
          </p>
          <FieldGrid
            ids={requiredAnyOf}
            prefix="required"
            values={values}
            rateUnit={rateUnit}
            onChange={onChange}
          />
        </div>
      )}

      {optional.length > 0 && (
        <div className="space-y-3 rounded-md border border-dashed p-3">
          <p className="text-xs font-medium">
            Optional — adds the probit method
          </p>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            The probit index needs the absolute event rates. Fill in any one of
            these and it will resolve alongside the logistic conversions.
          </p>
          <FieldGrid
            ids={optional}
            prefix="optional"
            values={values}
            rateUnit={rateUnit}
            onChange={onChange}
          />
        </div>
      )}
    </div>
  )
}
