import { useState } from 'react'
import { Sparkles, Trash2, Send, UserPlus, Phone } from 'lucide-react'
import { useLang } from '../i18n.jsx'
import { useStore, waPhone } from '../store.js'
import { ACTION_ICON } from '../components/ui.jsx'

export default function TasksView({ ghats }) {
  const { t, pick, lang } = useLang()
  const store = useStore()
  const [filter, setFilter] = useState('open')
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState({ name: '', phone: '', site_id: '' })
  const byId = Object.fromEntries(ghats.map((g) => [g.site_id, g]))
  const rankOf = (id) => byId[id]?.rank ?? 99

  const tasks = store.tasks
    .filter((x) => (filter === 'all' ? true : filter === 'done' ? x.status === 'done' : x.status !== 'done'))
    .sort((a, b) => rankOf(a.site_id) - rankOf(b.site_id) || (a.priority === 'high' ? -1 : 1))

  const taskMessage = (task) => {
    const g = byId[task.site_id]
    const m = store.managers.find((x) => x.id === task.manager_id)
    const en = `Bhopal Jal Drishti — task\nGhat: ${g?.name}\n${m ? `To: ${m.name}\n` : ''}Task: ${task.text_en}\nDue: ${task.due}`
    const hi = `भोपाल जल दृष्टि — काम\nघाट: ${g?.name_hi}\n${m ? `प्रति: ${m.name}\n` : ''}काम: ${task.text_hi}\nकब तक: ${task.due}`
    return `${en}\n\n${hi}`
  }

  return (
    <section aria-labelledby="tk-h" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <h2 id="tk-h" className="page-title">{t.tasksTitle}</h2>
          <p className="page-sub">{t.tasksSub}</p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            const n = store.seedTasks(ghats)
            setMsg(t.tasksMade(n))
            setTimeout(() => setMsg(''), 3000)
          }}
        >
          <Sparkles aria-hidden="true" className="h-5 w-5" /> {t.makeTasks}
        </button>
      </div>
      {msg && <p className="rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-900 ring-1 ring-inset ring-emerald-200" role="status">{msg}</p>}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* task list */}
        <div className="space-y-3">
          <div className="seg" role="group" aria-label="Filter">
            {['open', 'done', 'all'].map((f) => (
              <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}
                className="seg-btn">
                {t.taskFilter[f]}
              </button>
            ))}
          </div>
          {tasks.length === 0 && <p className="card p-5 text-ink-muted">{t.widgetTasksEmpty}</p>}
          <ul className="space-y-3">
            {tasks.map((task) => {
              const Icon = ACTION_ICON[task.type]
              const m = store.managers.find((x) => x.id === task.manager_id)
              const phone = waPhone(m?.phone)
              const enc = encodeURIComponent(taskMessage(task))
              return (
                <li key={task.id} className={`card p-5 ${task.status === 'done' ? 'opacity-70' : ''}`}>
                  <div className="flex items-start gap-2">
                    <Icon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-orange-900" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold">
                        {t.actions[task.type]} · {byId[task.site_id]?.rank}. {pick(byId[task.site_id] || {}, 'name')}
                        <span className={`chip ml-2 px-2 py-0.5 text-[11px] ${task.priority === 'high' ? 'bg-red-50 text-red-800 ring-red-200' : 'bg-stone-100 text-ink-muted ring-stone-200'}`}>{t.priority[task.priority]}</span>
                      </p>
                      <p className={`text-[15px] leading-snug ${task.status === 'done' ? 'line-through' : ''}`}>{lang === 'hi' ? task.text_hi : task.text_en}</p>
                    </div>
                    <button type="button" className="btn px-0 text-ink-muted hover:bg-stone-100" onClick={() => store.removeTask(task.id)} aria-label={`${t.remove}: ${t.actions[task.type]}`}>
                      <Trash2 aria-hidden="true" className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                    <label className="text-xs font-bold">
                      {t.assignTo}
                      <select value={task.manager_id || ''} onChange={(e) => store.updateTask(task.id, { manager_id: e.target.value || null })}
                        className={`input mt-1 text-sm font-medium ${m ? '' : 'border-red-400 bg-red-50/40'}`}>
                        <option value="">{t.unassigned}</option>
                        {store.managers.map((mm) => <option key={mm.id} value={mm.id}>{mm.name}</option>)}
                      </select>
                    </label>
                    <label className="text-xs font-bold">
                      {t.due}
                      <input type="date" value={task.due} onChange={(e) => store.updateTask(task.id, { due: e.target.value })}
                        className="input mt-1 text-sm" />
                    </label>
                    <fieldset className="text-xs font-bold">
                      <legend>{lang === 'hi' ? 'स्थिति' : 'Status'}</legend>
                      <div className="seg mt-1 flex w-full">
                        {['todo', 'doing', 'done'].map((s) => (
                          <button key={s} type="button" aria-pressed={task.status === s} onClick={() => store.updateTask(task.id, { status: s })}
                            className={`seg-btn flex-1 whitespace-nowrap px-2 text-xs ${task.status === s && s === 'done' ? '!bg-emerald-700 !text-white' : ''}`}>
                            {t.taskStatus[s]}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                  </div>
                  <a className="btn mt-3 w-full bg-[#0B7A3B] text-sm text-white shadow-sm hover:bg-[#086130] sm:w-auto"
                    href={phone ? `https://wa.me/${phone}?text=${enc}` : `whatsapp://send?text=${enc}`} target={phone ? '_blank' : undefined} rel="noreferrer">
                    <Send aria-hidden="true" className="h-4 w-4" /> {t.sendTask}{m ? ` · ${m.name}` : ''}
                  </a>
                </li>
              )
            })}
          </ul>
        </div>

        {/* managers */}
        <aside className="card h-fit p-5 xl:sticky xl:top-24" aria-labelledby="mg-h">
          <h3 id="mg-h" className="mb-2 font-semibold">{t.managers}</h3>
          <ul className="mb-3 space-y-2">
            {store.managers.map((m) => (
              <li key={m.id} className="flex items-center gap-2 rounded-xl bg-stone-50 px-3 py-2 ring-1 ring-inset ring-stone-200">
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{m.name}</p>
                  <p className="truncate text-xs text-ink-muted">
                    {m.phone && <><Phone aria-hidden="true" className="mr-1 inline h-3 w-3" />{m.phone} · </>}
                    {m.site_id ? pick(byId[m.site_id] || {}, 'name') : '—'}
                  </p>
                </div>
                <button type="button" className="btn px-0 text-ink-muted hover:bg-stone-200" onClick={() => store.removeManager(m.id)} aria-label={`${t.remove}: ${m.name}`}>
                  <Trash2 aria-hidden="true" className="h-5 w-5" />
                </button>
              </li>
            ))}
          </ul>
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (!form.name.trim()) return
              store.addManager({ name: form.name.trim(), phone: form.phone.trim(), site_id: form.site_id || null })
              setForm({ name: '', phone: '', site_id: '' })
            }}
          >
            <p className="text-sm font-bold">{t.addManager}</p>
            <label className="block text-xs font-bold">{t.managerName}
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input mt-1" autoComplete="name" />
            </label>
            <label className="block text-xs font-bold">{t.managerPhone}
              <input type="tel" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input mt-1" placeholder="98XXXXXXXX" autoComplete="tel" />
            </label>
            <label className="block text-xs font-bold">{t.managerGhat}
              <select value={form.site_id} onChange={(e) => setForm({ ...form, site_id: e.target.value })} className="input mt-1">
                <option value="">—</option>
                {ghats.map((g) => <option key={g.site_id} value={g.site_id}>{pick(g, 'name')}</option>)}
              </select>
            </label>
            <button type="submit" className="btn-outline w-full"><UserPlus aria-hidden="true" className="h-5 w-5" /> {t.save}</button>
          </form>
        </aside>
      </div>
    </section>
  )
}
