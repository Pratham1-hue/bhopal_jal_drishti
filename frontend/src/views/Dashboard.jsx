import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Gavel, Droplets, EyeOff, ListChecks, MessageSquareText, Sparkles, MapPinned, FlaskRound, ClipboardList } from 'lucide-react'
import { fetchAnomalies, fetchGuidelines } from '../api.js'
import { useLang } from '../i18n.jsx'
import { useStore } from '../store.js'
import GhatCard from '../components/GhatCard.jsx'
import { InfoPopover, Legend } from '../components/ui.jsx'

function Hero() {
  const { t } = useLang()
  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-800 via-orange-900 to-orange-950 p-5 text-white shadow-lift sm:p-7" aria-labelledby="hero-h">
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-yellow-400/20 blur-3xl" aria-hidden="true" />
      <div className="relative">
        <p className="text-xs font-semibold uppercase tracking-wider text-yellow-200">{t.org}</p>
        <h1 id="hero-h" className="mt-1.5 text-2xl font-bold tracking-tight sm:text-3xl">{t.heroTitle}</h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-orange-50">{t.subTagline}</p>
        <p className="mt-3 text-sm italic text-yellow-200/90" aria-hidden="true" lang="sa">{t.taglineDeva}</p>
      </div>
    </section>
  )
}

export function Counters({ overview }) {
  const { t } = useLang()
  const items = [
    { value: overview.total_ghats, label: t.totalGhats, sub: `${overview.years[0]}–${overview.years.at(-1)}`, Icon: MapPinned, cls: 'bg-white text-ink ring-1 ring-inset ring-stone-200', sub2: 'text-ink-muted' },
    { value: overview.critical_violations, label: t.violations, sub: t.violationsSub(overview), Icon: Droplets, cls: 'bg-risk-red text-white', sub2: 'text-white/90' },
    { value: overview.blind_spots, label: t.blindspots, sub: t.blindspotsSub, Icon: EyeOff, cls: 'stripes-grey text-white', sub2: 'text-white/90' },
  ]
  return (
    <dl className="grid grid-cols-3 gap-2.5 sm:gap-4">
      {items.map((it) => (
        <div key={it.label} className={`rounded-2xl p-3 shadow-card sm:p-5 ${it.cls}`}>
          <dt className="flex items-center gap-2 text-[11px] font-semibold uppercase leading-tight tracking-wide sm:text-xs">
            <it.Icon aria-hidden="true" className="hidden h-4 w-4 sm:block" /> {it.label}
          </dt>
          <dd className="mt-1 text-2xl font-bold tabular-nums tracking-tight sm:text-4xl">{it.value}</dd>
          <dd className={`mt-0.5 hidden truncate text-xs sm:block ${it.sub2}`}>{it.sub}</dd>
        </div>
      ))}
    </dl>
  )
}

function RailCard({ title, Icon, action, children }) {
  return (
    <section className="card p-5" aria-label={title}>
      <div className="mb-3 flex items-center gap-2">
        <Icon aria-hidden="true" className="h-[18px] w-[18px] text-orange-800" />
        <h3 className="flex-1 text-[15px] font-semibold">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

function SeeAll({ onClick }) {
  const { t } = useLang()
  return (
    <button type="button" onClick={onClick} className="inline-flex min-h-[40px] items-center gap-1 rounded-lg px-2 text-sm font-semibold text-ink-soft hover:bg-stone-100 hover:text-ink">
      {t.viewAll} <ArrowRight aria-hidden="true" className="h-4 w-4" />
    </button>
  )
}

function QuickActions({ ghats, go, onBrief }) {
  const { t, lang } = useLang()
  const store = useStore()
  const total = store.tasks.length
  const done = store.tasks.filter((x) => x.status === 'done').length
  return (
    <RailCard title={t.quickActions} Icon={Sparkles}>
      <div className="grid gap-2">
        <button type="button" className="btn-primary w-full" onClick={() => onBrief('all')}>
          <MessageSquareText aria-hidden="true" className="h-4 w-4" /> {t.genBrief} · {lang === 'hi' ? 'पूरा शहर' : 'whole city'}
        </button>
        {total === 0 ? (
          <button type="button" className="btn-secondary w-full" onClick={() => { store.seedTasks(ghats); go('tasks') }}>
            <ClipboardList aria-hidden="true" className="h-4 w-4" /> {t.makeTasks}
          </button>
        ) : (
          <button type="button" onClick={() => go('tasks')} className="rounded-xl p-3 text-left ring-1 ring-inset ring-stone-200 transition hover:bg-stone-50">
            <span className="flex items-center justify-between text-sm font-semibold">
              <span className="flex items-center gap-2"><ClipboardList aria-hidden="true" className="h-4 w-4 text-ink-muted" /> {t.widgetTasks}</span>
              <span className="tabular-nums text-ink-muted">{done}/{total}</span>
            </span>
            <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-stone-100" aria-hidden="true">
              <span className="block h-full rounded-full bg-emerald-600" style={{ width: `${(100 * done) / total}%` }} />
            </span>
          </button>
        )}
      </div>
    </RailCard>
  )
}

function Checklist({ go }) {
  const { t, lang } = useLang()
  const { data } = useQuery({ queryKey: ['guidelines'], queryFn: fetchGuidelines })
  return (
    <RailCard title={t.checklist} Icon={ListChecks} action={<SeeAll onClick={() => go('guidelines')} />}>
      {!data ? (
        <p className="text-sm text-ink-muted">{t.loading}</p>
      ) : (
        <ol className="space-y-3">
          {data.checklist.slice(0, 3).map((c, i) => (
            <li key={i} className="flex gap-3 text-sm leading-relaxed text-ink-soft">
              <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-50 text-xs font-bold text-orange-800 ring-1 ring-inset ring-orange-200">{i + 1}</span>
              {lang === 'hi' ? c[1] : c[0]}
            </li>
          ))}
        </ol>
      )}
    </RailCard>
  )
}

function DataProblems({ go }) {
  const { t, pick } = useLang()
  const { data } = useQuery({ queryKey: ['anomalies'], queryFn: fetchAnomalies })
  const top = (data?.anomalies || []).filter((a) => a.severity === 'high').slice(0, 3)
  return (
    <RailCard title={t.widgetPopups} Icon={EyeOff} action={<SeeAll onClick={() => go('anomalies')} />}>
      <ul className="divide-y divide-stone-100">
        {top.map((a) => (
          <li key={a.id}>
            <button type="button" onClick={() => go('anomalies')} className="flex w-full items-start gap-2.5 py-2.5 text-left text-sm hover:text-ink">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${a.category === 'gap' ? 'bg-stone-500' : 'bg-amber-500'}`} aria-hidden="true" />
              <span className="leading-snug text-ink-soft">{pick(a, 'title')}</span>
            </button>
          </li>
        ))}
      </ul>
    </RailCard>
  )
}

function KeyFacts({ overview, ghats }) {
  const { t } = useLang()
  const lake = ghats.filter((g) => g.ngt).length
  return (
    <div className="space-y-2" aria-label={t.keyFacts}>
      <p className="flex items-start gap-3 rounded-2xl border-2 border-risk-red bg-risk-redsoft px-4 py-3 text-[15px] font-semibold leading-snug text-red-950" role="note">
        <FlaskRound aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-risk-red" />
        {t.bodBanner(overview.ghats_failing_bod_latest_year, overview.years.at(-1))}
      </p>
      {lake > 0 && (
        <p className="flex items-start gap-3 rounded-2xl border-2 border-indigo-900 bg-indigo-50 px-4 py-3 text-[15px] font-semibold leading-snug text-indigo-950" role="note">
          <Gavel aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-indigo-900" />
          {t.ngtCount(lake)}
        </p>
      )}
    </div>
  )
}

export default function Dashboard({ overview, ghats, go, onOpen, onBrief }) {
  const { t } = useLang()
  return (
    <div className="space-y-5 lg:space-y-6">
      <Hero />
      <Counters overview={overview} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="space-y-4" aria-labelledby="rank-h">
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <h2 id="rank-h" className="text-xl font-bold tracking-tight lg:text-2xl">{t.rankTitle}</h2>
              <p className="mt-0.5 text-sm text-ink-muted">{t.rankSub}</p>
            </div>
            <InfoPopover label={t.legendTitle}>
              <Legend />
            </InfoPopover>
          </div>
          <KeyFacts overview={overview} ghats={ghats} />
          <ol className="space-y-3" aria-label={t.rankTitle}>
            {ghats.map((g, i) => (
              <li key={g.site_id}>
                <GhatCard ghat={g} index={i} onOpen={onOpen} onBrief={onBrief} />
              </li>
            ))}
          </ol>
        </section>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start" aria-label={t.quickActions}>
          <QuickActions ghats={ghats} go={go} onBrief={onBrief} />
          <Checklist go={go} />
          <DataProblems go={go} />
        </aside>
      </div>
    </div>
  )
}
