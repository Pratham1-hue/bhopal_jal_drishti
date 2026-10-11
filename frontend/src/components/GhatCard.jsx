import { motion } from 'framer-motion'
import { ArrowRight, EyeOff, MapPin, MessageSquareText } from 'lucide-react'
import { useLang } from '../i18n.jsx'
import { ConfidenceChip, NgtChip, PhaseSparks, STATUS_STYLE, StatusBadge, TeamBadge } from './ui.jsx'

export default function GhatCard({ ghat, onOpen, onBrief, index }) {
  const { t, pick, fest } = useLang()
  const s = STATUS_STYLE[ghat.status]
  const name = pick(ghat, 'name')
  const missing = ghat.season_strip.filter((x) => x.table_missing)
  const trend = ghat.phase_trend_full || ghat.phase_trend

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.25 }}
      className="card group relative overflow-hidden transition hover:shadow-lift"
      aria-labelledby={`ghat-${ghat.site_id}-title`}
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${s.accent}`} aria-hidden="true" />
      <div className="grid gap-4 p-4 pl-5 sm:p-5 sm:pl-6 md:grid-cols-[minmax(0,1fr)_220px]">
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-bold tabular-nums ${s.tint}`} aria-label={`${t.rank} ${ghat.rank} / 7`}>
              {ghat.rank}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h3 id={`ghat-${ghat.site_id}-title`} className="text-[17px] font-semibold leading-snug">{name}</h3>
                <StatusBadge status={ghat.status} size="sm" />
              </div>
              <p className="mt-0.5 flex items-center gap-1 text-sm text-ink-muted">
                <MapPin aria-hidden="true" className="h-3.5 w-3.5" /> {pick(ghat, 'water_body')}
              </p>
            </div>
          </div>

          <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{pick(ghat, 'primary_reason')}</p>

          {ghat.deploy?.some((d) => d.type !== 'ngt') && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5" aria-label={t.sendTeams}>
              <span className="text-xs font-bold uppercase tracking-wide text-ink-muted">{t.sendLabel}:</span>
              {ghat.deploy.filter((d) => d.type !== 'ngt').map((d, i) => <TeamBadge key={i} d={d} size="sm" />)}
            </div>
          )}

          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <NgtChip ngt={ghat.ngt} />
            <ConfidenceChip conf={ghat.data_confidence} />
            {missing.length > 0 && (
              <span className="chip stripes-light text-stone-800 ring-stone-300">
                <EyeOff aria-hidden="true" className="h-3.5 w-3.5" />
                {missing.map((m) => `${fest(m.festival)} ${m.year}`).join(', ')}: {t.status.grey}
              </span>
            )}
          </div>
        </div>

        <div className="rounded-xl bg-stone-50 px-3 py-2.5 md:self-start">
          <PhaseSparks trend={trend} only="do" />
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-stone-100 px-4 py-2.5 sm:px-5">
        <button type="button" className="btn-ghost -ml-2 flex-1 justify-start text-ink sm:flex-none" onClick={() => onOpen(ghat.site_id)} aria-label={`${t.details}: ${name}`}>
          {t.details} <ArrowRight aria-hidden="true" className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </button>
        <span className="hidden flex-1 text-xs text-ink-muted sm:block">{t.score} {ghat.score}/100</span>
        <button type="button" className="btn-secondary" onClick={() => onBrief(ghat.site_id)} aria-label={`${t.genBrief}: ${name}`}>
          <MessageSquareText aria-hidden="true" className="h-4 w-4" /> {t.genBrief}
        </button>
      </div>
    </motion.article>
  )
}
