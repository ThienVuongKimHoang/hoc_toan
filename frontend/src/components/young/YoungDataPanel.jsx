import React from 'react'
import MathText from '../MathText.jsx'
import YoungMagnifier from './YoungMagnifier.jsx'
import {
  fringeSpacing, fringeAt, countInField, coincidence, spectrumWidth, radiationsAt, pathDiffNm,
  wavelengthToRGB, rgbCss, VIOLET_NM, RED_NM, vn, tx,
} from '../../physics/youngPhysics.js'

/* ─────────────────────────────────────────────────────────────
   Bảng "Số liệu giao thoa" — cột tối bên phải (dùng chung class mp-* với MotionPanel).
   Điểm M: chỗ con trỏ đang rê trên màn; không rê thì lấy đầu phải của thước đo.
───────────────────────────────────────────────────────────── */

const Ico = ({ children, size = 16, sw = 2.2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{children}</svg>
)
const IcoCollapse = p => <Ico {...p}><path d="M13 6l6 6-6 6M5 6l6 6-6 6" /></Ico>
const IcoSun = p => <Ico {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Ico>
const IcoMoon = p => <Ico {...p}><path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z" /></Ico>
const IcoDot = p => <Ico {...p}><circle cx="12" cy="12" r="5" /></Ico>
const Minus = () => <Ico size={14}><path d="M5 12h14" /></Ico>
const Plus = () => <Ico size={14}><path d="M12 5v14M5 12h14" /></Ico>

function Metric({ sym, label, value, unit }) {
  return (
    <div className="mp-metric">
      <span className="mp-metric-label"><i>{sym}</i>{label}</span>
      <span className="mp-metric-value">{value}<em>{unit}</em></span>
    </div>
  )
}

const Swatch = ({ nm }) => <i className="young-swatch" style={{ background: rgbCss(wavelengthToRGB(nm)) }} />
const um = nm => vn(nm / 1000, 3)

function verdictAt(x, params) {
  if (params.mode === 'white') {
    if (Math.abs(x) < 1e-6) return { tone: 'ok', Icon: IcoSun, title: 'Vân sáng trắng trung tâm', note: 'Mọi bức xạ đều cho vân sáng tại x = 0.' }
    const br = radiationsAt(x, params, 'bright')
    return {
      tone: br.length ? 'ok' : 'neutral', Icon: IcoDot,
      title: br.length ? `${br.length} bức xạ cho vân sáng tại M` : 'Không bức xạ nào cho vân sáng tại M',
      list: br,
      note: 'λ = a·x / (k·D) với 0,38 µm ≤ λ ≤ 0,76 µm',
    }
  }
  const lam = params.lambdaNm
  const i = fringeSpacing(lam, params)
  const f = fringeAt(x, i)
  if (params.mode === 'two') {
    const i2 = fringeSpacing(params.lambda2Nm, params)
    const f2 = fringeAt(x, i2)
    const b1 = f.type === 'bright', b2 = f2.type === 'bright'
    if (b1 && b2) return { tone: 'ok', Icon: IcoSun, title: `Vân trùng: sáng bậc ${f.k} (λ₁) và bậc ${f2.k} (λ₂)`, note: 'Hai vân sáng chồng nhau, màu là màu tổng hợp.' }
    if (b1) return { tone: 'ok', Icon: IcoSun, title: `Vân sáng bậc ${f.k} của λ₁`, note: f2.type === 'dark' ? `Đồng thời là vân tối thứ ${f2.k} của λ₂.` : 'Không trùng vân sáng của λ₂.' }
    if (b2) return { tone: 'ok', Icon: IcoSun, title: `Vân sáng bậc ${f2.k} của λ₂`, note: f.type === 'dark' ? `Đồng thời là vân tối thứ ${f.k} của λ₁.` : 'Không trùng vân sáng của λ₁.' }
    if (f.type === 'dark' && f2.type === 'dark') return { tone: 'hold', Icon: IcoMoon, title: `Vân tối của cả hai bức xạ`, note: `Tối thứ ${f.k} (λ₁), tối thứ ${f2.k} (λ₂).` }
    return { tone: 'neutral', Icon: IcoDot, title: 'Không trùng vân sáng nào', note: `x/i₁ = ${vn(f.u, 2)} ; x/i₂ = ${vn(f2.u, 2)}` }
  }
  if (f.type === 'bright') return { tone: 'ok', Icon: IcoSun, title: f.k === 0 ? 'Vân sáng trung tâm' : `Vân sáng bậc ${f.k}`, note: `x = ${f.k}·i ⇒ hiệu quang trình = ${f.k}λ` }
  if (f.type === 'dark') return { tone: 'hold', Icon: IcoMoon, title: `Vân tối thứ ${f.k}`, note: `x = (${f.k} − ½)·i ⇒ hiệu quang trình = ${vn(f.k - 0.5, 1)}λ` }
  return { tone: 'neutral', Icon: IcoDot, title: `Giữa vân sáng bậc ${f.k} và bậc ${f.k + 1}`, note: `x/i = ${vn(f.u, 2)} — không nguyên, không bán nguyên` }
}

export default function YoungDataPanel({ params, ruler, markX = null, kSel, onK, onCollapse, guideHi = [] }) {
  const { mode, aMm, Dm, n, Lmm } = params
  const lam1 = mode === 'white' ? null : params.lambdaNm
  const i1 = lam1 ? fringeSpacing(lam1, params) : null
  const dist = Math.abs(ruler.x2 - ruler.x1)
  const xM = markX ?? ruler.x2
  const fromCursor = markX != null
  const verdict = verdictAt(xM, params)
  const delta = pathDiffNm(xM, params)
  const statusText = mode === 'white' ? 'Ánh sáng trắng · 0,38 – 0,76 µm' : mode === 'two'
    ? `Hai bức xạ · ${um(params.lambdaNm)} & ${um(params.lambda2Nm)} µm` : `Đơn sắc · λ = ${um(params.lambdaNm)} µm`
  const inMedium = Math.abs(n - 1) > 1e-9

  return (
    <aside className="mp young-mp" aria-label="Số liệu giao thoa">
      <header className="mp-head">
        <div className="mp-head-row">
          <h2 className="mp-title">Số liệu giao thoa</h2>
          {onCollapse && <button className="mp-icon-btn" onClick={onCollapse} title="Thu gọn bảng" aria-label="Thu gọn bảng"><IcoCollapse size={16} /></button>}
        </div>
        <span className="mp-status young-status" role="status">
          {lam1 ? <Swatch nm={lam1} /> : <i className="young-swatch young-swatch--white" />}
          {mode === 'two' && <Swatch nm={params.lambda2Nm} />}
          {statusText}
        </span>
      </header>

      <div className="mp-body">
        <section className="mp-sec" aria-label="Khoảng vân và thước đo">
          <div className="mp-hero">
            <div className="mp-hero-cell">
              <span className="mp-hero-label">Khoảng vân{mode === 'two' ? <small>λ₁</small> : mode === 'white' ? <small>0,55 µm</small> : null}</span>
              <span className="mp-hero-value">{vn(i1 ?? fringeSpacing(550, params), 3)}<em>mm</em></span>
            </div>
            <div className="mp-hero-cell">
              <span className="mp-hero-label">Thước đo{i1 ? <small>≈ {vn(dist / i1, 2)} i</small> : null}</span>
              <span className="mp-hero-value">{vn(dist, 2)}<em>mm</em></span>
            </div>
          </div>
          <div className="mp-metrics">
            {mode === 'two' ? (
              <>
                <Metric sym="λ₁" label="Bước sóng 1" value={um(params.lambdaNm)} unit="µm" />
                <Metric sym="i₂" label="Khoảng vân 2" value={vn(fringeSpacing(params.lambda2Nm, params), 3)} unit="mm" />
              </>
            ) : mode === 'mono' ? (
              <>
                <Metric sym="λ" label="Bước sóng" value={um(params.lambdaNm)} unit="µm" />
                <Metric sym="λ'" label={inMedium ? 'Trong môi trường' : 'Trong không khí'} value={um(params.lambdaNm / n)} unit="µm" />
              </>
            ) : (
              <>
                <Metric sym="iₜ" label="Khoảng vân tím" value={vn(fringeSpacing(VIOLET_NM, params), 3)} unit="mm" />
                <Metric sym="i" label="Khoảng vân đỏ" value={vn(fringeSpacing(RED_NM, params), 3)} unit="mm" />
              </>
            )}
            <Metric sym="a" label="Hai khe" value={vn(aMm, 2)} unit="mm" />
            <Metric sym="D" label="Khe → màn" value={vn(Dm, 2)} unit="m" />
          </div>
        </section>

        {/* Vị trí vân bậc k / quang phổ bậc k */}
        <section className="mp-sec" aria-label="Vị trí vân">
          <div className="young-sec-row">
            <h3 className="mp-sec-title">{mode === 'white' ? 'Quang phổ bậc k' : 'Vị trí vân bậc k'}</h3>
            <div className="young-stepper" role="group" aria-label="Chọn bậc k">
              <button onClick={() => onK(Math.max(1, kSel - 1))} disabled={kSel <= 1} aria-label="Giảm k"><Minus /></button>
              <span>k = {kSel}</span>
              <button onClick={() => onK(Math.min(20, kSel + 1))} disabled={kSel >= 20} aria-label="Tăng k"><Plus /></button>
            </div>
          </div>
          <div className="young-rows">
            {mode === 'white' ? (
              <>
                <div><span>Từ (tím) <MathText text={`$k\\,i_t$`} /></span><b>{vn(kSel * fringeSpacing(VIOLET_NM, params), 3)}<em>mm</em></b></div>
                <div><span>Đến (đỏ) <MathText text={`$k\\,i_đ$`} /></span><b>{vn(kSel * fringeSpacing(RED_NM, params), 3)}<em>mm</em></b></div>
                <div><span>Bề rộng quang phổ</span><b>{vn(spectrumWidth(kSel, params), 3)}<em>mm</em></b></div>
              </>
            ) : (
              <>
                <div><span><Swatch nm={lam1} />Vân sáng bậc {kSel} <MathText text="$x_s = k i$" /></span><b>± {vn(kSel * i1, 3)}<em>mm</em></b></div>
                <div><span><i className="young-swatch young-swatch--dark" />Vân tối thứ {kSel} <MathText text="$x_t = (k-\tfrac12) i$" /></span><b>± {vn((kSel - 0.5) * i1, 3)}<em>mm</em></b></div>
                {mode === 'two' && (() => {
                  const i2 = fringeSpacing(params.lambda2Nm, params)
                  return <div><span><Swatch nm={params.lambda2Nm} />Vân sáng bậc {kSel} của λ₂</span><b>± {vn(kSel * i2, 3)}<em>mm</em></b></div>
                })()}
              </>
            )}
          </div>
        </section>

        {/* Điểm M */}
        <section className="mp-sec" aria-label="Điểm M trên màn">
          <h3 className="mp-sec-title">Điểm M {fromCursor ? '' : '(đầu phải thước)'}</h3>
          <div className="mp-metrics young-metrics-top">
            <Metric sym="x" label="Toạ độ" value={vn(xM, 3)} unit="mm" />
            <Metric sym="δ" label="Hiệu đường đi" value={vn(Math.abs(delta) / 1000, 3)} unit="µm" />
          </div>
          <div className={`mp-verdict mp-verdict--${verdict.tone} young-verdict`} aria-live="polite">
            <span className="mp-verdict-ico"><verdict.Icon size={18} /></span>
            <div className="mp-verdict-text">
              <div className="mp-verdict-title">{verdict.title}</div>
              {lam1 && (
                <div className="mp-verdict-math">
                  <MathText text={`$\\dfrac{n\\,\\delta}{\\lambda${mode === 'two' ? '_1' : ''}} = \\dfrac{${tx(n, 2)}\\cdot ${tx(Math.abs(delta) / 1000, 3)}}{${tx(lam1 / 1000, 3)}} = ${tx((n * Math.abs(delta)) / lam1, 2)}$`} />
                </div>
              )}
              {verdict.list && verdict.list.length > 0 && (
                <ul className="young-rad-list">
                  {verdict.list.map(r => (
                    <li key={r.k}><Swatch nm={r.lambdaNm} />k = {r.k}: λ = {um(r.lambdaNm)} µm</li>
                  ))}
                </ul>
              )}
              <div className="mp-verdict-note">{verdict.note}</div>
            </div>
          </div>
        </section>

        <YoungMagnifier params={params} x={xM} guided={guideHi.includes('magnifier')} />

        {/* Vùng giao thoa */}
        <section className="mp-sec" aria-label="Số vân trên vùng giao thoa">
          <h3 className="mp-sec-title">Vùng giao thoa L = {vn(Lmm, 1)} mm</h3>
          {mode === 'mono' && (() => {
            const N = countInField(Lmm, i1)
            return (
              <div className="mp-metrics young-metrics-top">
                <Metric sym="Nₛ" label="Vân sáng" value={N.bright} unit="vân" />
                <Metric sym="Nₜ" label="Vân tối" value={N.dark} unit="vân" />
              </div>
            )
          })()}
          {mode === 'two' && (() => {
            const c = coincidence(params)
            const N1 = countInField(Lmm, i1).bright
            const N2 = countInField(Lmm, fringeSpacing(params.lambda2Nm, params)).bright
            if (c.same) return <p className="young-note">Hai bước sóng bằng nhau — mọi vân đều trùng.</p>
            const Nc = 2 * Math.floor(Lmm / 2 / c.x + 1e-9) + 1
            return (
              <>
                <div className="mp-metrics young-metrics-top">
                  <Metric sym="N₁" label="Vân sáng λ₁" value={N1} unit="vân" />
                  <Metric sym="N₂" label="Vân sáng λ₂" value={N2} unit="vân" />
                  <Metric sym="N≡" label="Vân trùng" value={Nc} unit="vân" />
                  <Metric sym="N" label="Vạch sáng thấy được" value={N1 + N2 - Nc} unit="vạch" />
                </div>
                <p className="young-note">
                  Vân trùng đầu tiên: <MathText text={`$k_1 : k_2 = ${c.k1} : ${c.k2}$`} />, cách vân trung tâm {vn(c.x, 3)} mm.
                  Giữa hai vân trùng liên tiếp có {c.between1} vân của λ₁ và {c.between2} vân của λ₂.
                </p>
              </>
            )
          })()}
          {mode === 'white' && (
            <p className="young-note">
              Quang phổ bậc 1 rộng {vn(spectrumWidth(1, params), 3)} mm. Từ bậc 2 trở đi các quang phổ chồng lên nhau
              (vì <MathText text="$2\lambda_đ > 3\lambda_t$" />), nên chỉ thấy rõ vài dải màu gần vân trung tâm.
            </p>
          )}
        </section>
      </div>
    </aside>
  )
}
