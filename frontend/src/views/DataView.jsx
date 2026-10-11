import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { fetchDataSummary } from '../api.js'
import { useLang } from '../i18n.jsx'

function Bar({ value, max, color, label }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-100" aria-hidden="true">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, (100 * value) / max)}%` }} />
      </div>
      <span className="w-14 text-right text-xs font-bold">{label}</span>
    </div>
  )
}

export default function DataView() {
  const { t, fest, param } = useLang()
  const { data, isLoading, isError } = useQuery({ queryKey: ['datasummary'], queryFn: fetchDataSummary })
  if (isLoading) return <p className="flex items-center gap-2 py-10" role="status"><Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" /> {t.loading}</p>
  if (isError) return <p className="py-10 font-semibold text-red-800">{t.loadError}</p>

  const tiles = [
    { label: t.readings, value: data.rows.toLocaleString('en-IN'), cls: 'card' },
    { label: t.tablesFound, value: `${data.tables_found}/${data.tables_expected}`, cls: 'card' },
    { label: t.tooSmall, value: data.kinds.bdl || 0, cls: 'card bg-sky-50' },
    { label: t.notSampled, value: data.kinds.missing || 0, cls: 'stripes-grey text-white shadow-card [&_dt]:!text-white/90' },
  ]

  return (
    <section aria-labelledby="dv-h" className="space-y-4">
      <div>
        <h2 id="dv-h" className="page-title">{t.dataTitle}</h2>
        <p className="page-sub">{t.dataSub}</p>
      </div>

      <dl className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {tiles.map((x) => (
          <div key={x.label} className={`rounded-2xl p-4 sm:p-5 ${x.cls}`}>
            <dt className="text-xs font-semibold text-ink-muted sm:text-sm">{x.label}</dt>
            <dd className="mt-1 text-2xl font-bold tabular-nums tracking-tight sm:text-3xl">{x.value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="card p-5">
          <h3 className="mb-3 font-semibold">{t.byFestival}</h3>
          <ul className="space-y-3">
            {data.by_season.map((s) => (
              <li key={`${s.year}-${s.festival}`}>
                <p className="mb-1 text-sm font-bold">
                  {fest(s.festival)} {s.year}
                  <span className="ml-2 font-semibold text-stone-600">· {s.ghats_reported}/7 · p.{s.pages[0]}–{s.pages.at(-1)}</span>
                </p>
                <div className="grid gap-1 sm:grid-cols-2 sm:gap-3">
                  <div>
                    <p className="text-[11px] font-semibold text-ink-muted">{t.oxygenFail}: {s.do_fail}/{s.do_n}</p>
                    <Bar value={s.do_fail} max={s.do_n || 1} color="bg-red-600" label={`${Math.round((100 * s.do_fail) / (s.do_n || 1))}%`} />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-ink-muted">{t.wasteFail}: {s.bod_fail}/{s.bod_n}</p>
                    <Bar value={s.bod_fail} max={s.bod_n || 1} color="bg-orange-500" label={`${Math.round((100 * s.bod_fail) / (s.bod_n || 1))}%`} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="mb-3 font-semibold">{t.phaseEffect}</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-ink-muted">
                  <th scope="col" className="py-1" />
                  <th scope="col" className="py-1 text-right">{t.avgOxygen}</th>
                  <th scope="col" className="py-1 text-right">{t.oxygenFail}</th>
                  <th scope="col" className="py-1 text-right">{t.avgWaste}</th>
                </tr>
              </thead>
              <tbody>
                {data.phase_effect.map((p) => (
                  <tr key={p.phase} className="border-t border-stone-200">
                    <th scope="row" className="py-2 text-left font-bold">{t[p.phase]}</th>
                    <td className="py-2 text-right">{p.do_mean}</td>
                    <td className="py-2 text-right font-semibold text-red-700">{p.do_fail_pct}%</td>
                    <td className="py-2 text-right">{p.bod_mean}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card p-5">
            <h3 className="mb-2 font-semibold">{t.coverageTitle}</h3>
            <div className="mb-2 flex flex-wrap gap-3 text-xs">
              <span className="inline-flex items-center gap-1"><span className="h-3 w-4 rounded bg-emerald-600" />{t.found}</span>
              <span className="inline-flex items-center gap-1"><span className="h-3 w-4 rounded bg-sky-300" />{t.tooSmall}</span>
              <span className="inline-flex items-center gap-1"><span className="h-3 w-4 rounded stripes-grey" />{t.notSampled}</span>
              <span className="inline-flex items-center gap-1"><span className="h-3 w-4 rounded bg-stone-700" />{t.notInTable}</span>
            </div>
            <ul className="space-y-1.5">
              {data.coverage.map((c) => (
                <li key={c.key} className="grid grid-cols-[minmax(0,140px)_1fr] items-center gap-2 text-xs">
                  <span className="truncate font-semibold" title={param(c.key)}>{param(c.key)}</span>
                  <div
                    className="flex h-3 overflow-hidden rounded-full bg-stone-100"
                    role="img"
                    aria-label={`${param(c.key)}: ${t.found} ${c.value}, ${t.tooSmall} ${c.bdl}, ${t.notSampled} ${c.missing}, ${t.notInTable} ${c.not_in_table} / ${c.expected}`}
                  >
                    <div className="bg-emerald-600" style={{ width: `${(100 * c.value) / c.expected}%` }} />
                    <div className="bg-sky-300" style={{ width: `${(100 * c.bdl) / c.expected}%` }} />
                    <div className="stripes-grey" style={{ width: `${(100 * c.missing) / c.expected}%` }} />
                    <div className="bg-stone-700" style={{ width: `${(100 * c.not_in_table) / c.expected}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
