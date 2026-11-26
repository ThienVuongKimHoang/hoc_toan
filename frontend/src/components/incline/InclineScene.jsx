import React, { useEffect, useId, useRef, useState } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { canSlide } from '../../physics/inclinePhysics.js'
import { Squirrel, SquirrelBall, squirrelMode, HAND_REACH, BALL_R } from './Squirrel.jsx'

/* ─────────────────────────────────────────────────────────────
   Cảnh 2D mặt phẳng nghiêng.
   SVG lấy đúng kích thước khung (1 đơn vị = 1 px) nên luôn lấp đầy vùng hình,
   và các nhãn KaTeX (lớp HTML phủ) được định vị bằng px khớp tuyệt đối với SVG.
───────────────────────────────────────────────────────────── */

export const FORCE_COLORS = {
  P: '#e11d48',
  N: '#2563eb',
  Fms: '#ea580c',
  comp: '#9333ea',
  v: '#059669',
  axis: '#475569',
  hand: '#0d9488',        // lực giữ của sóc
}

const tex = s => katex.renderToString(s, { throwOnError: false })
const vn = (n, d = 2) => n.toFixed(d).replace('.', ',')

/* Vùng trống dành cho lớp phủ: thanh công cụ (trái trên) và bảng số liệu (phải trên) */
const TOP_RESERVE = 130
const FLOOR_BAND = 54

function Arrow({ from, vec, color, markerId, dashed = false, width = 3.4 }) {
  const len = Math.hypot(vec[0], vec[1])
  if (len < 5) return null
  const k = (len - 7) / len           // lùi điểm cuối để đầu mũi tên không lố
  const to = [from[0] + vec[0] * k, from[1] + vec[1] * k]
  return (
    <g>
      {!dashed && (
        <line x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]}
          stroke="#fff" strokeWidth={width + 3.2} strokeLinecap="round" opacity="0.9" />
      )}
      <line x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]}
        stroke={color} strokeWidth={dashed ? width - 1.2 : width} strokeLinecap="round"
        strokeDasharray={dashed ? '7 5' : undefined} markerEnd={`url(#${markerId})`} />
    </g>
  )
}

function useSize(ref) {
  const [size, setSize] = useState({ w: 900, h: 560 })
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

/* Cửa sổ thời gian (ms) để ước lượng tốc độ vuốt khi thả tay */
const FLICK_WINDOW = 100

export default function InclineScene({
  params, state, sim, show, ghostTimes = [], rightReserve = 0,
  dragging = false, dragV = 0, onDragStart, onDrag, onDragEnd, onNudge,
  playing = false, tired = false, flicked = false,
}) {
  const boxRef = useRef(null)
  const svgRef = useRef(null)
  const samplesRef = useRef([])          // [{ t (ms), x (m) }] trong lúc kéo
  const draggable = !!onDrag
  const { w: VW, h: VH } = useSize(boxRef)
  const uid = useId().replace(/:/g, '')
  const { alphaDeg, m, L } = params
  const al = (alphaDeg * Math.PI) / 180
  const sin = Math.sin(al)
  const cos = Math.cos(al)

  /* ── Hình học dốc: co giãn trong vùng trống (trừ lề trái cho đường gióng h, lề phải cho bảng số liệu) ── */
  const FLOOR_Y = VH - FLOOR_BAND
  const left = 64
  const right = rightReserve > 0 && VW >= 640 ? rightReserve + 56 : 56
  const availW = Math.max(220, VW - left - right)
  const availH = Math.max(140, FLOOR_Y - TOP_RESERVE)
  const Lpx = sin < 1e-6 ? availW : Math.min(availW / cos, availH / sin)
  const hw = Lpx * cos
  const hh = Lpx * sin
  const Bx = left + Math.max(0, (availW - hw) / 2)
  const A = [Bx, FLOOR_Y - hh]
  const B = [Bx, FLOOR_Y]
  const C = [Bx + hw, FLOOR_Y]
  const ppm = Lpx / L                                   // px trên 1 mét
  const bw = Math.min(60 + m * 3, Lpx * 0.3)
  const bh = bw * 0.62
  const P_LEN = Math.max(70, Math.min(118, VH * 0.17))

  const d = [cos, sin]            // hướng xuống dốc (y màn hình hướng xuống)
  const n = [sin, -cos]           // pháp tuyến mặt dốc, hướng ra ngoài
  const usable = Math.max(1, Lpx - bw - 12)
  const along = x => bw / 2 + 6 + (x / L) * usable
  const onSlope = s => [A[0] + d[0] * s, A[1] + d[1] * s]
  const add = (p, v, k = 1) => [p[0] + v[0] * k, p[1] + v[1] * k]

  /* ── Kéo – vuốt vật ──
     Chiếu con trỏ lên đường mặt dốc rồi đổi ngược qua along() để ra x (m).
     Tốc độ vuốt = Δx/Δt của các mẫu trong FLICK_WINDOW ms gần nhất (m/s theo thời gian thực). */
  const pointerToX = e => {
    const r = svgRef.current.getBoundingClientRect()
    const p = [e.clientX - r.left, e.clientY - r.top]
    const sPx = (p[0] - A[0]) * d[0] + (p[1] - A[1]) * d[1]
    const x = ((sPx - bw / 2 - 6) / usable) * L
    return Math.round(Math.min(L, Math.max(0, x)) * 100) / 100
  }
  const flickVelocity = () => {
    const smp = samplesRef.current
    if (smp.length < 2) return 0
    const last = smp[smp.length - 1]
    const first = smp.find(q => last.t - q.t <= FLICK_WINDOW) || smp[0]
    const dt = (last.t - first.t) / 1000
    return dt > 0.008 ? (last.x - first.x) / dt : 0
  }
  const grabOffset = useRef(0)           // giữ nguyên khoảng lệch giữa con trỏ và vật khi bắt đầu kéo
  const handleDown = e => {
    if (!draggable || e.button > 0) return
    e.preventDefault()
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* con trỏ không còn hợp lệ — vẫn kéo được */ }
    grabOffset.current = pointerToX(e) - state.x
    samplesRef.current = [{ t: performance.now(), x: state.x }]
    onDragStart?.()
  }
  const handleMove = e => {
    if (!dragging) return
    const x = Math.round(Math.min(L, Math.max(0, pointerToX(e) - grabOffset.current)) * 100) / 100
    const now = performance.now()
    samplesRef.current = [...samplesRef.current.filter(q => now - q.t <= FLICK_WINDOW * 2), { t: now, x }]
    onDrag?.(x, flickVelocity())
  }
  const handleUp = e => {
    if (!dragging) return
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* đã nhả */ }
    // Nếu tay đã dừng lại trước khi thả (mẫu cuối cũ hơn cửa sổ) thì coi như thả nhẹ
    const smp = samplesRef.current
    const stale = smp.length && performance.now() - smp[smp.length - 1].t > FLICK_WINDOW
    onDragEnd?.(state.x, stale ? 0 : flickVelocity())
    samplesRef.current = []
  }
  const handleKey = e => {
    if (!onNudge) return
    if (e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); onNudge(-0.1) }
    if (e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); onNudge(0.1) }
  }

  const contact = onSlope(along(state.x))
  const center = add(contact, n, bh / 2)

  const f = sim.forces
  const k = f.P > 0 ? P_LEN / f.P : 0
  const vecP = [0, f.P * k]
  const vecN = [n[0] * f.N * k, n[1] * f.N * k]
  const vecPpar = [d[0] * f.Ppar * k, d[1] * f.Ppar * k]
  const vecPperp = [-n[0] * f.Pperp * k, -n[1] * f.Pperp * k]
  const vecF = [d[0] * state.Fms * k, d[1] * state.Fms * k]
  const dirV = Math.sign(state.v)
  const vLen = Math.min(96, Math.abs(state.v) * 11) * dirV
  const vecV = [d[0] * vLen, d[1] * vLen]
  let vFrom = add(center, d, dirV * (bw / 2 + 4))        // vận tốc mọc ra từ mặt trước của vật
  const fFrom = add(contact, n, 2.5)

  /* ── Hiệu ứng ma sát ──
     Công suất ma sát |Fms|·|v| (W) quyết định độ dày tia lửa và vệt nóng.
     Khi ma sát hãm (đi xuống mà a < 0) thì vật rung nhẹ. */
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const moving = Math.abs(state.v) > 0.03 && state.frictionKind === 'kinetic'
  const fricPower = moving ? Math.abs(state.Fms * state.v) : 0
  const sparkCount = reduceMotion ? 0 : Math.min(28, Math.round(fricPower / 1.6))
  const braking = state.phase === 'down' && state.a < 0 && moving
  const jitter = braking && !reduceMotion ? Math.sin(state.t * 95) * 0.9 : 0
  const blockAt = add(contact, n, jitter)
  const rearEdge = add(contact, d, -dirV * (bw / 2 - 2))
  const sparks = []
  for (let i = 0; i < sparkCount; i++) {
    const rnd = (Math.sin((i + 1) * 12.9898) * 43758.5453) % 1
    const r1 = Math.abs(rnd)
    const age = (state.t * 2.6 + i * 0.6180339) % 1
    const back = -dirV * age * (22 + r1 * 34)
    const up = age * (10 + r1 * 20) - age * age * 18
    const p = add(add(rearEdge, d, back * 1.3), n, up * 1.4)
    sparks.push({ x: p[0], y: p[1], r: 1.2 + (1 - age) * 2.4, o: 1 - age * 0.85, hot: age < 0.35 })
  }
  const staticGrip = state.frictionKind === 'static' && f.Ppar > 1e-6 && !dragging

  /* ── Sóc ── */
  const slides = canSlide(params)
  const sqMode = squirrelMode({ params, t: state.t, playing, dragging, tired, show, slides, flicked })
  const sqScale = Math.max(0.8, Math.min(1.15, bh / 44))
  const sqS0 = along(params.x0 ?? 0) + bw / 2 + HAND_REACH * sqScale      // chân sóc khi đang giữ/đẩy (px dọc dốc)
  const holdForce = Math.max(0, f.Ppar - f.FmsMax)                         // lực giữ tối thiểu
  // Điểm đứng theo px dọc dốc; quá chân dốc thì đứng trên sàn (không nghiêng)
  const standAt = s => (s <= Lpx ? { at: onSlope(s), rot: alphaDeg } : { at: [C[0] + (s - Lpx), FLOOR_Y], rot: 0 })
  const ballAt = (s, r) => (s <= Lpx ? add(onSlope(s), n, r) : [C[0] + (s - Lpx), FLOOR_Y - r])
  const FALL_DELAY = 0.35        // giây mô phỏng sóc đứng thở hắt trước khi ngã
  let sqView = null
  if (sqMode === 'hold' || sqMode === 'tired' || sqMode === 'relax' || sqMode === 'pushReady' || sqMode === 'shove') {
    const s = sqMode === 'relax' ? along(state.x) + bw / 2 + 16 * sqScale : sqS0
    sqView = { kind: 'stand', ...standAt(s) }
  } else if (sqMode === 'pushFall') {
    // Sóc chạy theo sau vật, vừa chạy vừa đẩy suốt giai đoạn đi lên.
    // Vật dừng (đỉnh quãng đi lên) → sóc hết sức, đứng thở hắt FALL_DELAY giây → ngã lăn xuống dốc,
    // luôn ở phía dưới mặt vật nếu vật trượt trở xuống (như bị vật đuổi theo).
    const up = sim.phases[0]
    const tStop = up && up.kind === 'up' ? up.t1 : 0
    const xStop = sim.stateAt(tStop).x
    const sStop = along(xStop) + bw / 2 + HAND_REACH * sqScale
    const blockFront = along(state.x) + bw / 2
    if (state.t <= tStop - 1e-9) {
      sqView = { kind: 'stand', ...standAt(blockFront + HAND_REACH * sqScale), running: true }
    } else if (state.t < tStop + FALL_DELAY) {
      sqView = { kind: 'stand', ...standAt(Math.max(sStop, blockFront + HAND_REACH * sqScale)), spent: true }
    } else {
      const r = BALL_R * sqScale
      const tt = state.t - tStop - FALL_DELAY
      const s = Math.max(sStop - HAND_REACH * sqScale * 0.5 + 25 * tt + 170 * tt * tt, blockFront + r + 1)
      const at = ballAt(s, r)
      if (at[0] < VW + 40) sqView = { kind: 'ball', at, spin: (s / r) * (180 / Math.PI), r }
    }
  } else if (sqMode === 'roll') {
    // Bị vật cuốn: luôn lăn phía trước mặt vật, nhanh hơn vật một chút; quá chân dốc thì lăn trên sàn rồi ra khỏi khung
    const r = BALL_R * sqScale
    const tt = state.t
    const blockFront = along(state.x) + bw / 2
    const s = Math.max(sqS0 - HAND_REACH * sqScale + r + 40 * tt + 150 * tt * tt, blockFront + r + 1)
    const at = ballAt(s, r)
    if (at[0] < VW + 40) sqView = { kind: 'ball', at, spin: (s / r) * (180 / Math.PI), r }
  }
  // Bong bóng thoại đặt sau lưng sóc (phía chân dốc) để không che vật và nhãn lực
  const sqHead = sqView?.kind === 'stand'
    ? (sqView.rot === 0
      ? [sqView.at[0] + 40 * sqScale, sqView.at[1] - 74 * sqScale]
      : add(add(sqView.at, d, 46 * sqScale), n, 74 * sqScale))
    : null
  if (sqView?.kind === 'ball' && sqMode === 'roll') vFrom = add(vFrom, n, bh / 2 + 10)      // vectơ v đi phía trên sóc đang lăn
  const upStop = sim.phases[0]?.kind === 'up' ? sim.phases[0].t1 : 0
  const fallT = state.t - upStop - FALL_DELAY
  const sqBubble =
    sqMode === 'pushFall' && sqView?.running ? (state.t < 0.35 ? 'Hựựự!' : 'Lên nữa nào…')
    : sqMode === 'pushFall' && sqView?.spent ? 'Hết sức rồi…'
    :
    sqMode === 'hold' ? 'Cố lên… giữ chặt!'
    : sqMode === 'tired' ? 'Hết hơi rồi…'
    : sqMode === 'relax' ? 'Ma sát giữ rồi, nghỉ thôi!'
    : sqMode === 'roll' && state.t < 0.7 ? 'Áaa!'
    : sqMode === 'pushReady' ? 'Đẩy lên nào!'
    : sqMode === 'shove' ? 'Hựựự!'
    : sqMode === 'pushFall' && fallT >= 0 && fallT < 0.6 ? 'Oái!'
    : null
  const handFrom = add(add(contact, d, bw / 2), n, bh * 0.55)
  const vecHand = [-d[0] * holdForce * k, -d[1] * holdForce * k]

  /* ── Nhãn HTML ── */
  const labels = []
  const addLabel = (key, from, vec, html, color, pad = 16, nudge = [0, 0]) => {
    const len = Math.hypot(vec[0], vec[1])
    if (len < 5) return
    labels.push({
      key, color, html,
      x: from[0] + vec[0] + (vec[0] / len) * pad + nudge[0],
      y: from[1] + vec[1] + (vec[1] / len) * pad + nudge[1],
    })
  }
  if (show.P) addLabel('P', center, vecP, tex('\\vec P'), FORCE_COLORS.P)
  if (show.N) addLabel('N', center, vecN, tex('\\vec N'), FORCE_COLORS.N)
  if (show.Fms) addLabel('F', fFrom, vecF, tex('\\vec F_{ms}'), FORCE_COLORS.Fms, 18, [-n[0] * 18, -n[1] * 18])
  if (show.comp) {
    addLabel('Px', center, vecPpar, tex('\\vec P_x'), FORCE_COLORS.comp)
    addLabel('Py', center, vecPperp, tex('\\vec P_y'), FORCE_COLORS.comp)
  }
  if (show.v) addLabel('v', vFrom, vecV, tex('\\vec v'), FORCE_COLORS.v)

  // Nhãn khối lượng gắn ở góc trên phía đỉnh dốc của vật — tránh gốc các vectơ
  const mAnchor = add(add(contact, d, -bw / 2 - 6), n, bh + 14)

  /* ── Cung góc α ── */
  const r = 46
  const arcEnd = [C[0] - r * cos, C[1] - r * sin]
  const arcPath = `M ${C[0] - r} ${C[1]} A ${r} ${r} 0 0 1 ${arcEnd[0]} ${arcEnd[1]}`
  const alLabel = [C[0] - 54 * Math.cos(al / 2), C[1] - 54 * Math.sin(al / 2)]

  /* ── Trục toạ độ Oxy gắn với vật ── */
  const axX0 = add(center, d, -70)
  const axX1 = add(center, d, 170)
  const axY0 = add(center, n, -60)
  const axY1 = add(center, n, 150)

  const ticks = []
  for (let i = 0; i <= Math.floor(L + 1e-9); i++) ticks.push(i)
  const h = L * sin
  const mk = c => `${uid}-mk-${c.slice(1)}`
  const DIM_X = B[0] - 28

  // Lưới kỹ thuật: ô nhỏ 0,5 m, ô lớn 1 m, neo tại chân dốc để đọc được khoảng cách
  const minor = Math.max(8, ppm / 2)
  const major = minor * 2

  return (
    <div className="incline-scene" ref={boxRef}>
      <svg ref={svgRef} width={VW} height={VH} viewBox={`0 0 ${VW} ${VH}`} role="img"
        aria-label={`Mặt phẳng nghiêng góc ${alphaDeg} độ`}>
        <defs>
          <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="1" stopColor="#f4f6f9" />
          </linearGradient>
          <pattern id={`${uid}-gmin`} width={minor} height={minor} patternUnits="userSpaceOnUse"
            patternTransform={`translate(${C[0]} ${FLOOR_Y})`}>
            <path d={`M ${minor} 0 L 0 0 0 ${minor}`} fill="none" stroke="#dbe3ee" strokeWidth="0.8" />
          </pattern>
          <pattern id={`${uid}-gmaj`} width={major} height={major} patternUnits="userSpaceOnUse"
            patternTransform={`translate(${C[0]} ${FLOOR_Y})`}>
            <path d={`M ${major} 0 L 0 0 0 ${major}`} fill="none" stroke="#c3cfdf" strokeWidth="1.1" />
          </pattern>
          <linearGradient id={`${uid}-floor`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#d7dde6" />
            <stop offset="1" stopColor="#eef1f5" />
          </linearGradient>
          <pattern id={`${uid}-hatch`} width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="14" stroke="#b8c1ce" strokeWidth="1.4" />
          </pattern>
          <linearGradient id={`${uid}-wood`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f0cf9f" />
            <stop offset="0.55" stopColor="#d9a466" />
            <stop offset="1" stopColor="#b97c40" />
          </linearGradient>
          <pattern id={`${uid}-grain`} width="120" height="26" patternUnits="userSpaceOnUse">
            <path d="M0 8 C 30 2, 60 14, 120 7" fill="none" stroke="#8a5424" strokeOpacity="0.13" strokeWidth="1.6" />
            <path d="M0 20 C 40 26, 80 14, 120 21" fill="none" stroke="#8a5424" strokeOpacity="0.09" strokeWidth="1.2" />
          </pattern>
          <radialGradient id={`${uid}-heat`}>
            <stop offset="0" stopColor="#fde047" stopOpacity="0.95" />
            <stop offset="0.45" stopColor="#f97316" stopOpacity="0.6" />
            <stop offset="1" stopColor="#ef4444" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${uid}-block`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#6b7280" />
            <stop offset="1" stopColor="#374151" />
          </linearGradient>
          <filter id={`${uid}-shadow`} x="-20%" y="-20%" width="140%" height="160%">
            <feDropShadow dx="0" dy="7" stdDeviation="8" floodColor="#0f172a" floodOpacity="0.16" />
          </filter>
          <filter id={`${uid}-bshadow`} x="-30%" y="-30%" width="160%" height="170%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#111827" floodOpacity="0.28" />
          </filter>
          {Object.values(FORCE_COLORS).map(c => (
            <marker key={c} id={mk(c)} viewBox="0 0 12 12" refX="4" refY="6"
              markerWidth="4.2" markerHeight="4.2" orient="auto-start-reverse" markerUnits="strokeWidth">
              <path d="M0 0 L12 6 L0 12 L3 6 Z" fill={c} />
            </marker>
          ))}
        </defs>

        <rect x="0" y="0" width={VW} height={VH} fill={`url(#${uid}-bg)`} />
        {show.grid && (
          <>
            <rect x="0" y="0" width={VW} height={FLOOR_Y} fill={`url(#${uid}-gmin)`} />
            <rect x="0" y="0" width={VW} height={FLOOR_Y} fill={`url(#${uid}-gmaj)`} />
          </>
        )}
        <rect x="0" y={FLOOR_Y} width={VW} height={VH - FLOOR_Y} fill={`url(#${uid}-floor)`} />
        <rect x="0" y={FLOOR_Y} width={VW} height="16" fill={`url(#${uid}-hatch)`} opacity="0.55" />
        <line x1="0" y1={FLOOR_Y} x2={VW} y2={FLOOR_Y} stroke="#94a3b8" strokeWidth="2" />

        {/* Dốc */}
        <g filter={`url(#${uid}-shadow)`}>
          <polygon points={`${A.join(',')} ${B.join(',')} ${C.join(',')}`} fill={`url(#${uid}-wood)`} />
          <polygon points={`${A.join(',')} ${B.join(',')} ${C.join(',')}`} fill={`url(#${uid}-grain)`} />
        </g>
        <line x1={A[0]} y1={A[1]} x2={C[0]} y2={C[1]} stroke="#7c4a1e" strokeWidth="3.2" strokeLinecap="round" />

        {/* Độ nhám mặt dốc: răng cưa cao dần theo μ; μ = 0 thì mặt trơn bóng ánh xanh */}
        {params.mu > 0.01 ? (
          <polyline fill="none" stroke="#5b3412" strokeLinejoin="round"
            strokeOpacity={0.3 + 0.5 * Math.min(1, params.mu)} strokeWidth="1.2"
            points={(() => {
              const amp = 0.8 + 4.2 * Math.min(1, params.mu)
              const step = 5
              const out = []
              for (let s = 0, i = 0; s <= Lpx; s += step, i++) {
                const p = add(onSlope(s), n, i % 2 ? amp : 0)
                out.push(`${p[0]},${p[1]}`)
              }
              return out.join(' ')
            })()} />
        ) : (
          <line x1={A[0] + n[0] * 1.5} y1={A[1] + n[1] * 1.5} x2={C[0] + n[0] * 1.5} y2={C[1] + n[1] * 1.5}
            stroke="#7dd3fc" strokeWidth="3" strokeOpacity="0.8" strokeLinecap="round" className="incline-ice" />
        )}

        {/* Vạch chia mét */}
        {ticks.map(i => {
          const p = onSlope(along(i))
          const q = add(p, n, -9)
          const tp = add(p, n, -21)
          return (
            <g key={i}>
              <line x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke="#7c4a1e" strokeOpacity="0.6" strokeWidth="1.6" />
              {sin > 0.12 && i < Math.floor(L + 1e-9) && (
                <text x={tp[0]} y={tp[1]} fontSize="11" fill="#7c4a1e" fillOpacity="0.75"
                  textAnchor="middle" dominantBaseline="middle"
                  transform={`rotate(${alphaDeg} ${tp[0]} ${tp[1]})`}>{i} m</text>
              )}
            </g>
          )
        })}

        {/* Đường gióng chiều cao h */}
        {h > 0.05 && (
          <g>
            <line x1={DIM_X} y1={B[1]} x2={DIM_X} y2={A[1]} stroke="#64748b" strokeWidth="1.3" />
            <line x1={DIM_X - 7} y1={A[1]} x2={DIM_X + 7} y2={A[1]} stroke="#64748b" strokeWidth="1.3" />
            <line x1={DIM_X - 7} y1={B[1]} x2={DIM_X + 7} y2={B[1]} stroke="#64748b" strokeWidth="1.3" />
            <line x1={DIM_X + 8} y1={A[1]} x2={A[0]} y2={A[1]} stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 3" />
            <text x={DIM_X - 9} y={(A[1] + B[1]) / 2} fontSize="13" fill="#475569" textAnchor="middle"
              fontStyle="italic" transform={`rotate(-90 ${DIM_X - 9} ${(A[1] + B[1]) / 2})`}>h = {vn(h)} m</text>
          </g>
        )}

        {alphaDeg > 0 && (
          <>
            <path d={arcPath} fill="none" stroke="#334155" strokeWidth="1.8" />
            <path d={`${arcPath} L ${C[0]} ${C[1]} Z`} fill="#334155" fillOpacity="0.07" />
          </>
        )}

        {/* Lưu vết: vị trí của vật sau mỗi khoảng thời gian bằng nhau */}
        {show.ghost && ghostTimes.map((gt, i) => {
          const gs = sim.stateAt(gt)
          const p = onSlope(along(gs.x))
          return (
            <g key={i} transform={`translate(${p[0]} ${p[1]}) rotate(${alphaDeg})`}>
              <rect x={-bw / 2} y={-bh} width={bw} height={bh} rx="8"
                fill="#6b7280" fillOpacity="0.06" stroke="#6b7280" strokeOpacity="0.4"
                strokeWidth="1.2" strokeDasharray="4 3" />
              <circle cx="0" cy={-bh / 2} r="2.4" fill="#6b7280" fillOpacity="0.6" />
            </g>
          )
        })}

        {/* Vệt nóng do ma sát ở mặt tiếp xúc */}
        {fricPower > 0.5 && (
          <ellipse cx={contact[0]} cy={contact[1]} rx={bw * 0.62} ry="7"
            transform={`rotate(${alphaDeg} ${contact[0]} ${contact[1]})`}
            fill={`url(#${uid}-heat)`} opacity={Math.min(0.9, fricPower / 45)} />
        )}

        {/* Vật */}
        <g transform={`translate(${blockAt[0]} ${blockAt[1]}) rotate(${alphaDeg})`} filter={`url(#${uid}-bshadow)`}>
          <rect x={-bw / 2} y={-bh} width={bw} height={bh} rx="9" fill={`url(#${uid}-block)`} stroke="#1f2937" strokeWidth="1.2" />
          <rect x={-bw / 2 + 5} y={-bh + 4} width={bw - 10} height={bh * 0.3} rx="6" fill="#fff" fillOpacity="0.18" />
        </g>

        {/* Ma sát nghỉ đang giữ: các vấu răng nhỏ nhấp nháy dưới đáy vật */}
        {staticGrip && (
          <g className="incline-grip" transform={`translate(${contact[0]} ${contact[1]}) rotate(${alphaDeg})`}>
            {[-0.32, -0.16, 0, 0.16, 0.32].map(u => (
              <path key={u} d={`M ${u * bw - 4} 0 L ${u * bw} -5 L ${u * bw + 4} 0 Z`} fill={FORCE_COLORS.Fms} />
            ))}
          </g>
        )}

        {/* Mép nóng: đáy vật phát sáng theo công suất ma sát */}
        {fricPower > 0.5 && (() => {
          const a0 = add(add(contact, d, -bw / 2 + 6), n, 1.5)
          const a1 = add(add(contact, d, bw / 2 - 6), n, 1.5)
          const op = Math.min(1, 0.25 + fricPower / 40)
          return (
            <g opacity={op}>
              <line x1={a0[0]} y1={a0[1]} x2={a1[0]} y2={a1[1]} stroke="#f97316" strokeWidth="7" strokeLinecap="round" opacity="0.35" />
              <line x1={a0[0]} y1={a0[1]} x2={a1[0]} y2={a1[1]} stroke="#fde047" strokeWidth="2.6" strokeLinecap="round" />
            </g>
          )
        })()}

        {/* Tia lửa ma sát — bắn ra phía sau mép vật */}
        {sparks.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={p.r} fill={p.hot ? '#fde047' : '#f97316'}
            stroke="#9a3412" strokeWidth="0.7" strokeOpacity="0.6" opacity={p.o} />
        ))}

        {/* Sóc */}
        {sqView?.kind === 'stand' && (
          <g transform={`translate(${sqView.at[0]} ${sqView.at[1]}) rotate(${sqView.rot}) scale(${sqScale})`}>
            <g className={
              sqMode === 'hold' || sqMode === 'pushReady' ? 'sq-tremble'
              : sqMode === 'tired' || sqView.spent ? 'sq-tremble sq-tremble--hard'
              : sqMode === 'shove' ? 'sq-shove'
              : sqView.running ? 'sq-run'
              : 'sq-breathe'}>
              <Squirrel pose={sqMode === 'relax' ? 'relax' : 'push'}
                mood={sqMode === 'relax' ? 'happy' : sqMode === 'tired' || sqView.spent ? 'tired' : 'strain'} />
            </g>
          </g>
        )}
        {sqView?.kind === 'ball' && (
          <g transform={`translate(${sqView.at[0]} ${sqView.at[1]}) scale(${sqScale})`}>
            <SquirrelBall spin={sqView.spin} t={state.t} />
          </g>
        )}
        {(sqMode === 'hold' || sqMode === 'tired') && holdForce > 0 && (
          <Arrow from={handFrom} vec={vecHand} color={FORCE_COLORS.hand} markerId={mk(FORCE_COLORS.hand)} width={3.2} />
        )}

        {/* Trục Oxy */}
        {show.axes && (
          <g opacity="0.9">
            <Arrow from={axX0} vec={[axX1[0] - axX0[0], axX1[1] - axX0[1]]} color={FORCE_COLORS.axis} markerId={mk(FORCE_COLORS.axis)} dashed width={2.6} />
            <Arrow from={axY0} vec={[axY1[0] - axY0[0], axY1[1] - axY0[1]]} color={FORCE_COLORS.axis} markerId={mk(FORCE_COLORS.axis)} dashed width={2.6} />
          </g>
        )}

        {/* Vectơ lực */}
        {show.comp && (
          <>
            <Arrow from={center} vec={vecPpar} color={FORCE_COLORS.comp} markerId={mk(FORCE_COLORS.comp)} dashed />
            <Arrow from={center} vec={vecPperp} color={FORCE_COLORS.comp} markerId={mk(FORCE_COLORS.comp)} dashed />
            <line x1={center[0] + vecPpar[0]} y1={center[1] + vecPpar[1]} x2={center[0] + vecP[0]} y2={center[1] + vecP[1]}
              stroke={FORCE_COLORS.comp} strokeOpacity="0.35" strokeWidth="1.2" strokeDasharray="3 4" />
            <line x1={center[0] + vecPperp[0]} y1={center[1] + vecPperp[1]} x2={center[0] + vecP[0]} y2={center[1] + vecP[1]}
              stroke={FORCE_COLORS.comp} strokeOpacity="0.35" strokeWidth="1.2" strokeDasharray="3 4" />
          </>
        )}
        {show.N && <Arrow from={center} vec={vecN} color={FORCE_COLORS.N} markerId={mk(FORCE_COLORS.N)} />}
        {show.P && <Arrow from={center} vec={vecP} color={FORCE_COLORS.P} markerId={mk(FORCE_COLORS.P)} />}
        {show.Fms && <Arrow from={fFrom} vec={vecF} color={FORCE_COLORS.Fms} markerId={mk(FORCE_COLORS.Fms)} />}
        {show.v && <Arrow from={vFrom} vec={vecV} color={FORCE_COLORS.v} markerId={mk(FORCE_COLORS.v)} width={3} />}
        <circle cx={center[0]} cy={center[1]} r="3.6" fill="#0f172a" stroke="#fff" strokeWidth="1.5" />

        {/* Vectơ v₀ dự kiến trong lúc vuốt */}
        {dragging && Math.abs(dragV) >= 0.3 && (
          <Arrow from={add(center, d, Math.sign(dragV) * (bw / 2 + 6))}
            vec={[d[0] * Math.sign(dragV) * Math.min(110, 14 + Math.abs(dragV) * 9), d[1] * Math.sign(dragV) * Math.min(110, 14 + Math.abs(dragV) * 9)]}
            color={FORCE_COLORS.v} markerId={mk(FORCE_COLORS.v)} dashed width={3.2} />
        )}

        {/* Vùng bắt chuột/chạm để kéo vật — vẽ sau cùng để nằm trên các vectơ */}
        {draggable && (
          <g transform={`translate(${contact[0]} ${contact[1]}) rotate(${alphaDeg})`}
            className={`incline-grab${dragging ? ' is-dragging' : ''}`}
            onPointerDown={handleDown} onPointerMove={handleMove} onPointerUp={handleUp} onPointerCancel={handleUp}
            onKeyDown={handleKey} tabIndex={0} role="slider"
            aria-label="Vật trên mặt dốc — kéo để đổi vị trí, vuốt để ném; phím ↑ ↓ để dời 0,1 m"
            aria-valuemin={0} aria-valuemax={L} aria-valuenow={Math.round(state.x * 100) / 100}
            aria-valuetext={`x = ${vn(state.x)} m`}>
            <rect x={-bw / 2 - 10} y={-bh - 10} width={bw + 20} height={bh + 14} rx="12"
              fill="transparent" className="incline-grab-hit" />
            <rect x={-bw / 2 - 3} y={-bh - 3} width={bw + 6} height={bh + 6} rx="11"
              fill="none" className="incline-grab-ring" />
          </g>
        )}
      </svg>

      <div className="incline-labels" aria-hidden="true">
        {alphaDeg > 0 && (
          <span className="incline-label incline-label--alpha" style={{ left: alLabel[0], top: alLabel[1] }}
            dangerouslySetInnerHTML={{ __html: tex(`\\alpha = ${String(alphaDeg).replace('.', '{,}')}^\\circ`) }} />
        )}
        {!dragging && (
          <span className="incline-label incline-label--mass" style={{ left: mAnchor[0], top: mAnchor[1] }}
            dangerouslySetInnerHTML={{ __html: tex(`m = ${vn(m, 1).replace(',', '{,}')}\\,\\text{kg}`) }} />
        )}
        {show.axes && (
          <>
            <span className="incline-label incline-label--axis" style={{ left: add(axX1, d, 14)[0], top: add(axX1, d, 14)[1] }}
              dangerouslySetInnerHTML={{ __html: tex('x') }} />
            <span className="incline-label incline-label--axis" style={{ left: add(axY1, n, 14)[0], top: add(axY1, n, 14)[1] }}
              dangerouslySetInnerHTML={{ __html: tex('y') }} />
          </>
        )}
        {labels.map(l => (
          <span key={l.key} className="incline-label" style={{ left: l.x, top: l.y, color: l.color }}
            dangerouslySetInnerHTML={{ __html: l.html }} />
        ))}
        {(sqMode === 'hold' || sqMode === 'tired') && holdForce > 0 && (() => {
          const len = Math.hypot(vecHand[0], vecHand[1])
          if (len < 5) return null
          const p = add(add(handFrom, vecHand), [-d[0], -d[1]], 4)
          const q = add(p, n, 16)
          return (
            <span className="incline-label" style={{ left: q[0], top: q[1], color: FORCE_COLORS.hand }}
              dangerouslySetInnerHTML={{ __html: tex('\\vec F_{\\text{giữ}}') }} />
          )
        })()}
        {sqBubble && (sqHead || sqView?.kind === 'ball') && (() => {
          const at = sqHead || [sqView.at[0], sqView.at[1] - sqView.r - 26]
          return (
            <span className={`incline-bubble incline-bubble--${sqMode}`} style={{ left: at[0], top: at[1] }}>{sqBubble}</span>
          )
        })()}
        {dragging && (() => {
          const at = mAnchor
          return (
            <span className="incline-drag-tip" style={{ left: at[0], top: at[1] }}>
              <span dangerouslySetInnerHTML={{ __html: tex(`x_0 = ${vn(state.x).replace(',', '{,}')}\\,\\text{m}`) }} />
              {Math.abs(dragV) >= 0.3 && (
                <span className="incline-drag-v" dangerouslySetInnerHTML={{
                  __html: tex(`v_0 \\approx ${vn(dragV, 1).replace(',', '{,}')}\\,\\text{m/s}`),
                }} />
              )}
            </span>
          )
        })()}
      </div>
    </div>
  )
}
