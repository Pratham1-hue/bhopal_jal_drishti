import { useEffect, useRef, useState } from 'react'
import {
  AlertOctagon, AlertTriangle, CheckCircle2, EyeOff, FileCheck2, Wind, Sparkles, FlaskConical, Gavel,
  ExternalLink, ShieldCheck, Info, X,
} from 'lucide-react'
import { useLang } from '../i18n.jsx'

/* ------------------------------------------------------------------ status */
// Solid, high-contrast status colours (readable in direct sunlight). Icon + word, never colour alone.
export const STATUS_STYLE = {
  red: { chip: 'bg-risk-red text-white ring-red-800', accent: 'bg-risk-red', tint: 'bg-risk-red text-white', Icon: AlertOctagon },
  yellow: { chip: 'bg-risk-yellow text-stone-950 ring-amber-600', accent: 'bg-risk-yellow', tint: 'bg-risk-yellow text-stone-950', Icon: AlertTriangle },
  green: { chip: 'bg-risk-green text-white ring-green-800', accent: 'bg-risk-green', tint: 'bg-risk-green text-white', Icon: CheckCircle2 },
  grey: { chip: 'stripes-grey text-white ring-gray-700', accent: 'stripes-grey', tint: 'stripes-grey text-white', Icon: EyeOff },
}

export function StatusBadge({ status, size = 'md' }) {
  const { t } = useLang()
  const s = STATUS_STYLE[status] || STATUS_STYLE.grey
  return (
    <span className={`chip font-bold ${s.chip} ${size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'text-[13px]'}`} role="status" aria-label={t.status[status]}>
      <s.Icon aria-hidden="true" className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      {t.status[status]}
    </span>
  )
}

export const ACTION_ICON = { ngt: Gavel, aeration: Wind, cleaning: Sparkles, testing: FlaskConical }

// One colour per team, used everywhere the team appears.
export const TEAM_STYLE = {
  aeration: { solid: 'bg-sky-700 text-white', soft: 'bg-sky-50 text-sky-900 ring-sky-200', bar: 'bg-sky-700', text: 'text-sky-800' },
  cleaning: { solid: 'bg-teal-700 text-white', soft: 'bg-teal-50 text-teal-900 ring-teal-200', bar: 'bg-teal-700', text: 'text-teal-800' },
  testing: { solid: 'bg-violet-700 text-white', soft: 'bg-violet-50 text-violet-900 ring-violet-200', bar: 'bg-violet-700', text: 'text-violet-800' },
  ngt: { solid: 'bg-indigo-900 text-white', soft: 'bg-indigo-50 text-indigo-900 ring-indigo-200', bar: 'bg-indigo-900', text: 'text-indigo-900' },
}

export function TeamBadge({ d, size = 'md' }) {
  const { t } = useLang()
  const Icon = ACTION_ICON[d.type]
  const s = TEAM_STYLE[d.type]
  const muted = d.level === 'standby' || d.level === 'check'
  return (
    <span className={`chip font-semibold ${muted ? s.soft : `${s.solid} ring-transparent`} ${size === 'sm' ? 'px-2 py-0.5 text-[11px]' : ''}`}>
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      {t.team[d.type]}
      <span className="font-normal opacity-90">· {t.level[d.level]}</span>
    </span>
  )
}

export function DivertList({ ngt, options, max = 4 }) {
  const { t, pick } = useLang()
  if (!ngt || !options?.length) return null
  const divert = ngt.level === 'divert'
  return (
    <div className={`rounded-2xl p-4 ring-1 ring-inset ${divert ? 'bg-white ring-red-300' : 'bg-white ring-stone-200'}`}>
      <p className={`text-sm font-bold ${divert ? 'text-red-900' : 'text-ink'}`}>{divert ? t.divertTitle : t.divertIfFull}</p>
      <ol className="mt-2 space-y-1.5">
        {options.slice(0, max).map((a, i) => (
          <li key={a.site_id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-900 text-[11px] font-bold text-white" aria-hidden="true">{i + 1}</span>
            <span className="font-semibold">{pick(a, 'name')}</span>
            <span className="text-ink-muted">· {a.km != null ? t.aboutKm(a.km) : t.noLoc}</span>
            {a.on_lake && <span className="text-xs text-indigo-800">· {t.onLake}</span>}
            <StatusBadge status={a.status} size="sm" />
          </li>
        ))}
      </ol>
      <p className="mt-2 text-xs text-ink-muted">{t.divertSub}</p>
    </div>
  )
}

/* ------------------------------------------------------------------ citation */
export function SourceLink({ source, compact = false }) {
  const { t, lang } = useLang()
  if (!source) return null
  const text = source.page
    ? lang === 'hi' ? `${source.year} रिपोर्ट · पेज ${source.page}` : `${source.year} report · p.${source.page}`
    : lang === 'hi' ? `${source.year} रिपोर्ट` : `${source.year} report`
  const cls = `inline-flex items-center gap-1.5 rounded-lg bg-white font-semibold text-blue-800 ring-1 ring-inset ring-blue-200 transition hover:bg-blue-50 hover:ring-blue-300 ${
    compact ? 'min-h-[36px] px-2.5 text-xs' : 'min-h-[40px] px-3 text-sm'
  }`
  const body = (
    <>
      <FileCheck2 aria-hidden="true" className="h-4 w-4 shrink-0" />
      <span><span className="font-bold">{t.verify}</span><span className="text-blue-700/80"> · MPPCB {text}</span></span>
    </>
  )
  if (!source.pdf_url) return <span className={cls}>{body}</span>
  return (
    <a href={source.pdf_url} target="_blank" rel="noreferrer" className={cls} aria-label={`${t.verify}: ${source.label}. ${t.openPdf}`}>
      {body}
    </a>
  )
}

/* ------------------------------------------------------------------ NGT */
export function NgtChip({ ngt }) {
  const { t } = useLang()
  if (!ngt) return null
  const divert = ngt.level === 'divert'
  return (
    <span className={`chip ${divert ? 'bg-red-50 text-red-800 ring-red-200' : 'bg-indigo-50 text-indigo-900 ring-indigo-200'}`}>
      <Gavel aria-hidden="true" className="h-3.5 w-3.5" />
      {divert ? t.ngtDivertShort : t.ngtShort}
    </span>
  )
}

export function NgtBanner({ ngt }) {
  const { t, lang } = useLang()
  if (!ngt) return null
  const divert = ngt.level === 'divert'
  return (
    <div className={`flex gap-3 rounded-2xl p-4 ring-1 ring-inset ${divert ? 'bg-red-50 ring-red-200' : 'bg-indigo-50 ring-indigo-200'}`} role="note">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${divert ? 'bg-red-600' : 'bg-indigo-600'} text-white`} aria-hidden="true">
        <Gavel className="h-[18px] w-[18px]" />
      </span>
      <div className={`min-w-0 text-sm ${divert ? 'text-red-950' : 'text-indigo-950'}`}>
        <p className="font-bold">
          {t.ngtBadge}
          {divert && <span className="chip ml-2 bg-white px-2 py-0.5 text-[11px] text-red-800 ring-red-200">{t.ngtDivert}</span>}
        </p>
        <p className="mt-1 leading-relaxed">{lang === 'hi' ? ngt.hi : ngt.en}</p>
        <a href={ngt.source.url} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex min-h-[32px] items-center gap-1 text-xs font-semibold underline underline-offset-2">
          <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" /> {ngt.source.label}
        </a>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ data confidence */
const CONF = {
  high: { chip: 'bg-emerald-50 text-emerald-800 ring-emerald-200', bar: 'bg-emerald-600' },
  medium: { chip: 'bg-amber-50 text-amber-900 ring-amber-300', bar: 'bg-amber-500' },
  low: { chip: 'bg-stone-100 text-stone-800 ring-stone-300', bar: 'bg-stone-500' },
}

export function ConfidenceChip({ conf }) {
  const { t } = useLang()
  if (!conf) return null
  return (
    <span className={`chip ${CONF[conf.level].chip}`} title={t.confDetail(conf)}>
      <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" />
      {t.confidenceShort} {conf.pct}%
      <span className="sr-only">, {t.confLevel[conf.level]}. {t.confDetail(conf)}</span>
    </span>
  )
}

export function ConfidenceBadge({ conf }) {
  const { t } = useLang()
  if (!conf) return null
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-inset ring-stone-200">
      <div className="flex items-baseline justify-between gap-2">
        <p className="eyebrow">{t.confidence}</p>
        <p className="text-2xl font-bold tabular-nums">{conf.pct}%</p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-100" aria-hidden="true">
        <div className={`h-full rounded-full ${CONF[conf.level].bar}`} style={{ width: `${conf.pct}%` }} />
      </div>
      <p className="mt-2 text-sm text-ink-muted">
        <span className={`chip mr-1.5 px-2 py-0.5 text-[11px] ${CONF[conf.level].chip}`}>{t.confLevel[conf.level]}</span>
        {t.confDetail(conf)}
      </p>
      {conf.level === 'low' && <p className="mt-1.5 text-sm font-semibold text-ink">{t.confLowNote}</p>}
    </div>
  )
}

/* ------------------------------------------------------------------ sparklines */
function Spark({ points, kind, label, phaseLabels, height = 62, hideLabel = false, wide = false }) {
  const W = 140
  const H = height
  const pad = { l: 16, r: 16, t: 13, b: 16 }
  const max = kind === 'do' ? Math.max(10, ...points.map((p) => p.value ?? 0)) : Math.max(15, ...points.map((p) => p.value ?? 0))
  const limit = kind === 'do' ? 5 : 3
  const bad = (v) => (kind === 'do' ? v < limit : v > limit)
  const x = (i) => pad.l + (i * (W - pad.l - pad.r)) / 2
  const y = (v) => pad.t + (1 - v / max) * (H - pad.t - pad.b)
  const segs = []
  for (let i = 0; i < 2; i++) {
    const a = points[i]
    const b = points[i + 1]
    if (a.value != null && b.value != null) segs.push({ i, worse: kind === 'do' ? b.value < a.value - 0.5 : b.value > a.value + 0.5 })
  }
  const summary = points.map((p) => (p.value == null ? '?' : p.printed || p.value)).join(' → ')
  return (
    <figure className="min-w-0">
      <figcaption className={hideLabel ? 'sr-only' : 'text-[11px] font-semibold text-ink-muted'}>{label}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className={`w-full ${wide ? 'max-w-[300px]' : 'max-w-[200px]'}`} style={{ height: wide ? H * 1.35 : H }} role="img" aria-label={`${label}: ${summary}. Limit ${kind === 'do' ? '≥' : '≤'} ${limit}`}>
        {phaseLabels.map((l, i) => (
          <text key={l} x={x(i)} y={H - 2} textAnchor="middle" fontSize="8" fontWeight="500" fill="#78716C">{l}</text>
        ))}
        <line x1={pad.l - 8} x2={W - pad.r + 8} y1={y(limit)} y2={y(limit)} stroke="#93C5FD" strokeWidth="1" strokeDasharray="3 3" />
        {segs.map((s) => (
          <line key={s.i} x1={x(s.i)} y1={y(points[s.i].value)} x2={x(s.i + 1)} y2={y(points[s.i + 1].value)}
            stroke={s.worse ? '#DC2626' : '#A8A29E'} strokeWidth="2.25" strokeLinecap="round" />
        ))}
        {points.map((p, i) =>
          p.value == null ? (
            <g key={i}>
              <circle cx={x(i)} cy={H / 2} r="6" fill="#FAFAF9" stroke="#A8A29E" strokeDasharray="2 1.5" />
              <text x={x(i)} y={H / 2 + 3} textAnchor="middle" fontSize="8" fontWeight="700" fill="#57534E">?</text>
            </g>
          ) : (
            <g key={i}>
              <circle cx={x(i)} cy={y(p.value)} r="3.75" fill={bad(p.value) ? '#DC2626' : '#16A34A'} stroke="#fff" strokeWidth="1.5" />
              <text x={x(i)} y={Math.max(9, y(p.value) - 6)} textAnchor="middle" fontSize="9" fontWeight="700" fill="#1C1917">
                {p.printed && p.printed !== '(blank)' ? p.printed : p.value}
              </text>
            </g>
          ),
        )}
      </svg>
    </figure>
  )
}

export function PhaseSparks({ trend, note, only, wide = false }) {
  const { t, fest, lang } = useLang()
  if (!trend) return null
  const labels = lang === 'hi' ? ['पहले', 'दौरान', 'बाद'] : ['Before', 'During', 'After']
  const single = only === 'do' || only === 'bod'
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold text-ink-soft">
        {single
          ? `${only === 'do' ? t.sparkOxygen : t.sparkWaste} · ${fest(trend.festival)} ${trend.year}`
          : t.sparkTitle(fest(trend.festival), trend.year)}
        {note && <span className="font-normal text-ink-muted"> · {note}</span>}
      </p>
      <div className={`mt-1 grid gap-4 ${single ? 'grid-cols-1' : 'grid-cols-2'}`}>
        {only !== 'bod' && <Spark points={trend.do} kind="do" label={t.sparkOxygen} phaseLabels={labels} hideLabel={single} wide={wide} />}
        {only !== 'do' && <Spark points={trend.bod} kind="bod" label={t.sparkWaste} phaseLabels={labels} hideLabel={single} wide={wide} />}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ season record */
const SEASON_CELL = {
  red: 'bg-risk-red text-white',
  yellow: 'bg-risk-yellow text-stone-950',
  green: 'bg-risk-green text-white',
  grey: 'stripes-grey text-white',
}

export function SeasonStrip({ strip }) {
  const { t, fest } = useLang()
  return (
    <ul className="grid grid-cols-6 gap-1.5" aria-label={t.seasons}>
      {strip.map((s) => {
        const label = `${fest(s.festival)} ${s.year}: ${s.table_missing ? t.blindSpot : t.status[s.status]}${s.partial ? ` (${t.partialSeasons})` : ''}`
        return (
          <li key={`${s.year}-${s.festival}`} className={`flex flex-col items-center rounded-lg py-1.5 text-[11px] font-semibold leading-tight ${SEASON_CELL[s.status]}`} title={label} aria-label={label}>
            <span>{fest(s.festival).slice(0, 1)}{String(s.year).slice(2)}</span>
            <span aria-hidden="true" className="text-[10px] opacity-80">{s.table_missing ? '?' : s.partial ? '½' : '●'}</span>
          </li>
        )
      })}
    </ul>
  )
}

/* ------------------------------------------------------------------ info popover */
export function InfoPopover({ label, children }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])
  return (
    <div className="relative inline-block" ref={ref}>
      <button type="button" className="btn-ghost min-h-[40px] min-w-[40px] px-2" aria-expanded={open} aria-label={label} onClick={() => setOpen((o) => !o)}>
        <Info aria-hidden="true" className="h-5 w-5" />
      </button>
      {open && (
        <div role="dialog" aria-label={label} className="absolute right-0 top-full z-30 mt-2 w-[min(88vw,340px)] rounded-2xl border border-stone-200 bg-white p-4 shadow-pop">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-bold">{label}</p>
            <button type="button" className="btn-ghost min-h-[36px] min-w-[36px] px-1" onClick={() => setOpen(false)} aria-label="Close">
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
          {children}
        </div>
      )}
    </div>
  )
}

export function Legend() {
  const { t } = useLang()
  return (
    <ul className="space-y-2.5 text-sm">
      {['red', 'yellow', 'green', 'grey'].map((s) => (
        <li key={s} className="flex items-start gap-2">
          <StatusBadge status={s} size="sm" />
          <span className="text-ink-soft">{t.legend[s]}</span>
        </li>
      ))}
    </ul>
  )
}
