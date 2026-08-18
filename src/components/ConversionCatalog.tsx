import { QUANTITIES } from '@/lib/es/quantities'
import { CONVERSION_CATALOG } from '@/lib/es/registry'
import type { Quantity } from '@/lib/es/types'

function shortList(ids: Quantity[]): string {
  return ids.map((id) => QUANTITIES[id].short).join(' + ')
}

const METHOD_LABELS: Record<string, string> = {
  exact: 'algebra',
  cox: 'Cox',
  hh: 'Hasselblad–Hedges',
  probit: 'probit',
}

/** Every conversion the engine can actually perform, read off the engine. */
export function ConversionCatalog() {
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[20rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            <th className="py-2 pr-3 font-medium">From</th>
            <th className="py-2 pr-3 font-medium">To</th>
            <th className="py-2 pr-3 font-medium">Kind</th>
            <th className="py-2 font-medium">Routes</th>
          </tr>
        </thead>
        <tbody>
          {CONVERSION_CATALOG.map((entry) => (
            <tr key={`${entry.from.join(',')}-${entry.to}`} className="border-b">
              <td className="whitespace-nowrap py-1.5 pr-3 font-mono">
                {shortList(entry.from)}
              </td>
              <td className="whitespace-nowrap py-1.5 pr-3 font-mono">
                {QUANTITIES[entry.to].short}
              </td>
              <td className="py-1.5 pr-3">
                {entry.kind === 'exact' ? 'Exact' : 'Approximate'}
              </td>
              <td className="py-1.5">
                {entry.routes
                  .map((route) => METHOD_LABELS[route.id] ?? route.id)
                  .join(', ')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
