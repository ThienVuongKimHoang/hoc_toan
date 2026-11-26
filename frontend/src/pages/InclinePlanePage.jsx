import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_PARAMS, simulate, canSlide } from '../physics/inclinePhysics.js'
import { squirrelMode } from '../components/incline/Squirrel.jsx'
import InclineScene, { FORCE_COLORS } from '../components/incline/InclineScene.jsx'
import { InclineControls, FormulaModal } from '../components/incline/InclinePanels.jsx'
import MotionPanel from '../components/incline/MotionPanel.jsx'
import InclineCharts from '../components/incline/InclineCharts.jsx'
import '../components/incline/incline.css'

/* ── Icon nội tuyến ── */
const Svg = ({ children, size = 16, sw = 2.2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw}
    strokeLinecap="round" strokeLinejoin="round">{children}</svg>
)
const ArrowLeftIcon = () => <Svg size={18}><path d="M19 12H5M12 5l-7 7 7 7" /></Svg>
export const RampIcon = ({ size = 22 }) => (
  <Svg size={size} sw={2}><path d="M2 20h20L2 8z" /><rect x="7.2" y="8.6" width="5" height="3.6" rx="0.8" transform="rotate(31 9.7 10.4)" /></Svg>
)
const FormulaIcon = () => <Svg><path d="M4 7V4h16v3M9 20h6M12 4v16" /></Svg>
const ResetAllIcon = () => <Svg><path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8" /><path d="M3 3v5h5" /></Svg>
const ExpandIcon = () => <Svg><path d="M8 3H5a2 2 0 00-2 2v3M21 8V5a2 2 0 00-2-2h-3M3 16v3a2 2 0 002 2h3M16 21h3a2 2 0 002-2v-3" /></Svg>
const ShrinkIcon = () => <Svg><path d="M8 3v3a2 2 0 01-2 2H3M21 8h-3a2 2 0 01-2-2V3M3 16h3a2 2 0 012 2v3M16 21v-3a2 2 0 012-2h3" /></Svg>
const PlayIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15a1 1 0 001.5.86l12-7.5a1 1 0 000-1.72l-12-7.5A1 1 0 007 4.5z" /></svg>
const PauseIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4.5" width="4" height="15" rx="1.2" /><rect x="14" y="4.5" width="4" height="15" rx="1.2" /></svg>
const StepBackIcon = () => <Svg><path d="M6 5v14M18 6l-8 6 8 6z" /></Svg>
const StepFwdIcon = () => <Svg><path d="M18 5v14M6 6l8 6-8 6z" /></Svg>
const AxesIcon = () => <Svg size={18} sw={2}><path d="M5 19V4M5 19h15M5 4l-2 3M5 4l2 3M20 19l-3-2M20 19l-3 2" /></Svg>
const DecomposeIcon = () => <Svg size={18} sw={2}><path d="M6 6v12" /><path d="M6 18l12-6" strokeDasharray="3 3" /><path d="M6 18l-1-3M6 18l3-1" /></Svg>
const GridIcon = () => <Svg size={18} sw={1.8}><path d="M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18" /></Svg>
const TraceIcon = () => <Svg size={18} sw={1.8}><rect x="2" y="8" width="5" height="5" rx="1" strokeDasharray="2 2" /><rect x="9.5" y="8" width="5" height="5" rx="1" strokeDasharray="2 2" /><rect x="17" y="8" width="5" height="5" rx="1" /></Svg>

const SPEEDS = [0.25, 0.5, 1]
const STEP = 0.05
const GHOST_COUNT = 8
const AcornIcon = () => (
  <Svg size={18} sw={1.8}><path d="M5 10h14" /><path d="M6 10c0-3 3-5 6-5s6 2 6 5" /><path d="M12 5V3" /><path d="M6.5 10c0 5 2.5 9 5.5 10 3-1 5.5-5 5.5-10" /></Svg>
)
const DEFAULT_SHOW = { P: true, N: true, Fms: true, v: true, comp: false, axes: false, grid: true, ghost: true, squirrel: false }
const TIRED_MS = 1000          // thời gian sóc "hết hơi" trước khi vật bắt đầu trượt
const SHOVE_MS = 700           // thời gian sóc lấy đà đẩy vật lên dốc
const DataIcon = () => <Svg size={16}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></Svg>

const TOOLS = [
  { key: 'axes', label: 'Hệ trục Oxy', Icon: AxesIcon },
  { key: 'comp', label: 'Phân tích P thành Px, Py', Icon: DecomposeIcon, color: FORCE_COLORS.comp },
  { key: 'grid', label: 'Lưới ô vuông (ô nhỏ 0,5 m)', Icon: GridIcon },
  { key: 'ghost', label: 'Lưu vết chuyển động', Icon: TraceIcon },
  { key: 'squirrel', label: 'Nhân vật sóc', Icon: AcornIcon },
]

export default function InclinePlanePage({ onBack }) {
  const shellRef = useRef(null)
  const [params, setParams] = useState(DEFAULT_PARAMS)
  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(0.5)
  const [show, setShow] = useState(DEFAULT_SHOW)
  const [showFormula, setShowFormula] = useState(false)
  const [isFull, setIsFull] = useState(false)
  // Bảng thông số mở sẵn trên màn đủ rộng; màn hẹp thì thu gọn để nhường chỗ cho hình
  const [panelOpen, setPanelOpen] = useState(() => typeof window === 'undefined' || window.innerWidth >= 1180)

  const sim = useMemo(() => simulate(params), [params])
  const state = sim.stateAt(t)
  const done = t >= sim.tEnd - 1e-9

  /* Sóc "hết hơi": khi bắt đầu chạy lúc sóc đang giữ vật, sóc kiệt sức TIRED_MS rồi vật mới trượt.
     Mọi thao tác đổi thông số / kéo vật / đặt lại đều huỷ pha này. */
  const [tired, setTired] = useState(false)
  const tiredTimer = useRef(0)
  useEffect(() => () => clearTimeout(tiredTimer.current), [])
  const cancelTired = useCallback(() => { clearTimeout(tiredTimer.current); setTired(false) }, [])
  const startTired = useCallback((ms = TIRED_MS) => {
    clearTimeout(tiredTimer.current)
    setT(0); setPlaying(false); setTired(true)
    tiredTimer.current = setTimeout(() => { setTired(false); setPlaying(true) }, ms)
  }, [])

  // v0 đến từ cú vuốt tay của người dùng (không phải sóc đẩy) → không vẽ sóc
  const [flicked, setFlicked] = useState(false)

  const changeParams = useCallback(p => { cancelTired(); setFlicked(false); setParams(p); setT(0); setPlaying(false) }, [cancelTired])
  const toggle = useCallback(k => setShow(s => ({ ...s, [k]: !s[k] })), [])
  const resetAll = () => { cancelTired(); setParams(DEFAULT_PARAMS); setShow(DEFAULT_SHOW); setT(0); setPlaying(false); setSpeed(0.5) }

  /* ── Kéo – vuốt vật ──
     Trong lúc kéo: vật đứng ở x0 (v0 = 0), mô phỏng được tính lại liên tục nên bảng cập nhật ngay.
     Khi thả: tốc độ vuốt (m/s thời gian thực) chia cho hệ số tốc độ phát → v0 trong mô phỏng,
     để ngay sau khi thả vật đi đúng nhịp tay. Tự chạy nếu vật có chuyển động. */
  const [dragging, setDragging] = useState(false)
  const [dragV, setDragV] = useState(0)
  const toSimV = useCallback(vReal => {
    const v = vReal / speed
    if (Math.abs(v) < 0.3) return 0
    return Math.round(Math.max(-12, Math.min(12, v)) * 10) / 10
  }, [speed])
  const onDragStart = useCallback(() => {
    cancelTired(); setPlaying(false); setT(0); setDragging(true); setDragV(0)
  }, [cancelTired])
  const onDrag = useCallback((x, vReal) => {
    setParams(p => (p.x0 === x && p.v0 === 0 ? p : { ...p, x0: x, v0: 0 }))
    setDragV(toSimV(vReal))
  }, [toSimV])
  const onDragEnd = useCallback((x, vReal) => {
    const v0 = toSimV(vReal)
    const next = { ...params, x0: x, v0 }
    setDragging(false); setDragV(0); setFlicked(v0 !== 0)
    setParams(next); setT(0)
    const s = simulate(next)
    if (s.tEnd <= 0) return
    // Thả nhẹ khi sóc đang bật và vật sẽ trượt → sóc đỡ vật, hết hơi, rồi vật mới trượt
    const mode = squirrelMode({ params: next, t: 0, playing: false, dragging: false, tired: false, show, slides: canSlide(next), flicked: v0 !== 0 })
    if (mode === 'hold') startTired()
    else setPlaying(true)
  }, [params, toSimV, show, startTired])
  const onNudge = useCallback(dx => {
    changeParams({ ...params, x0: Math.round(Math.min(params.L, Math.max(0, (params.x0 ?? 0) + dx)) * 100) / 100, v0: 0 })
  }, [params, changeParams])

  /* Vòng hoạt ảnh. dt bị kẹp để khi tab ẩn rồi quay lại vật không "nhảy cóc". */
  const raf = useRef(0)
  useEffect(() => {
    if (!playing) return undefined
    let last = performance.now()
    const tick = now => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      setT(prev => {
        const next = prev + dt * speed
        if (next >= sim.tEnd) { setPlaying(false); return sim.tEnd }
        return next
      })
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [playing, speed, sim])

  /* Sóc đang ở trạng thái nào (giữ / hết hơi / nghỉ / bị cuốn lăn) */
  const sqMode = squirrelMode({ params, t, playing, dragging, tired, show, slides: canSlide(params), flicked })
  const holding = sqMode === 'hold' || sqMode === 'tired'

  const onPlay = useCallback(() => {
    if (tired) return
    if (playing) { setPlaying(false); return }
    if (done) setT(0)
    if (sim.tEnd <= 0) return
    // Đang giữ, hoặc chạy lại từ đầu sau khi sóc đã bị cuốn đi → sóc giữ lại, hết hơi rồi mới thả
    if (sqMode === 'hold' || (done && sqMode === 'roll')) { startTired(); return }
    // Đẩy lên dốc: sóc lấy đà đẩy rồi mới buông vật
    if (sqMode === 'pushReady' || (done && sqMode === 'pushFall')) { startTired(SHOVE_MS); return }
    setPlaying(true)
  }, [playing, done, sim, tired, sqMode, startTired])

  // Bước từng 0,05 s — bám đúng mốc lưới 0,05 để dễ đọc số liệu
  const step = useCallback(dir => {
    setPlaying(false)
    setT(prev => {
      const snapped = dir > 0 ? Math.floor(prev / STEP + 1e-6) * STEP + STEP : Math.ceil(prev / STEP - 1e-6) * STEP - STEP
      return Math.max(0, Math.min(sim.tEnd, snapped))
    })
  }, [sim])

  /* Phím tắt: Space chạy/dừng, ← → bước 0,05 s (bỏ qua khi đang gõ trong ô nhập) */
  useEffect(() => {
    const onKey = e => {
      if (showFormula) return
      const tag = e.target?.tagName
      if (tag === 'INPUT' && e.target.type !== 'range' && e.target.type !== 'checkbox') return
      if (tag === 'TEXTAREA') return
      if (e.code === 'Space') { e.preventDefault(); onPlay() }
      else if (e.key === 'ArrowRight' && tag !== 'INPUT') { e.preventDefault(); step(1) }
      else if (e.key === 'ArrowLeft' && tag !== 'INPUT') { e.preventDefault(); step(-1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onPlay, step, showFormula])

  /* Toàn màn hình — tiện khi trình chiếu lên máy chiếu / bảng thông minh */
  useEffect(() => {
    const onFs = () => setIsFull(document.fullscreenElement === shellRef.current)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])
  const toggleFull = () => {
    if (document.fullscreenElement) document.exitFullscreen?.()
    else shellRef.current?.requestFullscreen?.()
  }

  const ghostTimes = useMemo(() => {
    if (sim.tEnd <= 0) return []
    const out = []
    for (let i = 0; i <= GHOST_COUNT; i++) {
      const gt = (sim.tEnd * i) / GHOST_COUNT
      if (gt <= t + 1e-9) out.push(gt)
    }
    return out
  }, [sim, t])

  return (
    <div className="tool-page incline-shell" ref={shellRef}>
      <header className="incline-bar">
        <button className="incline-back" onClick={onBack}><ArrowLeftIcon /><span>Quay lại</span></button>
        <h1 className="incline-bar-title"><RampIcon size={20} /><span>Mô phỏng mặt phẳng nghiêng</span></h1>
        <div className="incline-bar-actions">
          <button className="incline-bar-btn" onClick={() => setShowFormula(true)}><FormulaIcon /><span>Công thức</span></button>
          <button className="incline-bar-btn" onClick={resetAll} title="Đặt lại mặc định"><ResetAllIcon /><span>Đặt lại</span></button>
          <button className="incline-bar-btn" onClick={toggleFull} title={isFull ? 'Thoát toàn màn hình' : 'Toàn màn hình'}>
            {isFull ? <ShrinkIcon /> : <ExpandIcon />}<span>{isFull ? 'Thoát' : 'Toàn màn hình'}</span>
          </button>
          <span className="incline-bar-tag">Vật lý 10 · Động lực học</span>
        </div>
      </header>

      <div className="incline-page">
        <aside className="incline-form">
          <InclineControls params={params} onChange={changeParams} show={show} onToggle={toggle}
            onPreset={p => changeParams(p)} />
        </aside>

        <main className="incline-stage">
          <div className="incline-canvas">
            <InclineScene params={params} state={state} sim={sim} show={show}
              ghostTimes={dragging ? [] : ghostTimes}
              dragging={dragging} dragV={dragV}
              onDragStart={onDragStart} onDrag={onDrag} onDragEnd={onDragEnd} onNudge={onNudge}
              playing={playing} tired={tired} flicked={flicked} />

            <div className="incline-toolbar" role="toolbar" aria-label="Tuỳ chọn hiển thị">
              {TOOLS.map(tl => (
                <button key={tl.key} className={show[tl.key] ? 'is-on' : ''} onClick={() => toggle(tl.key)}
                  aria-pressed={!!show[tl.key]} data-tip={tl.label} aria-label={tl.label}>
                  <tl.Icon />
                </button>
              ))}
            </div>

            {!panelOpen && (
              <button className="incline-open-panel" onClick={() => setPanelOpen(true)}>
                <DataIcon />Thông số chuyển động
              </button>
            )}
          </div>

          <InclineCharts sim={sim} t={t} dimmed={dragging} />

          <div className="incline-player">
            <button className="incline-play" onClick={onPlay} disabled={sim.tEnd <= 0 || tired}>
              {playing ? <PauseIcon /> : <PlayIcon />}
              {tired ? (sqMode === 'shove' ? 'Sóc đang đẩy…' : 'Sóc hết hơi…') : playing ? 'Tạm dừng' : done && t > 0 ? 'Chạy lại' : 'Chạy'}
            </button>
            <div className="incline-btn-group">
              <button onClick={() => { setPlaying(false); setT(0) }} title="Về t = 0"><ResetAllIcon /></button>
              <button onClick={() => step(-1)} disabled={t <= 0} title="Lùi 0,05 s (phím ←)"><StepBackIcon /></button>
              <button onClick={() => step(1)} disabled={done} title="Tiến 0,05 s (phím →)"><StepFwdIcon /></button>
            </div>
            <input className="incline-scrub" type="range" min="0" max={Math.max(sim.tEnd, 0.001)} step="0.001"
              value={t} disabled={sim.tEnd <= 0} aria-label="Thời gian"
              style={{ '--pct': `${sim.tEnd > 0 ? (t / sim.tEnd) * 100 : 0}%` }}
              onChange={e => { setPlaying(false); setT(Number(e.target.value)) }} />
            <span className="incline-time">
              {t.toFixed(2).replace('.', ',')}<small> / {sim.tEnd.toFixed(2).replace('.', ',')} s</small>
            </span>
            <div className="incline-seg">
              {SPEEDS.map(s => (
                <button key={s} className={speed === s ? 'is-on' : ''} onClick={() => setSpeed(s)}>
                  ×{String(s).replace('.', ',')}
                </button>
              ))}
            </div>
          </div>
        </main>

        {panelOpen && (
          <MotionPanel sim={sim} state={state} t={t} playing={playing} dragging={dragging} holding={holding} tired={sqMode === 'tired'} sqMode={sqMode}
            onCollapse={() => setPanelOpen(false)} />
        )}
      </div>

      {showFormula && <FormulaModal sim={sim} onClose={() => setShowFormula(false)} />}
    </div>
  )
}
