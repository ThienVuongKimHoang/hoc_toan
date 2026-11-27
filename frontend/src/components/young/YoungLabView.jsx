import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Squirrel } from '../incline/Squirrel.jsx'
import { makeColorAt, wavelengthToRGB, rgbCss, LIMITS, vn, vnShort, fringeSpacing } from '../../physics/youngPhysics.js'

/* ─────────────────────────────────────────────────────────────
   Góc nhìn phòng thí nghiệm — giống bộ thí nghiệm thật trên bàn:
   bút laser (hoặc đèn) → tấm bìa có hai khe hẹp → màn ảnh.
   Hình vân trên màn tính từ đúng công thức (phóng to vùng giữa màn, rộng viewW mm).
   Kéo tấm bìa để đổi D; bấm lên màn để chọn điểm M soi bằng kính lúp.
───────────────────────────────────────────────────────────── */

const VB_W = 1000
const VB_H = 540
// Màn ảnh đứng nghiêng nhẹ về phía người xem (tứ giác)
const B = { tl: [720, 92], tr: [945, 62], br: [945, 418], bl: [720, 392] }
const BAND = [0.3, 0.72]          // dải được chiếu sáng trên màn (theo chiều cao)
const SLICES = 150
const LASER_TIP = [196, 352]
const BOARD_C = [832, 244]
const D_PX = [150, 520]           // tầm khoảng cách bìa → màn trên hình

/* ── Khung "Nhìn gần tấm bìa" + sóc dán băng keo ── */
const ZW = 300, ZH = 196             // kích thước khung phóng to
const SQ_S = 1.4                     // tỉ lệ con sóc trong khung
const FEET_Y = ZH / 2 - 5            // chân sóc đứng ở mép dưới khung
const WALK = 700, PRESS = 300, LEAVE = 700
const STICK_AT = WALK + PRESS / 2    // lúc băng keo dính vào / rời khỏi khe
const ANIM_MS = WALK + PRESS + LEAVE
const lerp = (a, b, t) => a + (b - a) * Math.min(1, Math.max(0, t))

/* Miếng băng keo (tâm ở gốc toạ độ) */
const Tape = ({ x, y, rot = -8, squash = 1 }) => (
  <g transform={`translate(${x} ${y}) rotate(${rot}) scale(1.5 ${1.9 * squash})`} className="young-tape-strip">
    <path d="M-12 -19 l3 -2 l3 2 l3 -2 l3 2 l3 -2 l3 2 l3 -2 V19 l-3 2 l-3 -2 l-3 2 l-3 -2 l-3 2 l-3 -2 l-3 2 Z" />
    <path d="M-8 -12 H8 M-8 -4 H8 M-8 4 H8 M-8 12 H8" className="young-tape-lines" />
  </g>
)

/* Trạng thái sóc theo thời gian e (ms) — kind 'stick' (dán) | 'peel' (bóc) */
function squirrelAt(kind, e, xSlit) {
  const home = xSlit + 4 * SQ_S, out = ZW / 2 + 60
  const bob = Math.abs(Math.sin(e / 55)) * 2.2
  const stick = kind === 'stick'
  if (e < WALK) return { x: lerp(out, home, e / WALK), y: -bob, face: 1, pose: stick ? 'carry' : 'relax', mood: 'normal', holding: stick }
  if (e < WALK + PRESS) return { x: home, y: 0, face: 1, pose: 'carry', mood: 'happy', holding: stick ? e < STICK_AT : e >= STICK_AT, press: true }
  return { x: lerp(home, out, (e - WALK - PRESS) / LEAVE), y: -bob, face: -1, pose: stick ? 'relax' : 'carry', mood: 'happy', holding: !stick }
}

const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
/* Điểm trên màn theo (u ngang, v dọc) ∈ [0,1]² */
const P = (u, v) => mix(mix(B.tl, B.tr, u), mix(B.bl, B.br, u), v)
const pts = arr => arr.map(p => p.map(n => n.toFixed(1)).join(',')).join(' ')

export default function YoungLabView({ params, viewW, pinX, onPick, onChange, guide = null }) {
  /* Sóc dán / bóc băng keo khi bật / tắt "Che khe S₂". Hình trên màn chỉ đổi lúc băng keo chạm khe. */
  const [anim, setAnim] = useState(null)
  const [now, setNow] = useState(0)
  const prevOne = useRef(!!params.oneSlit)
  useEffect(() => {
    const one = !!params.oneSlit
    if (one === prevOne.current) return
    prevOne.current = one
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const t0 = performance.now()
    setAnim({ kind: one ? 'stick' : 'peel', t0 })
    setNow(t0)
  }, [params.oneSlit])
  useEffect(() => {
    if (!anim) return undefined
    let raf = 0
    const tick = t => {
      if (t - anim.t0 >= ANIM_MS) { setAnim(null); return }
      setNow(t)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [anim])
  const e = anim ? Math.max(0, now - anim.t0) : 0
  const visualOne = anim ? (anim.kind === 'stick' ? e >= STICK_AT : e < STICK_AT) : !!params.oneSlit

  const svgRef = useRef(null)
  const [drag, setDrag] = useState(false)
  const white = params.mode === 'white'
  const beamCol = white ? 'rgba(255,255,255,0.9)' : rgbCss(wavelengthToRGB(params.lambdaNm))

  /* Vị trí tấm bìa theo D */
  const t = (params.Dm - LIMITS.Dm[0]) / (LIMITS.Dm[1] - LIMITS.Dm[0])
  const xCard = B.tl[0] - (D_PX[0] + t * (D_PX[1] - D_PX[0]))
  const s = (xCard - LASER_TIP[0]) / (BOARD_C[0] - LASER_TIP[0])
  const yCard = LASER_TIP[1] + s * (BOARD_C[1] - LASER_TIP[1])

  /* Các lát màu trên màn */
  const slices = useMemo(() => {
    const colorAt = makeColorAt({ ...params, oneSlit: visualOne })
    const base = [38, 44, 58]       // màn trắng trong phòng tối
    const out = []
    for (let k = 0; k < SLICES; k++) {
      const u0 = k / SLICES
      const u1 = (k + 1) / SLICES
      const x = ((u0 + u1) / 2 - 0.5) * viewW
      const [r, g, b] = colorAt(x)
      const fill = `rgb(${Math.min(255, base[0] + r * 230) | 0},${Math.min(255, base[1] + g * 230) | 0},${Math.min(255, base[2] + b * 230) | 0})`
      out.push({ k, fill, poly: pts([P(u0, BAND[0]), P(u1 + 0.002, BAND[0]), P(u1 + 0.002, BAND[1]), P(u0, BAND[1])]) })
    }
    return out
  }, [params, viewW, visualOne])

  /* Thước mm dưới dải sáng */
  const step = viewW <= 5 ? 1 : viewW <= 10 ? 2 : viewW <= 20 ? 4 : viewW <= 40 ? 10 : 20
  const ticks = []
  for (let v = -Math.floor(viewW / 2 / step) * step; v <= viewW / 2 + 1e-9; v += step) ticks.push(v)
  const uOf = x => x / viewW + 0.5

  /* Khung nhìn gần: hai khe đặt cạnh nhau theo chiều ngang, khoảng cách theo a */
  const gap = 26 + ((params.aMm - LIMITS.aMm[0]) / (LIMITS.aMm[1] - LIMITS.aMm[0])) * 120
  const zoomC = [Math.min(VB_W - ZW / 2 - 290, Math.max(ZW / 2 + 12, xCard)), Math.max(ZH / 2 + 8, yCard - 205)]
  const x1s = -gap / 2, x2s = gap / 2
  const sq = anim ? squirrelAt(anim.kind, e, x2s) : null
  // băng keo: dính trên khe, hay đang trên tay sóc
  let tape = null
  if (sq && sq.holding) tape = { x: sq.x + (-3 * SQ_S * sq.face), y: FEET_Y + sq.y - 57 * SQ_S + 4, rot: -4 }
  else if (visualOne) tape = { x: x2s, y: 4, rot: -8, squash: sq?.press ? 0.94 : 1 }

  const toVB = e => {
    const svg = svgRef.current
    const pt = svg.createSVGPoint()
    pt.x = e.clientX; pt.y = e.clientY
    return pt.matrixTransform(svg.getScreenCTM().inverse())
  }
  const onCardDown = e => { e.preventDefault(); e.currentTarget.setPointerCapture?.(e.pointerId); setDrag(true) }
  const onMove = e => {
    if (!drag) return
    const p = toVB(e)
    const dist = B.tl[0] - p.x
    const tt = Math.min(1, Math.max(0, (dist - D_PX[0]) / (D_PX[1] - D_PX[0])))
    const D = Math.round((LIMITS.Dm[0] + tt * (LIMITS.Dm[1] - LIMITS.Dm[0])) * 100) / 100
    if (D !== params.Dm) onChange({ ...params, Dm: D })
  }
  const onBoardDown = e => {
    const p = toVB(e)
    const u = (p.x - B.tl[0]) / (B.tr[0] - B.tl[0])
    if (u < 0 || u > 1) return
    onPick(Math.round((u - 0.5) * viewW * 1000) / 1000)
  }
  const keyCard = e => {
    const dir = e.key === 'ArrowRight' ? -1 : e.key === 'ArrowLeft' ? 1 : 0
    if (!dir) return
    e.preventDefault()
    onChange({ ...params, Dm: Math.round(Math.min(LIMITS.Dm[1], Math.max(LIMITS.Dm[0], params.Dm + dir * 0.05)) * 100) / 100 })
  }

  /* Hoạt họa hướng dẫn: những chỗ cần chỉ */
  const hi = new Set(guide?.hi || [])
  const iMm = params.mode !== 'white' && !params.oneSlit ? fringeSpacing(params.lambdaNm, params) : null
  const spU = iMm && iMm <= viewW / 2 ? uOf(iMm) : null
  const bandMid = (BAND[0] + BAND[1]) / 2

  const pinU = pinX != null && Math.abs(pinX) <= viewW / 2 ? uOf(pinX) : null
  const bandTop = P(0, BAND[0])[1]

  return (
    <div className="young-lab">
      <svg ref={svgRef} viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="xMidYMid meet"
        onPointerMove={onMove} onPointerUp={() => setDrag(false)} onPointerCancel={() => setDrag(false)}
        role="img" aria-label={`Bộ thí nghiệm: ${white ? 'đèn ánh sáng trắng' : 'bút laser'}, tấm bìa hai khe cách màn ${params.Dm} m`}>
        <defs>
          <linearGradient id="yl-wall" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#141b2b" /><stop offset="1" stopColor="#0b101b" />
          </linearGradient>
          <linearGradient id="yl-table" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#5b3a24" /><stop offset="1" stopColor="#3b2416" />
          </linearGradient>
          <linearGradient id="yl-cone" x1="0" x2="1">
            <stop offset="0" stopColor={beamCol} stopOpacity="0.5" /><stop offset="1" stopColor={beamCol} stopOpacity="0.08" />
          </linearGradient>
          <radialGradient id="yl-glow">
            <stop offset="0" stopColor={beamCol} stopOpacity="0.9" /><stop offset="1" stopColor={beamCol} stopOpacity="0" />
          </radialGradient>
          <filter id="yl-blur"><feGaussianBlur stdDeviation="2.2" /></filter>
          <linearGradient id="yl-band-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#000" stopOpacity="1" />
            <stop offset="0.25" stopColor="#000" stopOpacity="0" />
            <stop offset="0.75" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="1" />
          </linearGradient>
        </defs>

        {/* Phòng tối + bàn */}
        {/* Tường + bàn tràn ra ngoài khung để không lộ viền khi khung khác tỉ lệ */}
        <rect x={-2000} y={-2000} width={5000} height={2400} fill="#141b2b" />
        <rect width={VB_W} height={VB_H} fill="url(#yl-wall)" />
        <polygon points="-2000,430 3000,368 3000,3000 -2000,3000" fill="#3b2416" />
        <polygon points="0,410 1000,388 1000,540 0,540" fill="url(#yl-table)" />
        <polygon points="-2000,430 3000,368 3000,376 -2000,438" fill="#7a5235" />

        {/* Màn ảnh */}
        <g className="young-lab-board" onPointerDown={onBoardDown}>
          <line x1={B.bl[0] + 30} y1={B.bl[1]} x2={B.bl[0] + 18} y2={404} className="young-lab-leg" />
          <line x1={B.br[0] - 30} y1={B.br[1] - 4} x2={B.br[0] - 22} y2={394} className="young-lab-leg" />
          <polygon points={pts([B.tl, B.tr, B.br, B.bl])} fill="#262d3b" stroke="#64748b" strokeWidth="2" />
          {slices.map(sl => <polygon key={sl.k} points={sl.poly} fill={sl.fill} />)}
          <polygon points={pts([P(0, BAND[0]), P(1, BAND[0]), P(1, BAND[1]), P(0, BAND[1])])} fill="url(#yl-band-fade)" opacity="0.55" pointerEvents="none" />
          {/* Thước mm */}
          <g className="young-lab-ruler" pointerEvents="none">
            <line x1={P(0, 0.8)[0]} y1={P(0, 0.8)[1]} x2={P(1, 0.8)[0]} y2={P(1, 0.8)[1]} />
            {ticks.map(v => {
              const a = P(uOf(v), 0.8), b = P(uOf(v), 0.83)
              return (
                <g key={v}>
                  <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
                  <text x={a[0]} y={b[1] + 13} textAnchor="middle">{vnShort(v, 1)}</text>
                </g>
              )
            })}
            <text x={P(1, 0.92)[0]} y={P(1, 0.92)[1]} textAnchor="end" className="young-lab-unit">mm</text>
          </g>
          {pinU != null && (
            <g pointerEvents="none" className="young-lab-pin">
              <line x1={P(pinU, BAND[0] - 0.06)[0]} y1={P(pinU, BAND[0] - 0.06)[1]} x2={P(pinU, BAND[1] + 0.02)[0]} y2={P(pinU, BAND[1] + 0.02)[1]} />
              <text x={P(pinU, BAND[0] - 0.08)[0]} y={P(pinU, BAND[0] - 0.08)[1]} textAnchor="middle">M</text>
            </g>
          )}
        </g>
        <text x={(B.tl[0] + B.tr[0]) / 2} y={B.tr[1] - 4} textAnchor="middle" className="young-lab-cap">Màn ảnh · phóng to {viewW} mm ở giữa</text>

        {/* Chùm sáng từ hai khe toả tới màn */}
        <polygon points={pts([[xCard, yCard], P(0, BAND[0]), P(1, BAND[0] - 0.04), P(1, BAND[1] + 0.04), P(0, BAND[1])])}
          fill="url(#yl-cone)" opacity={visualOne ? 0.6 : 0.85} pointerEvents="none" />

        {/* Nguồn sáng */}
        {white ? (
          <g>
            <rect x="70" y="318" width="118" height="68" rx="10" fill="#334155" stroke="#475569" strokeWidth="2" />
            <circle cx="188" cy="352" r="26" fill="url(#yl-glow)" />
            <circle cx="182" cy="352" r="10" fill="#fff" />
            <rect x="96" y="386" width="12" height="26" fill="#475569" /><rect x="150" y="386" width="12" height="26" fill="#475569" />
            <text x="129" y="306" textAnchor="middle" className="young-lab-cap">Đèn ánh sáng trắng</text>
          </g>
        ) : (
          <g>
            <g transform="rotate(-8.4 130 352)">
              <rect x="64" y="340" width="134" height="24" rx="12" fill="#1f2937" stroke="#475569" strokeWidth="2" />
              <rect x="186" y="344" width="14" height="16" rx="3" fill="#94a3b8" />
              <rect x="106" y="336" width="18" height="6" rx="2" fill="#ef4444" />
            </g>
            <rect x="110" y="368" width="10" height="44" fill="#475569" />
            <text x="130" y="318" textAnchor="middle" className="young-lab-cap">Bút laser</text>
          </g>
        )}

        {/* Tia tới tấm bìa */}
        <line x1={LASER_TIP[0]} y1={LASER_TIP[1]} x2={xCard} y2={yCard} stroke={beamCol} strokeWidth="7" opacity="0.35" filter="url(#yl-blur)" />
        <line x1={LASER_TIP[0]} y1={LASER_TIP[1]} x2={xCard} y2={yCard} stroke={beamCol} strokeWidth="2.4" />

        {/* Tấm bìa có hai khe — kéo để đổi D */}
        <g className={`young-lab-card${drag ? ' is-dragging' : ''}`} tabIndex={0} role="slider"
          aria-label="Khoảng cách từ hai khe đến màn D" aria-valuenow={params.Dm} aria-valuemin={LIMITS.Dm[0]} aria-valuemax={LIMITS.Dm[1]}
          onPointerDown={onCardDown} onKeyDown={keyCard}>
          <rect x={xCard - 30} y={yCard - 86} width={60} height={(410 - yCard) + 100} fill="transparent" />
          <rect x={xCard - 3} y={yCard + 50} width={6} height={Math.max(0, 404 - yCard - 50)} fill="#475569" />
          <rect x={xCard - 22} y={400} width={44} height={8} rx="2" fill="#475569" />
          <rect x={xCard - 8} y={yCard - 62} width={16} height={112} rx="2" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1.5" />
          <line x1={xCard} y1={yCard - 5} x2={xCard} y2={yCard - 1} stroke="#0b101b" strokeWidth="2.4" />
          <line x1={xCard} y1={yCard + 1} x2={xCard} y2={yCard + 5} stroke={visualOne ? '#e2e8f0' : '#0b101b'} strokeWidth="2.4" />
          <circle cx={xCard} cy={yCard} r="9" fill="url(#yl-glow)" />
          <rect x={xCard - 26} y={yCard - 80} width={52} height={150} rx="8" className="young-lab-grab" />
        </g>

        {/* Khung "Nhìn gần tấm bìa": hai khe nhỏ sáng lên vì ánh sáng chiếu từ phía sau */}
        <g className="young-lab-zoom" pointerEvents="none">
          <line x1={xCard - 8} y1={yCard - 62} x2={zoomC[0] - ZW / 2 + 14} y2={zoomC[1] + ZH / 2} />
          <line x1={xCard + 8} y1={yCard - 62} x2={zoomC[0] + ZW / 2 - 14} y2={zoomC[1] + ZH / 2} />
          <g transform={`translate(${zoomC[0]} ${zoomC[1]})`}>
            <defs>
              <clipPath id="yl-zoom-clip"><rect x={-ZW / 2} y={-ZH / 2} width={ZW} height={ZH} rx="12" /></clipPath>
              <filter id="yl-slit-glow" x="-200%" y="-50%" width="500%" height="200%"><feGaussianBlur stdDeviation="3" /></filter>
            </defs>
            <rect x={-ZW / 2} y={-ZH / 2} width={ZW} height={ZH} rx="12" className="young-zoom-frame" />
            <g clipPath="url(#yl-zoom-clip)">
              <text x={-ZW / 2 + 12} y={-ZH / 2 + 19} className="young-zoom-title">Nhìn gần tấm bìa</text>
              {/* tấm bìa */}
              <rect x={-ZW / 2 + 22} y={-62} width={ZW - 44} height={128} rx="5" className="young-zoom-card" />
              {/* hai khe: vạch tối + ánh sáng lọt qua */}
              {[x1s, x2s].map((x, k) => (
                <g key={k}>
                  <rect x={x - 4} y={-34} width={8} height={72} rx="4" fill="#0b101b" />
                  {!(k === 1 && visualOne) && (
                    <>
                      <rect x={x - 4} y={-34} width={8} height={72} rx="4" fill={beamCol} filter="url(#yl-slit-glow)" opacity="0.9" />
                      <rect x={x - 1.6} y={-32} width={3.2} height={68} rx="1.6" fill={beamCol} />
                    </>
                  )}
                  <text x={x} y={-42} textAnchor="middle" className="young-zoom-lbl">S{k === 0 ? '₁' : '₂'}</text>
                </g>
              ))}
              {/* kích thước a */}
              <g className="young-zoom-dim">
                <line x1={x1s} y1={52} x2={x2s} y2={52} />
                <line x1={x1s} y1={46} x2={x1s} y2={58} />
                <line x1={x2s} y1={46} x2={x2s} y2={58} />
              </g>
              <text x={0} y={ZH / 2 - 9} textAnchor="middle" className="young-zoom-val">
                {visualOne && !anim ? 'Khe S₂ đã bị dán băng keo' : `a = ${vn(params.aMm, 2)} mm`}
              </text>
              {tape && <Tape {...tape} />}
              {sq && (
                <g transform={`translate(${sq.x} ${FEET_Y + sq.y}) scale(${SQ_S * sq.face} ${SQ_S})`}>
                  <Squirrel pose={sq.pose} mood={sq.mood} />
                </g>
              )}
            </g>
          </g>
        </g>

        {/* Kích thước D trên mặt bàn */}
        <g className="young-lab-dim" pointerEvents="none">
          <line x1={xCard} y1={470} x2={B.bl[0]} y2={470} />
          <line x1={xCard} y1={462} x2={xCard} y2={478} />
          <line x1={B.bl[0]} y1={462} x2={B.bl[0]} y2={478} />
          <text x={(xCard + B.bl[0]) / 2} y={462} textAnchor="middle">D = {vn(params.Dm, 2)} m</text>
        </g>
        <text x={xCard} y={500} textAnchor="middle" className="young-lab-hint">↔ kéo tấm bìa</text>
        {bandTop && <text x={B.tl[0] - 8} y={(P(0, BAND[0])[1] + P(0, BAND[1])[1]) / 2} textAnchor="end" className="young-lab-hint">bấm lên màn →</text>}
        {/* ── Hoạt họa hướng dẫn ── */}
        {guide && (
          <g className="young-guide" pointerEvents="none">
            {hi.has('source') && <ellipse cx={128} cy={352} rx={84} ry={48} className="young-guide-ring" />}
            {hi.has('slits') && (
              <>
                <rect x={zoomC[0] - ZW / 2 - 6} y={zoomC[1] - ZH / 2 - 6} width={ZW + 12} height={ZH + 12} rx="16" className="young-guide-ring" />
                <circle cx={xCard} cy={yCard} r={20} className="young-guide-ring" />
              </>
            )}
            {hi.has('card') && (
              <>
                <rect x={xCard - 28} y={yCard - 76} width={56} height={(408 - yCard) + 80} rx="10" className="young-guide-ring" />
                <line x1={xCard} y1={470} x2={B.bl[0]} y2={470} className="young-guide-line" />
              </>
            )}
            {hi.has('cone') && (
              <polygon points={pts([[xCard, yCard], P(0, BAND[0]), P(1, BAND[0] - 0.04), P(1, BAND[1] + 0.04), P(0, BAND[1])])} className="young-guide-outline" />
            )}
            {hi.has('board') && <polygon points={pts([B.tl, B.tr, B.br, B.bl])} className="young-guide-outline" />}
            {hi.has('center') && (
              <polygon points={pts([P(0.5 - 0.022, BAND[0] - 0.03), P(0.5 + 0.022, BAND[0] - 0.03), P(0.5 + 0.022, BAND[1] + 0.03), P(0.5 - 0.022, BAND[1] + 0.03)])} className="young-guide-ring" />
            )}
            {hi.has('spacing') && spU != null && (() => {
              const v = BAND[0] - 0.07
              const a = P(0.5, v), b = P(spU, v)
              const a2 = P(0.5, BAND[0]), b2 = P(spU, BAND[0])
              const c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
              return (
                <g className="young-guide-bracket">
                  <line x1={P(0.5, BAND[0])[0]} y1={P(0.5, BAND[0])[1]} x2={P(0.5, BAND[1])[0]} y2={P(0.5, BAND[1])[1]} className="young-guide-fringe" />
                  <line x1={P(spU, BAND[0])[0]} y1={P(spU, BAND[0])[1]} x2={P(spU, BAND[1])[0]} y2={P(spU, BAND[1])[1]} className="young-guide-fringe" />
                  <polyline points={pts([a2, a, b, b2])} />
                  <rect x={c[0] - 58} y={c[1] - 34} width={116} height={24} rx="7" />
                  <text x={c[0]} y={c[1] - 17} textAnchor="middle">i = {vn(iMm, 2)} mm</text>
                </g>
              )
            })()}
            {guide.arrows && [0.17, 0.83].map(u => {
              const toward = guide.arrows === 'in' ? (u < 0.5 ? 1 : -1) : (u < 0.5 ? -1 : 1)
              const [x, y] = P(u, bandMid)
              return (
                <g key={u} transform={`translate(${x} ${y})`}>
                  <g className={`young-guide-arrow young-guide-arrow--${toward > 0 ? 'r' : 'l'}`}>
                    <path d={toward > 0 ? 'M-16 0 H10 M2 -8 L12 0 L2 8' : 'M16 0 H-10 M-2 -8 L-12 0 L-2 8'} />
                  </g>
                </g>
              )
            })}
          </g>
        )}
      </svg>
    </div>
  )
}
