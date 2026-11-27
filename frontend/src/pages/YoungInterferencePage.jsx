import React, { useCallback, useEffect, useRef, useState } from 'react'
import { DEFAULT_PARAMS, fringeSpacing } from '../physics/youngPhysics.js'
import YoungScene from '../components/young/YoungScene.jsx'
import YoungScreen, { primaryLambda } from '../components/young/YoungScreen.jsx'
import YoungDataPanel from '../components/young/YoungDataPanel.jsx'
import YoungBasicPanel from '../components/young/YoungBasicPanel.jsx'
import YoungLabView from '../components/young/YoungLabView.jsx'
import YoungTour, { TOUR } from '../components/young/YoungTour.jsx'
import { YoungControls, BasicControls, FormulaModal } from '../components/young/YoungPanels.jsx'
import '../components/incline/incline.css'
import '../components/young/young.css'

/* ─────────────────────────────────────────────────────────────
   Thí nghiệm ảo: Giao thoa ánh sáng — khe Young (Vật lý 11, chương Sóng).
   Bố cục giống trang Mặt phẳng nghiêng: thanh tiêu đề · cột điều khiển trái ·
   vùng hình (sơ đồ sóng + màn phóng to) · bảng số liệu phải · thanh điều khiển đáy.
   Chạy hoàn toàn trong trình duyệt, không gọi API.
───────────────────────────────────────────────────────────── */

const Svg = ({ children, size = 16, sw = 2.2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw}
    strokeLinecap="round" strokeLinejoin="round">{children}</svg>
)
const ArrowLeftIcon = () => <Svg size={18}><path d="M19 12H5M12 5l-7 7 7 7" /></Svg>
export const SlitsIcon = ({ size = 22 }) => (
  <Svg size={size} sw={2}><path d="M4 3v6M4 11v2M4 15v6" /><path d="M8 8a6 6 0 010 8M8 4a10 10 0 010 16" opacity="0.6" /><path d="M20 3v18" /></Svg>
)
const FormulaIcon = () => <Svg><path d="M4 7V4h16v3M9 20h6M12 4v16" /></Svg>
const ResetAllIcon = () => <Svg><path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8" /><path d="M3 3v5h5" /></Svg>
const ExpandIcon = () => <Svg><path d="M8 3H5a2 2 0 00-2 2v3M21 8V5a2 2 0 00-2-2h-3M3 16v3a2 2 0 002 2h3M16 21h3a2 2 0 002-2v-3" /></Svg>
const ShrinkIcon = () => <Svg><path d="M8 3v3a2 2 0 01-2 2H3M21 8h-3a2 2 0 01-2-2V3M3 16h3a2 2 0 012 2v3M16 21v-3a2 2 0 012-2h3" /></Svg>
const PlayIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15a1 1 0 001.5.86l12-7.5a1 1 0 000-1.72l-12-7.5A1 1 0 007 4.5z" /></svg>
const PauseIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4.5" width="4" height="15" rx="1.2" /><rect x="14" y="4.5" width="4" height="15" rx="1.2" /></svg>
const DataIcon = () => <Svg size={16}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></Svg>
const RulerIcon = ({ size = 18 }) => <Svg size={size} sw={1.8}><rect x="2" y="8" width="20" height="8" rx="1.5" /><path d="M6 8v3M10 8v4M14 8v3M18 8v4" /></Svg>
const WavesIcon = () => <Svg size={18} sw={1.8}><path d="M6 4a8 8 0 010 16M10 6a10 10 0 010 12" /><circle cx="3" cy="12" r="1.5" /><path d="M16 4a8 8 0 010 16" opacity="0.5" /></Svg>
const AvgIcon = () => <Svg size={18} sw={1.8}><path d="M3 18c3 0 3-12 6-12s3 12 6 12 3-12 6-12" /></Svg>
const HyperIcon = () => <Svg size={18} sw={1.8}><path d="M3 12h18" /><path d="M3 4c6 4 12 5 18 5M3 20c6-4 12-5 18-5" strokeDasharray="3 2.5" /></Svg>
const LabelIcon = () => <Svg size={18} sw={1.8}><path d="M4 6h3v12M14 6h4a2 2 0 010 4h-4v8" /></Svg>
const CompassIcon = () => <Svg size={16}><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5-5 2 2-5z" /></Svg>
const MagnetIcon = () => <Svg size={18} sw={1.8}><path d="M6 3v8a6 6 0 0012 0V3h-4v8a2 2 0 01-4 0V3z" /><path d="M6 7h4M14 7h4" /></Svg>

const DEFAULT_SHOW = { waves: true, avg: false, hyper: true, labels: true, ruler: true, snap: true }
const TOOLS = [
  { key: 'waves', label: 'Sóng từ hai khe', Icon: WavesIcon },
  { key: 'avg', label: 'Cường độ trung bình (dải hyperbol tĩnh)', Icon: AvgIcon },
  { key: 'hyper', label: 'Đường cực đại (vân sáng)', Icon: HyperIcon },
  { key: 'labels', label: 'Nhãn bậc vân', Icon: LabelIcon },
  { key: 'ruler', label: 'Thước đo trên màn', Icon: RulerIcon },
  { key: 'snap', label: 'Thước bám tâm vân', Icon: MagnetIcon },
]
const BASIC_TOOLS = ['waves', 'avg', 'hyper']
const SPEEDS = [0.5, 1, 2]
const VIEWS = [5, 10, 20, 40, 80]       // bề rộng khung màn phóng to (mm)
const DEFAULT_RULER = { x1: 0, x2: 6 }

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export default function YoungInterferencePage({ onBack }) {
  const shellRef = useRef(null)
  const [params, setParamsRaw] = useState(DEFAULT_PARAMS)
  const [show, setShow] = useState(DEFAULT_SHOW)
  const [playing, setPlaying] = useState(() => !prefersReducedMotion())
  const [speed, setSpeed] = useState(1)
  const [viewW, setViewW] = useState(20)
  const [ruler, setRuler] = useState(DEFAULT_RULER)
  const [cursorX, setCursorX] = useState(null)
  const [pinX, setPinX] = useState(null)
  const [kSel, setKSel] = useState(3)
  const [level, setLevel] = useState('basic')          // 'basic' | 'advanced'
  const [stageView, setStageView] = useState('lab')    // 'lab' (phòng thí nghiệm) | 'inside' (sơ đồ sóng)
  const [tourStep, setTourStep] = useState(null)
  const [showFormula, setShowFormula] = useState(false)
  const [isFull, setIsFull] = useState(false)
  const [panelOpen, setPanelOpen] = useState(() => typeof window === 'undefined' || window.innerWidth >= 1180)
  const basic = level === 'basic'

  /* Đổi thông số từ từ (dùng trong Khám phá từng bước) để mắt kịp thấy vân thay đổi */
  const paramsRef = useRef(params)
  paramsRef.current = params
  const tweenRef = useRef(0)
  useEffect(() => () => cancelAnimationFrame(tweenRef.current), [])
  const setParams = useCallback(p => { cancelAnimationFrame(tweenRef.current); setParamsRaw(p) }, [])
  const animateTo = useCallback((target, ms = 1300) => {
    cancelAnimationFrame(tweenRef.current)
    const from = paramsRef.current
    const nums = Object.keys(target).filter(k => typeof target[k] === 'number' && typeof from[k] === 'number' && target[k] !== from[k])
    const rest = Object.fromEntries(Object.keys(target).filter(k => !nums.includes(k)).map(k => [k, target[k]]))
    setParamsRaw(p => ({ ...p, ...rest }))
    if (!nums.length || prefersReducedMotion()) { setParamsRaw(p => ({ ...p, ...target })); return }
    const t0 = performance.now()
    const tick = now => {
      const u = Math.min(1, (now - t0) / ms)
      const e = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2
      setParamsRaw(p => {
        const nx = { ...p }
        nums.forEach(k => { nx[k] = u >= 1 ? target[k] : from[k] + (target[k] - from[k]) * e })
        return nx
      })
      if (u < 1) tweenRef.current = requestAnimationFrame(tick)
    }
    tweenRef.current = requestAnimationFrame(tick)
  }, [])

  const toggle = useCallback(k => setShow(s => ({ ...s, [k]: !s[k] })), [])
  const resetAll = () => {
    stopGuide()
    setParams(DEFAULT_PARAMS); setShow(DEFAULT_SHOW); setViewW(20); setRuler(DEFAULT_RULER)
    setKSel(3); setSpeed(1); setPlaying(!prefersReducedMotion()); setPinX(null); setTourStep(null)
  }

  const lam1 = primaryLambda(params)
  const i1 = lam1 && !params.oneSlit ? fringeSpacing(lam1, params) : null
  // Điểm M đang soi: chỗ con trỏ đang rê, không thì chỗ đã bấm
  const markX = cursorX ?? pinX

  /* Đo 10 khoảng vân đối xứng quanh vân trung tâm — đúng cách làm ở bài thực hành để giảm sai số.
     Chọn khung màn nhỏ nhất chứa vừa; khoảng vân quá lớn thì đo số khoảng (chẵn) nhiều nhất vừa khung. */
  const measure10 = () => {
    if (!i1) return
    const fit = VIEWS.find(v => 10 * i1 <= v * 0.94)
    const W = fit ?? VIEWS[VIEWS.length - 1]
    const half = fit ? 5 : Math.max(1, Math.floor((W * 0.94) / i1 / 2))
    setViewW(W)
    setRuler({ x1: Math.round(-half * i1 * 1000) / 1000, x2: Math.round(half * i1 * 1000) / 1000 })
    setShow(s => ({ ...s, ruler: true }))
  }

  /* ── Hoạt họa hướng dẫn (khi trả lời sai): chạy lần lượt các cảnh của step.guide ──
     Mỗi cảnh: set (đổi ngay) · tween (đổi dần) · pin / pinTo (điểm M) · view · hi (chỗ cần chỉ) · arrows · caption. */
  const [guide, setGuide] = useState(null)
  const guideTok = useRef(0)
  const pinRaf = useRef(0)
  const pinRef = useRef(pinX)
  pinRef.current = pinX
  useEffect(() => () => { guideTok.current++; cancelAnimationFrame(pinRaf.current) }, [])
  const stopGuide = useCallback(() => { guideTok.current++; cancelAnimationFrame(pinRaf.current); setGuide(null) }, [])
  const tweenPin = useCallback((to, ms) => {
    cancelAnimationFrame(pinRaf.current)
    const from = pinRef.current ?? 0
    const t0 = performance.now()
    const tick = now => {
      const u = Math.min(1, (now - t0) / ms)
      const e = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2
      setPinX(Math.round((from + (to - from) * e) * 1000) / 1000)
      if (u < 1) pinRaf.current = requestAnimationFrame(tick)
    }
    pinRaf.current = requestAnimationFrame(tick)
  }, [])
  const runGuide = useCallback(async step => {
    const tok = ++guideTok.current
    const frames = step.guide || []
    const sleep = ms => new Promise(r => setTimeout(r, ms))
    setCursorX(null)
    for (let k = 0; k < frames.length; k++) {
      if (tok !== guideTok.current) return
      const f = frames[k]
      const p = { ...paramsRef.current, ...(f.set || {}) }
      if (f.view) setStageView(f.view)
      if (f.view === 'inside') setShow(sh => ({ ...sh, waves: true, avg: true, hyper: true }))
      if (f.set) { cancelAnimationFrame(tweenRef.current); setParamsRaw(q => ({ ...q, ...f.set })); paramsRef.current = p }
      if (f.pin) { cancelAnimationFrame(pinRaf.current); setPinX(Math.round(f.pin(p) * 1000) / 1000) }
      if (f.tween) animateTo(f.tween, f.ms || 3000)
      if (f.pinTo) tweenPin(f.pinTo(p), f.ms || 3000)
      setGuide({ step, idx: k, total: frames.length, caption: f.caption, hi: f.hi || [], arrows: f.arrows || null, done: false })
      const moving = f.tween || f.pinTo
      await sleep(f.wait ?? (moving ? (f.ms || 3000) + 1000 : 2600))
    }
    if (tok === guideTok.current) setGuide(g => (g ? { ...g, done: true, arrows: null } : g))
  }, [animateTo, tweenPin])
  // Người dùng tự kéo / đổi thông số → dừng hoạt họa
  const userParams = useCallback(p => { stopGuide(); setParams(p) }, [stopGuide, setParams])
  const userPin = useCallback(x => { stopGuide(); setPinX(x) }, [stopGuide])
  const gHi = guide ? guide.hi : []

  /* ── Khám phá từng bước ── */
  const tourSetup = useCallback(step => {
    stopGuide()
    const next = { ...paramsRef.current, ...step.setup }
    setParams(next)
    setStageView(step.view || 'lab')
    setPinX(step.pin ? Math.round(step.pin(next) * 1000) / 1000 : null)
    setCursorX(null)
    if (step.view === 'inside') setShow(s => ({ ...s, waves: true, avg: true, hyper: true }))
  }, [setParams, stopGuide])
  const tourAction = useCallback(step => {
    if (step.action) animateTo(step.action)
    if (step.actionPin) setPinX(Math.round(step.actionPin(paramsRef.current) * 1000) / 1000)
  }, [animateTo])
  const startTour = () => { setTourStep(0); if (!panelOpen) setPanelOpen(true) }

  /* Phím tắt: Space chạy/dừng sóng (bỏ qua khi đang gõ) */
  useEffect(() => {
    const onKey = e => {
      if (showFormula) return
      const tag = e.target?.tagName
      if (tag === 'INPUT' && e.target.type !== 'range') return
      if (tag === 'TEXTAREA' || tag === 'BUTTON' || e.target?.getAttribute?.('role') === 'slider') return
      if (e.code === 'Space' && stageView === 'inside') { e.preventDefault(); setPlaying(p => !p) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showFormula, stageView])

  /* Toàn màn hình — tiện khi trình chiếu */
  useEffect(() => {
    const onFs = () => setIsFull(document.fullscreenElement === shellRef.current)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])
  const toggleFull = () => {
    if (document.fullscreenElement) document.exitFullscreen?.()
    else shellRef.current?.requestFullscreen?.()
  }

  const wavesMoving = playing && show.waves && !show.avg
  const tools = basic ? TOOLS.filter(t => BASIC_TOOLS.includes(t.key)) : TOOLS
  const showPlayer = !basic || stageView === 'inside'

  return (
    <div className={`tool-page incline-shell young-shell${basic ? ' is-basic' : ''}`} ref={shellRef}>
      <header className="incline-bar">
        <button className="incline-back" onClick={onBack}><ArrowLeftIcon /><span>Quay lại</span></button>
        <h1 className="incline-bar-title"><SlitsIcon size={20} /><span>Giao thoa ánh sáng — thí nghiệm khe Young</span></h1>
        <div className="incline-bar-actions">
          <div className="young-level" role="radiogroup" aria-label="Mức độ">
            {[['basic', 'Cơ bản'], ['advanced', 'Nâng cao']].map(([k, l]) => (
              <button key={k} role="radio" aria-checked={level === k} className={level === k ? 'is-on' : ''} onClick={() => setLevel(k)}>{l}</button>
            ))}
          </div>
          <button className={`incline-bar-btn young-tour-btn${tourStep != null ? ' is-on' : ''}`} onClick={() => (tourStep != null ? setTourStep(null) : startTour())}>
            <CompassIcon /><span>Khám phá từng bước</span>
          </button>
          <button className="incline-bar-btn" onClick={() => setShowFormula(true)}><FormulaIcon /><span>Công thức</span></button>
          <button className="incline-bar-btn" onClick={resetAll} title="Đặt lại mặc định"><ResetAllIcon /><span>Đặt lại</span></button>
          <button className="incline-bar-btn" onClick={toggleFull} title={isFull ? 'Thoát toàn màn hình' : 'Toàn màn hình'}>
            {isFull ? <ShrinkIcon /> : <ExpandIcon />}<span>{isFull ? 'Thoát' : 'Toàn màn hình'}</span>
          </button>
          <span className="incline-bar-tag">Vật lý 11 · Sóng ánh sáng</span>
        </div>
      </header>

      <div className="incline-page">
        <aside className="incline-form">
          {tourStep != null && (
            <YoungTour step={tourStep} onStep={k => setTourStep(Math.max(0, Math.min(TOUR.length - 1, k)))}
              onSetup={tourSetup} onAction={tourAction} onGuide={runGuide} onClose={() => { stopGuide(); setTourStep(null) }} params={params} />
          )}
          {basic
            ? <BasicControls params={params} onChange={userParams} />
            : <YoungControls params={params} onChange={userParams} />}
        </aside>

        <main className="incline-stage">
          <div className="incline-canvas young-canvas">
            {stageView === 'lab'
              ? <YoungLabView params={params} viewW={viewW} pinX={guide ? pinX : markX} onPick={userPin} onChange={userParams} guide={guide} />
              : <YoungScene params={params} show={show} playing={playing} speed={speed} onChange={userParams} pinX={guide ? pinX : markX} guideHi={gHi} />}

            <div className="young-views" role="tablist" aria-label="Góc nhìn">
              <button role="tab" aria-selected={stageView === 'lab'} className={stageView === 'lab' ? 'is-on' : ''} onClick={() => setStageView('lab')}>Phòng thí nghiệm</button>
              <button role="tab" aria-selected={stageView === 'inside'} className={stageView === 'inside' ? 'is-on' : ''} onClick={() => setStageView('inside')}>Bên trong: sóng ánh sáng</button>
            </div>

            {stageView === 'inside' && (
              <div className="incline-toolbar" role="toolbar" aria-label="Tuỳ chọn hiển thị">
                {tools.map(tl => (
                  <button key={tl.key} className={show[tl.key] ? 'is-on' : ''} onClick={() => toggle(tl.key)}
                    disabled={(tl.key === 'avg' && !show.waves) || (tl.key === 'snap' && (!show.ruler || !i1))}
                    aria-pressed={!!show[tl.key]} data-tip={tl.label} aria-label={tl.label}>
                    <tl.Icon />
                  </button>
                ))}
              </div>
            )}

            {guide && (
              <div className={`young-guide-cap${guide.done ? ' is-done' : ''}`} role="status" aria-live="polite">
                <div className="young-guide-bar"><i style={{ width: `${((guide.idx + (guide.done ? 1 : 0.5)) / guide.total) * 100}%` }} /></div>
                <div className="young-guide-row">
                  <span className="young-guide-n">{guide.idx + 1}/{guide.total}</span>
                  <p>{guide.caption}</p>
                  {guide.done
                    ? <><button onClick={() => runGuide(guide.step)}>↻ Xem lại</button><button onClick={stopGuide}>Đóng</button></>
                    : <button onClick={stopGuide}>Bỏ qua</button>}
                </div>
              </div>
            )}

            {!panelOpen && (
              <button className="incline-open-panel" onClick={() => setPanelOpen(true)}>
                <DataIcon />{basic ? 'Nhận xét' : 'Số liệu giao thoa'}
              </button>
            )}
          </div>

          <YoungScreen params={params} viewW={viewW} show={show} ruler={ruler} onRuler={setRuler}
            cursorX={guide ? null : cursorX} onCursor={setCursorX} pinX={pinX} onPick={userPin} basic={basic} guideHi={gHi} />

          {showPlayer && (
            <div className="incline-player">
              {stageView === 'inside' && (
                <button className="incline-play" onClick={() => setPlaying(p => !p)} disabled={!show.waves || show.avg}
                  title="Chạy / dừng sóng (phím Space)">
                  {wavesMoving ? <PauseIcon /> : <PlayIcon />}
                  {wavesMoving ? 'Dừng sóng' : 'Chạy sóng'}
                </button>
              )}
              {!basic && stageView === 'inside' && (
                <div className="incline-seg" aria-label="Tốc độ sóng">
                  {SPEEDS.map(s => (
                    <button key={s} className={speed === s ? 'is-on' : ''} onClick={() => setSpeed(s)}>×{String(s).replace('.', ',')}</button>
                  ))}
                </div>
              )}
              {!basic && (
                <>
                  <span className="young-player-label">Khung màn</span>
                  <div className="incline-seg" aria-label="Bề rộng khung màn">
                    {VIEWS.map(v => (
                      <button key={v} className={viewW === v ? 'is-on' : ''} onClick={() => setViewW(v)}>{v} mm</button>
                    ))}
                  </div>
                  <button className="young-measure" onClick={measure10} disabled={!i1} title={i1 ? 'Đặt thước đo 10 khoảng vân' : 'Chọn ánh sáng đơn sắc để đo khoảng vân'}>
                    <RulerIcon size={16} /><span>Đo 10 khoảng vân</span>
                  </button>
                </>
              )}
            </div>
          )}
        </main>

        {panelOpen && (basic
          ? <YoungBasicPanel params={params} markX={guide ? pinX : markX} guideHi={gHi} onCollapse={() => setPanelOpen(false)} />
          : <YoungDataPanel params={params} ruler={ruler} markX={guide ? pinX : markX} guideHi={gHi} kSel={kSel} onK={setKSel} onCollapse={() => setPanelOpen(false)} />
        )}
      </div>

      {showFormula && <FormulaModal params={params} kSel={kSel} onClose={() => setShowFormula(false)} />}
    </div>
  )
}
