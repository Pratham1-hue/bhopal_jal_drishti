import { useLang } from '../i18n.jsx'

// Small dependency-free SVG chart: lowest DO and highest BOD per year, with the Class B lines.
export default function TrendChart({ trend, limits }) {
  const { t } = useLang()
  const rows = trend.filter((r) => r.festival === 'All')
  const doLim = limits['Dissolved oxygen'].min
  const bodLim = limits.BOD.max

  const panels = [
    { key: 'do_min', title: t.minDO, lim: doLim, max: 12, bad: (v) => v < doLim, limLabel: `≥ ${doLim}` },
    { key: 'bod_max', title: t.maxBOD, lim: bodLim, max: Math.max(24, ...rows.map((r) => r.bod_max || 0)), bad: (v) => v > bodLim, limLabel: `≤ ${bodLim}` },
  ]
  const W = 150
  const H = 110
  const pad = { l: 22, b: 18, t: 8 }
  const plotH = H - pad.b - pad.t

  return (
    <div className="grid grid-cols-2 gap-2">
      {panels.map((p) => {
        const y = (v) => pad.t + plotH - (Math.min(v, p.max) / p.max) * plotH
        const bw = (W - pad.l - 6) / rows.length
        const summary = rows.map((r) => `${r.year}: ${r[p.key] ?? '—'} mg/l`).join(', ')
        return (
          <figure key={p.key} className="rounded-xl bg-stone-50 p-3">
            <figcaption className="text-xs font-semibold text-ink-soft">{p.title} (mg/l)</figcaption>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${p.title}: ${summary}. Limit ${p.limLabel} mg/l`}>
              <line x1={pad.l} x2={W - 4} y1={y(p.lim)} y2={y(p.lim)} stroke="#93C5FD" strokeWidth="1.25" strokeDasharray="4 3" />
              <text x={W - 4} y={y(p.lim) - 3} textAnchor="end" fontSize="8" fill="#1E3A8A" fontWeight="700">
                {p.limLabel}
              </text>
              <text x={pad.l - 3} y={y(0)} textAnchor="end" fontSize="8" fill="#44403C">0</text>
              <text x={pad.l - 3} y={y(p.max) + 6} textAnchor="end" fontSize="8" fill="#44403C">{p.max}</text>
              {rows.map((r, i) => {
                const v = r[p.key]
                const x = pad.l + i * bw + bw * 0.18
                const w = bw * 0.64
                return (
                  <g key={r.year}>
                    {v == null ? (
                      <rect x={x} y={pad.t} width={w} height={plotH} fill="#FAFAF9" stroke="#A8A29E" strokeDasharray="3 2" />
                    ) : (
                      <rect x={x} y={y(v)} width={w} height={Math.max(y(0) - y(v), 1.5)} rx="3" fill={p.bad(v) ? '#DC2626' : '#16A34A'} />
                    )}
                    <text x={x + w / 2} y={v == null ? pad.t + plotH / 2 : y(v) - 2} textAnchor="middle" fontSize="8.5" fontWeight="800" fill="#111827">
                      {v == null ? '?' : v}
                    </text>
                    <text x={x + w / 2} y={H - 5} textAnchor="middle" fontSize="8.5" fill="#292524" fontWeight="600">{r.year}</text>
                  </g>
                )
              })}
            </svg>
          </figure>
        )
      })}
    </div>
  )
}
