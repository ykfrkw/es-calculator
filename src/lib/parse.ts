/** Parse a form field into a finite number, or undefined while empty/invalid. */
export function parseNumeric(value: string): number | undefined {
  if (value.trim() === '') return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}
