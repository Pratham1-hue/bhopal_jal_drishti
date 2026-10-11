import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Check, Plus, ClipboardList, ArrowRight } from 'lucide-react'
import { fetchPlan } from '../api.js'
import { useLang } from '../i18n.jsx'
import { useStore } from '../store.js'
import { ACTION_ICON, SourceLink, StatusBadge, TEAM_STYLE } from '../components/ui.jsx'

const TEAMS = ['aeration', 'cleaning', 'testing']

export default function PlanView({ onOpen, go }) {
  const { t, lang, pick } = useLang()
  const store = useStore()
  const { data, isLoading, isError } = useQuery({ queryKey: ['plan'], queryFn: fetchPlan })
  const [team, setTeam] = useState('aeration') // mobile: one team at a time

  if (isLoading) return <p className="flex items-center gap-2 py-10" role="status"><Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" /> {t.loading}</p>
  if (isError) return <p className="py-10 font-semibold text-red-800">{t.loadError}</p>

  const addAll = () => {
    for (const k of [...TEAMS, 'ngt']) for (const x of data.teams[k]) store.addOneTask(x.site_id, { type: k, ...x })
    go('tasks')
  }

  return (
    <section aria-labelledby="plan-h" className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <h2 id="plan-h" className="page-title">{t.planTitle}</h2>
          <p className="page-sub">{t.planSub}</p>
        </div>
        <button type="button" className="btn-primary" onClick={addAll}>
          <ClipboardList aria-hidden="true" className="h-[18px] w-[18px]" /> {t.addAll}
        </button>
      </div>

      {/* summary tiles — also the team switcher on mobile */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-4" role="tablist" aria-label={t.sendTeams}>
        {TEAMS.map((k) => {
          const Icon = ACTION_ICON[k]
          const s = TEAM_STYLE[k]
          const active = team === k
          return (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTeam(k)}
              className={`rounded-2xl p-3 text-left shadow-card transition sm:p-5 lg:cursor-default ${s.solid} ${active ? 'ring-4 ring-yellow-300 lg:ring-0' : 'opacity-90 lg:opacity-100'}`}
            >
              <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide sm:text-xs">
                <Icon aria-hidden="true" className="h-4 w-4" /> {t.team[k]}
              </span>
              <span className="mt-1 block text-2xl font-bold tabular-nums sm:text-4xl">{data.counts[k]}</span>
              <span className="block text-[11px] opacity-90 sm:text-xs">
                {lang === 'hi' ? 'घाट' : 'ghats'} · {data.urgent[k]} {t.priority.high.toLowerCase()}
              </span>
            </button>
          )
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {TEAMS.map((k) => (
          <div key={k} className={`${team === k ? 'block' : 'hidden'} lg:block`} role="tabpanel" aria-label={t.team[k]}>
            <TeamColumn k={k} items={data.teams[k]} onOpen={onOpen} store={store} />
          </div>
        ))}
      </div>

      {data.teams.ngt.length > 0 && (
        <div className="card p-5">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-indigo-950">
            {(() => { const I = ACTION_ICON.ngt; return <I aria-hidden="true" className="h-5 w-5" /> })()} {t.team.ngt}
          </h3>
          <ul className="grid gap-2 md:grid-cols-2">
            {data.teams.ngt.map((x) => (
              <li key={x.site_id} className={`flex items-start gap-3 rounded-xl p-3 ring-1 ring-inset ${x.level === 'divert' ? 'bg-red-50 ring-red-200' : 'bg-indigo-50 ring-indigo-200'}`}>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-semibold">{x.rank}. {pick(x, 'name')} <span className="ml-1 text-xs font-bold uppercase">{t.level[x.level]}</span></p>
                  <p className="text-ink-soft">{lang === 'hi' ? x.hi : x.en}</p>
                </div>
                <button type="button" className="btn-secondary min-h-[40px] shrink-0 px-3 text-sm" onClick={() => onOpen(x.site_id)}>
                  {t.details} <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-sm text-ink-muted">{pick(data, 'note')}</p>
    </section>
  )
}

function TeamColumn({ k, items, onOpen, store }) {
  const { t, pick, lang } = useLang()
  const s = TEAM_STYLE[k]
  const Icon = ACTION_ICON[k]
  return (
    <div className="card overflow-hidden">
      <div className={`flex items-center gap-2 px-4 py-3 ${s.solid}`}>
        <Icon aria-hidden="true" className="h-5 w-5" />
        <h3 className="flex-1 font-semibold">{t.team[k]}</h3>
        <span className="rounded-full bg-white/20 px-2 text-sm font-bold">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="p-4 text-sm text-ink-muted">{t.noneNeeded}</p>
      ) : (
        <ol className="divide-y divide-stone-100">
          {items.map((x, i) => {
            const added = store.hasTask(x.site_id, x.en)
            return (
              <li key={`${x.site_id}-${i}`} className="p-4">
                <div className="flex items-start gap-2">
                  <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${x.priority === 'high' ? 'bg-risk-red text-white' : 'bg-stone-200 text-ink'}`} aria-hidden="true">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <button type="button" onClick={() => onOpen(x.site_id)} className="text-left font-semibold underline-offset-2 hover:underline">{pick(x, 'name')}</button>
                      <StatusBadge status={x.status} size="sm" />
                    </p>
                    <p className={`mt-0.5 text-xs font-bold uppercase tracking-wide ${x.priority === 'high' ? 'text-red-800' : s.text}`}>{t.level[x.level]}</p>
                    <p className="mt-1 text-sm leading-relaxed text-ink-soft">{lang === 'hi' ? x.hi : x.en}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {x.evidence.filter((e) => e.source?.page).map((e, j) => <SourceLink key={j} source={e.source} compact />)}
                      <button
                        type="button"
                        disabled={added}
                        onClick={() => store.addOneTask(x.site_id, { type: k, ...x })}
                        className={`inline-flex min-h-[36px] items-center gap-1 rounded-lg px-2.5 text-xs font-semibold ring-1 ring-inset ${added ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : 'bg-white text-ink ring-stone-300 hover:bg-stone-50'}`}
                      >
                        {added ? <Check aria-hidden="true" className="h-3.5 w-3.5" /> : <Plus aria-hidden="true" className="h-3.5 w-3.5" />}
                        {added ? t.added : t.addTask}
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
