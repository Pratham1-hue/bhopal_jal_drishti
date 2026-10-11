import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  LayoutDashboard, EyeOff, Gauge, BookOpenCheck, BarChart3, ClipboardList, MessageSquareText, Info,
  Languages, WifiOff, MoreHorizontal, X, UserRound, Route, Map as MapIcon, BellRing, ArrowRight,
} from 'lucide-react'
import { useLang } from '../i18n.jsx'
import NotificationBell from './NotificationBell.jsx'

export const NAV = [
  { k: 'dashboard', Icon: LayoutDashboard },
  { k: 'plan', Icon: Route },
  { k: 'map', Icon: MapIcon },
  { k: 'anomalies', Icon: EyeOff },
  { k: 'cpcb', Icon: Gauge },
  { k: 'guidelines', Icon: BookOpenCheck },
  { k: 'data', Icon: BarChart3 },
  { k: 'tasks', Icon: ClipboardList },
  { k: 'brief', Icon: MessageSquareText },
  { k: 'method', Icon: Info },
]
const TOP_TABS = [
  ['dashboard', ''], ['plan', ''], ['map', ''], ['cpcb', ''], ['guidelines', 'hidden xl:inline-flex'], ['data', 'hidden xl:inline-flex'],
]
const MOBILE_MAIN = ['dashboard', 'plan', 'map', 'brief']

export function daysUntil(dateStr = '2026-10-20') {
  const target = new Date(`${dateStr}T00:00:00`)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((target - today) / 86400000)
}

function LangButton({ dark = false, compact = false }) {
  const { t, toggle, lang } = useLang()
  return (
    <button
      type="button"
      onClick={toggle}
      className={`btn shrink-0 px-3 ${dark ? 'border-2 border-white/80 bg-white/10 text-white hover:bg-white/20' : 'border border-stone-300 bg-white text-ink shadow-sm hover:bg-stone-50'}`}
      aria-label={t.langToggleAria}
      aria-pressed={lang === 'hi'}
    >
      <Languages aria-hidden="true" className="h-[18px] w-[18px]" />
      <span lang={lang === 'en' ? 'hi' : 'en'}>{compact ? (lang === 'en' ? 'हिं' : 'EN') : t.langToggle}</span>
    </button>
  )
}

function OfflineBar({ cachedAt }) {
  const { t, lang } = useLang()
  if (!cachedAt) return null
  return (
    <div className="bg-stone-900 px-4 py-1.5 text-center text-sm text-white" role="status">
      <WifiOff aria-hidden="true" className="mr-1.5 inline h-4 w-4" />
      {t.offline(new Date(cachedAt).toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-IN'))}
    </div>
  )
}

/* Site-wide warning bar: the one message the officer must not miss. */
export function NavratriBar({ go }) {
  const { t } = useLang()
  const days = daysUntil()
  if (days < 0) return null
  return (
    <div className="bg-orange-900 text-white" role="region" aria-label="Navratri">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2 lg:px-8">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-300 px-3 py-1 text-xs font-bold text-stone-950">
          <BellRing aria-hidden="true" className="h-3.5 w-3.5" />
          {days > 0 ? `${days} ${t.daysLeft}` : t.daysTo(0)}
        </span>
        <p className="order-3 basis-full text-sm font-medium leading-snug sm:order-none sm:min-w-0 sm:flex-1 sm:basis-auto">{t.navratriBar(days)}</p>
        <button type="button" onClick={() => go('plan')} className="ml-auto inline-flex min-h-[36px] items-center gap-1 rounded-lg px-2 text-sm font-semibold text-yellow-200 underline-offset-2 hover:underline sm:ml-0">
          {t.openPlan} <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

/* ---------------- desktop ---------------- */
export function Sidebar({ view, go, badges }) {
  const { t } = useLang()
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col bg-orange-950 text-white lg:flex" aria-label={t.menu}>
      <div className="tricolor h-1 shrink-0" aria-hidden="true" />
      <div className="flex items-center gap-3 px-5 pb-5 pt-5">
        <img src="/favicon.svg" alt="" className="h-11 w-11 shrink-0 rounded-xl shadow-sm" />
        <div className="min-w-0">
          <p className="text-base font-bold leading-tight">{t.appName}</p>
          <p className="text-xs leading-snug text-orange-200">{t.org}</p>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3" aria-label={t.menu}>
        <ul className="space-y-0.5">
          {NAV.map(({ k, Icon }) => {
            const active = view === k
            return (
              <li key={k}>
                <button
                  type="button"
                  onClick={() => go(k)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-touch w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] font-medium transition ${
                    active ? 'bg-white font-semibold text-orange-950 shadow-sm' : 'text-orange-50 hover:bg-white/10'
                  }`}
                >
                  <Icon aria-hidden="true" className={`h-5 w-5 shrink-0 ${active ? 'text-orange-800' : 'text-orange-200'}`} />
                  <span className="flex-1">{t.nav[k]}</span>
                  {badges[k] ? (
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${active ? 'bg-risk-red text-white' : 'bg-yellow-300 text-stone-950'}`}>{badges[k]}</span>
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
      <div className="m-3 flex items-center gap-3 rounded-2xl bg-white/10 p-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-200 text-orange-950" aria-hidden="true">
          <UserRound className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{t.officer}</p>
          <p className="truncate text-xs text-orange-200">{t.officerSub}</p>
        </div>
      </div>
    </aside>
  )
}

export function TopBar({ view, go, cachedAt }) {
  return (
    <header className="sticky top-0 z-20 hidden border-b border-stone-200 bg-white/95 backdrop-blur-md lg:block">
      <div className="tricolor h-1" aria-hidden="true" />
      <div className="flex items-center gap-3 px-8 py-2.5">
        <nav aria-label="Sections" className="flex-1">
          <div className="flex flex-wrap gap-1">
            {TOP_TABS.map(([k, cls]) => (
              <TopTab key={k} k={k} cls={cls} view={view} go={go} />
            ))}
          </div>
        </nav>
        <LangButton />
        <NotificationBell go={go} />
      </div>
      <OfflineBar cachedAt={cachedAt} />
    </header>
  )
}

function TopTab({ k, cls, view, go }) {
  const { t } = useLang()
  const active = view === k
  return (
    <button
      type="button"
      onClick={() => go(k)}
      aria-current={active ? 'page' : undefined}
      className={`${cls || 'inline-flex'} min-h-[44px] items-center rounded-xl px-4 text-[15px] font-semibold transition ${
        active ? 'bg-orange-900 text-white shadow-sm' : 'text-ink-soft hover:bg-orange-50 hover:text-orange-950'
      }`}
    >
      {t.topTabs[k]}
    </button>
  )
}

/* ---------------- mobile ---------------- */
export function MobileHeader({ go, cachedAt }) {
  const { t } = useLang()
  return (
    <header className="sticky top-0 z-30 bg-orange-950 text-white shadow-md lg:hidden">
      <div className="tricolor h-1" aria-hidden="true" />
      <div className="flex items-center gap-2 px-3 py-2.5">
        <img src="/favicon.svg" alt="" className="h-9 w-9 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold leading-tight">{t.appName}</p>
          <p className="truncate text-[11px] text-orange-200">{t.org}</p>
        </div>
        <LangButton dark compact />
        <NotificationBell go={go} dark />
      </div>
      <OfflineBar cachedAt={cachedAt} />
    </header>
  )
}

export function BottomNav({ view, go, badges }) {
  const { t } = useLang()
  const [more, setMore] = useState(false)
  const inMore = !MOBILE_MAIN.includes(view)
  const items = NAV.filter((n) => MOBILE_MAIN.includes(n.k))
  const moreBadge = (badges.anomalies || 0) + (badges.tasks || 0) || undefined
  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur-md lg:hidden" aria-label="Main">
        <ul className="grid grid-cols-5 px-1">
          {items.map(({ k, Icon }) => (
            <li key={k}>
              <NavBtn active={view === k} label={t.navShort[k]} Icon={Icon} badge={badges[k]} onClick={() => go(k)} />
            </li>
          ))}
          <li>
            <NavBtn active={inMore} label={t.more} Icon={MoreHorizontal} badge={moreBadge} onClick={() => setMore(true)} expanded={more} />
          </li>
        </ul>
      </nav>
      <AnimatePresence>
        {more && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={t.more}>
            <motion.div className="absolute inset-0 bg-stone-900/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMore(false)} />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 340 }}
              className="absolute inset-x-0 bottom-0 rounded-t-4xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-pop"
            >
              <div className="mx-auto -mt-2 mb-3 h-1.5 w-10 rounded-full bg-stone-300" aria-hidden="true" />
              <div className="mb-3 flex items-center justify-between">
                <p className="text-lg font-bold">{t.more}</p>
                <button type="button" className="btn-secondary px-0" onClick={() => setMore(false)} aria-label={t.close}>
                  <X aria-hidden="true" className="h-5 w-5" />
                </button>
              </div>
              <ul className="grid grid-cols-2 gap-2.5">
                {NAV.filter((n) => !MOBILE_MAIN.includes(n.k)).map(({ k, Icon }) => (
                  <li key={k}>
                    <button
                      type="button"
                      onClick={() => {
                        setMore(false)
                        go(k)
                      }}
                      className={`flex min-h-[64px] w-full items-center gap-3 rounded-2xl px-3 text-left text-sm font-semibold ring-1 ring-inset transition ${
                        view === k ? 'bg-orange-50 text-orange-950 ring-orange-300' : 'bg-stone-50 text-ink ring-stone-200'
                      }`}
                    >
                      <Icon aria-hidden="true" className={`h-5 w-5 shrink-0 ${view === k ? 'text-orange-800' : 'text-stone-500'}`} />
                      <span className="flex-1">{t.nav[k]}</span>
                      {badges[k] ? <span className="rounded-full bg-risk-red px-2 text-[11px] font-bold text-white">{badges[k]}</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}

function NavBtn({ active, label, Icon, badge, onClick, expanded }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      aria-expanded={expanded}
      className={`flex min-h-[64px] w-full flex-col items-center justify-center gap-1 text-[11px] font-semibold ${active ? 'text-orange-900' : 'text-ink-muted'}`}
    >
      <span className={`relative flex h-8 w-14 items-center justify-center rounded-full transition ${active ? 'bg-orange-100' : ''}`}>
        <Icon aria-hidden="true" className="h-5 w-5" />
        {badge ? <span className="absolute -right-0.5 -top-1 min-w-[18px] rounded-full bg-risk-red px-1 text-[10px] font-bold leading-[18px] text-white">{badge}</span> : null}
      </span>
      <span className="line-clamp-1">{label}</span>
    </button>
  )
}
