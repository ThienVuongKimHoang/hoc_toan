import React, { useEffect } from 'react'
import MathText from '../MathText.jsx'
import { NumField } from '../incline/InclinePanels.jsx'
import {
  LIMITS, VIOLET_NM, RED_NM, fringeSpacing, countInField, coincidence, spectrumWidth, tx,
  colorName, wavelengthToRGB, rgbCss, vn,
} from '../../physics/youngPhysics.js'

/* Cột điều khiển trái + hộp "Công thức & lời giải" của thí nghiệm Young.
   Dùng lại khung giao diện (class incline-*) của trang Mặt phẳng nghiêng; màu do young.css đổi. */

/* ───────────── Biểu tượng tình huống ───────────── */
const Ico = ({ children }) => (
  <svg width="30" height="20" viewBox="0 0 32 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
)
const Fringes = ({ colors }) => (
  <svg width="30" height="20" viewBox="0 0 32 20" aria-hidden="true">
    <rect width="32" height="20" rx="3" fill="#0b1020" />
    {[3, 9, 15, 21, 27].map((x, j) => <rect key={x} x={x} y="3" width="2.6" height="14" rx="1" fill={colors[j % colors.length]} />)}
  </svg>
)
const IcoWater = () => <Ico><path d="M16 3c4 5 6 8 6 10.5a6 6 0 01-12 0C10 11 12 8 16 3z" /></Ico>

export const PRESETS = [
  { label: 'Laser đỏ 650 nm', Icon: () => <Fringes colors={['#ff2a00']} />, p: { mode: 'mono', lambdaNm: 650, aMm: 1, Dm: 2, n: 1 } },
  { label: 'Ánh sáng tím 400 nm', Icon: () => <Fringes colors={['#8300b5']} />, p: { mode: 'mono', lambdaNm: 400, aMm: 1, Dm: 2, n: 1 } },
  { label: 'Ánh sáng trắng', Icon: () => <Fringes colors={['#7a4dff', '#ffffff', '#ff5a1f']} />, p: { mode: 'white', aMm: 0.5, Dm: 2, n: 1 } },
  { label: 'Hai bức xạ 0,6 & 0,45 µm', Icon: () => <Fringes colors={['#ffbe00', '#0046ff']} />, p: { mode: 'two', lambdaNm: 600, lambda2Nm: 450, aMm: 1, Dm: 2, n: 1 } },
  { label: 'Thí nghiệm trong nước (n = 4/3)', Icon: IcoWater, p: { mode: 'mono', lambdaNm: 600, aMm: 1, Dm: 2, n: 4 / 3 } },
]

const MODES = [
  { key: 'mono', label: 'Đơn sắc' },
  { key: 'white', label: 'Ánh sáng trắng' },
  { key: 'two', label: 'Hai bức xạ' },
]

const MEDIA = [
  { label: 'Không khí', n: 1 },
  { label: 'Nước', n: 4 / 3 },
  { label: 'Thuỷ tinh', n: 1.5 },
]

function sliderDefs(mode) {
  const lam = { min: LIMITS.lambdaNm[0], max: LIMITS.lambdaNm[1], step: 1, unit: 'nm', dec: 0, spectrum: true }
  return [
    ...(mode === 'white' ? [] : [{ key: 'lambdaNm', label: mode === 'two' ? 'Bước sóng 1' : 'Bước sóng', sym: mode === 'two' ? '\\lambda_1' : '\\lambda', ...lam }]),
    ...(mode === 'two' ? [{ key: 'lambda2Nm', label: 'Bước sóng 2', sym: '\\lambda_2', ...lam }] : []),
    { key: 'aMm', label: 'Khoảng cách hai khe', sym: 'a', min: LIMITS.aMm[0], max: LIMITS.aMm[1], step: 0.05, unit: 'mm', dec: 2 },
    { key: 'Dm', label: 'Khe → màn', sym: 'D', min: LIMITS.Dm[0], max: LIMITS.Dm[1], step: 0.05, unit: 'm', dec: 2 },
    { key: 'n', label: 'Chiết suất môi trường', sym: 'n', min: LIMITS.n[0], max: LIMITS.n[1], step: 0.01, unit: '', dec: 2, hint: 'giữa hai khe và màn' },
    { key: 'Lmm', label: 'Bề rộng vùng giao thoa', sym: 'L', min: LIMITS.Lmm[0], max: LIMITS.Lmm[1], step: 0.5, unit: 'mm', dec: 1, hint: 'để đếm số vân' },
  ]
}

const near = (a, b) => Math.abs(a - b) < 1e-6

/* Che / mở khe S₂ — cho thấy cần HAI nguồn mới có giao thoa */
function OneSlitToggle({ params, onChange }) {
  return (
    <label className={`young-switch${params.oneSlit ? ' is-on' : ''}`}>
      <input type="checkbox" checked={!!params.oneSlit} onChange={e => onChange({ ...params, oneSlit: e.target.checked })} />
      <i aria-hidden="true" />
      <span>Che khe S₂ <small>chỉ để ánh sáng qua một khe</small></span>
    </label>
  )
}

/* ───────────── Điều khiển chế độ Cơ bản: tên đời thường, ít thông số ───────────── */
function FriendlySlider({ label, hint, value, min, max, step, display, onChange, spectrum = false, ends }) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className={`incline-slider young-friendly${spectrum ? ' young-spectrum' : ''}`}>
      <div className="incline-slider-top">
        <span className="incline-slider-name"><span>{label}</span>{hint && <small>{hint}</small>}</span>
        <b className="young-friendly-val">{display}</b>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} aria-label={label}
        style={{ '--pct': `${pct}%` }} onChange={e => onChange(Number(e.target.value))} />
      {ends && <div className="young-friendly-ends"><span>{ends[0]}</span><span>{ends[1]}</span></div>}
    </div>
  )
}

export function BasicControls({ params, onChange }) {
  const set = (k, v) => onChange({ ...params, [k]: v })
  const white = params.mode === 'white'
  const col = rgbCss(wavelengthToRGB(params.lambdaNm))
  return (
    <div className="incline-form-body">
      <section className="incline-block">
        <div className="incline-sec"><span className="incline-sec-num">1</span>Nguồn sáng</div>
        <div className="young-source">
          <button className={!white ? 'is-on' : ''} onClick={() => onChange({ ...params, mode: 'mono' })}>
            <svg width="34" height="20" viewBox="0 0 34 20" aria-hidden="true"><rect x="1" y="6" width="22" height="8" rx="4" fill="#334155" /><path d="M23 10h10" stroke={col} strokeWidth="2.5" /></svg>
            <span>Laser<small>một màu</small></span>
          </button>
          <button className={white ? 'is-on' : ''} onClick={() => onChange({ ...params, mode: 'white', aMm: Math.min(params.aMm, 0.6) })}>
            <svg width="34" height="20" viewBox="0 0 34 20" aria-hidden="true"><circle cx="12" cy="10" r="7" fill="#fde68a" /><path d="M22 6l10-3M22 10h10M22 14l10 3" stroke="#e2e8f0" strokeWidth="1.8" /></svg>
            <span>Ánh sáng trắng<small>đèn, Mặt Trời</small></span>
          </button>
        </div>
      </section>

      <section className="incline-block">
        <div className="incline-sec"><span className="incline-sec-num">2</span>Thay đổi và quan sát</div>
        {!white && (
          <FriendlySlider label="Màu ánh sáng" hint={`bước sóng λ = ${vn(params.lambdaNm / 1000, 2)} µm`} spectrum
            value={params.lambdaNm} min={LIMITS.lambdaNm[0]} max={LIMITS.lambdaNm[1]} step={1}
            display={<><i className="young-swatch" style={{ background: col }} />{colorName(params.lambdaNm)}</>}
            ends={['tím · sóng ngắn', 'đỏ · sóng dài']}
            onChange={v => set('lambdaNm', v)} />
        )}
        <FriendlySlider label="Hai khe cách nhau" hint="khoảng cách a" value={params.aMm}
          min={LIMITS.aMm[0]} max={LIMITS.aMm[1]} step={0.05} display={`${vn(params.aMm, 2)} mm`}
          ends={['gần nhau', 'xa nhau']} onChange={v => set('aMm', v)} />
        <FriendlySlider label="Màn đặt cách hai khe" hint="khoảng cách D" value={params.Dm}
          min={LIMITS.Dm[0]} max={LIMITS.Dm[1]} step={0.05} display={`${vn(params.Dm, 2)} m`}
          ends={['gần', 'xa']} onChange={v => set('Dm', v)} />
        <OneSlitToggle params={params} onChange={onChange} />
        <p className="incline-tip">Kéo thử từng thanh và nhìn các vạch trên màn: thưa ra hay sít lại?</p>
      </section>
    </div>
  )
}

export function YoungControls({ params, onChange }) {
  const activePreset = PRESETS.findIndex(pr => Object.keys(pr.p).every(k => near(pr.p[k], params[k]) || pr.p[k] === params[k]))
  const set = (key, v) => onChange({ ...params, [key]: v })
  return (
    <div className="incline-form-body">
      <section className="incline-block">
        <div className="incline-sec"><span className="incline-sec-num">1</span>Nguồn sáng</div>
        <div className="incline-seg young-modes" role="radiogroup" aria-label="Loại ánh sáng">
          {MODES.map(m => (
            <button key={m.key} role="radio" aria-checked={params.mode === m.key}
              className={params.mode === m.key ? 'is-on' : ''} onClick={() => set('mode', m.key)}>{m.label}</button>
          ))}
        </div>
        <div className="incline-presets">
          {PRESETS.map((pr, i) => (
            <button key={pr.label} className={i === activePreset ? 'is-on' : ''} onClick={() => onChange({ ...params, ...pr.p })}>
              <pr.Icon />
              <span>{pr.label}</span>
            </button>
          ))}
        </div>
        <OneSlitToggle params={params} onChange={onChange} />
        <p className="incline-tip">Mẹo: kéo hai khe hoặc màn E trên hình để đổi a, D; kéo hai đầu thước trên màn để đo.</p>
      </section>

      <section className="incline-block">
        <div className="incline-sec"><span className="incline-sec-num">2</span>Thông số</div>
        {params.mode === 'white' && (
          <p className="young-white-note">
            Ánh sáng trắng gồm mọi bức xạ từ <MathText text="$\lambda_t = 0{,}38\,\mu\text{m}$" /> (tím) đến <MathText text="$\lambda_đ = 0{,}76\,\mu\text{m}$" /> (đỏ).
          </p>
        )}
        {sliderDefs(params.mode).map(s => {
          const val = params[s.key]
          const pct = ((val - s.min) / (s.max - s.min)) * 100
          return (
            <div key={s.key} className={`incline-slider${s.spectrum ? ' young-spectrum' : ''}`}>
              <div className="incline-slider-top">
                <span className="incline-slider-name">
                  <span>{s.label} <MathText text={`$${s.sym}$`} /></span>
                  {s.spectrum ? <small>= {tx(val / 1000, 3).replace('{,}', ',')} µm</small> : s.hint && <small>{s.hint}</small>}
                </span>
                <NumField value={val} min={s.min} max={s.max} dec={s.dec} unit={s.unit} label={s.label}
                  onCommit={v => set(s.key, v)} />
              </div>
              <input type="range" min={s.min} max={s.max} step={s.step} value={val} aria-label={s.label}
                style={{ '--pct': `${pct}%` }}
                onChange={e => set(s.key, Number(e.target.value))} />
              {s.key === 'n' && (
                <div className="young-media">
                  {MEDIA.map(m => (
                    <button key={m.label} className={near(params.n, m.n) ? 'is-on' : ''} onClick={() => set('n', m.n)}>
                      {m.label}<small>{m.n === 4 / 3 ? '4/3' : String(m.n).replace('.', ',')}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </section>
    </div>
  )
}

/* ───────────── Hộp công thức + lời giải ───────────── */

const um = nm => tx(nm / 1000, 3)

function buildSteps(params, kSel) {
  const { aMm, Dm, n, Lmm, mode } = params
  const nStr = Math.abs(n - 1) < 1e-9 ? null : tx(n, 3)
  const steps = []
  const spacing = (lam, sub = '') => {
    const i = fringeSpacing(lam, params)
    const lines = [
      nStr
        ? `$i${sub} = \\dfrac{\\lambda${sub} D}{n a} = \\dfrac{${um(lam)}\\cdot 10^{-6}\\cdot ${tx(Dm)}}{${nStr}\\cdot ${tx(aMm)}\\cdot 10^{-3}} = ${tx(i, 3)}\\,\\text{mm}$`
        : `$i${sub} = \\dfrac{\\lambda${sub} D}{a} = \\dfrac{${um(lam)}\\cdot 10^{-6}\\cdot ${tx(Dm)}}{${tx(aMm)}\\cdot 10^{-3}} = ${tx(i, 3)}\\,\\text{mm}$`,
    ]
    return { i, lines }
  }

  if (mode === 'white') {
    const iv = fringeSpacing(VIOLET_NM, params)
    const ir = fringeSpacing(RED_NM, params)
    steps.push({ title: 'Khoảng vân của hai bức xạ biên', lines: [
      `$i_t = \\dfrac{\\lambda_t D}{${nStr ? 'n ' : ''}a} = ${tx(iv, 3)}\\,\\text{mm}$ ; $i_đ = \\dfrac{\\lambda_đ D}{${nStr ? 'n ' : ''}a} = ${tx(ir, 3)}\\,\\text{mm}$`,
    ] })
    steps.push({ title: `Bề rộng quang phổ bậc ${kSel}`, lines: [
      `$\\Delta x_{${kSel}} = ${kSel}\\,(i_đ - i_t) = ${kSel}\\cdot(${tx(ir, 3)} - ${tx(iv, 3)}) = ${tx(spectrumWidth(kSel, params), 3)}\\,\\text{mm}$`,
    ] })
    steps.push({ title: 'Quang phổ bậc k và k + 1 bắt đầu chồng lên nhau khi', lines: [
      '$k\\lambda_đ \\ge (k+1)\\lambda_t \\iff k \\ge \\dfrac{\\lambda_t}{\\lambda_đ - \\lambda_t} = 1$ ⇒ từ quang phổ bậc 2 trở đi đã chồng lấn',
    ] })
    return steps
  }

  const s1 = spacing(params.lambdaNm, mode === 'two' ? '_1' : '')
  steps.push({ title: mode === 'two' ? 'Khoảng vân của bức xạ λ₁' : 'Khoảng vân', lines: s1.lines })
  if (mode === 'two') {
    const s2 = spacing(params.lambda2Nm, '_2')
    steps.push({ title: 'Khoảng vân của bức xạ λ₂', lines: s2.lines })
    const c = coincidence(params)
    if (!c.same) {
      steps.push({ title: 'Vị trí vân trùng (hai vân sáng trùng nhau)', lines: [
        `$k_1\\lambda_1 = k_2\\lambda_2 \\Rightarrow \\dfrac{k_1}{k_2} = \\dfrac{\\lambda_2}{\\lambda_1} = \\dfrac{${Math.round(params.lambda2Nm)}}{${Math.round(params.lambdaNm)}} = \\dfrac{${c.k1}}{${c.k2}}$`,
        `$x_{\\text{trùng}} = ${c.k1}\\, i_1 = ${tx(c.x, 3)}\\,\\text{mm}$ (vân trùng gần vân trung tâm nhất)`,
        `Giữa hai vân trùng liên tiếp có $${c.k1} - 1 = ${c.between1}$ vân sáng của $\\lambda_1$ và $${c.k2} - 1 = ${c.between2}$ vân sáng của $\\lambda_2$.`,
      ] })
    }
    return steps
  }

  const i = s1.i
  steps.push({ title: `Vị trí vân sáng bậc ${kSel} và vân tối thứ ${kSel}`, lines: [
    `$x_s = k\\,i = ${kSel}\\cdot ${tx(i, 3)} = ${tx(kSel * i, 3)}\\,\\text{mm}$`,
    `$x_t = \\left(k - \\tfrac{1}{2}\\right) i = ${tx(kSel - 0.5, 1)}\\cdot ${tx(i, 3)} = ${tx((kSel - 0.5) * i, 3)}\\,\\text{mm}$`,
  ] })
  const N = countInField(Lmm, i)
  const h = Lmm / 2 / i
  steps.push({ title: `Số vân trên vùng giao thoa L = ${tx(Lmm, 1).replace('{,}', ',')} mm`, lines: [
    `$\\dfrac{L}{2i} = \\dfrac{${tx(Lmm, 1)}}{2\\cdot ${tx(i, 3)}} = ${tx(h, 2)}$`,
    `$N_s = 2\\left\\lfloor \\dfrac{L}{2i} \\right\\rfloor + 1 = ${N.bright}$ vân sáng`,
    `$N_t = 2\\left\\lfloor \\dfrac{L}{2i} + \\dfrac{1}{2} \\right\\rfloor = ${N.dark}$ vân tối`,
  ] })
  if (nStr) {
    steps.push({ title: 'Ảnh hưởng của môi trường', lines: [
      `$\\lambda' = \\dfrac{\\lambda}{n}$ ⇒ $i' = \\dfrac{i_{kk}}{n} = \\dfrac{${tx(i * n, 3)}}{${nStr}} = ${tx(i, 3)}\\,\\text{mm}$ (vân sít lại)`,
    ] })
  }
  return steps
}

const THEORY = [
  ['Điều kiện giao thoa', 'Hai nguồn kết hợp $S_1, S_2$: cùng tần số, độ lệch pha không đổi'],
  ['Hiệu đường đi tại điểm M (toạ độ x)', '$d_2 - d_1 = \\dfrac{a x}{D}$'],
  ['Vân sáng (cực đại)', '$d_2 - d_1 = k\\lambda \\Rightarrow x_s = k\\dfrac{\\lambda D}{a} = k\\,i$'],
  ['Vân tối (cực tiểu)', '$d_2 - d_1 = \\left(k - \\tfrac{1}{2}\\right)\\lambda \\Rightarrow x_t = \\left(k - \\tfrac{1}{2}\\right) i$'],
  ['Khoảng vân', '$i = \\dfrac{\\lambda D}{a}$ ; trong môi trường chiết suất $n$: $i\' = \\dfrac{i}{n}$'],
  ['Đo bước sóng', '$\\lambda = \\dfrac{a\\,i}{D}$ ; đo bề rộng $n$ khoảng vân rồi chia $n$ để giảm sai số'],
  ['Hai bức xạ trùng vân', '$k_1\\lambda_1 = k_2\\lambda_2$'],
  ['Ánh sáng trắng', 'Vân trung tâm trắng; bậc $k$ là dải màu tím trong – đỏ ngoài, rộng $k(i_đ - i_t)$'],
]

export function FormulaModal({ params, kSel, onClose }) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const steps = buildSteps(params, kSel)
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
