import { Fragment, useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Circle, Tooltip, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { MapPinOff, ArrowRight } from 'lucide-react'
import { useLang } from '../i18n.jsx'
import { StatusBadge, TeamBadge } from '../components/ui.jsx'

const FILL = { red: '#B91C1C', yellow: '#EAB308', green: '#15803D', grey: '#6B7280' }
const APPROX_RADIUS_M = { exact: 0, landmark: 400, area: 900, lake: 1200 }

function FlyTo({ target }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lon], 14, { duration: 0.6 })
  }, [map, target])
  return null
}

export default function MapView({ ghats, onOpen }) {
  const { t, pick } = useLang()
  const [selected, setSelected] = useState(null)
  const placed = ghats.filter((g) => g.location)
  const unplaced = ghats.filter((g) => !g.location)
  const sel = ghats.find((g) => g.site_id === selected)
  const center = useMemo(() => {
    if (!placed.length) return [23.2299, 77.4126]
    const lat = placed.reduce((a, g) => a + g.location.lat, 0) / placed.length
    const lon = placed.reduce((a, g) => a + g.location.lon, 0) / placed.length
    return [lat, lon]
  }, [placed])

  return (
    <section aria-labelledby="map-h" className="space-y-5">
      <div>
        <h2 id="map-h" className="page-title">{t.mapTitle}</h2>
        <p className="page-sub">{t.mapSub}</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="card overflow-hidden">
          <div className="relative isolate z-0 h-[58vh] min-h-[380px] w-full lg:h-[640px]">
            <MapContainer center={center} zoom={12} scrollWheelZoom className="h-full w-full" attributionControl>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {placed.map((g) => {
                const r = APPROX_RADIUS_M[g.location.precision] || 0
                const lowConf = g.data_confidence?.level === 'low'
                return (
                  <Fragment key={g.site_id}>
                    {r > 0 && (
                      <Circle center={[g.location.lat, g.location.lon]} radius={r}
                        pathOptions={{ color: FILL[g.status], weight: 1.5, dashArray: '5 5', fillOpacity: 0.06 }} />
                    )}
                    <CircleMarker
                      center={[g.location.lat, g.location.lon]}
                      radius={selected === g.site_id ? 16 : 13}
                      pathOptions={{
                        color: lowConf ? '#374151' : '#ffffff',
                        weight: lowConf ? 4 : 3,
                        dashArray: lowConf ? '4 3' : null,
                        fillColor: FILL[g.status],
                        fillOpacity: 0.95,
                      }}
                      eventHandlers={{ click: () => setSelected(g.site_id) }}
                    >
                      <Tooltip direction="top" offset={[0, -12]} permanent={false}>
                        <strong>{g.rank}. {pick(g, 'name')}</strong> — {t.status[g.status]}
                      </Tooltip>
                    </CircleMarker>
                  </Fragment>
                )
              })}
              <FlyTo target={sel?.location} />
            </MapContainer>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-stone-100 px-4 py-3 text-xs text-ink-soft">
            {['red', 'yellow'].map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5">
                <span className="h-3.5 w-3.5 rounded-full ring-2 ring-white" style={{ background: FILL[s] }} aria-hidden="true" /> {t.status[s]}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3.5 w-3.5 rounded-full border-2 border-dashed border-stone-700 bg-stone-400" aria-hidden="true" /> {t.confidence}: {t.confLevel.low}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3.5 w-5 rounded-full border border-dashed border-stone-500" aria-hidden="true" /> {t.precision.area}
            </span>
            <span className="ml-auto">{t.mapOffline}</span>
          </div>
        </div>

        {/* list — keyboard & screen-reader friendly twin of the map */}
        <div className="space-y-3">
          <ol className="card divide-y divide-stone-100" aria-label={t.mapTitle}>
            {ghats.map((g) => (
              <li key={g.site_id}>
                <button
                  type="button"
                  onClick={() => (g.location ? setSelected(g.site_id) : onOpen(g.site_id))}
                  aria-pressed={selected === g.site_id}
                  className={`flex w-full items-start gap-3 p-4 text-left transition hover:bg-stone-50 ${selected === g.site_id ? 'bg-orange-50' : ''}`}
                >
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: FILL[g.status] }} aria-hidden="true">
                    {g.rank}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold leading-snug">{pick(g, 'name')}</span>
                    <span className="mt-0.5 block text-xs text-ink-muted">
                      {g.location ? t.precision[g.location.precision] : t.mapNotPlaced}
                    </span>
                  </span>
                  {!g.location && <MapPinOff aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-muted" />}
                </button>
              </li>
            ))}
          </ol>

          {sel && (
            <div className="card space-y-3 p-5" aria-live="polite">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-bold">{sel.rank}. {pick(sel, 'name')}</h3>
                <StatusBadge status={sel.status} size="sm" />
              </div>
              <p className="text-sm text-ink-soft">{pick(sel, 'primary_reason')}</p>
              <div className="flex flex-wrap gap-1.5">
                {sel.deploy.map((d, i) => <TeamBadge key={i} d={d} size="sm" />)}
              </div>
              <p className="text-xs text-ink-muted">{sel.location.located_by} · {sel.location.source}</p>
              <button type="button" className="btn-primary w-full" onClick={() => onOpen(sel.site_id)}>
                {t.details} <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
          )}

          {unplaced.length > 0 && (
            <p className="rounded-xl stripes-light px-4 py-3 text-sm text-ink-soft ring-1 ring-inset ring-stone-300">
              <MapPinOff aria-hidden="true" className="mr-1.5 inline h-4 w-4" />
              {unplaced.map((g) => pick(g, 'name')).join(', ')} — {t.mapNotPlaced}. <code className="text-xs">data/ghat_locations.csv</code>
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
