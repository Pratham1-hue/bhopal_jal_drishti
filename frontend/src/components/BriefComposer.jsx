import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Copy, Check, Send, MessageSquare, Loader2, Sparkles, ShieldCheck, Info, Wand2 } from 'lucide-react'
import { generateBrief } from '../api.js'
import { useLang } from '../i18n.jsx'
import { useStore, waPhone } from '../store.js'

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  }
}

export function applicableIssues(g) {
  if (!g) return []
  const out = []
  if (g.ngt) out.push('ngt')
  if (g.stats.do_below_limit) out.push('do')
  if (g.stats.bod_above_limit) out.push('bod')
  if (g.stats.ph_out_of_range) out.push('ph')
  if (g.has_blind_spot) out.push('gaps')
  if (g.site_match_confidence !== 'high') out.push('name')
  return out
}

const pickText = (res, lang) => (lang === 'en' ? res.english : lang === 'hi' ? res.hindi : res.combined)

export default function BriefComposer({ ghats, initialSite = 'all', autoGenerate = false }) {
  const { t, pick, lang: uiLang } = useLang()
  const store = useStore()
  const [site, setSite] = useState(initialSite)
  const ghat = ghats.find((g) => g.site_id === site)
  const available = useMemo(() => applicableIssues(ghat), [ghat])
  const [issues, setIssues] = useState(available)
  const [managerId, setManagerId] = useState('')
  const [note, setNote] = useState('')
  const [language, setLanguage] = useState('both')
  const [audience, setAudience] = useState('bmc')
  const [text, setText] = useState('')
  const [edited, setEdited] = useState(false)
  const [instruction, setInstruction] = useState('')
  const [copied, setCopied] = useState(false)
  const [result, setResult] = useState(null)
  const started = useRef(false)

  // When the ghat changes, reset the issue list and suggest that ghat's manager.
  useEffect(() => {
    setIssues(applicableIssues(ghats.find((g) => g.site_id === site)))
    const m = store.managers.find((x) => x.site_id === site)
    setManagerId(m ? m.id : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site, ghats.length])

  const manager = store.managers.find((m) => m.id === managerId)

  const gen = useMutation({
    mutationFn: generateBrief,
    onSuccess: (res, vars) => {
      setResult(res)
      if (vars.instruction) {
        if (res.refined) {
          setText(pickText(res, language))
          setInstruction('')
        }
      } else {
        setText(pickText(res, language))
        setEdited(false)
      }
    },
  })

  const run = (extra = {}) =>
    gen.mutate({
      site_id: site,
      audience,
      issues: site === 'all' || audience !== 'bmc' ? undefined : issues,
      manager: manager?.name || undefined,
      note: note.trim() || undefined,
      language,
      ...extra,
    })

  useEffect(() => {
    if (autoGenerate && !started.current) {
      started.current = true
      run()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const changeLanguage = (l) => {
    setLanguage(l)
    if (result && !edited) setText(pickText(result, l))
  }

  const enc = encodeURIComponent(text)
  const phone = waPhone(manager?.phone)
  const waHref = phone ? `https://wa.me/${phone}?text=${enc}` : `whatsapp://send?text=${enc}`

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      {/* ---- left: choices ---- */}
      <form
        className="card space-y-5 p-5"
        onSubmit={(e) => {
          e.preventDefault()
          run()
        }}
      >
        <fieldset>
          <legend className="mb-1 text-sm font-bold">{uiLang === 'hi' ? 'किसके लिए' : 'Who is it for'}</legend>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-orange-50 p-1 ring-1 ring-inset ring-orange-200">
            {['bmc', 'police', 'public'].map((k) => (
              <label key={k} className={`flex min-h-[44px] cursor-pointer items-center justify-center rounded-lg px-1 text-center text-sm font-semibold transition has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-blue-600 ${audience === k ? 'bg-orange-800 text-white shadow-sm' : 'text-orange-950'}`}>
                <input type="radio" name="bc-aud" value={k} checked={audience === k} onChange={() => setAudience(k)} className="sr-only" />
                {t.audience[k]}
              </label>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-ink-muted">{t.audienceSub[audience]}</p>
        </fieldset>

        <div>
          <label htmlFor="bc-site" className="mb-1 block text-sm font-bold">{t.chooseGhat}</label>
          <select id="bc-site" value={site} onChange={(e) => setSite(e.target.value)} className="input font-medium">
            <option value="all">{t.allGhats}</option>
            {ghats.map((g) => (
              <option key={g.site_id} value={g.site_id}>{g.rank}. {pick(g, 'name')}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="bc-mgr" className="mb-1 block text-sm font-bold">{t.chooseManager}</label>
          <select id="bc-mgr" value={managerId} onChange={(e) => setManagerId(e.target.value)} className="input font-medium">
            <option value="">{t.noManager}</option>
            {store.managers.map((m) => (
              <option key={m.id} value={m.id}>{m.name}{m.phone ? ` · ${m.phone}` : ''}</option>
            ))}
          </select>
          {store.managers.length === 0 && <p className="mt-1 text-xs text-ink-muted">{t.addManagerHint}</p>}
        </div>

        {site !== 'all' && audience === 'bmc' && available.length > 0 && (
          <fieldset>
            <legend className="mb-1 text-sm font-bold">{t.chooseIssues}</legend>
            <div className="flex flex-wrap gap-2">
              {available.map((k) => {
                const on = issues.includes(k)
                return (
                  <label
                    key={k}
                    className={`flex min-h-touch cursor-pointer items-center gap-2 rounded-xl px-3 text-sm font-semibold ring-1 ring-inset transition ${
                      on ? 'bg-orange-50 text-orange-950 ring-orange-300' : 'bg-white text-ink-soft ring-stone-300 hover:ring-stone-400'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-orange-800"
                      checked={on}
                      onChange={() => setIssues((s) => (on ? s.filter((x) => x !== k) : [...s, k]))}
                    />
                    {t.issue[k]}
                  </label>
                )
              })}
            </div>
          </fieldset>
        )}

        <div>
          <label htmlFor="bc-note" className="mb-1 block text-sm font-bold">{t.extraNote}</label>
          <textarea
            id="bc-note"
            rows={2}
            value={note}
            maxLength={1000}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t.extraNotePh}
            className="input py-2.5"
          />
        </div>

        <fieldset>
          <legend className="mb-1 text-sm font-bold">{t.language}</legend>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-stone-100 p-1">
            {[['en', t.english], ['hi', t.hindi], ['both', t.both]].map(([k, label]) => (
              <label key={k} className={`flex min-h-[40px] cursor-pointer items-center justify-center rounded-lg text-sm font-semibold transition has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-blue-600 ${language === k ? 'bg-white text-ink shadow-sm' : 'text-ink-soft'}`}>
                <input type="radio" name="bc-lang" value={k} checked={language === k} onChange={() => changeLanguage(k)} className="sr-only" />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <button type="submit" className="btn-brand w-full" disabled={gen.isPending}>
          {gen.isPending && !gen.variables?.instruction ? <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" /> : <Sparkles aria-hidden="true" className="h-5 w-5" />}
          {gen.isPending && !gen.variables?.instruction ? t.generating : t.generate}
        </button>
      </form>

      {/* ---- right: editable brief ---- */}
      <div className="space-y-3">
        {gen.isError && <p className="rounded-xl bg-red-50 p-3 font-semibold text-red-900" role="alert">{t.briefError}</p>}

        {!result && gen.isPending && (
          <div className="animate-pulse space-y-2 rounded-2xl bg-white p-4 ring-1 ring-stone-300" aria-hidden="true">
            <div className="h-4 w-3/4 rounded bg-stone-200" />
            <div className="h-4 w-full rounded bg-stone-200" />
            <div className="h-4 w-5/6 rounded bg-stone-200" />
          </div>
        )}

        {result && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className={`chip ${result.source === 'claude' ? 'bg-violet-50 text-violet-900 ring-violet-200' : 'bg-emerald-50 text-emerald-900 ring-emerald-200'}`}>
                <ShieldCheck aria-hidden="true" className="h-4 w-4" />
                {result.source === 'claude' ? t.briefByAI(result.model) : t.briefByTemplate}
              </span>
            </div>
            {result.note && (
              <p className="flex items-start gap-1.5 rounded-xl bg-stone-100 px-3 py-2 text-xs text-ink-soft" role="status">
                <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" /> {result.note}
              </p>
            )}
            <div>
              <label htmlFor="bc-text" className="mb-1 block text-sm font-bold">{t.editable}</label>
              <textarea
                id="bc-text"
                value={text}
                onChange={(e) => {
                  setText(e.target.value)
                  setEdited(true)
                }}
                rows={14}
                className="input min-h-[320px] rounded-2xl p-4 text-[15px] leading-relaxed"
                lang={language === 'hi' ? 'hi' : undefined}
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button type="button" className="btn-outline" onClick={async () => { if (await copyText(text)) { setCopied(true); setTimeout(() => setCopied(false), 2000) } }}>
                {copied ? <Check aria-hidden="true" className="h-5 w-5" /> : <Copy aria-hidden="true" className="h-5 w-5" />}
                <span aria-live="polite">{copied ? t.copied : t.copy}</span>
              </button>
              <a className="btn bg-[#0B7A3B] text-white shadow-sm hover:bg-[#086130]" href={waHref} target={phone ? '_blank' : undefined} rel="noreferrer">
                <Send aria-hidden="true" className="h-5 w-5" /> {t.whatsapp}
              </a>
              <a className="btn-outline" href={`sms:${manager?.phone || ''}?&body=${enc}`}>
                <MessageSquare aria-hidden="true" className="h-5 w-5" /> {t.sms}
              </a>
            </div>
            {!phone && (
              <p className="text-center text-xs text-ink-muted">
                WhatsApp Web: <a className="font-semibold text-blue-800 underline" href={`https://wa.me/?text=${enc}`} target="_blank" rel="noreferrer">wa.me</a>
              </p>
            )}

            <form
              className="flex gap-2 rounded-2xl bg-violet-50/70 p-2 ring-1 ring-inset ring-violet-200"
              onSubmit={(e) => {
                e.preventDefault()
                if (instruction.trim()) run({ instruction: instruction.trim(), previous: text })
              }}
            >
              <label htmlFor="bc-ask" className="sr-only">{t.askClaude}</label>
              <Wand2 aria-hidden="true" className="ml-1 mt-3.5 h-5 w-5 shrink-0 text-violet-800" />
              <input
                id="bc-ask"
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder={`${t.askClaude} — ${t.askClaudePh}`}
                maxLength={600}
                className="input min-w-0 flex-1 border-violet-200"
                lang={uiLang === 'hi' ? 'hi' : undefined}
              />
              <button type="submit" className="btn shrink-0 bg-violet-700 text-white hover:bg-violet-800" disabled={gen.isPending || !instruction.trim()}>
                {gen.isPending && gen.variables?.instruction ? <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" /> : t.send}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
