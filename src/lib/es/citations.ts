/**
 * Bibliography. Method cards, the catalogue and the footer all read from
 * here, so a reference is written once and cannot drift between them.
 */

export interface Citation {
  /** Short key, as it appears inside method labels and assumption prose. */
  key: string
  /** Full reference, ready to render. */
  text: string
  /** What the reader is being pointed at — never a claim the paper does not make. */
  note: string
  doi?: string
  pmid?: string
  url: string
}

export const CITATIONS: Record<string, Citation> = {
  'Cox 1970': {
    key: 'Cox 1970',
    text: 'Cox DR. Analysis of Binary Data. London: Methuen; 1970. (2nd ed.: Cox DR, Snell EJ. Chapman & Hall; 1989.)',
    note: 'Source of the logistic-scale conversion with the 1.65 divisor (d_Cox).',
    url: 'https://doi.org/10.1201/9781315137391',
  },
  'Hasselblad 1995': {
    key: 'Hasselblad 1995',
    text: 'Hasselblad V, Hedges LV. Meta-analysis of screening and diagnostic tests. Psychol Bull. 1995;117(1):167–178.',
    note: 'Logistic-scale conversion (Hasselblad & Hedges 1995), popularised for meta-analysis by Chinn 2000.',
    doi: '10.1037/0033-2909.117.1.167',
    pmid: '7870860',
    url: 'https://pubmed.ncbi.nlm.nih.gov/7870860/',
  },
  'Chinn 2000': {
    key: 'Chinn 2000',
    text: 'Chinn S. A simple method for converting an odds ratio to effect size for use in meta-analysis. Stat Med. 2000;19(22):3127–3131.',
    note: 'States the ln(OR) / 1.81 form used here; 1.81 ≈ π/√3, the SD of the standard logistic distribution.',
    doi: '10.1002/1097-0258(20001130)19:22<3127::aid-sim784>3.0.co;2-m',
    pmid: '11113947',
    url: 'https://pubmed.ncbi.nlm.nih.gov/11113947/',
  },
  'Sánchez-Meca 2003': {
    key: 'Sánchez-Meca 2003',
    text: 'Sánchez-Meca J, Marín-Martínez F, Chacón-Moscoso S. Effect-size indices for dichotomized outcomes in meta-analysis. Psychol Methods. 2003;8(4):448–467.',
    note: 'A study comparing seven effect-size indices for dichotomised outcomes, including the probit and logistic conversions used here.',
    doi: '10.1037/1082-989X.8.4.448',
    pmid: '14664682',
    url: 'https://pubmed.ncbi.nlm.nih.gov/14664682/',
  },
}

/** Display order for the reference list: chronological. */
export const CITATION_ORDER = [
  'Cox 1970',
  'Hasselblad 1995',
  'Chinn 2000',
  'Sánchez-Meca 2003',
]

const CITATION_REGEX = new RegExp(
  `(${Object.keys(CITATIONS)
    .map((key) => key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')})`,
  'g',
)

export type Segment = { text: string } | { cite: string }

/**
 * Split a string on known citation keys so components can link them without
 * embedding JSX inside message strings.
 */
export function splitCitations(input: string): Segment[] {
  const segments: Segment[] = []
  let cursor = 0
  for (const match of input.matchAll(CITATION_REGEX)) {
    const start = match.index ?? 0
    if (start > cursor) segments.push({ text: input.slice(cursor, start) })
    segments.push({ cite: match[1] })
    cursor = start + match[1].length
  }
  if (cursor < input.length) segments.push({ text: input.slice(cursor) })
  return segments
}
