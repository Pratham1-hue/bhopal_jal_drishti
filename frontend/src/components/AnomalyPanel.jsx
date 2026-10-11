import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { EyeOff, SearchCheck, Shuffle, Ban, Loader2, RefreshCw, ArrowRight } from 'lucide-react'
import { fetchAnomalies, refreshData } from '../api.js'
import { useLang } from '../i18n.jsx'
import { SourceLink } from './ui.jsx'

const CAT_STYLE = {
  gap: { Icon: EyeOff, icon: 'stripes-light text-stone-700 ring-1 ring-inset ring-stone-300' },
  verify: { Icon: SearchCheck, icon: 'bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200' },
  ambiguity: { Icon: Shuffle, icon: 'bg-sky-50 text-sky-800 ring-1 ring-inset ring-sky-200' },
  scope: { Icon: Ban, icon: 'bg-stone-100 text-stone-700 ring-1 ring-inset ring-stone-200' },
}
const SEV = {
  high: 'bg-red-50 text-red-800 ring-red-200',
  medium: 'bg-amber-50 text-amber-900 ring-amber-200',
  low: 'bg-stone-100 text-stone-700 ring-stone-200',
}

export default function AnomalyPanel({ onOpenGhat }) {
  const { t, pick } = useLang()
  const [cat, setCat] = useState('all')
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['anomalies'], queryFn: fetchAnomalies })
  const qc = useQueryClient()
  const [done, setDone] = useState(false)
  const refresh = useMutation({
    mutationFn: refreshData,
    onSuccess: async () => {
      await qc.invalidateQueries()
      setDone(true)
      setTimeout(() => setDone(false), 2500)
    },
  })

  if (isLoading)
    return (
      <p className="flex items-center gap-2 py-10 text-ink-muted" role="status">
        <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" /> {t.loading}
      </p>
    )
  if (isError)
    return (
      <div className="py-10">
        <p className="font-semibold text-red-800">{t.loadError}</p>
        <button className="btn-secondary mt-3" onClick={() => refetch()}>{t.retry}</button>
      </div>
    )

  const items = data.anomalies.filter((a) => cat === 'all' || a.category === cat)
  const filters = ['all', 'gap', 'verify', 'ambiguity', 'scope']

  return (
    <section aria-labelledby="gaps-h" className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <h2 id="gaps-h" className="page-title">{t.gapsTitle}</h2>
          <p className="page-sub">{t.gapsSub}</p>
        </div>
        <button type="button" className="btn-secondary" onClick={() => refresh.mutate()} disabled={refresh.isPending}>
          <RefreshCw aria-hidden="true" className={`h-4 w-4 ${refresh.isPending ? 'animate-spin' : ''}`} />
          <span aria-live="polite">{done ? t.refreshed : t.refresh}</span>
        </button>
      </div>

      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div className="seg" role="group" aria-label="Filter">
          {filters.map((f) => (
            <button key={f} type="button" onClick={() => setCat(f)} aria-pressed={cat === f} className="seg-btn inline-flex shrink-0 items-center gap-2 whitespace-nowrap">
              {f === 'all' ? t.filterAll : t.cat[f]}
              <span className="rounded-full bg-stone-200/80 px-1.5 text-[11px] tabular-nums">{f === 'all' ? data.anomalies.length : data.counts[f]}</span>
            </button>
          ))}
        </div>
      </div>

      <ul className="grid gap-3 xl:grid-cols-2">
        {items.map((a) => {
          const s = CAT_STYLE[a.category]
          return (
            <li key={a.id} className="card flex gap-4 p-5">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${s.icon}`} aria-hidden="true">
                <s.Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-semibold text-ink-muted">{t.cat[a.category]}</span>
                  <span className={`chip px-2 py-0.5 text-[11px] ${SEV[a.severity]}`}>{t.severity[a.severity]}</span>
                </div>
                <h3 className="font-semibold leading-snug">{pick(a, 'title')}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">{pick(a, 'detail')}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {dedupe(a.citations).map((c, i) => <SourceLink key={i} source={c} compact />)}
                  {a.site_id && (
                    <button type="button" className="inline-flex min-h-[36px] items-center gap-1 rounded-lg px-2 text-xs font-semibold text-ink-soft hover:bg-stone-100 hover:text-ink" onClick={() => onOpenGhat(a.site_id)}>
                      {t.viewReceipts} <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function dedupe(citations) {
  const seen = new Set()
  return citations.filter((c) => {
    const k = `${c.year}-${c.page}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}
