import { useCallback, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { fetchRanked, readCache } from './api.js'
import { useLang } from './i18n.jsx'
import { useStore } from './store.js'
import { BottomNav, MobileHeader, NavratriBar, Sidebar, TopBar } from './components/Shell.jsx'
import GhatDrawer from './components/GhatDrawer.jsx'
import AnomalyPanel from './components/AnomalyPanel.jsx'
import BriefComposer from './components/BriefComposer.jsx'
import BriefModal from './components/BriefModal.jsx'
import MethodPanel from './components/MethodPanel.jsx'
import AnomalyToast from './components/AnomalyToast.jsx'
import Dashboard from './views/Dashboard.jsx'
import CpcbView from './views/CpcbView.jsx'
import GuidelinesView from './views/GuidelinesView.jsx'
import DataView from './views/DataView.jsx'
import TasksView from './views/TasksView.jsx'
import PlanView from './views/PlanView.jsx'
import MapView from './views/MapView.jsx'

export default function App() {
  const { t } = useLang()
  const store = useStore()
  const [view, setView] = useState('dashboard')
  const [openSite, setOpenSite] = useState(null)
  const [briefSite, setBriefSite] = useState(null)

  const cached = readCache('/api/ghats/ranked')
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['ranked'],
    queryFn: fetchRanked,
    placeholderData: cached ? { ...cached.data, __cachedAt: cached.t } : undefined,
  })

  const go = useCallback((v, siteId) => {
    setView(v)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    if (siteId && v === 'dashboard') setOpenSite(siteId)
  }, [])
  const closeDrawer = useCallback(() => setOpenSite(null), [])
  const closeBrief = useCallback(() => setBriefSite(null), [])

  const overview = data?.overview
  const ghats = data?.ghats || []
  const badges = {
    anomalies: overview?.blind_spots,
    tasks: store.tasks.filter((x) => x.status !== 'done').length || undefined,
  }

  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[70] focus:rounded focus:bg-white focus:p-2">
        Skip to content
      </a>
      <Sidebar view={view} go={go} badges={badges} />

      <div className="lg:pl-[248px]">
        <TopBar view={view} go={go} cachedAt={data?.__cachedAt} />
        <MobileHeader go={go} cachedAt={data?.__cachedAt} />
        <NavratriBar go={go} />

        <main id="main" className="mx-auto max-w-3xl px-4 pb-28 pt-5 md:max-w-4xl md:px-6 lg:max-w-[1400px] lg:px-8 lg:pb-12 lg:pt-8">
          {isLoading && !data && (
            <p className="flex items-center gap-2 py-16 text-lg" role="status">
              <Loader2 aria-hidden="true" className="h-6 w-6 animate-spin" /> {t.loading}
            </p>
          )}
          {isError && !data && (
            <div className="card p-5" role="alert">
              <p className="font-semibold text-red-800">{t.loadError}</p>
              <button type="button" className="btn-outline mt-3" onClick={() => refetch()}>{t.retry}</button>
            </div>
          )}

          {overview && view === 'dashboard' && (
            <Dashboard overview={overview} ghats={ghats} go={go} onOpen={setOpenSite} onBrief={setBriefSite} />
          )}
          {view === 'plan' && <PlanView onOpen={setOpenSite} go={go} />}
          {overview && view === 'map' && <MapView ghats={ghats} onOpen={setOpenSite} />}
          {view === 'anomalies' && <AnomalyPanel onOpenGhat={setOpenSite} />}
          {view === 'cpcb' && <CpcbView onOpen={setOpenSite} />}
          {view === 'guidelines' && <GuidelinesView />}
          {view === 'data' && <DataView />}
          {overview && view === 'tasks' && <TasksView ghats={ghats} />}
          {overview && view === 'brief' && (
            <section aria-labelledby="brief-h">
              <h2 id="brief-h" className="page-title">{t.briefTitle}</h2>
              <p className="page-sub mb-5">{t.briefSub}</p>
              <BriefComposer ghats={ghats} initialSite="all" />
            </section>
          )}
          {overview && view === 'method' && <MethodPanel overview={overview} />}

          <footer className="mt-12 border-t border-stone-200 pt-4 text-center text-xs text-ink-muted">{t.footer}</footer>
        </main>
      </div>

      <BottomNav view={view} go={go} badges={badges} />
      <AnomalyToast go={go} />

      <AnimatePresence>
        {openSite && <GhatDrawer key={openSite} siteId={openSite} onClose={closeDrawer} onBrief={(id) => setBriefSite(id)} />}
      </AnimatePresence>
      <AnimatePresence>
        {briefSite && <BriefModal key={briefSite} siteId={briefSite} ghats={ghats} onClose={closeBrief} />}
      </AnimatePresence>
    </div>
  )
}
