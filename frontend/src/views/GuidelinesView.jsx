import { useQuery } from '@tanstack/react-query'
import { Loader2, ExternalLink, CheckSquare } from 'lucide-react'
import { fetchGuidelines } from '../api.js'
import { useLang } from '../i18n.jsx'

export default function GuidelinesView() {
  const { t, pick, lang } = useLang()
  const { data, isLoading, isError } = useQuery({ queryKey: ['guidelines'], queryFn: fetchGuidelines })
  if (isLoading) return <p className="flex items-center gap-2 py-10" role="status"><Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" /> {t.loading}</p>
  if (isError) return <p className="py-10 font-semibold text-red-800">{t.loadError}</p>

  const groups = ['bhopal', 'cpcb', 'tool']
  return (
    <section aria-labelledby="gl-h" className="space-y-4">
      <div>
        <h2 id="gl-h" className="page-title">{t.guidelinesTitle}</h2>
        <p className="page-sub">{t.guidelinesSub}</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          {groups.map((g) => (
            <div key={g}>
              <h3 className="eyebrow mb-3">{t.groups[g]}</h3>
              <div className="grid gap-3 md:grid-cols-2">
                {data.items.filter((i) => i.group === g).map((i) => {
                  const src = data.sources[i.source]
                  return (
                    <article key={i.id} className="card p-5">
                      <h4 className="font-semibold leading-snug">{pick(i, 'title')}</h4>
                      <ul className="mt-2 space-y-1.5">
                        {i.points.map((p, k) => (
                          <li key={k} className="flex gap-2 text-[15px] leading-snug">
                            <span aria-hidden="true" className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-stone-400" />
                            {lang === 'hi' ? p[1] : p[0]}
                          </li>
                        ))}
                      </ul>
                      {src && (
                        src.url ? (
                          <a href={src.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-touch items-center gap-1 text-xs font-semibold text-blue-800 underline">
                            <ExternalLink aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /> {src.label}
                          </a>
                        ) : (
                          <p className="mt-2 text-xs text-ink-muted">{src.label}</p>
                        )
                      )}
                    </article>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <aside className="card h-fit p-5 xl:sticky xl:top-24">
          <h3 className="mb-3 flex items-center gap-2 font-semibold">
            <CheckSquare aria-hidden="true" className="h-5 w-5" /> {t.checklist}
          </h3>
          <ol className="space-y-2">
            {data.checklist.map((c, i) => (
              <li key={i} className="flex gap-2 text-[15px] leading-snug">
                <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-50 text-xs font-bold text-orange-800 ring-1 ring-inset ring-orange-200">{i + 1}</span>
                {lang === 'hi' ? c[1] : c[0]}
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </section>
  )
}
