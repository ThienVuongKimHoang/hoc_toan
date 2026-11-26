import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import { sample } from '../../physics/inclinePhysics.js'

/* ─────────────────────────────────────────────────────────────
   Dải "Đồ thị chuyển động" dưới vùng hình.
   Trái: tab dọc · Giữa: đồ thị (rê chuột để xem giá trị) · Phải: giá trị hiện tại.
   SVG lấy đúng bề rộng thật của khung nên chữ trên trục giữ cỡ ổn định.
───────────────────────────────────────────────────────────── */

const H = 168
const PAD = { l: 50, r: 14, t: 12, b: 36 }

const fmt = (n, d = 1) => (Math.abs(n) < 1e-9 ? '0' : n.toFixed(d).replace('.', ','))
const fmt2 = n => (Math.abs(n) < 5e-3 ? 0 : n).toFixed(2).replace('.', ',')

/* Số chữ số thập phân đủ để các vạch chia không trùng nhãn (bước 0,05 → 2 chữ số) */
const stepDec = step => (step >= 1 ? 0 : Math.min(3, Math.ceil(-Math.log10(step) - 1e-9)))

function niceStep(range, target) {
  const raw = range / target
  const p = Math.pow(10, Math.floor(Math.log10(raw)))
  const r = raw / p
  return (r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10) * p
}
function ticks(min, max, target) {
  if (max - min < 1e-9) max = min + 1
  const step = niceStep(max - min, target)
  const lo = Math.floor(min / step + 1e-9) * step
  const hi = Math.ceil(max / step - 1e-9) * step
  const out = []
  for (let v = lo; v <= hi + step * 1e-6; v += step) out.push(+v.toFixed(10))
  return { lo, hi, step, out }
}

const TABS = [
  { id: 'v', label: 'Vận tốc', sub: 'v(t)' },
  { id: 's', label: 'Quãng đường', sub: 's(t)' },
  { id: 'x', label: 'Vị trí', sub: 'x(t)' },
  { id: 'E', label: 'Năng lượng', sub: 'W(t)' },
]

const SERIES = {
  v: [{ key: 'v', label: 'Vận tốc', sym: 'v', unit: 'm/s', color: '#4cc38a', area: true }],
  s: [{ key: 'travelled', label: 'Quãng đường', sym: 's', unit: 'm', color: '#cbd5e1', area: true }],
  x: [{ key: 'x', label: 'Vị trí', sym: 'x', unit: 'm', color: '#e8b04a', area: false }],
  E: [
    { key: 'Wd', label: 'Động năng', sym: 'Wđ', unit: 'J', color: '#6aa8f5' },
    { key: 'Wt', label: 'Thế năng', sym: 'Wt', unit: 'J', color: '#4cc38a' },
    { key: 'Q', label: 'Nhiệt ma sát', sym: 'Q', unit: 'J', color: '#f39a52' },
    { key: 'E', label: 'Tổng', sym: 'W', unit: 'J', color: '#94a3b8', dashed: true },
  ],
}
const Y_TITLE = { v: 'v (m/s)', s: 's (m)', x: 'x (m)', E: 'W (J)' }
const NOTE = {
  v: 'Chiều dương hướng xuống dốc; v < 0 khi vật đi lên.',
  s: 'Cộng dồn cả lúc lên và xuống.',
  x: 'Tính từ đỉnh dốc; x tăng khi vật đi xuống.',
  E: 'Wđ + Wt + Q luôn không đổi.',
}

const ChevronDown = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>
)

export default function InclineCharts({ sim, t, dimmed = false }) {
  const [tab, setTab] = useState('v')
  const [open, setOpen] = useState(true)
  const [hoverT, setHoverT] = useState(null)
  const uid = useId().replace(/:/g, '')
  const boxRef = useRef(null)
  const [W, setW] = useState(600)
  useEffect(() => {
    const el = boxRef.current
    if (!el || typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [open])

  const pts = useMemo(() => sample(sim, 160), [sim])
  const T = sim.tEnd > 1e-9 ? sim.tEnd : 1
  const series = SERIES[tab]
  const all = pts.flatMap(p => series.map(s => p[s.key]))
  const yT = ticks(Math.min(0, ...all), Math.max(0, ...all), 4)
  const xT = ticks(0, T, W < 420 ? 4 : 6)
  const plotW = W - PAD.l - PAD.r
  const plotH = H - PAD.t - PAD.b
  const sx = tt => PAD.l + (tt / xT.hi) * plotW
  const sy = v => PAD.t + (1 - (v - yT.lo) / (yT.hi - yT.lo)) * plotH
  const y0 = sy(Math.max(yT.lo, Math.min(yT.hi, 0)))
  const cur = sim.stateAt(t)

  const hov = hoverT == null ? null : sim.stateAt(hoverT)
  const onMove = e => {
    const r = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * W
    setHoverT(Math.max(0, Math.min(T, ((x - PAD.l) / plotW) * xT.hi)))
  }
  const tipLines = hov ? [`t = ${fmt2(hov.t)} s`, ...series.map(s => `${s.sym} = ${fmt2(hov[s.key])} ${s.unit}`)] : []
  const tipW = 118
  const tipH = 10 + tipLines.length * 15
  const tipLeft = hov
    ? (sx(hov.t) + 12 + tipW > W - PAD.r ? Math.max(PAD.l + 4, sx(hov.t) - 12 - tipW) : sx(hov.t) + 12)
    : 0

  if (!open) {
    return (
      <div className="cs cs--collapsed">
        <button className="cs-toggle" onClick={() => setOpen(true)} aria-expanded="false">
          <span>Đồ thị chuyển động</span>
          <span style={{ transform: 'rotate(180deg)', display: 'flex' }}><ChevronDown /></span>
        </button>
      </div>
    )
  }

  return (
    <div className={`cs${dimmed ? ' is-dimmed' : ''}`}>
      <nav className="cs-tabs" role="tablist" aria-label="Chọn đồ thị">
        <div className="cs-title">Đồ thị chuyển động</div>
        {TABS.map(tb => (
          <button key={tb.id} role="tab" aria-selected={tab === tb.id} className={tab === tb.id ? 'is-on' : ''}
            onClick={() => setTab(tb.id)}>
            {tb.label}<small>{tb.sub}</small>
          </button>
        ))}
      </nav>

      <div ref={boxRef} className="cs-plot">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} className="cs-svg"
          onPointerMove={onMove} onPointerLeave={() => setHoverT(null)}
          role="img" aria-label={`Đồ thị ${Y_TITLE[tab]} theo thời gian`}>
          <defs>
            {series.filter(s => s.area).map(s => (
              <linearGradient key={s.key} id={`${uid}-a-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={s.color} stopOpacity="0.18" />
                <stop offset="1" stopColor={s.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>
          {yT.out.map(v => (
            <g key={`y${v}`}>
              <line x1={PAD.l} x2={W - PAD.r} y1={sy(v)} y2={sy(v)}
                stroke={Math.abs(v) < 1e-9 ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.05)'} />
              <text x={PAD.l - 10} y={sy(v)} fontSize="11" fill="#7c8799" textAnchor="end" dominantBaseline="middle">
                {fmt(v, stepDec(yT.step))}
              </text>
            </g>
          ))}
          {xT.out.map(v => (
            <g key={`x${v}`}>
              <line x1={sx(v)} x2={sx(v)} y1={PAD.t} y2={H - PAD.b} stroke="rgba(255,255,255,0.04)" />
              <text x={sx(v)} y={H - PAD.b + 16} fontSize="11" fill="#7c8799" textAnchor="middle">
                {fmt(v, stepDec(xT.step))}
              </text>
            </g>
          ))}
          <text x={PAD.l + plotW / 2} y={H - 4} fontSize="11.5" fill="#9aa4b2" textAnchor="middle">Thời gian (s)</text>
          <text x={12} y={PAD.t + plotH / 2} fontSize="11.5" fill="#9aa4b2" textAnchor="middle"
            transform={`rotate(-90 12 ${PAD.t + plotH / 2})`}>{Y_TITLE[tab]}</text>

          {series.map(s => {
            const line = pts.map(p => `${sx(p.t)},${sy(p[s.key])}`).join(' ')
            return (
              <g key={s.key}>
                {s.area && (
                  <polygon fill={`url(#${uid}-a-${s.key})`}
                    points={`${sx(pts[0].t)},${y0} ${line} ${sx(pts[pts.length - 1].t)},${y0}`} />
                )}
                <polyline fill="none" stroke={s.color} strokeWidth={s.dashed ? 1.4 : 2}
                  strokeDasharray={s.dashed ? '4 4' : undefined} strokeLinejoin="round" strokeLinecap="round" points={line} />
              </g>
            )
          })}

          <line x1={sx(cur.t)} x2={sx(cur.t)} y1={PAD.t} y2={H - PAD.b} stroke="rgba(255,255,255,0.22)" strokeDasharray="3 3" />
          {series.map(s => (
            <g key={s.key}>
              <circle cx={sx(cur.t)} cy={sy(cur[s.key])} r="7" fill={s.color} fillOpacity="0.15" />
              <circle cx={sx(cur.t)} cy={sy(cur[s.key])} r="3.6" fill="#141b26" stroke={s.color} strokeWidth="2" />
            </g>
          ))}

          {hov && (
            <g pointerEvents="none">
              <line x1={sx(hov.t)} x2={sx(hov.t)} y1={PAD.t} y2={H - PAD.b} stroke="rgba(255,255,255,0.45)" />
              {series.map(s => <circle key={s.key} cx={sx(hov.t)} cy={sy(hov[s.key])} r="3.2" fill={s.color} />)}
              <rect x={tipLeft} y={PAD.t + 2} width={tipW} height={tipH} rx="8" fill="#0b111b" stroke="rgba(255,255,255,0.1)" />
              {tipLines.map((ln, i) => (
                <text key={i} x={tipLeft + 10} y={PAD.t + 18 + i * 15} fontSize="11"
                  fill={i === 0 ? '#9aa4b2' : '#e5e7eb'} fontWeight={i === 0 ? 400 : 500}>{ln}</text>
              ))}
            </g>
          )}
        </svg>
        {dimmed && <div className="cs-dim-note">Thả vật để xem đồ thị</div>}
      </div>

      <aside className="cs-side">
        <button className="cs-collapse" onClick={() => setOpen(false)} title="Thu gọn đồ thị" aria-label="Thu gọn đồ thị"><ChevronDown /></button>
        <div className="cs-values">
          {series.map(s => (
            <div key={s.key} className="cs-value">
              <span><i style={{ background: s.color }} />{s.label}</span>
              <b>{fmt2(cur[s.key])}<em>{s.unit}</em></b>
            </div>
          ))}
        </div>
        <p className="cs-note">{NOTE[tab]}</p>
      </aside>
    </div>
  )
}
