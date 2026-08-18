import { CITATIONS, CITATION_ORDER } from '@/lib/es/citations'

export function ReferenceList() {
  return (
    <ul className="space-y-2">
      {CITATION_ORDER.map((key) => {
        const citation = CITATIONS[key]
        return (
          <li key={key} className="space-y-0.5">
            <div>{citation.text}</div>
            <div className="text-[hsl(var(--muted-foreground))]">
              {citation.note}
              {citation.pmid && (
                <>
                  {' '}
                  PMID:{' '}
                  <a
                    href={citation.url}
                    target="_blank"
                    rel="noreferrer"
                    className="underline-offset-2 hover:underline"
                  >
                    {citation.pmid}
                  </a>
                  .
                </>
              )}
              {citation.doi && <> doi:{citation.doi}</>}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
