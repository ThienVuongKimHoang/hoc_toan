import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  fringeSpacing, makeColorAt, wavelengthToRGB, rgbCss, intensity, coincidence,
  VIOLET_NM, RED_NM, vn, vnShort,
} from '../../physics/youngPhysics.js'

/* ─────────────────────────────────────────────────────────────
   Màn quan sát phóng to (toạ độ thật, đơn vị mm):
   dải vân màu · trục x · đồ thị cường độ I(x) · thước đo kéo được.
   Rê chuột trên màn → báo toạ độ cho bảng số liệu (điểm M).
───────────────────────────────────────────────────────────── */

const PAD_X = 22
const TOP = 30          // hàng nhãn bậc vân (+ dấu vân trùng phía trên)
const STRIP_H = 56
const AXIS_H = 24
const PLOT_H = 74
const SNAP_PX = 7

function niceStep(W) {
  const raw = W / 10
  const p = 10 ** Math.floor(Math.log10(raw))
  const m = raw / p
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p
}

function useWidth(ref) {
  const [w, setW] = useState(900)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(([e]) => { if (e.contentRect.width > 0) setW(Math.round(e.contentRect.width)) })
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return w
}

/* Bức xạ "chính" để đánh số vân và bám thước: đơn sắc → λ, hai bức xạ → λ₁, ánh sáng trắng → không có */
export const primaryLambda = params => (params.mode === 'white' ? null : params.lambdaNm)

export default function YoungScreen({ params, viewW, show, ruler, onRuler, cursorX, onCursor, pinX = null, onPick, basic = false, guideHi = [] }) {
  // Cơ bản: chỉ dải vân + trục mm (không đồ thị, không thước)
  const H = TOP + STRIP_H + AXIS_H + (basic ? 8 : PLOT_H + 16)
  if (basic) show = { ...show, ruler: false }
  const wrapRef = useRef(null)
  const svgRef = useRef(null)
  const canvasRef = useRef(null)
  const w = useWidth(wrapRef)
  const innerW = Math.max(100, w - 2 * PAD_X)
  const W = viewW
  const X = x => PAD_X + ((x + W / 2) * innerW) / W
  const xOf = px => ((px - PAD_X) * W) / innerW - W / 2

  const lam1 = primaryLambda(params)
  const i1 = lam1 ? fringeSpacing(lam1, params) : null
  const pxPerI = i1 ? (i1 * innerW) / W : 0

  /* Dải vân: tính màu từng cột điểm ảnh thật (theo devicePixelRatio) */
  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const cw = Math.max(1, Math.round(innerW * dpr))
    cv.width = cw; cv.height = 1
    const ctx = cv.getContext('2d')
    const img = ctx.createImageData(cw, 1)
    const colorAt = makeColorAt(params)
    for (let c = 0; c < cw; c++) {
      const x = ((c + 0.5) / cw) * W - W / 2
      const [r, g, b] = colorAt(x)
      img.data[c * 4] = 6 + r * 249
      img.data[c * 4 + 1] = 8 + g * 247
      img.data[c * 4 + 2] = 14 + b * 241
      img.data[c * 4 + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
  }, [params, W, innerW])

  /* Đường cường độ */
  const curves = useMemo(() => {
    const top = TOP + STRIP_H + AXIS_H
    const make = (lam, stroke, width) => {
      const i = fringeSpacing(lam, params)
      let d = ''
      for (let px = 0; px <= innerW; px += 2) {
        const x = (px / innerW) * W - W / 2
        const y = top + PLOT_H * (1 - 0.92 * intensity(x, i))
        d += `${px ? 'L' : 'M'}${(PAD_X + px).toFixed(1)} ${y.toFixed(1)}`
      }
      return { d, stroke, width }
    }
    if (params.mode === 'white') {
      return [make(VIOLET_NM + 20, rgbCss(wavelengthToRGB(VIOLET_NM + 20)), 1.4), make(550, 'rgba(255,255,255,0.85)', 2), make(RED_NM - 40, rgbCss(wavelengthToRGB(RED_NM - 40)), 1.4)]
    }
    const out = [make(params.lambdaNm, rgbCss(wavelengthToRGB(params.lambdaNm)), 2.2)]
    if (params.mode === 'two') out.push(make(params.lambda2Nm, rgbCss(wavelengthToRGB(params.lambda2Nm)), 2.2))
    return out
  }, [params, W, innerW])

  const step = niceStep(W)
  const ticks = []
  for (let v = Math.ceil(-W / 2 / step) * step; v <= W / 2 + 1e-9; v += step) ticks.push(Math.round(v * 1e6) / 1e6)

  /* Nhãn bậc vân sáng / tối */
  const labelEvery = pxPerI > 0 ? Math.max(1, Math.ceil(16 / pxPerI)) : 1
  const brightLabels = []
  const darkLabels = []
  if (i1 && show.labels && !params.oneSlit) {
    const K = Math.floor(W / 2 / i1 + 1e-9)
    for (let k = -K; k <= K; k++) if (k % labelEvery === 0) brightLabels.push(k)
    if (params.mode === 'mono' && pxPerI >= 30 && !basic && !params.oneSlit) {
      for (let m = 1; (m - 0.5) * i1 <= W / 2; m++) darkLabels.push(m)
    }
  }
  const second = []
  if (params.mode === 'two' && show.labels && !params.oneSlit) {
    const i2 = fringeSpacing(params.lambda2Nm, params)
    const every2 = Math.max(1, Math.ceil(16 / ((i2 * innerW) / W)))
    const K2 = Math.floor(W / 2 / i2 + 1e-9)
    for (let k = -K2; k <= K2; k++) if (k % every2 === 0) second.push({ k, x: k * i2 })
  }
  const coin = params.mode === 'two' && !params.oneSlit ? coincidence(params) : null
  const coinMarks = []
  if (coin && !coin.same) for (let j = -Math.floor(W / 2 / coin.x + 1e-9); j * coin.x <= W / 2 + 1e-9; j++) coinMarks.push(j * coin.x)

  /* Quang phổ ánh sáng trắng: bậc k trải từ k·i_tím đến k·i_đỏ */
  const spectra = []
  if (params.mode === 'white' && show.labels && !params.oneSlit) {
    const iv = fringeSpacing(VIOLET_NM, params)
    const ir = fringeSpacing(RED_NM, params)
    for (let k = 1; k <= 4; k++) if (k * iv < W / 2) spectra.push({ k, a: k * iv, b: Math.min(W / 2, k * ir) })
  }

  /* ── Thước đo ── */
  const [drag, setDrag] = useState(null)
  const snap = x => {
    if (!i1 || !show.snap) return x
    const half = i1 / 2
    const s = Math.round(x / half) * half
    return Math.abs(X(s) - X(x)) <= SNAP_PX ? s : x
  }
  const local = e => e.clientX - svgRef.current.getBoundingClientRect().left
  const clampX = x => Math.max(-W / 2, Math.min(W / 2, x))
  const onDown = end => e => {
    e.preventDefault(); e.stopPropagation()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    setDrag(end)
  }
  const onMove = e => {
    const x = clampX(xOf(local(e)))
    if (drag) {
      const v = Math.round(snap(x) * 1000) / 1000
      onRuler({ ...ruler, [drag]: v })
      onCursor(v)
    } else onCursor(x)
  }
  const onUp = () => setDrag(null)
  const onDownBg = e => { if (onPick && !drag) onPick(Math.round(clampX(xOf(local(e))) * 1000) / 1000) }
  const nudge = end => e => {
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!dir) return
    e.preventDefault(); e.stopPropagation()
    const stepMm = i1 ? i1 / 2 : W / 100
    onRuler({ ...ruler, [end]: Math.round(clampX(ruler[end] + dir * stepMm) * 1000) / 1000 })
  }

  const rx1 = X(Math.max(-W / 2, Math.min(W / 2, ruler.x1)))
  const rx2 = X(Math.max(-W / 2, Math.min(W / 2, ruler.x2)))
  const dist = Math.abs(ruler.x2 - ruler.x1)
  const rulerY = TOP + STRIP_H - 12
  const showCursor = cursorX != null && Math.abs(cursorX) <= W / 2

  return (
    <div className="young-screen" ref={wrapRef}>
      <div className="young-screen-title">
        <span>Màn quan sát (phóng to)</span>
        {onPick && <em className="young-screen-tip">bấm vào màn để soi điểm M</em>}
        <small>{params.oneSlit ? 'Chỉ một khe sáng: màn sáng đều, không có vân' : params.mode === 'white' ? 'Ánh sáng trắng: vân trung tâm trắng, hai bên là dải màu tím trong – đỏ ngoài' : `i = ${vn(i1, 3)} mm`} · trục x tính bằng mm{params.mode === 'two' ? ' · ▼ vân trùng · số trên: bậc của λ₁, số dưới: bậc của λ₂' : ''}</small>
      </div>
      <div className="young-screen-body" style={{ height: H }}>
        <canvas ref={canvasRef} className="young-strip" style={{ left: PAD_X, top: TOP, width: innerW, height: STRIP_H }} aria-hidden="true" />
        <svg ref={svgRef} width={w} height={H} className="young-screen-svg"
          onPointerDown={onDownBg} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerLeave={() => { if (!drag) onCursor(null) }}
          role="img" aria-label="Hình giao thoa trên màn và đồ thị cường độ">
          {/* Nhãn vân sáng (λ₁) */}
          {brightLabels.map(k => (
            <text key={`b${k}`} x={X(k * i1)} y={TOP - 6} textAnchor="middle" className={`young-lbl${k === 0 ? ' is-center' : ''}`}>{Math.abs(k)}</text>
          ))}
          {/* Vân trùng (hai bức xạ) */}
          {coinMarks.map(x => (
            <path key={`c${x}`} d={`M${X(x) - 5} ${TOP - 27} h10 l-5 6 z`} className="young-coin" />
          ))}
          {/* Bức xạ thứ hai: nhãn dưới dải */}
          {second.map(s => (
            <text key={`s${s.k}`} x={X(s.x)} y={TOP + STRIP_H + 11} textAnchor="middle" className="young-lbl young-lbl--2">{Math.abs(s.k)}</text>
          ))}
          {/* Quang phổ bậc k */}
          {spectra.flatMap(s => [1, -1].map(sg => {
            const a = X(sg * s.a), b = X(sg * s.b)
            return (
              <g key={`sp${s.k}${sg}`} className="young-spec">
                <line x1={a} x2={b} y1={TOP - 10} y2={TOP - 10} />
                <line x1={a} x2={a} y1={TOP - 13} y2={TOP - 7} />
                <text x={(a + b) / 2} y={TOP - 13} textAnchor="middle">bậc {s.k}</text>
              </g>
            )
          }))}
          {params.mode === 'white' && show.labels && <text x={X(0)} y={TOP - 6} textAnchor="middle" className="young-lbl is-center">0</text>}

          {/* Trục x (mm) */}
          <line x1={PAD_X} x2={PAD_X + innerW} y1={TOP + STRIP_H + 14} y2={TOP + STRIP_H + 14} className="young-axis" />
          {ticks.map(v => (
            <g key={v} className="young-tick">
              <line x1={X(v)} x2={X(v)} y1={TOP + STRIP_H + 10} y2={TOP + STRIP_H + 18} />
              <text x={X(v)} y={TOP + STRIP_H + AXIS_H + 6} textAnchor="middle">{vnShort(v, 2)}</text>
            </g>
          ))}

          {!basic && <>
          {/* Đồ thị cường độ */}
          <line x1={PAD_X} x2={PAD_X + innerW} y1={TOP + STRIP_H + AXIS_H + PLOT_H} y2={TOP + STRIP_H + AXIS_H + PLOT_H} className="young-axis" />
          <text x={PAD_X - 6} y={TOP + STRIP_H + AXIS_H + 18} textAnchor="end" className="young-axis-name">I</text>
          {curves.map((c, j) => <path key={j} d={c.d} stroke={c.stroke} strokeWidth={c.width} fill="none" />)}
          {darkLabels.flatMap(m => [1, -1].map(sg => (
            <text key={`t${m}${sg}`} x={X(sg * (m - 0.5) * i1)} y={TOP + STRIP_H + AXIS_H + PLOT_H + 12} textAnchor="middle" className="young-lbl young-lbl--dark">T{m}</text>
          )))}
          </>}

          {/* Hoạt họa hướng dẫn: ngoặc khoảng vân, vạch giữa */}
          {guideHi.includes('spacing') && i1 && i1 <= W / 2 && (
            <g className="young-guide-bracket young-guide-bracket--strip">
              <line x1={X(0)} x2={X(0)} y1={TOP} y2={TOP + STRIP_H} className="young-guide-fringe" />
              <line x1={X(i1)} x2={X(i1)} y1={TOP} y2={TOP + STRIP_H} className="young-guide-fringe" />
              <polyline points={`${X(0)},${TOP + 8} ${X(0)},${TOP + 2} ${X(i1)},${TOP + 2} ${X(i1)},${TOP + 8}`} />
              <rect x={(X(0) + X(i1)) / 2 - 48} y={TOP + 12} width={96} height={20} rx="6" />
              <text x={(X(0) + X(i1)) / 2} y={TOP + 26} textAnchor="middle">i = {vn(i1, 2)} mm</text>
            </g>
          )}
          {guideHi.includes('center') && <rect x={X(0) - 10} y={TOP - 3} width={20} height={STRIP_H + 6} rx="5" className="young-guide-ring" />}

          {/* Điểm M đã chọn */}
          {pinX != null && Math.abs(pinX) <= W / 2 && (
            <g className="young-pin">
              <line x1={X(pinX)} x2={X(pinX)} y1={TOP - 4} y2={TOP + STRIP_H + 4} />
              <circle cx={X(pinX)} cy={TOP + STRIP_H / 2} r="5" />
              <text x={X(pinX) + 8} y={TOP + 13}>M</text>
            </g>
          )}

          {/* Con trỏ (điểm M) */}
          {showCursor && (
            <g className="young-cursor">
              <line x1={X(cursorX)} x2={X(cursorX)} y1={TOP} y2={H - 16} />
            </g>
          )}

          {/* Thước đo */}
          {show.ruler && (
            <g className="young-ruler">
              <line x1={rx1} x2={rx2} y1={rulerY} y2={rulerY} className="young-ruler-bar" />
              <line x1={rx1} x2={rx1} y1={TOP + 2} y2={TOP + STRIP_H - 2} className="young-ruler-end" />
              <line x1={rx2} x2={rx2} y1={TOP + 2} y2={TOP + STRIP_H - 2} className="young-ruler-end" />
              <g transform={`translate(${(rx1 + rx2) / 2} ${rulerY - 9})`}>
                <rect x={-62} y={-13} width={124} height={18} rx={5} className="young-ruler-tag" />
                <text textAnchor="middle" y={0}>
                  {vn(dist, 2)} mm{i1 ? ` ≈ ${vn(dist / i1, 2)} i` : ''}
                </text>
              </g>
              {['x1', 'x2'].map(end => (
                <g key={end} className={`young-ruler-handle${drag === end ? ' is-dragging' : ''}`} tabIndex={0}
                  role="slider" aria-label={end === 'x1' ? 'Đầu trái thước đo' : 'Đầu phải thước đo'} aria-valuenow={ruler[end]}
                  onPointerDown={onDown(end)} onKeyDown={nudge(end)}
                  transform={`translate(${end === 'x1' ? rx1 : rx2} ${TOP + STRIP_H - 2})`}>
                  <circle r={12} className="young-ruler-hit" />
                  <path d="M0 -8 L6 2 H-6 Z" />
                </g>
              ))}
            </g>
          )}
        </svg>
      </div>
    </div>
  )
}
