// Ordered so that neighbouring colors are easy to tell apart, since new
// activities take the first unused one.
export const PALETTE: { name: string; value: string }[] = [
  { name: 'Clay', value: '#C2694F' },
  { name: 'Ochre', value: '#D29B3F' },
  { name: 'Sage', value: '#8BA47D' },
  { name: 'Dusty blue', value: '#7396B8' },
  { name: 'Plum', value: '#8E6384' },
  { name: 'Teal', value: '#5E9A94' },
  { name: 'Rose', value: '#CC8A94' },
  { name: 'Slate', value: '#56708A' },
  { name: 'Moss', value: '#5F7F5B' },
  { name: 'Sand', value: '#B79A78' },
]

export const FALLBACK_COLOR = '#A39A8E'

/** The first palette color not already in use, so new activities look distinct. */
export function nextColor(used: string[]): string {
  const set = new Set(used.map((c) => c.toUpperCase()))
  return (PALETTE.find((p) => !set.has(p.value.toUpperCase())) ?? PALETTE[used.length % PALETTE.length]).value
}
