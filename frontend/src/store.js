import { useCallback, useEffect, useState } from 'react'

// Tasks and ghat managers live only in this browser (localStorage) — no personal data goes to a server.
const KEY = 'vgw-tasks-v1'
const EVENT = 'vgw-store-change'

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY))
    if (raw && Array.isArray(raw.tasks) && Array.isArray(raw.managers)) return raw
  } catch {
    /* ignore */
  }
  return { tasks: [], managers: [], readAlerts: [] }
}

function save(state) {
  localStorage.setItem(KEY, JSON.stringify(state))
  window.dispatchEvent(new Event(EVENT))
}

const uid = () => Math.random().toString(36).slice(2, 10)

export function waPhone(phone) {
  const d = (phone || '').replace(/\D/g, '')
  if (d.length === 10) return `91${d}`
  return d
}

export function useStore() {
  const [state, setState] = useState(load)

  useEffect(() => {
    const sync = () => setState(load())
    window.addEventListener(EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const update = useCallback((fn) => {
    const next = fn(load())
    save(next)
    setState(next)
  }, [])

  return {
    ...state,
    readAlerts: state.readAlerts || [],
    // A new manager for a ghat also takes over that ghat's unassigned tasks.
    addManager: (m) =>
      update((s) => {
        const id = uid()
        return {
          ...s,
          managers: [...s.managers, { id, ...m }],
          tasks: s.tasks.map((t) => (m.site_id && t.site_id === m.site_id && !t.manager_id ? { ...t, manager_id: id } : t)),
        }
      }),
    removeManager: (id) =>
      update((s) => ({
        ...s,
        managers: s.managers.filter((m) => m.id !== id),
        tasks: s.tasks.map((t) => (t.manager_id === id ? { ...t, manager_id: null } : t)),
      })),
    updateTask: (id, patch) => update((s) => ({ ...s, tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
    removeTask: (id) => update((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) })),
    // One task per ghat + action type; running it again only adds what is new.
    seedTasks: (ghats) => {
      let added = 0
      update((s) => {
        const have = new Set(s.tasks.map((t) => `${t.site_id}:${t.type}:${t.text_en}`))
        const fresh = []
        for (const g of ghats) {
          for (const a of g.actions) {
            const k = `${g.site_id}:${a.type}:${a.en}`
            if (have.has(k)) continue
            const manager = s.managers.find((m) => m.site_id === g.site_id)
            fresh.push({
              id: uid(),
              site_id: g.site_id,
              type: a.type,
              priority: a.priority,
              text_en: a.en,
              text_hi: a.hi,
              manager_id: manager ? manager.id : null,
              status: 'todo',
              due: '2026-10-19',
              created: Date.now(),
            })
          }
        }
        added = fresh.length
        return { ...s, tasks: [...s.tasks, ...fresh] }
      })
      return added
    },
    hasTask: (siteId, text) => state.tasks.some((x) => x.site_id === siteId && x.text_en === text),
    addOneTask: (siteId, a) =>
      update((s) => {
        if (s.tasks.some((x) => x.site_id === siteId && x.text_en === a.en)) return s
        const manager = s.managers.find((m) => m.site_id === siteId)
        return {
          ...s,
          tasks: [...s.tasks, {
            id: uid(), site_id: siteId, type: a.type, priority: a.priority, text_en: a.en, text_hi: a.hi,
            manager_id: manager ? manager.id : null, status: 'todo', due: '2026-10-19', created: Date.now(),
          }],
        }
      }),
    markAlertsRead: (ids) => update((s) => ({ ...s, readAlerts: Array.from(new Set([...(s.readAlerts || []), ...ids])) })),
  }
}
