import React, { useEffect, useRef, useState } from 'react'
import MathText from '../MathText.jsx'
import { canSlide } from '../../physics/inclinePhysics.js'

/* ─────────────────────────────────────────────────────────────
   Bảng "Thông số chuyển động" — cột tối bên phải.
   4 khu vực: header + trạng thái · chuyển động · lực · kết luận.
   (Đồ thị nằm ở dải ngang dưới hình — InclineCharts.jsx.)
   Mọi số cập nhật ngay khi kéo vật; đại lượng vừa đổi dấu / chạm 0 sẽ nháy nhẹ.
───────────────────────────────────────────────────────────── */

const vn = (n, d = 2) => (Math.abs(n) < 5e-10 ? 0 : n).toFixed(d).replace('.', ',')
const tx = (n, d = 2) => vn(n, d).replace(',', '{,}')

/* Màu lực trong bảng (nền tối) — cùng ý nghĩa với vectơ trên hình */
export const PANEL_COLORS = { P: '#f47a8e', N: '#6aa8f5', Px: '#b48cf2', Fms: '#f39a52', hand: '#2dd4bf' }

const Ico = ({ children, size = 16, sw = 2.2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw}
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
)
const IcoDown = p => <Ico {...p}><path d="M7 7l10 10M17 9v8H9" /></Ico>
const IcoUp = p => <Ico {...p}><path d="M17 17L7 7M7 15V7h8" /></Ico>
const IcoPause = p => <Ico {...p}><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></Ico>
const IcoCheck = p => <Ico {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></Ico>
const IcoDot = p => <Ico {...p}><circle cx="12" cy="12" r="6" /></Ico>
const IcoHand = p => <Ico {...p}><path d="M8 13V5.5a1.5 1.5 0 013 0V12M11 11V4.5a1.5 1.5 0 013 0V12M14 11.5V6a1.5 1.5 0 013 0v7.5c0 4-2.5 6.5-6 6.5-2.6 0-4.2-1.4-5.5-3.6L4 13.4a1.5 1.5 0 012.6-1.5L8 14" /></Ico>
const IcoLock = p => <Ico {...p}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></Ico>
const IcoFlag = p => <Ico {...p}><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></Ico>
const IcoCollapse = p => <Ico {...p}><path d="M13 6l6 6-6 6M5 6l6 6-6 6" /></Ico>

/* ── Trạng thái (badge) ── */
export function statusOf(sim, st, t, { dragging = false, holding = false, tired = false, sqMode = 'none' } = {}) {
  if (dragging) return { tone: 'drag', Icon: IcoHand, text: 'Đang kéo vật' }
  if (sqMode === 'pushReady') return { tone: 'hand', Icon: IcoHand, text: 'Sóc chuẩn bị đẩy lên' }
  if (sqMode === 'shove') return { tone: 'drag', Icon: IcoHand, text: 'Sóc đang đẩy…' }
  if (tired) return { tone: 'drag', Icon: IcoHand, text: 'Sóc hết hơi…' }
  if (holding) return { tone: 'hand', Icon: IcoHand, text: 'Sóc đang giữ vật' }
  const done = t >= sim.tEnd - 1e-9
  const thrown = Math.abs(sim.params.v0 ?? 0) > 1e-9
  if (sim.end === 'top' && done && sim.tEnd > 0) return { tone: 'done', Icon: IcoFlag, text: 'Tới đỉnh dốc' }
  if (t <= 1e-9 && sim.tEnd > 0) {
    return thrown
      ? { tone: 'idle', Icon: IcoDot, text: `Sẵn sàng ném · v₀ = ${vn(sim.params.v0, 1)} m/s` }
      : { tone: 'idle', Icon: IcoDot, text: 'Sẵn sàng — bấm Chạy' }
  }
  if (st.phase === 'up') return { tone: 'up', Icon: IcoUp, text: thrown ? 'Đã ném · đang đi lên' : 'Đang đi lên' }
  if (st.phase === 'down') {
    if (done) return { tone: 'done', Icon: IcoCheck, text: 'Tới chân dốc' }
    if (st.a < 0) return { tone: 'rest', Icon: IcoDown, text: 'Đi xuống, chậm dần' }
    return { tone: 'down', Icon: IcoDown, text: thrown && st.t < 0.4 ? 'Đã ném · trượt xuống' : 'Trượt xuống' }
  }
  if (st.x >= sim.params.L - 1e-9) return { tone: 'done', Icon: IcoCheck, text: 'Ở chân dốc' }
  return { tone: 'rest', Icon: IcoPause, text: 'Đứng yên' }
}

/* ── Kết luận vật lý ── */
function verdictOf(sim, st, t, dragging, holding, tired, sqMode) {
  const f = sim.forces
  const done = t >= sim.tEnd - 1e-9
  if (sqMode === 'pushReady' || sqMode === 'shove') {
    const a1 = 9.8 * (f.sin + sim.params.mu * f.cos)
    return { tone: 'hand', Icon: IcoUp, title: sqMode === 'shove' ? 'Sóc đang đẩy vật lên dốc' : 'Sóc sắp đẩy vật lên dốc',
      math: `|v_0| = ${tx(Math.abs(sim.params.v0), 1)}\\,\\text{m/s},\\; |a_1| = g(\\sin\\alpha + \\mu\\cos\\alpha) = ${tx(a1)}\\,\\text{m/s}^2`,
      note: 'Rời tay sóc, vật chỉ còn chịu Pₓ và ma sát — cả hai cùng hướng xuống dốc nên vật chậm dần.' }
  }
  if (holding) {
    const need = Math.max(0, f.Ppar - f.FmsMax)
    return tired
      ? { tone: 'hold', Icon: IcoHand, title: 'Sóc hết hơi — sắp buông tay', math: `F_{\\text{giữ}} \\to 0,\\; P_x > \\mu N`,
          note: 'Khi lực giữ biến mất, ma sát một mình không cân bằng được Pₓ nên vật sẽ trượt xuống.' }
      : { tone: 'hand', Icon: IcoHand, title: 'Sóc đang giữ vật đứng yên', math: `F_{\\text{giữ}} = P_x - \\mu N = ${tx(need)}\\,\\text{N}`,
          note: 'Lực giữ tối thiểu: ma sát nghỉ đã gánh giúp sóc μN, sóc chỉ cần bù phần còn thiếu.' }
  }
  if (dragging) {
    return { tone: 'neutral', Icon: IcoHand, title: 'Đang đặt vị trí xuất phát', math: `h = (L - x_0)\\sin\\alpha = ${tx(st.h)}\\,\\text{m}`,
      note: 'Thả nhẹ để vật bắt đầu từ đây với v₀ = 0, hoặc vuốt nhanh rồi thả để ném vật.' }
  }
  if (sim.end === 'top' && done && sim.tEnd > 0) {
    return { tone: 'neutral', Icon: IcoFlag, title: 'Vật vượt qua đỉnh dốc', math: 'v_0^2 \\ge 2|a|\\,x_0',
      note: 'Vận tốc ném đủ lớn để vật đi hết phần dốc phía trên.' }
  }
  if (st.phase === 'up') {
    return { tone: 'neutral', Icon: IcoUp, title: 'Vật đi lên, chậm dần đều', math: 'a = -g(\\sin\\alpha + \\mu\\cos\\alpha)',
      note: 'Pₓ và lực ma sát cùng hướng xuống dốc, ngược chiều chuyển động.' }
  }
  if (st.phase === 'down' && st.a < 0) {
    return { tone: 'hold', Icon: IcoLock, title: 'Ma sát thắng Pₓ, vật chậm dần', math: '\\mu > \\tan\\alpha \\Rightarrow a < 0',
      note: 'μ > tanα nên ma sát lớn hơn Pₓ; vật sẽ dừng lại nếu dốc đủ dài.' }
  }
  if (st.x >= sim.params.L - 1e-9 && st.phase === 'rest') {
    return { tone: 'neutral', Icon: IcoCheck, title: 'Vật ở chân dốc', math: 'h = 0',
      note: 'Kéo vật lên dốc hoặc ném lên (v₀ < 0) để bắt đầu chuyển động.' }
  }
  if (!canSlide(sim.params)) {
    return { tone: 'hold', Icon: IcoLock, title: 'Ma sát giữ vật đứng yên', math: 'P_x \\le \\mu N',
      note: `Ma sát nghỉ cân bằng Pₓ: Fms = Pₓ = ${vn(f.Ppar)} N, gia tốc bằng 0.` }
  }
  const note = st.phase === 'down' && !done
    ? 'Vật đang trượt xuống mặt phẳng nghiêng, nhanh dần đều.'
    : done ? 'Vật đã trượt tới chân dốc.' : 'Khi thả, vật sẽ tự trượt xuống mặt phẳng nghiêng.'
  return { tone: 'ok', Icon: IcoDown, title: 'Điều kiện trượt thỏa mãn', math: 'P_x > \\mu N', note }
}

/* Nháy nhẹ khi một đại lượng vừa đổi dấu hoặc vừa chạm 0 */
function useFlash(value) {
  const prev = useRef(value)
  const [flash, setFlash] = useState(0)
  useEffect(() => {
    const a = prev.current
    const b = value
    const sa = Math.abs(a) < 1e-6 ? 0 : Math.sign(a)
    const sb = Math.abs(b) < 1e-6 ? 0 : Math.sign(b)
    if (sa !== 0 && sb !== sa) setFlash(k => k + 1)
    prev.current = value
  }, [value])
  return flash
}

function Metric({ sym, label, value, unit, accent }) {
  return (
    <div className={`mp-metric${accent ? ` is-${accent}` : ''}`}>
      <span className="mp-metric-label"><i>{sym}</i>{label}</span>
      <span className="mp-metric-value">{value}<em>{unit}</em></span>
    </div>
  )
}

export default function MotionPanel({ sim, state, t, playing = false, dragging = false, holding = false, tired = false, sqMode = 'none', onCollapse }) {
  const f = sim.forces
  const status = statusOf(sim, state, t, { dragging, holding, tired, sqMode })
  const verdict = verdictOf(sim, state, t, dragging, holding, tired, sqMode)
  const acc = state.phase === 'rest' || dragging ? 0 : state.phase === 'up' ? -state.a : state.a
  const vFlash = useFlash(state.v)
  const aFlash = useFlash(acc)
  const Fms = Math.abs(state.Fms)
  const fmsTag = state.frictionKind === 'static' ? 'nghỉ' : state.frictionKind === 'kinetic' ? 'trượt' : ''
  const scale = Math.max(f.P, 1e-9)
  const pct = v => `${Math.min(100, (v / scale) * 100)}%`
  const dir = Math.abs(state.v) < 1e-6 ? '' : state.v > 0 ? 'xuống dốc' : 'lên dốc'

  const forces = [
    { key: 'P', sym: 'P', name: 'Trọng lực', val: f.P },
    { key: 'N', sym: 'N', name: 'Phản lực', val: f.N },
    { key: 'Px', sym: 'P_x', name: 'Kéo xuống dốc', val: f.Ppar, mark: f.FmsMax },
    { key: 'Fms', sym: 'F_{ms}', name: 'Ma sát', val: Fms, tag: fmsTag },
    ...(holding ? [{ key: 'hand', sym: 'F_{\\text{giữ}}', name: 'Sóc giữ', val: Math.max(0, f.Ppar - f.FmsMax) }] : []),
  ]

  return (
    <aside className="mp" aria-label="Thông số chuyển động">
      {/* 1 · Header */}
      <header className="mp-head">
        <div className="mp-head-row">
          <h2 className="mp-title">Thông số chuyển động</h2>
          {onCollapse && (
            <button className="mp-icon-btn" onClick={onCollapse} title="Thu gọn bảng" aria-label="Thu gọn bảng"><IcoCollapse size={16} /></button>
          )}
        </div>
        <span className={`mp-status mp-status--${status.tone}${playing ? ' is-live' : ''}`} role="status">
          <status.Icon size={13} sw={2.4} />{status.text}
        </span>
      </header>

      <div className="mp-body">
        {/* 2 · Chuyển động */}
        <section className="mp-sec" aria-label="Chuyển động">
          <div className="mp-hero">
            <div className="mp-hero-cell" key={`v${vFlash}`} data-flash={vFlash > 0 || undefined}>
              <span className="mp-hero-label">Vận tốc{dir && <small>{dir}</small>}</span>
              <span className="mp-hero-value">{vn(Math.abs(state.v))}<em>m/s</em></span>
            </div>
            <div className={`mp-hero-cell${Math.abs(acc) < 1e-9 && !dragging ? ' is-zero' : ''}`} key={`a${aFlash}`} data-flash={aFlash > 0 || undefined}>
              <span className="mp-hero-label">Gia tốc{acc < -1e-9 && <small>chậm dần</small>}</span>
              <span className="mp-hero-value">{vn(Math.abs(acc))}<em>m/s²</em></span>
            </div>
          </div>
          <div className="mp-metrics">
            <Metric sym="t" label="Thời gian" value={vn(state.t)} unit="s" />
            <Metric sym="s" label="Quãng đường" value={vn(state.travelled)} unit="m" />
            <Metric sym="x" label="Vị trí" value={vn(state.x)} unit="m" accent={dragging ? 'drag' : undefined} />
            <Metric sym="h" label="Độ cao" value={vn(state.h)} unit="m" accent={dragging ? 'drag' : undefined} />
          </div>
        </section>

        {/* 3 · Lực */}
        <section className="mp-sec" aria-label="Phân tích lực">
          <h3 className="mp-sec-title">Phân tích lực</h3>
          <div className="mp-forces" role="table">
            {forces.map(fr => (
              <div key={fr.key} className="mp-force" role="row" style={{ '--c': PANEL_COLORS[fr.key] }}>
                <span className="mp-force-sym" role="cell"><MathText text={`$${fr.sym}$`} /></span>
                <span className="mp-force-name" role="cell">
                  {fr.name}
                  {fr.tag && <span className="mp-tag">{fr.tag}</span>}
                </span>
                <span className="mp-force-bar" role="cell" aria-hidden="true">
                  <i style={{ width: pct(fr.val) }} />
                  {fr.mark > 0 && <b style={{ left: pct(fr.mark) }} />}
                </span>
                <span className="mp-force-val" role="cell">{vn(fr.val)}<em>N</em></span>
              </div>
            ))}
          </div>
          <div className="mp-force-note">
            <MathText text="$P_x = P\sin\alpha$" />
            <span className="mp-mu"><i />ngưỡng <MathText text={`$\\mu N = ${tx(f.FmsMax)}\\,\\text{N}$`} /></span>
          </div>
        </section>

        {/* 4 · Kết luận */}
        <section className={`mp-verdict mp-verdict--${verdict.tone}`} aria-live="polite">
          <span className="mp-verdict-ico"><verdict.Icon size={18} /></span>
          <div className="mp-verdict-text">
            <div className="mp-verdict-title">{verdict.title}</div>
            <div className="mp-verdict-math"><MathText text={`$${verdict.math}$`} /></div>
            <div className="mp-verdict-note">{verdict.note}</div>
          </div>
        </section>
      </div>
    </aside>
  )
}
