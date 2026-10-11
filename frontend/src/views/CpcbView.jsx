import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Info } from 'lucide-react'
import { fetchMatrix } from '../api.js'
import { useLang } from '../i18n.jsx'
import { SourceLink } from '../components/ui.jsx'

const DOT = {
  red: 'bg-red-600 text-white ring-red-700/30',
  yellow: 'bg-amber-300 text-ink ring-amber-500/40',
  green: 'bg-emerald-700 text-white ring-emerald-800/30',
  grey: 'stripes-grey text-ink-muted ring-stone-300',
}
const CLASS_SHORT_EN = { A: 'Drinking (light treatment)', B: 'Bathing', C: 'Drinking (full treatment)', D: 'Fish & wildlife', E: 'Farming / industry' }
const CLASS_SHORT_HI = { A: 'पीना (हल्का उपचार)', B: 'नहाना', C: 'पीना (पूरा उपचार)', D: 'मछली व वन्यजीव', E: 'खेती / उद्योग' }

function issueText(t, cell) {
  if (!cell.issues.length) return t.allPass
  const i = cell.issues[0]
  return `${i.criterion} — ${i.count}×`
}

export default function CpcbView({ onOpen }) {
  const { t, pick, lang } = useLang()
  const { data, isLoading, isError } = useQuery({ queryKey: ['matrix'], queryFn: fetchMatrix })
  const [sel, setSel] = useState(null) // {site_id, class}

  if (isLoading) return <p className="flex items-center gap-2 py-10" role="status"><Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" /> {t.loading}</p>
  if (isError) return <p className="py-10 font-semibold text-red-800">{t.loadError}</p>

  const short = lang === 'hi' ? CLASS_SHORT_HI : CLASS_SHORT_EN
  const selRow = sel && data.rows.find((r) => r.site_id === sel.site_id)
  const selCell = selRow && selRow.cells.find((c) => c.class === sel.class)
  const selClass = sel && data.classes.find((c) => c.class === sel.class)
  const classB = data.classes.find((c) => c.class === 'B')

  return (
    <section aria-labelledby="cpcb-h" className="space-y-4">
      <div>
        <h2 id="cpcb-h" className="page-title">{t.cpcbTitle}</h2>
        <p className="page-sub">{t.cpcbSub}</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="card -mx-2 overflow-x-auto p-1 sm:mx-0 sm:p-5">
          <table className="w-full min-w-[330px] border-separate border-spacing-y-1 text-sm">
            <caption className="sr-only">{t.cpcbTitle}</caption>
            <thead>
              <tr>
                <th scope="col" className="px-2 py-1 text-left text-xs font-bold uppercase text-ink-muted">{t.chooseGhat}</th>
                {data.classes.map((c) => (
                  <th key={c.class} scope="col" className={`px-1 py-1 text-center ${c.class === 'B' ? 'rounded-t-xl bg-orange-50' : ''}`}>
                    <span className="block text-lg font-bold">{c.class}</span>
                    <span className="block text-[10px] font-semibold leading-tight text-ink-muted">{short[c.class]}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.site_id}>
                  <th scope="row" className="max-w-[88px] px-1 py-1 text-left align-middle sm:max-w-[150px] sm:px-2">
                    <button type="button" onClick={() => onOpen(r.site_id)} className="min-h-touch text-left text-xs font-bold leading-tight underline-offset-2 hover:underline sm:text-sm">
                      <span className="mr-1 text-stone-500">{r.rank}.</span>{pick(r, 'name')}
                    </button>
                  </th>
                  {r.cells.map((c) => {
                    const active = sel && sel.site_id === r.site_id && sel.class === c.class
                    const label = `${pick(r, 'name')}, ${t.cpcbTitle} ${c.class}: ${c.compliance_pct ?? '—'}%. ${issueText(t, c)}`
                    return (
                      <td key={c.class} className={`px-0.5 py-1 text-center sm:px-1 ${c.class === 'B' ? 'bg-orange-50' : ''}`}>
                        <div className="group relative inline-block">
                          <button
                            type="button"
                            onClick={() => setSel(active ? null : { site_id: r.site_id, class: c.class })}
                            aria-pressed={active}
                            aria-label={label}
                            className={`flex h-11 w-11 items-center justify-center rounded-full text-[11px] font-bold ring-2 transition sm:h-12 sm:w-12 sm:text-xs ${DOT[c.status]} ${active ? 'scale-110 ring-4 ring-blue-700' : ''}`}
                          >
                            {c.compliance_pct ?? '—'}{c.compliance_pct != null && '%'}
                          </button>
                          {/* hover box (desktop) */}
                          <div role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-60 -translate-x-1/2 rounded-xl bg-ink p-3 text-left text-xs leading-relaxed text-white shadow-pop group-hover:lg:block">
                            <p className="font-bold">{c.class} · {short[c.class]}</p>
                            <p>{t.samplesPassed(c.samples_passed, c.samples_evaluated)}</p>
                            <p className="mt-1"><span className="font-bold">{t.mainProblem}:</span> {issueText(t, c)}</p>
                          </div>
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 flex items-start gap-1.5 px-2 text-xs text-ink-muted">
            <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" /> {pick(data, 'rule')}
          </p>
        </div>

        <div className="space-y-4">
          {/* selected circle details */}
          <div className="card p-5" aria-live="polite">
            {!selCell ? (
              <p className="text-sm text-ink-muted">{lang === 'hi' ? 'विवरण देखने के लिए किसी गोले पर टैप करें।' : 'Tap a circle to see details.'}</p>
            ) : (
              <>
                <p className="text-xs font-bold uppercase text-orange-900">{selClass.class} · {pick(selClass, 'use')}</p>
                <h3 className="text-lg font-semibold">{pick(selRow, 'name')}</h3>
                <p className="text-sm">{t.samplesPassed(selCell.samples_passed, selCell.samples_evaluated)} ({selCell.compliance_pct}%)</p>
                {selCell.issues.length === 0 ? (
                  <p className="mt-2 font-bold text-green-800">{t.allPass}</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {selCell.issues.map((i) => (
                      <li key={i.criterion} className="rounded-xl bg-red-50 p-3 text-sm ring-1 ring-inset ring-red-200">
                        <p className="font-bold">{i.criterion} — {i.count}×</p>
                        <p className="text-ink-soft">{t.worst}: <strong>{i.worst.value}</strong> ({i.worst.season}, {t[i.worst.phase]})</p>
                        <SourceLink source={i.worst.source} compact />
                      </li>
                    ))}
                  </ul>
                )}
                {selClass.untestable.length > 0 && (
                  <p className="mt-2 text-xs text-ink-muted"><strong>{t.untestable}:</strong> {selClass.untestable.map((u) => u.parameter).join(', ')}</p>
                )}
              </>
            )}
          </div>

          {/* Class B compliance panel (blueprint: "Designated Best Use: Class B") */}
          <div className="card p-5">
            <h3 className="font-semibold">{t.classBTitle}</h3>
            <p className="mb-2 text-xs text-ink-muted">{classB.criteria.map((c) => c.text).join(' · ')}</p>
            <ul className="space-y-2">
              {data.rows.map((r) => {
                const c = r.cells.find((x) => x.class === 'B')
                return (
                  <li key={r.site_id}>
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold">{pick(r, 'name')}</span>
                      <span className="font-bold">{c.compliance_pct}%</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-stone-100" aria-hidden="true">
                      <div className={`h-full rounded-full ${c.status === 'red' ? 'bg-red-600' : c.status === 'yellow' ? 'bg-amber-400' : 'bg-emerald-600'}`} style={{ width: `${Math.max(c.compliance_pct, 2)}%` }} />
                    </div>
                  </li>
                )
              })}
            </ul>
            <p className="mt-2 text-xs text-ink-muted"><strong>{t.untestable}:</strong> {classB.untestable.map((u) => u.parameter).join(', ')}</p>
          </div>
        </div>
      </div>
    </section>
  )
}
