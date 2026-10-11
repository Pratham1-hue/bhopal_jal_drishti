import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { X, EyeOff, MessageSquareText, Loader2, ChevronDown } from 'lucide-react'
import { fetchGhat } from '../api.js'
import { useLang } from '../i18n.jsx'
import { ACTION_ICON, ConfidenceBadge, DivertList, NgtBanner, PhaseSparks, SeasonStrip, SourceLink, STATUS_STYLE, StatusBadge, TEAM_STYLE } from './ui.jsx'
import TrendChart from './TrendChart.jsx'

function useIsDesktop() {
  const q = '(min-width: 768px)'
  const [m, setM] = useState(() => window.matchMedia(q).matches)
  useEffect(() => {
    const mq = window.matchMedia(q)
    const fn = () => setM(mq.matches)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])
  return m
}

const CELL = {
  red: 'bg-red-50 text-red-800 ring-red-200',
  yellow: 'bg-amber-50 text-amber-900 ring-amber-200',
  green: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  grey: 'stripes-grey-soft text-stone-600 ring-stone-300 ring-dashed',
  bdl: 'bg-sky-50 text-sky-800 ring-sky-200',
  neutral: 'bg-white text-ink ring-stone-200',
}

export default function GhatDrawer({ siteId, onClose, onBrief }) {
  const { t, pick, lang } = useLang()
  const desktop = useIsDesktop()
  const closeRef = useRef(null)
  const { data, isLoading, isError } = useQuery({ queryKey: ['ghat', siteId], queryFn: () => fetchGhat(siteId) })
  const [tab, setTab] = useState('overview')

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const panelAnim = desktop
    ? { initial: { x: '100%' }, animate: { x: 0 }, exit: { x: '100%' } }
    : { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' } }

  const tabs = [
    ['overview', t.tabOverview],
    ['numbers', t.tabNumbers],
    ['trends', t.tabTrends],
  ]

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
      <motion.div className="absolute inset-0 bg-stone-900/40 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} aria-hidden="true" />
      <motion.div
        {...panelAnim}
        transition={{ type: 'spring', damping: 34, stiffness: 340 }}
        className="absolute inset-x-0 bottom-0 flex max-h-[94vh] flex-col rounded-t-4xl bg-canvas shadow-pop md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[720px] md:rounded-none md:rounded-l-4xl lg:w-[780px]"
      >
        <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-stone-300 md:hidden" aria-hidden="true" />

        {/* header */}
        <div className="shrink-0 px-5 pb-3 pt-3 md:px-7 md:pt-6">
          <div className="flex items-start gap-3">
            {data && (
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl font-bold ${STATUS_STYLE[data.status].tint}`} aria-label={`${t.rank} ${data.rank}/7`}>
                {data.rank}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2 id="drawer-title" className="text-xl font-bold leading-tight tracking-tight md:text-2xl">{data ? pick(data, 'name') : '…'}</h2>
              {data && (
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
                  <StatusBadge status={data.status} size="sm" />
                  <span>{pick(data, 'water_body')}</span>
                  <span aria-hidden="true">·</span>
                  <span>{t.score} {data.score}/100</span>
                </div>
              )}
            </div>
            <button ref={closeRef} type="button" onClick={onClose} className="btn-secondary px-0" aria-label={t.close}>
              <X aria-hidden="true" className="h-5 w-5" />
            </button>
          </div>
          <div className="seg mt-4 w-full" role="tablist" aria-label={t.details}>
            {tabs.map(([k, label]) => (
              <button key={k} type="button" role="tab" id={`tab-${k}`} aria-controls={`panel-${k}`} aria-selected={tab === k} onClick={() => setTab(k)} className="seg-btn flex-1">
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-28 pt-2 md:px-7 md:pb-8">
          {isLoading && (
            <p className="flex items-center gap-2 py-10 text-ink-muted" role="status">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> {t.loading}
            </p>
          )}
          {isError && <p className="py-10 font-semibold text-red-800">{t.loadError}</p>}
          {data && (
            <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="space-y-4">
              {tab === 'overview' && <Overview data={data} lang={lang} />}
              {tab === 'numbers' && <Numbers data={data} />}
              {tab === 'trends' && <Trends data={data} />}
            </div>
          )}
        </div>

        {data && (
          <div className="absolute inset-x-0 bottom-0 border-t border-stone-200 bg-white/90 p-3 backdrop-blur-md md:static md:px-7">
            <button type="button" className="btn-primary w-full" onClick={() => onBrief(siteId)}>
              <MessageSquareText aria-hidden="true" className="h-[18px] w-[18px]" /> {t.genBrief}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  )
}

function Section({ title, children, className = '' }) {
  return (
    <section className={`card p-5 ${className}`}>
      {title && <h3 className="mb-3 text-[15px] font-semibold">{title}</h3>}
      {children}
    </section>
  )
}

function Overview({ data, lang }) {
  const { t } = useLang()
  return (
    <>
      {data.ngt && (
        <div className="space-y-2">
          <NgtBanner ngt={data.ngt} />
          <DivertList ngt={data.ngt} options={data.divert_to} />
        </div>
      )}
      <Section title={t.whyRank}>
        <ul className="space-y-2">
          {(lang === 'hi' ? data.reasons_hi : data.reasons).map((r, i) => (
            <li key={i} className="flex gap-2.5 text-[15px] leading-relaxed text-ink-soft">
              <span aria-hidden="true" className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-stone-400" />
              {r}
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          {data.stats.lowest_do && <SourceLink source={data.stats.lowest_do.source} />}
          {data.stats.highest_bod && <SourceLink source={data.stats.highest_bod.source} />}
        </div>
      </Section>

      {data.deploy?.length > 0 && (
        <Section title={t.sendTeams}>
          <ol className="space-y-3">
            {data.deploy.map((d, i) => <DeployItem key={i} d={d} lang={lang} />)}
          </ol>
          <p className="mt-3 text-xs text-ink-muted">{t.planNote}</p>
        </Section>
      )}

      <ConfidenceBadge conf={data.data_confidence} />

      <Section title={t.seasons}>
        <SeasonStrip strip={data.season_strip} />
      </Section>

      <details className="card group p-5">
        <summary className="flex min-h-[32px] cursor-pointer list-none items-center justify-between text-[15px] font-semibold">
          {t.printedAs}
          <ChevronDown aria-hidden="true" className="h-4 w-4 transition group-open:rotate-180" />
        </summary>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-ink-soft">
          {data.names_as_printed.map((n) => <li key={n}>{n}</li>)}
        </ul>
      </details>
    </>
  )
}

export function DeployItem({ d, lang, compact = false }) {
  const { t } = useLang()
  const Icon = ACTION_ICON[d.type]
  const s = TEAM_STYLE[d.type]
  return (
    <li className={`flex gap-3 rounded-2xl p-3 ring-1 ring-inset ${s.soft}`}>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${s.solid}`} aria-hidden="true">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1 text-[15px] leading-relaxed text-ink">
        <p className="flex flex-wrap items-center gap-2 font-bold">
          {t.team[d.type]}
          <span className={`chip px-2 py-0.5 text-[11px] ${d.priority === 'high' ? 'bg-risk-red text-white ring-transparent' : 'bg-white text-ink-soft ring-stone-300'}`}>{t.level[d.level]}</span>
        </p>
        <p className="text-ink-soft">{lang === 'hi' ? d.hi : d.en}</p>
        {!compact && (
          <p className="mt-1.5 text-xs text-ink-muted">
            <span className="font-semibold">{t.ruleLabel}:</span> {lang === 'hi' ? d.rule_hi : d.rule}
          </p>
        )}
        {d.evidence?.some((e) => e.source?.page) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {d.evidence.filter((e) => e.source?.page).map((e, k) => <SourceLink key={k} source={e.source} compact />)}
          </div>
        )}
      </div>
    </li>
  )
}

function Numbers({ data }) {
  const { t, fest } = useLang()
  const [season, setSeason] = useState(() => {
    const withData = data.seasons.filter((s) => !s.table_missing)
    const durga = [...withData].reverse().find((s) => s.festival === 'Durga')
    const s = durga || withData.at(-1)
    return s ? `${s.year}-${s.festival}` : null
  })
  const selected = data.seasons.find((s) => `${s.year}-${s.festival}` === season)
  return (
    <>
      <p className="text-sm text-ink-muted">{t.receiptsSub}</p>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label={t.seasons}>
        {data.seasons.map((s) => {
          const key = `${s.year}-${s.festival}`
          const active = key === season
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSeason(key)}
              className={`inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold ring-1 ring-inset transition ${
                active ? 'bg-ink text-white ring-ink' : s.table_missing ? 'stripes-grey-soft text-stone-600 ring-stone-300' : 'bg-white text-ink-soft ring-stone-200 hover:ring-stone-300'
              }`}
            >
              {s.table_missing && <EyeOff aria-hidden="true" className="h-3.5 w-3.5" />}
              {fest(s.festival)} {s.year}
            </button>
          )
        })}
      </div>

      {selected?.table_missing && (
        <div className="rounded-2xl stripes-grey-soft p-8 text-center ring-1 ring-inset ring-stone-300" role="note">
          <EyeOff aria-hidden="true" className="mx-auto h-8 w-8 text-stone-500" />
          <p className="mt-2 text-lg font-semibold">{t.blindSpot}</p>
          <p className="mt-1 text-sm text-ink-muted">{t.noTable}</p>
        </div>
      )}

      {selected && !selected.table_missing && (
        <>
          <Section>
            <PhaseSparks wide trend={data.phase_trends.find((p) => p.year === selected.year && p.festival === selected.festival)} />
          </Section>
          <SeasonTable season={selected} limits={data.limits} />
        </>
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-muted">
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-5 rounded bg-sky-50 ring-1 ring-sky-300" />{t.bdlNote}</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-5 rounded stripes-grey-soft ring-1 ring-stone-400" />{t.missingNote}</span>
      </div>
    </>
  )
}

function Trends({ data }) {
  const { t, pick } = useLang()
  const worse = data.immersion_events?.filter((e) => e.worse).length ?? 0
  return (
    <>
      <Section title={t.whatChanged}>
        <p className="mb-3 text-[15px] leading-relaxed text-ink-soft">{pick(data, 'trend_text')}</p>
        <TrendChart trend={data.trend} limits={data.limits} />
        {data.immersion_events?.length > 0 && <p className="mt-3 text-sm text-ink-muted">{t.immersionImpact(worse, data.immersion_events.length)}</p>}
      </Section>
      <div className="grid gap-3 sm:grid-cols-2">
        {data.phase_trends.map((p) => (
          <div key={`${p.year}-${p.festival}`} className="card p-4">
            <PhaseSparks trend={p} />
          </div>
        ))}
      </div>
    </>
  )
}

function SeasonTable({ season, limits }) {
  const { t, fest, param } = useLang()
  const limitText = (p) => (limits[p] ? limits[p].text : t.noLimit)
  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 px-4 py-3">
        <p className="min-w-0 text-sm text-ink-muted">
          <span className="font-semibold text-ink">{fest(season.festival)} {season.year}</span> · “{season.site_as_printed}”
        </p>
        <SourceLink source={season.source} compact />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[330px] table-fixed border-collapse text-sm">
          <caption className="sr-only">{fest(season.festival)} {season.year}, {season.source?.label}</caption>
          <colgroup>
            <col className="w-[38%]" />
            <col />
            <col />
            <col />
          </colgroup>
          <thead>
            <tr className="text-left text-xs font-semibold text-ink-muted">
              <th scope="col" className="px-4 py-2.5">{t.parameter}</th>
              <th scope="col" className="px-1 py-2.5 text-center">{t.pre}</th>
              <th scope="col" className="px-1 py-2.5 text-center">{t.during}</th>
              <th scope="col" className="px-1 py-2.5 text-center">{t.after}</th>
            </tr>
          </thead>
          <tbody>
            {season.rows.map((row) => (
              <tr key={row.parameter} className="border-t border-stone-100">
                <th scope="row" className="px-4 py-2 text-left align-top font-medium">
                  {param(row.parameter)}
                  <span className="block text-[11px] font-normal text-ink-muted">
                    {row.unit && `${row.unit} · `}{t.limit}: {limitText(row.parameter)}
                  </span>
                </th>
                {row.not_in_table ? (
                  <td colSpan={3} className="p-1.5">
                    <div className={`rounded-lg px-2 py-2 text-center text-xs font-semibold ring-1 ring-inset ${CELL.grey}`}>{t.notTested}</div>
                  </td>
                ) : (
                  ['pre', 'during', 'after'].map((ph) => {
                    const c = row.cells[ph]
                    if (!c) return <td key={ph} className="p-1.5" />
                    const status = c.kind === 'bdl' ? 'bdl' : c.status
                    const desc = `${param(row.parameter)}, ${t[ph]}: ${c.kind === 'missing' ? t.blindSpot : c.value_as_printed} ${c.kind === 'value' ? c.unit : ''}. ${t.source}: ${c.source.label}`
                    return (
                      <td key={ph} className="p-1.5 text-center align-top">
                        <a href={c.source.pdf_url || undefined} target="_blank" rel="noreferrer" title={desc} aria-label={desc}
                          className={`block rounded-lg px-1 py-1.5 ring-1 ring-inset transition hover:brightness-95 ${CELL[status]}`}>
                          <span className="block text-[15px] font-semibold tabular-nums leading-tight">
                            {c.kind === 'missing' ? `—${c.value_as_printed !== '(blank)' ? ` ${c.value_as_printed}` : ''}` : c.value_as_printed}
                          </span>
                          <span className="block text-[10px] leading-tight opacity-75">p.{c.source.page}</span>
                        </a>
                      </td>
                    )
                  })
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
