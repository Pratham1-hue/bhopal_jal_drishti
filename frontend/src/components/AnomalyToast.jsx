import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { EyeOff, X } from 'lucide-react'
import { fetchAnomalies } from '../api.js'
import { useLang } from '../i18n.jsx'

// "Data anomaly pop-up": once per browser session, show the most serious data problem.
export default function AnomalyToast({ go }) {
  const { t, pick } = useLang()
  const { data } = useQuery({ queryKey: ['anomalies'], queryFn: fetchAnomalies })
  const [show, setShow] = useState(false)
  const top = data?.anomalies?.find((a) => a.severity === 'high' && a.category === 'gap')

  useEffect(() => {
    if (!top || sessionStorage.getItem('vgw-toast')) return
    const open = setTimeout(() => {
      sessionStorage.setItem('vgw-toast', '1')
      setShow(true)
    }, 1200)
    const close = setTimeout(() => setShow(false), 14000)
    return () => {
      clearTimeout(open)
      clearTimeout(close)
    }
  }, [top])

  return (
    <AnimatePresence>
      {show && top && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 30 }}
          className="fixed inset-x-3 bottom-[84px] z-40 rounded-2xl border border-stone-200 bg-white p-4 shadow-pop sm:left-auto sm:right-5 sm:w-96 lg:bottom-5"
          role="alert"
        >
          <div className="flex items-start gap-2">
            <span className="stripes-light flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-muted ring-1 ring-inset ring-stone-300" aria-hidden="true">
              <EyeOff className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase text-ink-muted">{t.popupTitle}</p>
              <p className="font-semibold leading-snug">{pick(top, 'title')}</p>
              <p className="text-sm text-ink-soft">{t.blindSpot}</p>
            </div>
            <button type="button" className="btn -mr-1 -mt-1 px-0 text-ink-muted" onClick={() => setShow(false)} aria-label={t.dismiss}>
              <X aria-hidden="true" className="h-5 w-5" />
            </button>
          </div>
          <button type="button" className="btn-primary mt-3 w-full" onClick={() => { setShow(false); go('anomalies') }}>
            {t.see}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
