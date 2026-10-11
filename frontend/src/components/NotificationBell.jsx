import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { Bell, AlertOctagon, AlertTriangle, CalendarClock, ClipboardList } from 'lucide-react'
import { fetchNotifications } from '../api.js'
import { useLang } from '../i18n.jsx'
import { useStore } from '../store.js'

const LEVEL = {
  high: { Icon: AlertOctagon, cls: 'text-risk-red' },
  warning: { Icon: AlertTriangle, cls: 'text-amber-700' },
  info: { Icon: CalendarClock, cls: 'text-blue-800' },
  task: { Icon: ClipboardList, cls: 'text-orange-900' },
}

export default function NotificationBell({ go, dark = false }) {
  const { t, pick, lang } = useLang()
  const store = useStore()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const { data } = useQuery({ queryKey: ['notifications'], queryFn: fetchNotifications })

  const openTasks = store.tasks.filter((x) => x.status !== 'done')
  const unassigned = openTasks.filter((x) => !x.manager_id && x.priority === 'high')
  const items = [...(data?.items || [])]
  if (unassigned.length) {
    items.splice(1, 0, {
      id: `tasks-unassigned-${unassigned.length}`,
      level: 'task',
      title: lang === 'hi' ? `${unassigned.length} तुरंत वाले काम किसी को नहीं दिए` : `${unassigned.length} urgent task(s) not assigned`,
      body: lang === 'hi' ? 'काम पेज पर घाट प्रबंधक चुनें।' : 'Pick a ghat manager on the Tasks page.',
      target: { view: 'tasks' },
    })
  }
  const unread = items.filter((i) => !store.readAlerts.includes(i.id))

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
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`${t.notifications}${unread.length ? `, ${unread.length}` : ''}`}
        className={`btn relative px-0 ${dark ? 'border-2 border-white/80 bg-white/10 text-white hover:bg-white/20' : 'border border-stone-300 bg-white text-ink shadow-sm hover:bg-stone-50'}`}
      >
        <Bell aria-hidden="true" className="h-5 w-5" />
        {unread.length > 0 && (
          <span className="absolute -right-1.5 -top-1.5 min-w-[20px] rounded-full bg-risk-red px-1 text-xs font-bold leading-5 text-white">
            {unread.length}
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="fixed inset-x-3 top-16 z-50 max-h-[70vh] overflow-y-auto rounded-2xl border border-stone-200 bg-white text-ink shadow-pop sm:absolute sm:inset-x-auto sm:right-0 sm:top-14 sm:w-[400px]"
            role="region"
            aria-label={t.notifications}
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-stone-200 bg-white px-4 py-2">
              <p className="font-semibold">{t.notifications}</p>
              {unread.length > 0 && (
                <button type="button" className="min-h-touch text-sm font-bold text-blue-800 underline" onClick={() => store.markAlertsRead(items.map((i) => i.id))}>
                  {t.markRead}
                </button>
              )}
            </div>
            {items.length === 0 && <p className="p-4 text-sm">{t.noNotifications}</p>}
            <ul>
              {items.map((n) => {
                const L = LEVEL[n.level] || LEVEL.info
                const isUnread = !store.readAlerts.includes(n.id)
                return (
                  <li key={n.id} className="border-b border-stone-100 last:border-0">
                    <button
                      type="button"
                      onClick={() => {
                        store.markAlertsRead([n.id])
                        setOpen(false)
                        go(n.target?.view || 'dashboard', n.target?.site_id)
                      }}
                      className={`flex w-full gap-3 px-4 py-3 text-left hover:bg-stone-50 ${isUnread ? 'bg-orange-50/60' : ''}`}
                    >
                      <L.Icon aria-hidden="true" className={`mt-0.5 h-5 w-5 shrink-0 ${L.cls}`} />
                      <span className="min-w-0">
                        <span className="block text-sm font-bold leading-snug">{pick(n, 'title')}</span>
                        <span className="line-clamp-2 block text-xs text-ink-muted">{pick(n, 'body')}</span>
                      </span>
                      {isUnread && <span className="ml-auto mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-risk-red" aria-label="unread" />}
                    </button>
                  </li>
                )
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
