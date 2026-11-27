import React, { useEffect, useMemo, useRef, useState } from 'react'
import { wavelengthToRGB, rgbCss, LIMITS, ONE_SLIT_I, fringeSpacing } from '../../physics/youngPhysics.js'

/* ─────────────────────────────────────────────────────────────
   Sơ đồ thí nghiệm Young nhìn từ trên xuống:
   đèn → khe F → hai khe S₁S₂ → màn E.
   Trường sóng được tính thật từ khoảng cách tới từng nguồn (không vẽ giả bằng ảnh):
   - "Sóng tức thời": A = cos(k(r₁+r₀) − ωt) + cos(k(r₂+r₀) − ωt), tô theo A²
     → vạch cực tiểu (tối) đứng yên, đỉnh sóng chạy dọc các vạch cực đại.
   - "Cường độ trung bình": I = ½(1 + cos k(r₁ − r₂)) → các dải hyperbol tĩnh.
   Sơ đồ KHÔNG theo tỉ lệ: bước sóng phóng to cỡ 10⁴ lần để mắt thấy được sóng,
   a và D chỉ đổi theo đúng chiều (tăng a → vân sít, tăng D → vân thưa).
───────────────────────────────────────────────────────────── */

const S = 2                 // 1 điểm ảnh trường sóng = 2 px CSS (đủ mịn, đủ nhanh)
const LAMBDA_PX = 14        // bước sóng hiển thị (px) ứng với 600 nm — ≥ 6 điểm ảnh/bước sóng để không răng cưa
const WAVE_SPEED = 55       // tốc độ lan của đỉnh sóng trên hình (px/s)
const BG = [7, 11, 20]
const SCREEN_W = 9

const lerp01 = (v, [a, b]) => (v - a) / (b - a)

/* Toạ độ các bộ phận theo kích thước khung + thông số a, D */
export function sceneGeometry(w, h, params) {
  const xLamp = 34
  const xF = 92
  const xS = Math.round(Math.min(250, Math.max(160, w * 0.2)))
  const avail = Math.max(140, w - xS - 64)
  const Dpx = (0.25 + 0.75 * lerp01(params.Dm, LIMITS.Dm)) * avail
  const span = Math.max(160, Math.min(h - 40, 420))
  const dpx = (0.08 + 0.3 * lerp01(params.aMm, LIMITS.aMm)) * span
  return { w, h, xLamp, xF, xS, xScr: xS + Dpx, yc: h / 2, dpx, avail, span }
}
const DFromX = (xScr, g) => LIMITS.Dm[0] + (LIMITS.Dm[1] - LIMITS.Dm[0]) * (((xScr - g.xS) / g.avail - 0.25) / 0.75)
const aFromD = (dpx, g) => LIMITS.aMm[0] + (LIMITS.aMm[1] - LIMITS.aMm[0]) * ((dpx / g.span - 0.08) / 0.3)
const clamp = (v, [a, b]) => Math.min(b, Math.max(a, v))

/* Các bức xạ vẽ trên trường sóng: ánh sáng trắng đại diện bằng 3 màu */
function fieldComponents(params) {
  const lams = params.mode === 'white' ? [450, 540, 640] : params.mode === 'two' ? [params.lambdaNm, params.lambda2Nm] : [params.lambdaNm]
  const cols = lams.map(wavelengthToRGB)
  if (params.mode === 'white') {
    const s = [0, 0, 0]
    cols.forEach(c => { s[0] += c[0]; s[1] += c[1]; s[2] += c[2] })
    cols.forEach(c => { c[0] /= s[0] || 1; c[1] /= s[1] || 1; c[2] /= s[2] || 1 })
  }
  // λ trong môi trường n ngắn đi n lần (chỉ phần sau hai khe)
  return lams.map((l, j) => ({ lambda: l, col: cols[j], k: (2 * Math.PI) / ((LAMBDA_PX * l) / 600) }))
}

/* Bảng khoảng cách từng điểm ảnh tới F, S₁, S₂ — chỉ tính lại khi hình học đổi */
function buildCache(g) {
  const cw = Math.max(1, Math.ceil(g.w / S))
  const ch = Math.max(1, Math.ceil(g.h / S))
  const N = cw * ch
  const region = new Uint8Array(N)
  const rF = new Float32Array(N)
  const r1 = new Float32Array(N)
  const r2 = new Float32Array(N)
  const y1 = g.yc - g.dpx / 2
  const y2 = g.yc + g.dpx / 2
  const rFS = Math.hypot(g.xS - g.xF, g.dpx / 2)
  for (let j = 0; j < ch; j++) {
    const py = (j + 0.5) * S
    for (let i = 0; i < cw; i++) {
      const px = (i + 0.5) * S
      const idx = j * cw + i
      if (px < g.xF) continue
      if (px < g.xS) { region[idx] = 1; rF[idx] = Math.hypot(px - g.xF, py - g.yc); continue }
      if (px > g.xScr + SCREEN_W) continue
      region[idx] = px >= g.xScr ? 3 : 2
      r1[idx] = Math.hypot(px - g.xS, py - y1)
      r2[idx] = Math.hypot(px - g.xS, py - y2)
    }
  }
  return { cw, ch, region, rF, r1, r2, rFS }
}

function paintField(ctx, img, cache, comps, n, t, avg, one = false) {
  const { region, rF, r1, r2, rFS } = cache
  const d = img.data
  const m = comps.length
  const K = comps.map(c => c.k)
  const Kn = comps.map(c => c.k * n)              // số sóng sau hai khe (môi trường n)
  const W = comps.map(c => c.k * WAVE_SPEED * t)   // cùng tốc độ hình học cho mọi màu
  for (let idx = 0, p = 0; idx < region.length; idx++, p += 4) {
    const reg = region[idx]
    let r = 0, g = 0, b = 0
    if (reg) {
      for (let c = 0; c < m; c++) {
        let I
        if (reg === 1) {
          if (avg) I = 0.1
          else { const A = 0.5 + 0.5 * Math.cos(K[c] * rF[idx] - W[c]); I = A * A * 0.5 }
        } else if (one) {
          // Chỉ còn khe S₁: sóng tròn của một nguồn, màn sáng đều (không có vân)
          if (reg === 3 || avg) I = reg === 3 ? ONE_SLIT_I : ONE_SLIT_I * 0.8
          else { const A = 0.5 + 0.5 * Math.cos(Kn[c] * r1[idx] + K[c] * rFS - W[c]); I = A * A * 0.6 }
        } else if (reg === 3 || avg) {
          I = 0.5 + 0.5 * Math.cos(Kn[c] * (r1[idx] - r2[idx]))
          if (reg === 2) I *= 0.8
        } else {
          const A = Math.cos(Kn[c] * r1[idx] + K[c] * rFS - W[c]) + Math.cos(Kn[c] * r2[idx] + K[c] * rFS - W[c])
          I = A * A * 0.25
        }
        const col = comps[c].col
        r += col[0] * I; g += col[1] * I; b += col[2] * I
      }
      if (m === 2 && comps[0].col !== comps[1].col && reg !== 3) { r *= 0.85; g *= 0.85; b *= 0.85 }
    }
    d[p] = Math.min(255, BG[0] + r * 248)
    d[p + 1] = Math.min(255, BG[1] + g * 248)
    d[p + 2] = Math.min(255, BG[2] + b * 248)
    d[p + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
}

/* Đường cực đại bậc k: tập điểm có r₂ − r₁ = kλ (hyperbol), giải bằng chia đôi theo y */
function hyperbola(g, k, lpx) {
  const target = k * lpx
  if (Math.abs(target) >= g.dpx * 0.995) return null
  const y1 = g.yc - g.dpx / 2
  const y2 = g.yc + g.dpx / 2
  const pts = []
  const N = 36
  for (let s = 0; s <= N; s++) {
    const x = g.xS + 2 + ((g.xScr - g.xS - 2) * s) / N
    const dx = x - g.xS
    // f(y) = r₂ − r₁ giảm dần theo y (trên cao gần S₁ hơn)
    let lo = g.yc - 20000, hi = g.yc + 20000
    for (let it = 0; it < 48; it++) {
      const mid = (lo + hi) / 2
      const f = Math.hypot(dx, mid - y2) - Math.hypot(dx, mid - y1)
      if (f > target) lo = mid; else hi = mid
    }
    const y = (lo + hi) / 2
    pts.push([x, y])
  }
  return pts
}

function useSize(ref) {
  const [size, setSize] = useState({ w: 900, h: 340 })
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect
      if (width > 0 && height > 0) setSize({ w: Math.round(width), h: Math.round(height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return size
}

export default function YoungScene({ params, show, playing, speed = 1, onChange, pinX = null, guideHi = [] }) {
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const svgRef = useRef(null)
  const { w, h } = useSize(wrapRef)
  const g = useMemo(() => sceneGeometry(w, h, params), [w, h, params])
  const comps = useMemo(() => fieldComponents(params), [params])
  const cache = useMemo(() => buildCache(g), [g])
  const n = params.n || 1
  const one = !!params.oneSlit

  /* Vẽ trường sóng: chạy vòng rAF khi sóng đang lan, còn lại vẽ 1 lần mỗi khi thông số đổi */
  const tRef = useRef(0)
  const animate = playing && show.waves && !show.avg
  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return undefined
    cv.width = cache.cw; cv.height = cache.ch
    const ctx = cv.getContext('2d')
    const img = ctx.createImageData(cache.cw, cache.ch)
    if (!show.waves) {
      // Không vẽ sóng: chỉ chừa màn chiếu sáng theo cường độ trung bình
      const only = { ...cache, region: cache.region.map(r => (r === 3 ? 3 : 0)) }
      paintField(ctx, img, only, comps, n, 0, true, one)
      return undefined
    }
    if (!animate) { paintField(ctx, img, cache, comps, n, tRef.current, show.avg, one); return undefined }
    let raf = 0
    let last = performance.now()
    const tick = now => {
      tRef.current += Math.min(0.05, (now - last) / 1000) * speed
      last = now
      paintField(ctx, img, cache, comps, n, tRef.current, false, one)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [cache, comps, n, one, animate, show.waves, show.avg, speed])

  /* Đường cực đại — vẽ cho bức xạ thứ nhất (đơn sắc / λ₁; ánh sáng trắng: màu lục 540 nm) */
  const hyper = useMemo(() => {
    if (!show.hyper || one) return []
    const lam = params.mode === 'white' ? 540 : params.lambdaNm
    const lpx = (LAMBDA_PX * lam) / 600 / n
    const out = []
    for (let k = -6; k <= 6; k++) {
      const pts = hyperbola(g, k, lpx)
      if (!pts) continue
      const vis = pts.filter(([, y]) => y > -40 && y < h + 40)
      if (vis.length > 1) out.push({ k, pts: vis, end: pts[pts.length - 1] })
    }
    return out
  }, [g, params.mode, params.lambdaNm, n, show.hyper, h, one])

  /* ── Kéo màn (đổi D) và kéo khe (đổi a) ── */
  const [drag, setDrag] = useState(null)
  const local = e => {
    const r = svgRef.current.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const startDrag = kind => e => {
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    setDrag(kind)
  }
  const moveDrag = e => {
    if (!drag) return
    const p = local(e)
    if (drag === 'screen') {
      const D = Math.round(clamp(DFromX(p.x, g), LIMITS.Dm) * 100) / 100
      if (D !== params.Dm) onChange({ ...params, Dm: D })
    } else {
      const a = Math.round(clamp(aFromD(2 * Math.abs(p.y - g.yc), g), LIMITS.aMm) * 100) / 100
      if (a !== params.aMm) onChange({ ...params, aMm: a })
    }
  }
  const endDrag = () => setDrag(null)
  const keyNudge = kind => e => {
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0
    if (!dir) return
    e.preventDefault()
    e.stopPropagation()
    if (kind === 'screen') onChange({ ...params, Dm: Math.round(clamp(params.Dm + dir * 0.05, LIMITS.Dm) * 100) / 100 })
    else onChange({ ...params, aMm: Math.round(clamp(params.aMm + dir * 0.05, LIMITS.aMm) * 100) / 100 })
  }

  const y1 = g.yc - g.dpx / 2
  const y2 = g.yc + g.dpx / 2

  /* Điểm M trên màn (toạ độ thật x mm) → vị trí trên sơ đồ: dùng tỉ lệ khoảng vân hình / khoảng vân thật */
  let yM = null
  if (pinX != null) {
    const lamRef = params.mode === 'white' ? 550 : params.lambdaNm
    const ipx = (((LAMBDA_PX * lamRef) / 600 / n) * (g.xScr - g.xS)) / g.dpx
    const y = g.yc - (pinX * ipx) / fringeSpacing(lamRef, params)
    if (y > 8 && y < h - 8) yM = y
  }
  const beam = params.mode === 'white' ? 'rgba(255,255,255,0.55)' : rgbCss(wavelengthToRGB(params.lambdaNm), 0.6)
  const slitGap = 5
  const dimY = h - 40

  return (
    <div className="young-scene" ref={wrapRef}>
      <canvas ref={canvasRef} className="young-field" aria-hidden="true" />
      <svg ref={svgRef} width={w} height={h} className="young-overlay"
        onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}
        role="img" aria-label={`Sơ đồ thí nghiệm Young: a = ${params.aMm} mm, D = ${params.Dm} m`}>
        <defs>
          <radialGradient id="yg-lamp">
            <stop offset="0" stopColor="#fff" />
            <stop offset="0.35" stopColor={beam} />
            <stop offset="1" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
          <linearGradient id="yg-beam" x1="0" x2="1">
            <stop offset="0" stopColor={beam} stopOpacity="0.9" />
            <stop offset="1" stopColor={beam} stopOpacity="0.25" />
          </linearGradient>
        </defs>

        {/* Đèn + chùm sáng tới khe F */}
        <circle cx={g.xLamp} cy={g.yc} r="26" fill="url(#yg-lamp)" />
        <circle cx={g.xLamp} cy={g.yc} r="7" fill="#fff" />
        <polygon points={`${g.xLamp + 6},${g.yc - 12} ${g.xF},${g.yc - 3} ${g.xF},${g.yc + 3} ${g.xLamp + 6},${g.yc + 12}`} fill="url(#yg-beam)" />

        {/* Tấm chắn có khe F */}
        <g className="young-wall">
          <rect x={g.xF - 3} y={0} width={6} height={g.yc - 3} />
          <rect x={g.xF - 3} y={g.yc + 3} width={6} height={h - g.yc - 3} />
        </g>

        {/* Tấm chắn có hai khe S₁, S₂ — kéo để đổi a */}
        <g className="young-wall">
          <rect x={g.xS - 4} y={0} width={8} height={y1 - slitGap / 2} />
          <rect x={g.xS - 4} y={y1 + slitGap / 2} width={8} height={y2 - y1 - slitGap} />
          <rect x={g.xS - 4} y={y2 + slitGap / 2} width={8} height={h - y2 - slitGap / 2} />
        </g>

        {/* Đường cực đại (vân sáng) */}
        {hyper.map(hp => (
          <g key={hp.k}>
            <polyline points={hp.pts.map(p => p.join(',')).join(' ')} className={`young-hyper${hp.k === 0 ? ' is-center' : ''}`} />
            {show.labels && hp.end[1] > 10 && hp.end[1] < h - 10 && (
              <text x={g.xScr + SCREEN_W + 6} y={hp.end[1] + 4} className="young-k-label">{hp.k === 0 ? 'k = 0' : Math.abs(hp.k)}</text>
            )}
          </g>
        ))}

        {/* Khe S₂ bị che */}
        {one && <rect x={g.xS - 6} y={y2 - slitGap} width={12} height={slitGap * 2} rx="2" className="young-tape" />}

        {/* Hai đường đi tới điểm M */}
        {yM != null && (
          <g className={`young-paths${guideHi.includes('paths') ? ' is-guided' : ''}`}>
            <line x1={g.xS} y1={y1} x2={g.xScr} y2={yM} className="young-path young-path--1" />
            {!one && <line x1={g.xS} y1={y2} x2={g.xScr} y2={yM} className="young-path young-path--2" />}
            <text x={(g.xS + g.xScr) / 2} y={(y1 + yM) / 2 - 6} className="young-path-lbl young-path-lbl--1">d₁</text>
            {!one && <text x={(g.xS + g.xScr) / 2} y={(y2 + yM) / 2 + 16} className="young-path-lbl young-path-lbl--2">d₂</text>}
            <circle cx={g.xScr + SCREEN_W / 2} cy={yM} r="5.5" className="young-m-dot" />
            <text x={g.xScr - 8} y={yM - 9} textAnchor="end" className="young-m-lbl">M</text>
          </g>
        )}

        {/* Màn E — kéo để đổi D */}
        <rect x={g.xScr - 1} y={0} width={SCREEN_W + 2} height={h} className="young-screen-edge" />

        {/* Kích thước a và D */}
        <g className="young-dim">
          <line x1={g.xS - 18} y1={y1} x2={g.xS - 18} y2={y2} />
          <line x1={g.xS - 23} y1={y1} x2={g.xS - 13} y2={y1} />
          <line x1={g.xS - 23} y1={y2} x2={g.xS - 13} y2={y2} />
          <text x={g.xS + 14} y={g.yc + 4}>a = {String(params.aMm).replace('.', ',')} mm</text>
          <line x1={g.xS} y1={dimY} x2={g.xScr} y2={dimY} />
          <line x1={g.xS} y1={dimY - 5} x2={g.xS} y2={dimY + 5} />
          <line x1={g.xScr} y1={dimY - 5} x2={g.xScr} y2={dimY + 5} />
          <text x={(g.xS + g.xScr) / 2} y={dimY - 6} textAnchor="middle">D = {String(params.Dm).replace('.', ',')} m</text>
        </g>
        <g className="young-names">
          <text x={g.xF} y={g.yc - 12} textAnchor="middle">F</text>
          <text x={g.xS + 9} y={y1 - 6}>S₁</text>
          <text x={g.xS + 9} y={y2 + 15}>S₂</text>
          <text x={g.xScr + SCREEN_W / 2} y={16} textAnchor="middle">E</text>
        </g>

        {/* Tay nắm kéo */}
        <g className={`young-grab young-grab--slit${drag === 'slit' ? ' is-dragging' : ''}`} tabIndex={0}
          role="slider" aria-label="Khoảng cách hai khe a" aria-valuenow={params.aMm} aria-valuemin={LIMITS.aMm[0]} aria-valuemax={LIMITS.aMm[1]}
          onPointerDown={startDrag('slit')} onKeyDown={keyNudge('slit')}>
          <rect x={g.xS - 12} y={y1 - 14} width={24} height={28} rx="6" className="young-grab-ring" />
          <rect x={g.xS - 12} y={y2 - 14} width={24} height={28} rx="6" className="young-grab-ring" />
        </g>
        <g className={`young-grab young-grab--screen${drag === 'screen' ? ' is-dragging' : ''}`} tabIndex={0}
          role="slider" aria-label="Khoảng cách từ hai khe đến màn D" aria-valuenow={params.Dm} aria-valuemin={LIMITS.Dm[0]} aria-valuemax={LIMITS.Dm[1]}
          onPointerDown={startDrag('screen')} onKeyDown={keyNudge('screen')}>
          <rect x={g.xScr - 9} y={24} width={SCREEN_W + 18} height={h - 52} rx="8" className="young-grab-ring" />
        </g>
      </svg>
      <div className="young-scale-note">Sơ đồ không theo tỉ lệ · bước sóng phóng to ~10⁴ lần · kéo khe hoặc màn để đổi a, D</div>
    </div>
  )
}
