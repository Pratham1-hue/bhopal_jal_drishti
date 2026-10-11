import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useLang } from '../i18n.jsx'
import BriefComposer from './BriefComposer.jsx'

export default function BriefModal({ siteId, ghats, onClose }) {
  const { t } = useLang()
  const closeRef = useRef(null)
  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-labelledby="brief-title">
      <motion.div className="absolute inset-0 bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} aria-hidden="true" />
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 320 }}
        className="relative max-h-[94vh] w-full overflow-y-auto rounded-t-3xl bg-stone-50 p-4 shadow-2xl md:max-w-5xl md:rounded-3xl md:p-6"
      >
        <div className="mb-3 flex items-start gap-3">
          <div className="flex-1">
            <h2 id="brief-title" className="text-xl font-semibold">{t.briefTitle}</h2>
            <p className="text-sm text-ink-soft">{t.briefSub}</p>
          </div>
          <button ref={closeRef} type="button" className="btn-outline px-0" onClick={onClose} aria-label={t.close}>
            <X aria-hidden="true" className="h-6 w-6" />
          </button>
        </div>
        <BriefComposer ghats={ghats} initialSite={siteId} autoGenerate />
      </motion.div>
    </div>
  )
}
