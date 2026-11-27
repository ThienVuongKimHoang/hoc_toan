import React, { useEffect, useState } from 'react'
import MathText from '../MathText.jsx'
import { G, canSlide } from '../../physics/inclinePhysics.js'
import { FORCE_COLORS } from './InclineScene.jsx'

/* Cột điều khiển trái + hộp "Công thức & lời giải".
   Bảng thông số chuyển động nằm ở MotionPanel.jsx. */

/* Số kiểu Việt Nam (dấu phẩy thập phân). Trong KaTeX dùng {,} để không bị thêm khoảng trắng. */
const vn = (n, d = 2) => (Math.abs(n) < 5e-10 ? 0 : n).toFixed(d).replace('.', ',')
const tx = (n, d = 2) => vn(n, d).replace(',', '{,}')

/* ───────────── Tình huống mẫu ───────────── */

const IconSmooth = () => (
  <svg viewBox="0 0 32 22" width="30" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
    <path d="M2 20h28L2 6z" /><rect x="8" y="5.2" width="7" height="5" rx="1" transform="rotate(26.5 11.5 7.7)" />
  </svg>
)
const IconRough = () => (
  <svg viewBox="0 0 32 22" width="30" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
    <path d="M2 20h28L2 6z" /><rect x="8" y="5.2" width="7" height="5" rx="1" transform="rotate(26.5 11.5 7.7)" />
    <path d="M12 14.5l-1.5 2M17 17l-1.5 2M7 12l-1.5 2" strokeWidth="1.4" />
  </svg>
)
const IconHold = () => (
  <svg viewBox="0 0 32 22" width="30" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
    <path d="M2 20h28L2 12z" /><rect x="9" y="9.5" width="7" height="5" rx="1" transform="rotate(16 12.5 12)" />
    <path d="M22 3v7M19 7l3 3 3-3" strokeLinecap="round" transform="rotate(180 22 6.5)" />
  </svg>
)
const IconPush = () => (
  <svg viewBox="0 0 32 22" width="30" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
    <path d="M2 20h28L2 6z" /><rect x="17" y="10.5" width="7" height="5" rx="1" transform="rotate(26.5 20.5 13)" />
    <path d="M15 8.5l-6-3M9 5.5l3.2-.4M9 5.5l1.6 2.8" />
  </svg>
)
const IconThrowDown = () => (
  <svg viewBox="0 0 32 22" width="30" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
    <path d="M2 20h28L2 12z" /><rect x="6" y="7.5" width="7" height="5" rx="1" transform="rotate(16 9.5 10)" />
    <path d="M16 11.5l7 2M23 13.5l-3-1.9M23 13.5l-2.6 2" />
  </svg>
)

export const PRESETS = [
  { label: 'Không ma sát', Icon: IconSmooth, p: { alphaDeg: 30, m: 2, mu: 0, x0: 0, v0: 0, L: 5 } },
  { label: 'Có ma sát', Icon: IconRough, p: { alphaDeg: 30, m: 2, mu: 0.2, x0: 0, v0: 0, L: 5 } },
  { label: 'Ma sát giữ vật', Icon: IconHold, p: { alphaDeg: 20, m: 2, mu: 0.5, x0: 0, v0: 0, L: 5 } },
  { label: 'Đẩy lên dốc', Icon: IconPush, p: { alphaDeg: 30, m: 2, mu: 0.2, x0: 5, v0: -5, L: 5 } },
  { label: 'Ném xuống, ma sát lớn', Icon: IconThrowDown, p: { alphaDeg: 20, m: 2, mu: 0.5, x0: 0, v0: 4, L: 8 } },
]

const sliderDefs = L => [
  { key: 'alphaDeg', label: 'Góc nghiêng', sym: '\\alpha', min: 0, max: 60, step: 1, unit: '°', dec: 0 },
  { key: 'm', label: 'Khối lượng', sym: 'm', min: 0.5, max: 10, step: 0.5, unit: 'kg', dec: 1 },
  { key: 'mu', label: 'Hệ số ma sát', sym: '\\mu', min: 0, max: 1, step: 0.01, unit: '', dec: 2 },
  { key: 'x0', label: 'Vị trí xuất phát', sym: 'x_0', min: 0, max: L, step: 0.05, unit: 'm', dec: 2, hint: 'tính từ đỉnh dốc' },
  { key: 'v0', label: 'Vận tốc ban đầu', sym: 'v_0', min: -12, max: 12, step: 0.5, unit: 'm/s', dec: 1, hint: 'âm: lên dốc · dương: xuống dốc' },
  { key: 'L', label: 'Chiều dài dốc', sym: 'L', min: 2, max: 10, step: 1, unit: 'm', dec: 0 },
]

const QUICK = [
  { key: 'P', label: 'Trọng lực', color: FORCE_COLORS.P },
  { key: 'N', label: 'Phản lực', color: FORCE_COLORS.N },
  { key: 'Fms', label: 'Ma sát', color: FORCE_COLORS.Fms },
  { key: 'v', label: 'Vận tốc', color: FORCE_COLORS.v },
]

/* Hiển thị giá trị: ít nhất `dec` chữ số, thêm chữ số nếu người dùng gõ số lẻ hơn (tối đa 3) */
function fieldText(value, dec) {
  let d = dec
  while (d < 3 && Math.abs(value - Number(value.toFixed(d))) > 1e-9) d++
  return value.toFixed(d).replace('.', ',')
}

/* Ô nhập số: gõ chính xác (chấp nhận dấu phẩy), Enter hoặc rời ô để áp dụng, kẹp vào [min, max] */
export function NumField({ value, min, max, dec, unit, onCommit, label }) {
  const [txt, setTxt] = useState(fieldText(value, dec))
  const [focus, setFocus] = useState(false)
  useEffect(() => { if (!focus) setTxt(fieldText(value, dec)) }, [value, dec, focus])
  const commit = () => {
    const num = Number(String(txt).trim().replace(',', '.'))
    if (Number.isFinite(num)) {
      const c = Math.min(max, Math.max(min, Math.round(num * 1000) / 1000))
      if (c !== value) onCommit(c)
      setTxt(fieldText(c, dec))
    } else {
      setTxt(fieldText(value, dec))
    }
  }
  return (
    <span className="incline-num">
      <input type="text" inputMode="decimal" value={txt} aria-label={label}
        onFocus={e => { setFocus(true); e.target.select() }}
        onBlur={() => { setFocus(false); commit() }}
        onChange={e => setTxt(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') { setTxt(fieldText(value, dec)); e.currentTarget.blur() }
        }} />
      {unit && <em>{unit}</em>}
    </span>
  )
}

/* Đổi một thông số; đổi L thì kẹp lại x0 cho nằm trên dốc */
const withParam = (params, key, v) => {
  const next = { ...params, [key]: v }
  if (key === 'L' && next.x0 > v) next.x0 = v
  return next
}

export function InclineControls({ params, onChange, show, onToggle, onPreset }) {
  const activePreset = PRESETS.findIndex(pr => Object.keys(pr.p).every(k => pr.p[k] === params[k]))
  return (
    <div className="incline-form-body">
      <section className="incline-block">
        <div className="incline-sec"><span className="incline-sec-num">1</span>Tình huống</div>
        <div className="incline-presets">
          {PRESETS.map((pr, i) => (
            <button key={pr.label} className={i === activePreset ? 'is-on' : ''} onClick={() => onPreset(pr.p)}>
              <pr.Icon />
              <span>{pr.label}</span>
            </button>
          ))}
        </div>
        <p className="incline-tip">Mẹo: kéo vật trên hình để đổi vị trí, vuốt rồi thả để ném.</p>
      </section>

      <section className="incline-block">
        <div className="incline-sec"><span className="incline-sec-num">2</span>Thông số</div>
        {sliderDefs(params.L).map(s => {
          const val = params[s.key]
          const pct = ((val - s.min) / (s.max - s.min)) * 100
          return (
            <div key={s.key} className="incline-slider">
              <div className="incline-slider-top">
                <span className="incline-slider-name">
                  <span>{s.label} <MathText text={`$${s.sym}$`} /></span>
                  {s.hint && <small>{s.hint}</small>}
                </span>
                <NumField value={val} min={s.min} max={s.max} dec={s.dec} unit={s.unit} label={s.label}
                  onCommit={v => onChange(withParam(params, s.key, v))} />
              </div>
              <input type="range" min={s.min} max={s.max} step={s.step} value={val} aria-label={s.label}
                style={{ '--pct': `${pct}%` }}
                onChange={e => onChange(withParam(params, s.key, Number(e.target.value)))} />
            </div>
          )
        })}
      </section>

      <section className="incline-block">
        <div className="incline-sec"><span className="incline-sec-num">3</span>Hiển thị nhanh</div>
        <div className="incline-toggles">
          {QUICK.map(f => (
            <label key={f.key} className={`incline-check${show[f.key] ? ' is-on' : ''}`} style={{ '--c': f.color }}>
              <input type="checkbox" checked={!!show[f.key]} onChange={() => onToggle(f.key)} />
              <i />{f.label}
            </label>
          ))}
        </div>
      </section>
    </div>
  )
}

/* ───────────── Hộp công thức + lời giải ───────────── */

function buildSteps(sim) {
  const { params, forces: f, phases } = sim
  const { alphaDeg, m, mu, L } = params
  const x0 = params.x0 ?? 0
  const v0 = params.v0 ?? 0
  const a = `${String(alphaDeg).replace('.', '{,}')}^\\circ`
  const steps = []
  const slideCondition = () => ({
    title: 'Điều kiện trượt',
    lines: canSlide(params)
      ? [`$\\tan ${a} = ${tx(f.tan, 3)} > \\mu = ${tx(mu)}$ nên vật trượt xuống.`]
      : [`$\\tan ${a} = ${tx(f.tan, 3)} \\le \\mu = ${tx(mu)}$ nên vật đứng yên; $F_{msn} = P\\sin\\alpha = ${tx(f.Ppar)}\\,\\text{N}$.`],
  })
  steps.push({
    title: 'Phân tích lực',
    lines: [
      `$P = mg = ${tx(m, 1)} \\cdot ${tx(G, 1)} = ${tx(f.P)}\\,\\text{N}$`,
      `$P_x = P\\sin\\alpha = ${tx(f.Ppar)}\\,\\text{N}$ ; $N = P_y = P\\cos\\alpha = ${tx(f.N)}\\,\\text{N}$`,
      mu > 0 ? `$F_{ms} = \\mu N = ${tx(mu)} \\cdot ${tx(f.N)} = ${tx(f.FmsMax)}\\,\\text{N}$` : 'Không có ma sát: $F_{ms} = 0$',
    ],
  })
  steps.push({
    title: 'Điều kiện đầu',
    lines: [`$x_0 = ${tx(x0)}\\,\\text{m}$ (tính từ đỉnh dốc), $v_0 = ${tx(v0, 1)}\\,\\text{m/s}$ (chiều dương xuống dốc).`],
  })

  for (const ph of phases) {
    if (ph.kind === 'up') {
      const lines = [`$a_1 = -g(\\sin\\alpha + \\mu\\cos\\alpha) = -${tx(ph.a)}\\,\\text{m/s}^2$ (chiều dương lên dốc)`]
      if (sim.end === 'top' && ph === phases[phases.length - 1]) {
        const vt = Math.sqrt(Math.max(0, ph.v0 * ph.v0 - 2 * ph.a * ph.x0))
        lines.push(`Quãng đường tới đỉnh $${tx(ph.x0)}\\,\\text{m} \\le \\dfrac{v_0^2}{2|a_1|}$ nên vật lên tới đỉnh với $v = ${tx(vt)}\\,\\text{m/s}$.`)
      } else {
        const d = (ph.v0 * ph.v0) / (2 * ph.a)
        lines.push(`$t_1 = \\dfrac{|v_0|}{|a_1|} = ${tx(ph.t1 - ph.t0)}\\,\\text{s}$ ; $d = \\dfrac{v_0^2}{2|a_1|} = ${tx(d)}\\,\\text{m}$, dừng tại $x = ${tx(ph.x0 - d)}\\,\\text{m}$`)
      }
      steps.push({ title: 'Giai đoạn đi lên', lines })
      // Dừng giữa dốc → xét vật trượt lại hay đứng yên
      if (phases[phases.indexOf(ph) + 1]) steps.push(slideCondition())
    } else if (ph.kind === 'down') {
      const dur = ph.t1 - ph.t0
      const lines = [`$a = g(\\sin\\alpha - \\mu\\cos\\alpha) = ${tx(ph.a)}\\,\\text{m/s}^2$`]
      if (ph.a < 0) lines.push(`$a < 0$ vì $\\mu > \\tan\\alpha$: ma sát lớn hơn $P_x$, vật chậm dần.`)
      const next = phases[phases.indexOf(ph) + 1]
      if (next && next.kind === 'rest') {
        lines.push(`Dừng sau $t = \\dfrac{v_0}{|a|} = ${tx(dur)}\\,\\text{s}$, đi được $\\dfrac{v_0^2}{2|a|} = ${tx(next.x0 - ph.x0)}\\,\\text{m}$, rồi đứng yên.`)
      } else {
        const s = L - ph.x0
        if (Math.abs(ph.v0) < 1e-9) {
          lines.push(`$s = L - x = ${tx(s)}\\,\\text{m} \\Rightarrow t = \\sqrt{\\dfrac{2s}{a}} = ${tx(dur)}\\,\\text{s}$`)
        } else {
          lines.push(`$s = v_0t + \\tfrac{1}{2}at^2$ với $s = ${tx(s)}\\,\\text{m} \\Rightarrow t = ${tx(dur)}\\,\\text{s}$`)
        }
        lines.push(`Vận tốc tại chân dốc: $v = v_0 + at = ${tx(ph.v0 + ph.a * dur)}\\,\\text{m/s}$`)
      }
      steps.push({ title: phases.length > 1 && phases[0] !== ph ? 'Giai đoạn đi xuống' : 'Định luật II Newton (chiều dương xuống dốc)', lines })
    }
  }
  if (phases[0].kind === 'rest' && phases[0].x0 < L - 1e-9) steps.push(slideCondition())
  else if (phases[0].kind === 'rest') steps.push({ title: 'Vị trí', lines: ['Vật đang ở chân dốc, không có chuyển động.'] })
  if (phases.length > 1 && sim.tEnd > 0 && Number.isFinite(sim.tEnd)) {
    steps.push({ title: 'Tổng thời gian', lines: [`$t = ${tx(sim.tEnd)}\\,\\text{s}$`] })
  }
  return steps
}

const THEORY = [
  ['Trọng lực và các thành phần', '$P = mg$ ; $P_x = P\\sin\\alpha$ ; $P_y = P\\cos\\alpha$'],
  ['Phản lực và ma sát', '$N = P\\cos\\alpha$ ; $F_{ms} = \\mu N = \\mu mg\\cos\\alpha$'],
  ['Điều kiện vật tự trượt', '$P_x > F_{ms,\\max} \\iff \\tan\\alpha > \\mu$'],
  ['Đi xuống (chiều dương xuống dốc)', '$a = g(\\sin\\alpha - \\mu\\cos\\alpha)$'],
  ['Đi lên dốc (chiều dương lên dốc)', '$a = -g(\\sin\\alpha + \\mu\\cos\\alpha)$'],
  ['Chuyển động biến đổi đều', '$v = v_0 + at$ ; $s = v_0t + \\tfrac{1}{2}at^2$ ; $v^2 - v_0^2 = 2as$'],
  ['Năng lượng', '$W_đ + W_t + Q = \\text{const}$, với $Q = F_{ms}\\cdot s$'],
]

export function FormulaModal({ sim, onClose }) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const steps = buildSteps(sim)
  return (
    <div className="incline-modal-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="incline-modal" role="dialog" aria-modal="true" aria-label="Công thức">
        <div className="incline-modal-head">
          <span>Công thức &amp; lời giải</span>
          <button onClick={onClose} aria-label="Đóng">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="incline-modal-body">
          <div>
            <div className="incline-modal-sub">Tóm tắt lý thuyết</div>
            <dl className="incline-theory">
              {THEORY.map(([k, v]) => (
                <React.Fragment key={k}><dt>{k}</dt><dd><MathText text={v} /></dd></React.Fragment>
              ))}
            </dl>
          </div>
          <div>
            <div className="incline-modal-sub">Áp dụng với số liệu hiện tại</div>
            <ol className="incline-steps">
              {steps.map((s, i) => (
                <li key={i}>
                  <div className="incline-step-title">{s.title}</div>
                  {s.lines.map((ln, j) => <div key={j} className="incline-step-line"><MathText text={ln} /></div>)}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}
