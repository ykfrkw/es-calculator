import { CITATIONS, splitCitations } from '@/lib/es/citations'

/** Render prose with known citation keys turned into links. */
export function CitationText({ text }: { text: string }) {
  return (
    <>
      {splitCitations(text).map((segment, index) =>
        'cite' in segment ? (
          <a
            key={index}
            href={CITATIONS[segment.cite].url}
            target="_blank"
            rel="noreferrer"
            className="underline-offset-2 hover:underline"
            title={`Open ${segment.cite} in a new tab`}
          >
            {segment.cite}
          </a>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </>
  )
}
